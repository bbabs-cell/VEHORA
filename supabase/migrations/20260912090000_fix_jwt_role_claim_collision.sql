-- VEHORA — Phase 1 : correction d'une collision de claim JWT. CRITIQUE.
--
-- Constat. Supabase place dans chaque JWT un claim `role` valant
-- `authenticated` (ou `anon`). PostgREST s'en sert pour déterminer le RÔLE
-- POSTGRESQL de la session : `set role <claim role>`.
--
-- Notre hook écrasait ce claim avec le code de rôle métier (`OWNER`,
-- `CASHIER`, …). PostgREST aurait donc tenté `set role OWNER` — un rôle qui
-- n'existe pas en base. Toutes les requêtes API auraient été rejetées, ou
-- pire, exécutées avec un rôle inattendu.
--
-- Le bug n'était pas visible dans le test de la phase 1 : l'événement simulé ne
-- contenait pas le claim `role` de Supabase, seulement `sub`. Il ne serait
-- apparu qu'à la première connexion réelle.
--
-- Correction : le rôle métier est publié sous `vehora_role`. Le claim `role` de
-- Supabase n'est plus jamais touché. Règle générale : ne jamais réutiliser un
-- nom de claim réservé (`role`, `sub`, `aud`, `exp`, `iat`, `iss`, `email`,
-- `phone`, `session_id`, `aal`, `amr`, `is_anonymous`).

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
  select m.id, m.organization_id, r.code as role_code, r.scope as role_scope
    into v_membership
    from public.organization_memberships m
    join public.roles r on r.id = m.role_id
   where m.profile_id = v_profile_id
     and m.status = 'ACTIVE'
   order by
     (m.organization_id::text = coalesce(v_claims -> 'user_metadata' ->> 'active_org_id', '')) desc,
     m.created_at asc
   limit 1;

  if v_membership.id is null then
    -- Compte sans adhésion active : aucun accès aux données métier.
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
