-- VEHORA — Phase 4 : code d'erreur correct pour une invitation refusée.
--
-- Constat. `no_data_found` (P0002) est traduit par PostgREST en HTTP 500.
-- Un jeton inconnu ou destiné à quelqu'un d'autre n'est pas une panne : c'est
-- un refus. Remonter 500 polluerait la supervision d'erreurs qui n'en sont pas,
-- et masquerait les vraies pannes au milieu du bruit.
--
-- Correction : `insufficient_privilege` (42501), traduit en HTTP 403.
-- Le message reste volontairement identique dans les deux cas, pour ne pas
-- confirmer l'existence d'une invitation à qui essaie des jetons au hasard.

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

  if v_invitation.id is null or lower(v_invitation.email) <> v_email then
    raise exception 'VEHORA_INVITATION_INTROUVABLE: invitation inconnue ou destinée à une autre adresse'
      using errcode = 'insufficient_privilege';
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
      using errcode = 'check_violation';
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

-- ---------------------------------------------------------------------------
-- Intention documentée dans la base : l'advisor Supabase signale ces deux
-- fonctions comme « SECURITY DEFINER appelable par un utilisateur connecté ».
-- C'est volontaire — ce sont les points d'entrée privilégiés du produit — et
-- chacune vérifie elle-même ses conditions. Révoquer EXECUTE casserait
-- l'inscription et les invitations.
-- ---------------------------------------------------------------------------

comment on function public.provisionner_organisation(text, text, text, text) is
  'Point d''entrée privilégié VOLONTAIREMENT exposé aux utilisateurs connectés : '
  'créer une organisation ne peut pas passer par une policy. La fonction vérifie '
  'elle-même ses conditions (compte sans adhésion active, nom et pays valides) et '
  'écrit dans audit_logs. Ne pas révoquer EXECUTE : cela casserait l''inscription.';

comment on function public.accepter_invitation(text) is
  'Point d''entrée privilégié VOLONTAIREMENT exposé aux utilisateurs connectés : '
  'l''invité n''a pas le droit de lire l''invitation qu''il accepte. La fonction '
  'vérifie le jeton, l''adresse e-mail, le statut et l''expiration, et écrit dans '
  'audit_logs. Ne pas révoquer EXECUTE : cela casserait les invitations.';
