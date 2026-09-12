-- VEHORA — Phase 4 : opérations privilégiées d'approvisionnement.
--
-- Créer une organisation et accepter une invitation ne peuvent pas passer par
-- un simple INSERT : la première n'a volontairement aucune policy, et la
-- seconde doit lire une invitation que l'invité n'a pas le droit de lire.
--
-- Ces deux opérations passent donc par des fonctions `SECURITY DEFINER`, qui
-- vérifient elles-mêmes leurs conditions et écrivent dans `audit_logs`.
-- Aucune clé `service_role` n'est nécessaire : tout est dans la base.

-- ---------------------------------------------------------------------------
-- Fabrique un identifiant d'URL lisible et unique à partir du nom.
-- ---------------------------------------------------------------------------
create or replace function vehora.slug_organisation(p_nom text)
returns text language plpgsql stable set search_path = '' as $$
declare
  v_base    text;
  v_essai   text;
  v_suffixe integer := 0;
begin
  -- Translittération du français : « Lavage Thiès » -> « lavage-thies ».
  v_base := lower(trim(p_nom));
  v_base := translate(v_base,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then
    v_base := 'organisation';
  end if;
  v_base := left(v_base, 40);

  v_essai := v_base;
  while exists (select 1 from public.organizations where slug = v_essai) loop
    v_suffixe := v_suffixe + 1;
    v_essai := v_base || '-' || v_suffixe;
  end loop;

  return v_essai;
end;
$$;

-- ---------------------------------------------------------------------------
-- Création d'une organisation par son futur propriétaire.
-- ---------------------------------------------------------------------------
create or replace function public.provisionner_organisation(
  p_nom           text,
  p_pays          text,
  p_ville         text default null,
  p_nom_station   text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profil  uuid := vehora.current_profile_id();
  v_org     uuid;
  v_role    uuid;
begin
  if v_profil is null then
    raise exception 'VEHORA_NON_AUTHENTIFIE: connexion requise'
      using errcode = 'insufficient_privilege';
  end if;

  -- Un compte ne crée qu'une organisation. Sans cette limite, n'importe quel
  -- compte pourrait en créer en masse : la table est publique en écriture par
  -- cette fonction, c'est donc ici que la limite doit vivre.
  if exists (
    select 1 from public.organization_memberships
     where profile_id = v_profil and status = 'ACTIVE'
  ) then
    raise exception 'VEHORA_DEJA_MEMBRE: ce compte appartient déjà à une organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if length(trim(coalesce(p_nom, ''))) < 2 then
    raise exception 'VEHORA_NOM_INVALIDE: le nom de l''entreprise est requis'
      using errcode = 'check_violation';
  end if;

  if p_pays !~ '^[A-Z]{2}$' then
    raise exception 'VEHORA_PAYS_INVALIDE: code pays ISO attendu (ex. SN)'
      using errcode = 'check_violation';
  end if;

  insert into public.organizations (name, slug, country_code, city, status)
  values (left(trim(p_nom), 120), vehora.slug_organisation(p_nom), p_pays,
          nullif(trim(coalesce(p_ville, '')), ''), 'TRIAL')
  returning id into v_org;

  insert into public.organization_settings (organization_id) values (v_org);

  select id into v_role from public.roles where code = 'OWNER';
  insert into public.organization_memberships (profile_id, organization_id, role_id)
  values (v_profil, v_org, v_role);

  -- Une organisation sans station ne peut rien faire : on en crée une par
  -- défaut, renommable ensuite.
  insert into public.stations (organization_id, name, city)
  values (v_org, coalesce(nullif(trim(coalesce(p_nom_station, '')), ''), 'Station principale'),
          nullif(trim(coalesce(p_ville, '')), ''));

  perform vehora.write_audit_log(
    'organization.provisioned', 'organization', v_org::text, v_org, null,
    null, jsonb_build_object('name', p_nom, 'country', p_pays));

  return v_org;
end;
$$;

revoke all on function public.provisionner_organisation(text, text, text, text) from public, anon;
grant execute on function public.provisionner_organisation(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Acceptation d'une invitation.
-- ---------------------------------------------------------------------------
create or replace function public.accepter_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profil     uuid := vehora.current_profile_id();
  v_email      text;
  v_invitation record;
  v_membership uuid;
begin
  if v_profil is null then
    raise exception 'VEHORA_NON_AUTHENTIFIE: connexion requise'
      using errcode = 'insufficient_privilege';
  end if;

  select lower(email) into v_email from auth.users where id = v_profil;

  select * into v_invitation
    from public.organization_invitations
   where token = p_token
   for update;

  -- Message volontairement identique pour « jeton inconnu » et « destinataire
  -- différent » : sinon on confirmerait l'existence d'une invitation à qui
  -- essaie des jetons au hasard.
  if v_invitation.id is null or lower(v_invitation.email) <> v_email then
    raise exception 'VEHORA_INVITATION_INTROUVABLE: invitation inconnue ou destinée à une autre adresse'
      using errcode = 'no_data_found';
  end if;

  if v_invitation.status <> 'PENDING' then
    raise exception 'VEHORA_INVITATION_UTILISEE: cette invitation a déjà été utilisée ou révoquée'
      using errcode = 'check_violation';
  end if;

  if v_invitation.expires_at < now() then
    update public.organization_invitations set status = 'EXPIRED' where id = v_invitation.id;
    raise exception 'VEHORA_INVITATION_EXPIREE: cette invitation a expiré'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.organization_memberships
     where profile_id = v_profil and organization_id = v_invitation.organization_id
  ) then
    raise exception 'VEHORA_DEJA_MEMBRE: ce compte appartient déjà à cette organisation'
      using errcode = 'unique_violation';
  end if;

  insert into public.organization_memberships (profile_id, organization_id, role_id, invited_by)
  values (v_profil, v_invitation.organization_id, v_invitation.role_id, v_invitation.invited_by)
  returning id into v_membership;

  update public.organization_invitations
     set status = 'ACCEPTED', accepted_by = v_profil, accepted_at = now()
   where id = v_invitation.id;

  perform vehora.write_audit_log(
    'invitation.accepted', 'organization_membership', v_membership::text,
    v_invitation.organization_id, null, null,
    jsonb_build_object('invitation_id', v_invitation.id, 'email', v_email));

  return v_invitation.organization_id;
end;
$$;

revoke all on function public.accepter_invitation(text) from public, anon;
grant execute on function public.accepter_invitation(text) to authenticated;
