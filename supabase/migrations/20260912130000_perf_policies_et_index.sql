-- VEHORA — Phase 3 : performance des policies et index manquants.
--
-- Constats des advisors Supabase.
--
-- 1. MULTIPLE PERMISSIVE POLICIES (WARN)
--    Trois tables portaient deux policies SELECT permissives pour le même rôle.
--    PostgreSQL doit alors évaluer CHAQUE policy pour chaque ligne examinée,
--    puis les combiner en OR. Deux policies = deux fois le travail, sur des
--    tables lues à chaque écran.
--    Correction : une seule policy par table et par action, la condition étant
--    le OR explicite des deux précédentes. Sémantique strictement identique,
--    coût divisé par deux.
--
-- 2. UNINDEXED FOREIGN KEYS (INFO)
--    Trois clés étrangères sans index de couverture. Sans index, une
--    suppression dans la table référencée impose un parcours complet de la
--    table référençante — et `audit_logs` est la table qui grossit le plus.

-- ---------------------------------------------------------------------------
-- 1. Fusion des policies SELECT
-- ---------------------------------------------------------------------------

drop policy "read own membership"      on public.organization_memberships;
drop policy "managers read memberships" on public.organization_memberships;

create policy "read memberships" on public.organization_memberships
  for select to authenticated
  using (
    profile_id = vehora.current_profile_id()
    or vehora.can_read(organization_id, 'users.manage')
  );

drop policy "read own profile"                on public.profiles;
drop policy "read profiles of my organization" on public.profiles;

create policy "read profiles" on public.profiles
  for select to authenticated
  using (
    id = vehora.current_profile_id()
    or exists (
      select 1 from public.organization_memberships m
       where m.profile_id = public.profiles.id
         and m.organization_id = vehora.current_org_id()
    )
  );

drop policy "read own station assignments"      on public.station_users;
drop policy "managers read station assignments" on public.station_users;

create policy "read station assignments" on public.station_users
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
       where m.id = membership_id
         and (
           m.profile_id = vehora.current_profile_id()
           or vehora.can_read(m.organization_id, 'users.manage')
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Index de couverture des clés étrangères
-- ---------------------------------------------------------------------------

create index if not exists audit_logs_station_id_idx
  on public.audit_logs (station_id);

create index if not exists organization_memberships_role_id_idx
  on public.organization_memberships (role_id);

create index if not exists organization_memberships_invited_by_idx
  on public.organization_memberships (invited_by);
