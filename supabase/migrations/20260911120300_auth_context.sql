-- VEHORA — Phase 0 : contexte d'authentification dans le JWT (ADR-001).
-- Les policies RLS lisent des claims, pas des jointures : pas de récursion,
-- pas de sous-requête réexécutée par ligne.

-- ---------------------------------------------------------------------------
-- Lecteurs de claims. STABLE : évalués une fois par requête, pas par ligne.
-- ---------------------------------------------------------------------------

create or replace function vehora.jwt_claims()
returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- Organisation active de l'utilisateur courant.
create or replace function vehora.current_org_id()
returns uuid language sql stable as $$
  select nullif(vehora.jwt_claims() ->> 'org_id', '')::uuid;
$$;

create or replace function vehora.current_profile_id()
returns uuid language sql stable as $$
  select nullif(vehora.jwt_claims() ->> 'sub', '')::uuid;
$$;

create or replace function vehora.is_platform_admin()
returns boolean language sql stable as $$
  select coalesce((vehora.jwt_claims() ->> 'is_platform_admin')::boolean, false);
$$;

-- Une session d'assistance interdit toute écriture (ADR-003).
create or replace function vehora.is_impersonating()
returns boolean language sql stable as $$
  select nullif(vehora.jwt_claims() ->> 'impersonation_session_id', '') is not null;
$$;

create or replace function vehora.has_permission(p_key text)
returns boolean language sql stable as $$
  select coalesce(
    vehora.jwt_claims() -> 'permissions' ? p_key,
    false
  );
$$;

-- Un rôle de portée ORGANIZATION couvre toutes les stations ; un rôle de portée
-- STATION est limité à ses affectations.
create or replace function vehora.can_access_station(p_station_id uuid)
returns boolean language sql stable as $$
  select case
    when p_station_id is null then true
    when coalesce(vehora.jwt_claims() ->> 'role_scope', '') <> 'STATION' then true
    else coalesce(
      vehora.jwt_claims() -> 'station_ids' ? p_station_id::text,
      false
    )
  end;
$$;

-- Révocation immédiate, pour les opérations sensibles uniquement (ADR-001).
create or replace function vehora.is_revoked()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.session_revocations
     where profile_id = vehora.current_profile_id()
  );
$$;

-- Raccourci : accès en lecture aux données d'une organisation.
create or replace function vehora.can_read(p_org_id uuid, p_permission text, p_station_id uuid default null)
returns boolean language sql stable as $$
  select p_org_id = vehora.current_org_id()
     and vehora.has_permission(p_permission)
     and vehora.can_access_station(p_station_id);
$$;

-- Raccourci : accès en écriture. Refuse les sessions d'assistance et les
-- sessions révoquées.
create or replace function vehora.can_write(p_org_id uuid, p_permission text, p_station_id uuid default null)
returns boolean language sql stable as $$
  select p_org_id = vehora.current_org_id()
     and vehora.has_permission(p_permission)
     and vehora.can_access_station(p_station_id)
     and not vehora.is_impersonating()
     and not vehora.is_revoked();
$$;

-- ---------------------------------------------------------------------------
-- Custom access token hook : construit les claims à l'émission du JWT.
-- À déclarer dans Supabase : Auth > Hooks > Customize Access Token.
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
  -- Organisation active : celle demandée par le client si l'adhésion existe et
  -- est active, sinon la plus ancienne adhésion active. Le choix n'est donc
  -- jamais imposé par le client sans vérification.
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
           'role', null,
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
         'role', v_membership.role_code,
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

-- Le hook doit pouvoir lire ces tables ; personne d'autre n'y accède par ce biais.
grant usage on schema vehora to supabase_auth_admin;
grant select on public.organization_memberships, public.roles,
                public.role_permissions, public.station_users
  to supabase_auth_admin;
