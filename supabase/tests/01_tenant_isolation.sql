-- VEHORA — test d'isolation multi-tenant (fondation 3).
-- Simule deux organisations et vérifie qu'aucune ne voit l'autre, en jouant
-- réellement les policies RLS sous le rôle `authenticated`.

begin;

set local role postgres;

-- --- Jeu de données -------------------------------------------------------
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- Awa, OWNER organisation A
  ('22222222-2222-2222-2222-222222222222'),  -- Moussa, OWNER organisation B
  ('33333333-3333-3333-3333-333333333333');  -- Fatou, OPERATOR station A1

-- Les profils sont créés automatiquement par le trigger on_auth_user_created.
update public.profiles set full_name = 'Awa'    where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set full_name = 'Moussa' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set full_name = 'Fatou'  where id = '33333333-3333-3333-3333-333333333333';

insert into public.organizations (id, name, slug, country_code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Station Awa', 'station-awa', 'SN'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Moussa Wash', 'moussa-wash', 'ML');

insert into public.organization_settings (organization_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002');

insert into public.stations (id, organization_id, name) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Awa — Liberté 6'),
  ('a2a2a2a2-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Awa — Ouakam'),
  ('b1b1b1b1-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'Moussa — Bamako');

insert into public.organization_memberships (id, profile_id, organization_id, role_id)
select 'ccc11111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-0000-0000-0000-000000000001', id from public.roles where code = 'OWNER';
insert into public.organization_memberships (id, profile_id, organization_id, role_id)
select 'ccc22222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
       'bbbbbbbb-0000-0000-0000-000000000002', id from public.roles where code = 'OWNER';
insert into public.organization_memberships (id, profile_id, organization_id, role_id)
select 'ccc33333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333',
       'aaaaaaaa-0000-0000-0000-000000000001', id from public.roles where code = 'OPERATOR';

insert into public.station_users (membership_id, station_id) values
  ('ccc33333-0000-0000-0000-000000000003', 'a1a1a1a1-0000-0000-0000-000000000001');

-- --- Outillage ------------------------------------------------------------
-- Reproduit ce que le custom access token hook mettra dans le JWT.
create or replace function pg_temp.login(p_profile uuid, p_org uuid, p_role text)
returns void language plpgsql as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'sub', p_profile::text,
    'org_id', p_org::text,
    'role', r.code,
    'role_scope', r.scope,
    'station_ids', coalesce(
      (select jsonb_agg(su.station_id::text)
         from public.station_users su
         join public.organization_memberships m on m.id = su.membership_id
        where m.profile_id = p_profile and m.organization_id = p_org), '[]'::jsonb),
    'permissions', coalesce(
      (select jsonb_agg(rp.permission_key)
         from public.role_permissions rp where rp.role_id = r.id), '[]'::jsonb),
    'is_platform_admin', r.scope = 'PLATFORM'
  ) into v
  from public.roles r where r.code = p_role;

  perform set_config('request.jwt.claims', v::text, true);
end;
$$;

create or replace function pg_temp.check(p_label text, p_actual bigint, p_expected bigint)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ÉCHEC — % : attendu %, obtenu %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok — %', p_label;
end;
$$;

-- ==========================================================================
-- 1. Utilisateur autorisé : Awa voit son organisation et ses 2 stations.
-- ==========================================================================
set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');

select pg_temp.check('Awa voit son organisation',
  (select count(*) from public.organizations), 1);
select pg_temp.check('Awa voit ses 2 stations',
  (select count(*) from public.stations), 2);

-- ==========================================================================
-- 2. Utilisateur non autorisé : Awa ne voit rien de l'organisation B.
-- ==========================================================================
select pg_temp.check('Awa ne voit pas la station de Moussa',
  (select count(*) from public.stations
    where organization_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0);
select pg_temp.check('Awa ne voit pas les adhésions de B',
  (select count(*) from public.organization_memberships
    where organization_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0);
select pg_temp.check('Awa ne voit pas le profil de Moussa',
  (select count(*) from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'), 0);

-- ==========================================================================
-- 3. Portée station : Fatou (OPERATOR) ne voit que la station où elle est affectée.
-- ==========================================================================
select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');
select pg_temp.check('Fatou ne voit que sa station',
  (select count(*) from public.stations), 1);
select pg_temp.check('Fatou ne voit pas la station Ouakam',
  (select count(*) from public.stations
    where id = 'a2a2a2a2-0000-0000-0000-000000000002'), 0);

-- ==========================================================================
-- 4. Utilisateur malveillant.
-- ==========================================================================

-- 4a. Fatou n'a pas `stations.manage` : elle ne peut pas créer de station.
do $$
begin
  insert into public.stations (organization_id, name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Station pirate');
  raise exception 'ÉCHEC — un OPERATOR a pu créer une station';
exception
  when insufficient_privilege then raise notice 'ok — OPERATOR ne peut pas créer de station';
end;
$$;

-- 4b. Awa (OWNER, toutes permissions) ne peut pas créer une station dans B,
--     même en falsifiant organization_id : c'est le test IDOR fondamental.
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');
do $$
begin
  insert into public.stations (organization_id, name)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'Station injectée');
  raise exception 'ÉCHEC CRITIQUE — organization_id falsifié accepté';
exception
  when insufficient_privilege then raise notice 'ok — organization_id falsifié refusé';
end;
$$;

-- 4c. Escalade de privilèges : un OWNER avec `users.manage` ne doit jamais
--     pouvoir s'attribuer, ni attribuer à un tiers, un rôle de plateforme.
do $$
declare v_super uuid;
begin
  select id into v_super from public.roles where code = 'SUPER_ADMIN';
  insert into public.organization_memberships (profile_id, organization_id, role_id)
  values ('33333333-3333-3333-3333-333333333333',
          'aaaaaaaa-0000-0000-0000-000000000001', v_super);
  raise exception 'ÉCHEC CRITIQUE — escalade vers SUPER_ADMIN possible';
exception
  when insufficient_privilege then raise notice 'ok — escalade vers SUPER_ADMIN refusée';
end;
$$;

-- 4d. Le journal d'audit n'est modifiable par personne via l'API.
set local role postgres;
select vehora.write_audit_log('test.entry', 'test', 'x',
       'aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');
-- Sous RLS, aucune policy UPDATE/DELETE n'existe : la requête ne touche aucune
-- ligne (PostgreSQL ne lève pas d'erreur, il filtre).
do $$
declare v_count integer;
begin
  update public.audit_logs set action = 'falsifié';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'ÉCHEC CRITIQUE — % ligne(s) d''audit modifiée(s) via RLS', v_count;
  end if;
  raise notice 'ok — audit_logs non modifiable sous RLS';
end;
$$;

-- Mais service_role contourne la RLS. C'est le trigger d'immuabilité qui doit
-- tenir, et on le vérifie sous un rôle qui ignore les policies.
set local role postgres;
do $$
begin
  update public.audit_logs set action = 'falsifié';
  raise exception 'ÉCHEC CRITIQUE — audit_logs modifiable en contournant la RLS';
exception
  when insufficient_privilege then raise notice 'ok — audit_logs immuable même sans RLS';
end;
$$;
do $$
begin
  delete from public.audit_logs;
  raise exception 'ÉCHEC CRITIQUE — audit_logs supprimable en contournant la RLS';
exception
  when insufficient_privilege then raise notice 'ok — audit_logs non supprimable même sans RLS';
end;
$$;

-- 4e. Session révoquée : l'écriture sensible est immédiatement coupée, sans
--     attendre l'expiration du JWT (ADR-001).
set local role postgres;
insert into public.session_revocations (profile_id)
values ('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');
do $$
begin
  insert into public.stations (organization_id, name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Après révocation');
  raise exception 'ÉCHEC — écriture acceptée malgré la révocation';
exception
  when insufficient_privilege then raise notice 'ok — écriture refusée après révocation';
end;
$$;

-- ==========================================================================
-- 5. Invariants métier.
-- ==========================================================================
set local role postgres;

-- Une station ne peut pas être affectée à un membre d'une autre organisation.
do $$
begin
  insert into public.station_users (membership_id, station_id)
  values ('ccc22222-0000-0000-0000-000000000002', 'a1a1a1a1-0000-0000-0000-000000000001');
  raise exception 'ÉCHEC CRITIQUE — affectation croisée entre organisations acceptée';
exception
  when others then
    if sqlerrm like '%VEHORA_TENANCY_VIOLATION%' then
      raise notice 'ok — affectation croisée refusée';
    else raise;
    end if;
end;
$$;

-- Une organisation conserve toujours un OWNER actif.
do $$
begin
  update public.organization_memberships set status = 'SUSPENDED'
   where id = 'ccc11111-0000-0000-0000-000000000001';
  raise exception 'ÉCHEC — dernier propriétaire supprimable';
exception
  when others then
    if sqlerrm like '%VEHORA_LAST_OWNER%' then
      raise notice 'ok — dernier propriétaire protégé';
    else raise;
    end if;
end;
$$;

-- Une organisation doit rester supprimable : l'invariant « dernier
-- propriétaire » ne doit pas bloquer la cascade (régression corrigée en phase 1).
do $$
declare v_org uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
begin
  delete from public.organizations where id = v_org;
  if exists (select 1 from public.organization_memberships where organization_id = v_org) then
    raise exception 'ÉCHEC — adhésions orphelines après suppression d''organisation';
  end if;
  raise notice 'ok — organisation supprimable en cascade';
exception
  when others then
    if sqlerrm like '%VEHORA_LAST_OWNER%' then
      raise exception 'ÉCHEC — l''invariant dernier propriétaire bloque la suppression d''organisation';
    else raise;
    end if;
end;
$$;

rollback;
