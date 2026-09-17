-- VEHORA — Phase 14 : actions de plateforme sur les abonnements et les flags.
--
-- Changer le plan d'un client et lui ouvrir une fonctionnalité sont des actions
-- sensibles au sens de la fondation 3 : droit vérifié, motif obligatoire, audit
-- systématique, et aucune policy d'écriture qui permettrait de s'en passer.

insert into public.permissions (key, description)
values ('platform.subscriptions.manage',
        'Plateforme : changer le plan d''une organisation et ses dérogations de fonctionnalités')
on conflict (key) do nothing;

-- Le support lit, il ne facture pas (ADR-002) : seul le SUPER_ADMIN l'obtient.
insert into public.role_permissions (role_id, permission_key)
select r.id, 'platform.subscriptions.manage'
  from public.roles r where r.code = 'SUPER_ADMIN'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Changement de plan.
--
-- Le plan précédent est clos, le nouveau ouvert, dans la même transaction :
-- l'index unique interdit deux abonnements en cours, et deux écritures
-- séparées depuis un navigateur peuvent être coupées au milieu — une
-- organisation se retrouverait sans plan, donc sans limite connue.
--
-- Un changement de plan ne casse jamais l'existant : si le nouveau plan est
-- plus étroit que ce que l'organisation utilise déjà, la fonction refuse
-- plutôt que de laisser une station ou un compte hors quota. Les quotas
-- s'appliquent à ce qu'on ajoute, pas rétroactivement à ce qui tourne.
-- ---------------------------------------------------------------------------
create or replace function public.changer_plan(
  p_organization_id uuid,
  p_plan_code       text,
  p_motif           text
)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org      public.organizations;
  v_plan     public.plans;
  v_ancien   public.subscriptions;
  v_nouveau  public.subscriptions;
  v_stations bigint;
  v_membres  bigint;
begin
  if not vehora.is_platform_admin()
     or not vehora.has_permission('platform.subscriptions.manage') then
    raise exception 'VEHORA_PLATEFORME_REFUSEE: cette action est réservée à la plateforme'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_motif), '') = '' then
    raise exception 'VEHORA_MOTIF_REQUIS: changer un plan exige un motif'
      using errcode = 'check_violation';
  end if;

  select * into v_org from public.organizations
   where id = p_organization_id and is_platform = false for update;
  if v_org.id is null then
    raise exception 'VEHORA_ORGANISATION_INTROUVABLE: cette organisation n''existe pas'
      using errcode = 'check_violation';
  end if;

  select * into v_plan from public.plans where code = p_plan_code;
  if v_plan.id is null then
    raise exception 'VEHORA_PLAN_INTROUVABLE: ce plan n''existe pas'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_stations from public.stations where organization_id = v_org.id;
  select count(*) into v_membres from public.organization_memberships
   where organization_id = v_org.id and status = 'ACTIVE';

  if v_plan.max_stations is not null and v_stations > v_plan.max_stations then
    raise exception 'VEHORA_PLAN_TROP_ETROIT: % stations ouvertes, le plan % en autorise %',
      v_stations, v_plan.label, v_plan.max_stations using errcode = 'check_violation';
  end if;
  if v_plan.max_users is not null and v_membres > v_plan.max_users then
    raise exception 'VEHORA_PLAN_TROP_ETROIT: % comptes actifs, le plan % en autorise %',
      v_membres, v_plan.label, v_plan.max_users using errcode = 'check_violation';
  end if;

  select * into v_ancien from public.subscriptions
   where organization_id = v_org.id
     and status in ('TRIAL', 'ACTIVE', 'PAST_DUE')
   for update;

  if v_ancien.id is not null then
    if v_ancien.plan_id = v_plan.id then
      raise exception 'VEHORA_PLAN_INCHANGE: cette organisation est déjà sur ce plan'
        using errcode = 'check_violation';
    end if;
    update public.subscriptions
       set status = 'CANCELLED', ends_at = now(), updated_at = now()
     where id = v_ancien.id;
  end if;

  insert into public.subscriptions (organization_id, plan_id, status)
  values (v_org.id, v_plan.id, 'ACTIVE')
  returning * into v_nouveau;

  perform vehora.write_audit_log(
    'platform.subscription.change', 'subscription', v_nouveau.id::text,
    v_org.id, null,
    case when v_ancien.id is null then null
         else jsonb_build_object('plan', (select code from public.plans where id = v_ancien.plan_id),
                                 'statut', v_ancien.status) end,
    jsonb_build_object('plan', v_plan.code, 'statut', 'ACTIVE', 'organisation', v_org.name),
    p_motif);

  return v_nouveau;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dérogation de fonctionnalité pour une organisation.
--
-- `p_actif = null` retire la dérogation : l'organisation revient à ce que son
-- plan dit. C'est le seul moyen de revenir en arrière sans deviner quelle
-- valeur « remettre ».
-- ---------------------------------------------------------------------------
create or replace function public.basculer_fonctionnalite(
  p_organization_id uuid,
  p_cle             text,
  p_actif           boolean,
  p_motif           text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     public.organizations;
  v_avant   boolean;
  v_apres   boolean;
begin
  if not vehora.is_platform_admin()
     or not vehora.has_permission('platform.subscriptions.manage') then
    raise exception 'VEHORA_PLATEFORME_REFUSEE: cette action est réservée à la plateforme'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_motif), '') = '' then
    raise exception 'VEHORA_MOTIF_REQUIS: ouvrir ou fermer une fonctionnalité exige un motif'
      using errcode = 'check_violation';
  end if;

  select * into v_org from public.organizations
   where id = p_organization_id and is_platform = false;
  if v_org.id is null then
    raise exception 'VEHORA_ORGANISATION_INTROUVABLE: cette organisation n''existe pas'
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.feature_flags where key = p_cle) then
    raise exception 'VEHORA_FONCTIONNALITE_INCONNUE: cette fonctionnalité n''existe pas'
      using errcode = 'check_violation';
  end if;

  v_avant := vehora.flag_actif(p_cle, v_org.id);

  if p_actif is null then
    delete from public.organization_feature_overrides
     where organization_id = v_org.id and flag_key = p_cle;
  else
    insert into public.organization_feature_overrides (organization_id, flag_key, enabled, reason)
    values (v_org.id, p_cle, p_actif, p_motif)
    on conflict (organization_id, flag_key)
      do update set enabled = excluded.enabled, reason = excluded.reason;
  end if;

  v_apres := vehora.flag_actif(p_cle, v_org.id);

  perform vehora.write_audit_log(
    'platform.feature.toggle', 'feature_flag', p_cle,
    v_org.id, null,
    jsonb_build_object('actif', v_avant),
    jsonb_build_object('actif', v_apres, 'derogation', p_actif, 'organisation', v_org.name),
    p_motif);

  return v_apres;
end;
$$;

revoke execute on function public.changer_plan(uuid, text, text) from public, anon;
grant execute on function public.changer_plan(uuid, text, text) to authenticated;
revoke execute on function public.basculer_fonctionnalite(uuid, text, boolean, text) from public, anon;
grant execute on function public.basculer_fonctionnalite(uuid, text, boolean, text) to authenticated;

comment on function public.changer_plan is
  'Change le plan d''une organisation : clôt l''abonnement en cours et en ouvre un nouveau dans la même transaction. Refuse un plan plus étroit que l''usage réel. SECURITY DEFINER ; vérifie le rôle de plateforme, exige un motif, audite.';

-- ---------------------------------------------------------------------------
-- Vue de plateforme : le plan de chaque organisation.
--
-- Même règle qu'en phase 12 : garde-fou dans le corps, agrégats seulement,
-- aucun chiffre d'affaires client.
-- ---------------------------------------------------------------------------
create view public.platform_subscriptions as
select
  o.id as organization_id,
  o.name as organisation,
  p.code as plan_code,
  p.label as plan_label,
  p.price_minor,
  p.currency,
  p.max_stations,
  p.max_users,
  s.status,
  s.started_at,
  s.trial_ends_at,
  (select count(*) from public.stations st where st.organization_id = o.id) as stations_utilisees,
  (select count(*) from public.organization_memberships m
    where m.organization_id = o.id and m.status = 'ACTIVE')                 as membres_actifs
from public.organizations o
join public.subscriptions s
  on s.organization_id = o.id and s.status in ('TRIAL', 'ACTIVE', 'PAST_DUE')
join public.plans p on p.id = s.plan_id
where o.is_platform = false
  and vehora.is_platform_admin();

comment on view public.platform_subscriptions is
  'Plan en cours et consommation de chaque organisation cliente. Réservée aux rôles de plateforme par le filtre de son corps. Ne contient aucun chiffre d''affaires client — seulement le prix du plan, qui est un revenu VEHORA.';

revoke all on public.platform_subscriptions from anon;

-- ---------------------------------------------------------------------------
-- Un flag qui n'empêche rien n'est pas un flag.
--
-- Les rapports sont la première fonctionnalité derrière un plan. La vérification
-- est ajoutée DANS les fonctions de rapport : masquer l'écran ne ferme pas
-- l'API, et c'est l'API qui rend le chiffre.
-- ---------------------------------------------------------------------------
create or replace function public.rapport_journalier(
  p_debut   date,
  p_fin     date,
  p_station uuid default null
)
returns table (
  jour              date,
  station_id        uuid,
  station_nom       text,
  dossiers_livres   bigint,
  encaisse_minor    bigint,
  especes_minor     bigint,
  mobile_minor      bigint,
  autres_minor      bigint,
  panier_moyen_minor bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not vehora.has_permission('reports.read') then
    raise exception 'VEHORA_PERMISSION: consulter les rapports exige la permission reports.read'
      using errcode = 'insufficient_privilege';
  end if;

  if not vehora.flag_actif('rapports') then
    raise exception 'VEHORA_FONCTIONNALITE_FERMEE: les rapports ne sont pas inclus dans votre plan'
      using errcode = 'insufficient_privilege';
  end if;

  if p_fin < p_debut then
    raise exception 'VEHORA_PERIODE_INVALIDE: la fin de période précède son début'
      using errcode = 'check_violation';
  end if;

  if p_fin - p_debut > 366 then
    raise exception 'VEHORA_PERIODE_TROP_LONGUE: 366 jours au maximum par rapport'
      using errcode = 'check_violation';
  end if;

  return query
  with encaissements as (
    select
      (p.created_at at time zone coalesce(o.timezone, 'UTC'))::date as jour,
      p.station_id,
      sum(case when p.kind = 'REFUND' then -p.amount_minor else p.amount_minor end) as encaisse,
      sum(case when p.method = 'CASH'
               then (case when p.kind = 'REFUND' then -p.amount_minor else p.amount_minor end)
               else 0 end) as especes,
      sum(case when p.method = 'MOBILE_MONEY'
               then (case when p.kind = 'REFUND' then -p.amount_minor else p.amount_minor end)
               else 0 end) as mobile,
      sum(case when p.method not in ('CASH', 'MOBILE_MONEY')
               then (case when p.kind = 'REFUND' then -p.amount_minor else p.amount_minor end)
               else 0 end) as autres
      from public.payments p
      join public.organizations o on o.id = p.organization_id
     where p.status = 'COMPLETED'
       and (p_station is null or p.station_id = p_station)
       and (p.created_at at time zone coalesce(o.timezone, 'UTC'))::date between p_debut and p_fin
     group by 1, 2
  ),
  restitutions as (
    select
      (d.delivered_at at time zone coalesce(o.timezone, 'UTC'))::date as jour,
      d.station_id,
      count(*) as livres
      from public.service_orders d
      join public.organizations o on o.id = d.organization_id
     where d.status = 'DELIVERED'
       and d.delivered_at is not null
       and (p_station is null or d.station_id = p_station)
       and (d.delivered_at at time zone coalesce(o.timezone, 'UTC'))::date between p_debut and p_fin
     group by 1, 2
  )
  select
    coalesce(e.jour, r.jour),
    coalesce(e.station_id, r.station_id),
    s.name,
    coalesce(r.livres, 0)::bigint,
    coalesce(e.encaisse, 0)::bigint,
    coalesce(e.especes, 0)::bigint,
    coalesce(e.mobile, 0)::bigint,
    coalesce(e.autres, 0)::bigint,
    case when coalesce(r.livres, 0) = 0 then 0
         else (coalesce(e.encaisse, 0) / r.livres)::bigint end
  from encaissements e
  full outer join restitutions r on r.jour = e.jour and r.station_id = e.station_id
  join public.stations s on s.id = coalesce(e.station_id, r.station_id)
  order by 1 desc, 3;
end;
$$;

create or replace function public.rapport_prestations(
  p_debut   date,
  p_fin     date,
  p_station uuid default null
)
returns table (
  prestation      text,
  quantite        bigint,
  montant_minor   bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not vehora.has_permission('reports.read') then
    raise exception 'VEHORA_PERMISSION: consulter les rapports exige la permission reports.read'
      using errcode = 'insufficient_privilege';
  end if;

  if not vehora.flag_actif('rapports') then
    raise exception 'VEHORA_FONCTIONNALITE_FERMEE: les rapports ne sont pas inclus dans votre plan'
      using errcode = 'insufficient_privilege';
  end if;

  if p_fin < p_debut or p_fin - p_debut > 366 then
    raise exception 'VEHORA_PERIODE_INVALIDE: période absente ou trop longue'
      using errcode = 'check_violation';
  end if;

  return query
  select
    i.service_name,
    sum(i.quantity)::bigint,
    sum(i.line_total_minor)::bigint
    from public.service_order_items i
    join public.service_orders d on d.id = i.service_order_id
    join public.organizations o on o.id = d.organization_id
   where d.status = 'DELIVERED'
     and d.delivered_at is not null
     and (p_station is null or d.station_id = p_station)
     and (d.delivered_at at time zone coalesce(o.timezone, 'UTC'))::date between p_debut and p_fin
   group by i.service_name
   order by 3 desc, 1;
end;
$$;

revoke execute on function public.rapport_journalier(date, date, uuid) from public, anon;
grant execute on function public.rapport_journalier(date, date, uuid) to authenticated;
revoke execute on function public.rapport_prestations(date, date, uuid) from public, anon;
grant execute on function public.rapport_prestations(date, date, uuid) to authenticated;
