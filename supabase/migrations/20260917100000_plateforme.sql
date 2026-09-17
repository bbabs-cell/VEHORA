-- VEHORA — Phase 12 : espace Super Admin (fondation 3, ADR-002).
--
-- La règle la plus importante de cette fondation : le Super Admin n'a AUCUNE
-- policy de lecture sur les tables métier des clients. Pas de
-- `or vehora.is_platform_admin()` sur `service_orders`, `payments`,
-- `customers`. Ce serait un contournement unique, global et silencieux de tout
-- le cloisonnement multi-tenant — invisible dans les journaux, puisqu'il
-- emprunterait le chemin normal.
--
-- Il pilote la plateforme par des vues d'agrégats et des fonctions privilégiées
-- qui vérifient leurs droits et auditent. Rien d'autre.

-- ---------------------------------------------------------------------------
-- L'organisation de plateforme.
--
-- Un rôle de portée PLATFORM est attribué comme les autres : par une adhésion.
-- Une adhésion exige une organisation. VEHORA a donc la sienne — marquée comme
-- telle, pour qu'elle n'apparaisse jamais dans la liste des clients.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column is_platform boolean not null default false;

comment on column public.organizations.is_platform is
  'Organisation technique de VEHORA, porteuse des adhésions de plateforme. Jamais un client.';

insert into public.organizations (name, slug, country_code, city, status, is_platform)
values ('VEHORA', 'vehora-platform', 'SN', 'Dakar', 'ACTIVE', true)
on conflict (slug) do nothing;

insert into public.organization_settings (organization_id)
select id from public.organizations where slug = 'vehora-platform'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Vues de plateforme.
--
-- Elles NE sont PAS en `security_invoker` : le Super Admin n'ayant aucune
-- policy sur les tables clientes, une vue en droits d'appelant ne renverrait
-- rien. Elles s'exécutent donc avec les droits de leur propriétaire et portent
-- le garde-fou dans leur corps. Deux propriétés rendent cela vérifiable : le
-- filtre est écrit une seule fois, au même endroit que la requête, et ces vues
-- ne renvoient que des agrégats — jamais une ligne de dossier ou de paiement.
--
-- Ce qu'elles n'exposent pas, volontairement : le chiffre d'affaires des
-- organisations. La plateforme a besoin de savoir si un client est vivant, pas
-- combien il gagne. Le CA appartient au client ; les revenus de VEHORA sont ses
-- abonnements, et vivront dans leurs propres tables.
-- ---------------------------------------------------------------------------
create view public.platform_organizations as
select
  o.id,
  o.name,
  o.slug,
  o.country_code,
  o.city,
  o.status,
  o.currency,
  o.created_at,
  (select count(*) from public.stations s where s.organization_id = o.id) as stations,
  (select count(*) from public.organization_memberships m
    where m.organization_id = o.id and m.status = 'ACTIVE')                as membres_actifs,
  (select count(*) from public.vehicles v
    where v.organization_id = o.id and v.archived_at is null)              as vehicules,
  (select count(*) from public.service_orders d
    where d.organization_id = o.id)                                       as dossiers,
  (select count(*) from public.service_orders d
    where d.organization_id = o.id and d.arrived_at > now() - interval '30 days')
                                                                          as dossiers_30j,
  (select max(d.arrived_at) from public.service_orders d
    where d.organization_id = o.id)                                       as derniere_activite
from public.organizations o
where o.is_platform = false
  and vehora.is_platform_admin();

comment on view public.platform_organizations is
  'Métadonnées et volumes des organisations clientes. Réservée aux rôles de plateforme par le filtre de son corps. N''expose aucune donnée métier ligne à ligne, ni aucun chiffre d''affaires.';

-- Journal de la plateforme : ses propres actions, pas celles des clients.
-- Un Super Admin n'a pas à lire le motif d'une remise accordée chez un client.
create view public.platform_audit_logs as
select
  a.id,
  a.occurred_at,
  a.actor_label,
  a.organization_id,
  a.action,
  a.resource_type,
  a.resource_id,
  a.old_value,
  a.new_value,
  a.reason
from public.audit_logs a
where a.action like 'platform.%'
  and vehora.is_platform_admin();

comment on view public.platform_audit_logs is
  'Journal des actions de plateforme uniquement. Le journal métier d''une organisation reste à l''organisation.';

-- ---------------------------------------------------------------------------
-- Suspension et réactivation.
--
-- Écrire `status = 'SUSPENDED'` ne coupe rien par soi-même : aucune policy ne
-- lit ce statut, et aucune ne doit le lire — ce serait une sous-requête par
-- ligne, exactement ce que la fondation 3 interdit.
--
-- La suspension agit donc sur deux temps :
--   immédiatement      une ligne de `session_revocations` par membre, que
--                      `vehora.can_write()` consulte déjà : toute écriture est
--                      refusée dans la seconde ;
--   au renouvellement  le custom access token hook refuse d'émettre des claims
--                      pour une organisation suspendue : la lecture s'arrête
--                      aussi, au plus tard au bout d'un cycle de token.
--
-- SECURITY DEFINER plutôt qu'Edge Function : mêmes garanties (droit vérifié,
-- audit obligatoire, verrou de ligne), testable par la suite SQL existante,
-- aucune surface de déploiement ajoutée. Amendement documenté en fondation 3.
-- ---------------------------------------------------------------------------
create or replace function public.suspendre_organisation(
  p_organization_id uuid,
  p_motif           text
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if not vehora.is_platform_admin()
     or not vehora.has_permission('platform.organizations.suspend') then
    raise exception 'VEHORA_PLATEFORME_REFUSEE: cette action est réservée à la plateforme'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_motif), '') = '' then
    raise exception 'VEHORA_MOTIF_REQUIS: suspendre une organisation exige un motif'
      using errcode = 'check_violation';
  end if;

  select * into v_org from public.organizations
   where id = p_organization_id and is_platform = false for update;

  if v_org.id is null then
    raise exception 'VEHORA_ORGANISATION_INTROUVABLE: cette organisation n''existe pas'
      using errcode = 'check_violation';
  end if;

  if v_org.status = 'SUSPENDED' then
    raise exception 'VEHORA_DEJA_SUSPENDUE: cette organisation est déjà suspendue'
      using errcode = 'check_violation';
  end if;

  update public.organizations set status = 'SUSPENDED' where id = v_org.id
    returning * into v_org;

  -- Effet immédiat : plus aucune écriture, sans attendre le renouvellement.
  insert into public.session_revocations (profile_id, reason)
  select m.profile_id, 'Organisation suspendue'
    from public.organization_memberships m
   where m.organization_id = v_org.id
  on conflict (profile_id) do update set revoked_at = now(),
                                         reason = 'Organisation suspendue';

  perform vehora.write_audit_log(
    'platform.organization.suspend', 'organization', v_org.id::text,
    v_org.id, null,
    jsonb_build_object('status', 'ACTIVE'),
    jsonb_build_object('status', 'SUSPENDED', 'nom', v_org.name),
    p_motif);

  return v_org;
end;
$$;

create or replace function public.reactiver_organisation(
  p_organization_id uuid,
  p_motif           text
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if not vehora.is_platform_admin()
     or not vehora.has_permission('platform.organizations.suspend') then
    raise exception 'VEHORA_PLATEFORME_REFUSEE: cette action est réservée à la plateforme'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_motif), '') = '' then
    raise exception 'VEHORA_MOTIF_REQUIS: réactiver une organisation exige un motif'
      using errcode = 'check_violation';
  end if;

  select * into v_org from public.organizations
   where id = p_organization_id and is_platform = false for update;

  if v_org.id is null then
    raise exception 'VEHORA_ORGANISATION_INTROUVABLE: cette organisation n''existe pas'
      using errcode = 'check_violation';
  end if;

  if v_org.status <> 'SUSPENDED' then
    raise exception 'VEHORA_NON_SUSPENDUE: cette organisation n''est pas suspendue'
      using errcode = 'check_violation';
  end if;

  update public.organizations set status = 'ACTIVE' where id = v_org.id
    returning * into v_org;

  -- On ne lève que les révocations posées par la suspension : celles décidées
  -- pour une autre raison (compte compromis) doivent survivre.
  delete from public.session_revocations r
   where r.reason = 'Organisation suspendue'
     and exists (select 1 from public.organization_memberships m
                  where m.profile_id = r.profile_id
                    and m.organization_id = v_org.id);

  perform vehora.write_audit_log(
    'platform.organization.reactivate', 'organization', v_org.id::text,
    v_org.id, null,
    jsonb_build_object('status', 'SUSPENDED'),
    jsonb_build_object('status', 'ACTIVE', 'nom', v_org.name),
    p_motif);

  return v_org;
end;
$$;

revoke execute on function public.suspendre_organisation(uuid, text) from public, anon;
grant execute on function public.suspendre_organisation(uuid, text) to authenticated;
revoke execute on function public.reactiver_organisation(uuid, text) from public, anon;
grant execute on function public.reactiver_organisation(uuid, text) to authenticated;

comment on function public.suspendre_organisation is
  'Suspend une organisation : statut, révocation immédiate de toutes ses sessions, audit. SECURITY DEFINER ; vérifie elle-même le rôle de plateforme et la permission. Ne pas révoquer son EXECUTE à `authenticated`.';

-- ---------------------------------------------------------------------------
-- Le hook refuse d'émettre des claims pour une organisation suspendue.
--
-- Sans cela, une suspension bloquerait les écritures (par la révocation) mais
-- laisserait la lecture ouverte indéfiniment, token après token.
-- ---------------------------------------------------------------------------
create or replace function vehora.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id  uuid := (event ->> 'user_id')::uuid;
  v_claims      jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_membership  record;
  v_permissions jsonb;
  v_stations    jsonb;
begin
  -- Seules les organisations en TRIAL ou ACTIVE ouvrent des droits. Une
  -- organisation suspendue, expirée ou désactivée n'en ouvre aucun.
  select m.id, m.organization_id, r.code as role_code, r.scope as role_scope
    into v_membership
    from public.organization_memberships m
    join public.roles r on r.id = m.role_id
    join public.organizations o on o.id = m.organization_id
   where m.profile_id = v_profile_id
     and m.status = 'ACTIVE'
     and o.status in ('TRIAL', 'ACTIVE')
   order by
     (m.organization_id::text = coalesce(v_claims -> 'user_metadata' ->> 'active_org_id', '')) desc,
     m.created_at asc
   limit 1;

  if v_membership.id is null then
    v_claims := v_claims
      || jsonb_build_object(
           'org_id', null,
           'vehora_role', null,
           'role_scope', null,
           'station_ids', '[]'::jsonb,
           'permissions', '[]'::jsonb,
           'is_platform_admin', false
         );
    return jsonb_set(event, '{claims}', v_claims);
  end if;

  select coalesce(jsonb_agg(rp.permission_key), '[]'::jsonb)
    into v_permissions
    from public.role_permissions rp
    join public.organization_memberships m on m.role_id = rp.role_id
   where m.id = v_membership.id;

  select coalesce(jsonb_agg(su.station_id::text), '[]'::jsonb)
    into v_stations
    from public.station_users su
   where su.membership_id = v_membership.id;

  v_claims := v_claims
    || jsonb_build_object(
         'org_id', v_membership.organization_id,
         'vehora_role', v_membership.role_code,
         'role_scope', v_membership.role_scope,
         'station_ids', v_stations,
         'permissions', v_permissions,
         'is_platform_admin', v_membership.role_scope = 'PLATFORM'
       );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

grant execute on function vehora.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function vehora.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on public.organizations to supabase_auth_admin;
