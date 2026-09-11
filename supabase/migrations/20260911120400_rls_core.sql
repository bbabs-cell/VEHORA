-- VEHORA — Phase 0 : RLS sur les tables de cloisonnement (fondation 3).
-- Principe : RLS activée partout, aucune policy permissive par défaut,
-- et AUCUNE policy « or is_platform_admin() » sur les données clientes.

alter table public.organizations            enable row level security;
alter table public.organization_settings    enable row level security;
alter table public.profiles                 enable row level security;
alter table public.stations                 enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.station_users            enable row level security;
alter table public.session_revocations      enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.roles                    enable row level security;
alter table public.permissions              enable row level security;
alter table public.role_permissions         enable row level security;

-- ---------------------------------------------------------------------------
-- Référentiel RBAC : lisible par tout utilisateur authentifié (l'interface en a
-- besoin pour afficher les rôles), modifiable par personne via l'API.
-- ---------------------------------------------------------------------------
create policy "roles readable" on public.roles
  for select to authenticated using (true);
create policy "permissions readable" on public.permissions
  for select to authenticated using (true);
create policy "role_permissions readable" on public.role_permissions
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- organizations : on ne voit que la sienne.
-- ---------------------------------------------------------------------------
create policy "members read own organization" on public.organizations
  for select to authenticated
  using (id = vehora.current_org_id());

create policy "owners update own organization" on public.organizations
  for update to authenticated
  using (vehora.can_write(id, 'organization.manage'))
  with check (id = vehora.current_org_id());

-- Création et suppression d'une organisation : opérations de plateforme,
-- réalisées par Edge Function en service_role. Aucune policy ici, volontairement.

-- ---------------------------------------------------------------------------
-- organization_settings
-- ---------------------------------------------------------------------------
create policy "members read settings" on public.organization_settings
  for select to authenticated
  using (organization_id = vehora.current_org_id());

create policy "admins update settings" on public.organization_settings
  for update to authenticated
  using (vehora.can_write(organization_id, 'organization.manage'))
  with check (organization_id = vehora.current_org_id());

-- ---------------------------------------------------------------------------
-- profiles : son propre profil, et ceux des membres de son organisation.
-- ---------------------------------------------------------------------------
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = vehora.current_profile_id());

create policy "read profiles of my organization" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
       where m.profile_id = public.profiles.id
         and m.organization_id = vehora.current_org_id()
    )
  );

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = vehora.current_profile_id())
  with check (id = vehora.current_profile_id());

-- ---------------------------------------------------------------------------
-- stations
-- ---------------------------------------------------------------------------
create policy "members read stations" on public.stations
  for select to authenticated
  using (
    organization_id = vehora.current_org_id()
    and vehora.can_access_station(id)
  );

create policy "admins insert stations" on public.stations
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'stations.manage'));

create policy "admins update stations" on public.stations
  for update to authenticated
  using (vehora.can_write(organization_id, 'stations.manage'))
  with check (organization_id = vehora.current_org_id());

create policy "admins delete stations" on public.stations
  for delete to authenticated
  using (vehora.can_write(organization_id, 'stations.manage'));

-- ---------------------------------------------------------------------------
-- organization_memberships : voir sa propre adhésion, et gérer celles de son
-- organisation avec `users.manage`.
-- ---------------------------------------------------------------------------
create policy "read own membership" on public.organization_memberships
  for select to authenticated
  using (profile_id = vehora.current_profile_id());

create policy "managers read memberships" on public.organization_memberships
  for select to authenticated
  using (vehora.can_read(organization_id, 'users.manage'));

create policy "managers insert memberships" on public.organization_memberships
  for insert to authenticated
  with check (
    vehora.can_write(organization_id, 'users.manage')
    -- Interdiction d'attribuer un rôle de plateforme depuis une organisation :
    -- sans cela, `users.manage` permettrait l'escalade vers Super Admin.
    and exists (
      select 1 from public.roles r
       where r.id = role_id and r.scope <> 'PLATFORM'
    )
  );

create policy "managers update memberships" on public.organization_memberships
  for update to authenticated
  using (vehora.can_write(organization_id, 'users.manage'))
  with check (
    organization_id = vehora.current_org_id()
    and exists (
      select 1 from public.roles r
       where r.id = role_id and r.scope <> 'PLATFORM'
    )
  );

create policy "managers delete memberships" on public.organization_memberships
  for delete to authenticated
  using (vehora.can_write(organization_id, 'users.manage'));

-- ---------------------------------------------------------------------------
-- station_users : affectations. Le trigger de cohérence garantit déjà que la
-- station et l'adhésion partagent la même organisation.
-- ---------------------------------------------------------------------------
create policy "read own station assignments" on public.station_users
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
       where m.id = membership_id
         and m.profile_id = vehora.current_profile_id()
    )
  );

create policy "managers read station assignments" on public.station_users
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
       where m.id = membership_id
         and vehora.can_read(m.organization_id, 'users.manage')
    )
  );

create policy "managers write station assignments" on public.station_users
  for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_memberships m
       where m.id = membership_id
         and vehora.can_write(m.organization_id, 'users.manage')
    )
  );

create policy "managers delete station assignments" on public.station_users
  for delete to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
       where m.id = membership_id
         and vehora.can_write(m.organization_id, 'users.manage')
    )
  );

-- ---------------------------------------------------------------------------
-- session_revocations : lecture par l'intéressé uniquement. L'écriture passe
-- par une Edge Function en service_role — aucune policy d'écriture.
-- ---------------------------------------------------------------------------
create policy "read own revocation" on public.session_revocations
  for select to authenticated
  using (profile_id = vehora.current_profile_id());

-- ---------------------------------------------------------------------------
-- audit_logs : lecture seule, pour les rôles habilités de l'organisation.
-- Aucune policy INSERT / UPDATE / DELETE : l'écriture se fait exclusivement par
-- des fonctions SECURITY DEFINER. Un journal d'audit modifiable ne sert à rien.
-- ---------------------------------------------------------------------------
create policy "auditors read organization logs" on public.audit_logs
  for select to authenticated
  using (vehora.can_read(organization_id, 'audit.read'));

-- ---------------------------------------------------------------------------
-- Écriture d'audit : seul chemin autorisé.
-- ---------------------------------------------------------------------------
create or replace function vehora.write_audit_log(
  p_action        text,
  p_resource_type text,
  p_resource_id   text default null,
  p_organization_id uuid default null,
  p_station_id    uuid default null,
  p_old_value     jsonb default null,
  p_new_value     jsonb default null,
  p_reason        text default null,
  p_context       jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.audit_logs (
    actor_profile_id, actor_label, organization_id, station_id,
    action, resource_type, resource_id, old_value, new_value, reason, context
  ) values (
    vehora.current_profile_id(),
    coalesce((select full_name from public.profiles where id = vehora.current_profile_id()), 'system'),
    coalesce(p_organization_id, vehora.current_org_id()),
    p_station_id,
    p_action, p_resource_type, p_resource_id, p_old_value, p_new_value, p_reason,
    p_context || jsonb_build_object('impersonating', vehora.is_impersonating())
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function vehora.write_audit_log(text, text, text, uuid, uuid, jsonb, jsonb, text, jsonb)
  to authenticated;
