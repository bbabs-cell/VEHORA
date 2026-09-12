-- VEHORA — test d'isolation multi-tenant (fondation 3).
-- Simule deux organisations et vérifie qu'aucune ne voit l'autre, en jouant
-- réellement les policies RLS sous le rôle `authenticated`.

begin;

set local role postgres;

-- --- Jeu de données -------------------------------------------------------
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- Awa, OWNER organisation A
  ('22222222-2222-2222-2222-222222222222'),  -- Moussa, OWNER organisation B
  ('33333333-3333-3333-3333-333333333333'),  -- Fatou, OPERATOR station A1
  ('44444444-4444-4444-4444-444444444444');  -- Ousmane, CASHIER station A1

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

-- ==========================================================================
-- 6. `organization_id` déduit du JWT (phase 3).
-- ==========================================================================
-- La section précédente a révoqué la session d'Awa : on la rétablit, sinon
-- `can_write` refuse à juste titre et le test mesurerait autre chose.
set local role postgres;
delete from public.session_revocations
 where profile_id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');

-- (a) omis par le client : la base le remplit correctement.
insert into public.stations (name) values ('Station sans org_id explicite');
select pg_temp.check('organization_id rempli depuis le jeton',
  (select count(*) from public.stations
    where name = 'Station sans org_id explicite'
      and organization_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1);

-- (b) falsifié par le client : toujours refusé. Le défaut ne remplace pas la
--     policy, il la complète.
do $$
begin
  insert into public.stations (organization_id, name)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'Station forcée chez B');
  raise exception 'ÉCHEC CRITIQUE — organization_id falsifié accepté malgré le défaut';
exception
  when insufficient_privilege then
    raise notice 'ok — organization_id falsifié toujours refusé';
end;
$$;

set local role postgres;

-- ==========================================================================
-- 7. Invitations (phase 4).
-- ==========================================================================
set local role authenticated;

-- (a) Un rôle sans `users.manage` ne peut pas inviter.
select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');
do $$
declare v_role uuid;
begin
  select id into v_role from public.roles where code = 'CASHIER';
  insert into public.organization_invitations (organization_id, email, role_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'x@vehora.test', v_role);
  raise exception 'ÉCHEC — un OPERATOR a pu inviter';
exception
  when insufficient_privilege then raise notice 'ok — inviter exige users.manage';
end;
$$;

-- (b) Même avec `users.manage`, inviter à un rôle de plateforme est refusé :
--     ce serait la porte d'entrée vers le Super Admin.
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');
do $$
declare v_role uuid;
begin
  select id into v_role from public.roles where code = 'SUPER_ADMIN';
  insert into public.organization_invitations (organization_id, email, role_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'x@vehora.test', v_role);
  raise exception 'ÉCHEC CRITIQUE — invitation à un rôle de plateforme acceptée';
exception
  when insufficient_privilege then raise notice 'ok — invitation à un rôle de plateforme refusée';
end;
$$;

set local role postgres;

-- ==========================================================================
-- 8. Clients (phase 5).
-- ==========================================================================
set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');

insert into public.customers (full_name, phone) values ('Moussa Diallo', '+221 77 123 45 67');

select pg_temp.check('le numéro est normalisé en forme internationale',
  (select count(*) from public.customers where phone_digits = '221771234567'), 1);

-- Le doublon est la première erreur de saisie en station : cinq écritures du
-- même numéro doivent toutes être reconnues.
do $$
declare v_forme text;
begin
  foreach v_forme in array array['00221 77 123 45 67', '221771234567',
                                 '77 123 45 67', '+221-77-123-45-67', '077 123 45 67'] loop
    begin
      insert into public.customers (full_name, phone) values ('Doublon', v_forme);
      raise exception 'ÉCHEC — doublon accepté pour la forme %', v_forme;
    exception
      when unique_violation then null;
    end;
  end loop;
  raise notice 'ok — cinq écritures du même numéro reconnues comme doublons';
end;
$$;

-- Un rôle sans `customers.write` ne peut pas écrire, même en lecture autorisée.
select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');
select pg_temp.check('un OPERATOR lit les clients',
  (select count(*) from public.customers), 1);
do $$
begin
  insert into public.customers (full_name) values ('Créé sans permission');
  raise exception 'ÉCHEC — écriture acceptée sans customers.write';
exception
  when insufficient_privilege then raise notice 'ok — écriture refusée sans customers.write';
end;
$$;

-- Cloisonnement : l'organisation B ne voit rien.
select pg_temp.login('22222222-2222-2222-2222-222222222222',
                     'bbbbbbbb-0000-0000-0000-000000000002', 'OWNER');
select pg_temp.check('une autre organisation ne voit aucun client',
  (select count(*) from public.customers), 0);

set local role postgres;

-- ==========================================================================
-- 9. Véhicules (phase 6).
-- ==========================================================================
set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');

insert into public.vehicles (vehicle_type_id, plate, make)
select id, 'DK-1234-A', 'Toyota' from public.vehicle_types where code = 'SEDAN';

select pg_temp.check('la plaque est normalisée',
  (select count(*) from public.vehicles where plate_normalized = 'DK1234A'), 1);

-- Quatre écritures de la même plaque doivent toutes être reconnues.
do $$
declare v_forme text; v_type uuid;
begin
  select id into v_type from public.vehicle_types where code = 'SEDAN';
  foreach v_forme in array array['dk1234a', 'DK 1234 A', 'dk-1234-a', 'DK.1234.A'] loop
    begin
      insert into public.vehicles (vehicle_type_id, plate) values (v_type, v_forme);
      raise exception 'ÉCHEC — plaque en doublon acceptée : %', v_forme;
    exception
      when unique_violation then null;
    end;
  end loop;
  raise notice 'ok — quatre écritures de la même plaque reconnues';
end;
$$;

-- Rattacher un client d'une autre organisation doit être refusé : la policy
-- vérifie le véhicule, pas ce qu'il référence.
do $$
declare v_type uuid; v_client_b uuid;
begin
  select id into v_type from public.vehicle_types where code = 'SUV';

  -- Un client chez B, créé hors RLS pour les besoins du test.
  set local role postgres;
  insert into public.customers (organization_id, full_name)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'Client de B')
  returning id into v_client_b;
  set local role authenticated;

  insert into public.vehicles (vehicle_type_id, customer_id, plate)
  values (v_type, v_client_b, 'XX-000-X');
  raise exception 'ÉCHEC CRITIQUE — véhicule rattaché à un client d''une autre organisation';
exception
  when insufficient_privilege then
    raise notice 'ok — rattachement à un client d''une autre organisation refusé';
end;
$$;

-- Un rôle sans `vehicles.write` lit mais n'écrit pas.
select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');
select pg_temp.check('un OPERATOR lit les véhicules',
  (select count(*) from public.vehicles), 1);
do $$
declare v_type uuid;
begin
  select id into v_type from public.vehicle_types where code = 'SEDAN';
  insert into public.vehicles (vehicle_type_id, plate) values (v_type, 'ZZ-111-Z');
  raise exception 'ÉCHEC — écriture acceptée sans vehicles.write';
exception
  when insufficient_privilege then raise notice 'ok — écriture refusée sans vehicles.write';
end;
$$;

set local role postgres;

-- ==========================================================================
-- 10. Inspections et photos (phase 7).
-- ==========================================================================
set local role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');

do $$
declare v_vehicule uuid; v_inspection uuid; v_zone uuid;
begin
  select id into v_vehicule from public.vehicles
   where organization_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1;
  select id into v_zone from public.inspection_zones where code = 'FRONT';

  insert into public.vehicle_inspections (vehicle_id, notes)
  values (v_vehicule, 'Constat de test') returning id into v_inspection;

  insert into public.inspection_items (inspection_id, zone_id, condition, comment)
  values (v_inspection, v_zone, 'ANOMALY', 'Rayure');

  raise notice 'ok — inspection et constat de zone enregistrés';
end;
$$;

-- Une inspection est un CONSTAT DATÉ : la modifier après coup lui retirerait
-- toute valeur de preuve. Aucune policy UPDATE ni DELETE n'existe.
do $$
declare v_touchees integer;
begin
  update public.vehicle_inspections set notes = 'Réécrit après coup';
  get diagnostics v_touchees = row_count;
  if v_touchees <> 0 then
    raise exception 'ÉCHEC CRITIQUE — % inspection(s) modifiée(s) après coup', v_touchees;
  end if;
  raise notice 'ok — une inspection ne peut pas être modifiée après coup';
end;
$$;

do $$
declare v_touchees integer;
begin
  delete from public.vehicle_inspections;
  get diagnostics v_touchees = row_count;
  if v_touchees <> 0 then
    raise exception 'ÉCHEC CRITIQUE — % inspection(s) supprimée(s)', v_touchees;
  end if;
  raise notice 'ok — une inspection ne peut pas être supprimée';
end;
$$;

-- Une zone n'est constatée qu'une fois par inspection.
do $$
declare v_inspection uuid; v_zone uuid;
begin
  select id into v_inspection from public.vehicle_inspections limit 1;
  select id into v_zone from public.inspection_zones where code = 'FRONT';
  insert into public.inspection_items (inspection_id, zone_id, condition)
  values (v_inspection, v_zone, 'OK');
  raise exception 'ÉCHEC — une zone a pu être constatée deux fois';
exception
  when unique_violation then raise notice 'ok — une zone n''est constatée qu''une fois';
end;
$$;

-- Un rôle sans `inspections.write` ne peut pas inspecter, même s'il lit.
select pg_temp.login('44444444-4444-4444-4444-444444444444',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'CASHIER');
do $$
declare v_vehicule uuid;
begin
  select id into v_vehicule from public.vehicles limit 1;
  insert into public.vehicle_inspections (vehicle_id) values (v_vehicule);
  raise exception 'ÉCHEC — inspection acceptée sans inspections.write';
exception
  when insufficient_privilege then
    raise notice 'ok — inspecter exige inspections.write';
end;
$$;

-- ===========================================================================
-- Phase 8 — catalogue de services et tarification
-- ===========================================================================
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');

insert into public.service_categories (id, name, sort_order) values
  ('cca00000-0000-0000-0000-000000000001', 'Lavage', 10);

insert into public.services (id, category_id, name, duration_minutes) values
  ('5e000000-0000-0000-0000-000000000001',
   'cca00000-0000-0000-0000-000000000001', 'Lavage complet', 45);

-- Trois tarifs de spécificité croissante pour le même service.
insert into public.service_prices (service_id, amount_minor)
  values ('5e000000-0000-0000-0000-000000000001', 5000);
insert into public.service_prices (service_id, vehicle_type_id, amount_minor)
  select '5e000000-0000-0000-0000-000000000001', id, 8000
    from public.vehicle_types where code = 'SUV';
insert into public.service_prices (service_id, vehicle_type_id, station_id, amount_minor)
  select '5e000000-0000-0000-0000-000000000001', id,
         'a1a1a1a1-0000-0000-0000-000000000001', 9500
    from public.vehicle_types where code = 'SUV';

do $$
declare v_suv uuid; v_moto uuid; r record; n integer;
begin
  select id into v_suv  from public.vehicle_types where code = 'SUV';
  select id into v_moto from public.vehicle_types where code = 'MOTORCYCLE';

  -- 1. Le plus spécifique gagne : type + station.
  select * into r from public.resoudre_prix(
    '5e000000-0000-0000-0000-000000000001', v_suv,
    'a1a1a1a1-0000-0000-0000-000000000001');
  if r.amount_minor <> 9500 or r.specificite <> 'SERVICE_TYPE_STATION' then
    raise exception 'ÉCHEC — tarif station+type non retenu (%, %)', r.amount_minor, r.specificite;
  end if;
  raise notice 'ok — le tarif station + type de véhicule prime';

  -- 2. Autre station : on retombe sur le tarif « SUV, toutes stations ».
  select * into r from public.resoudre_prix(
    '5e000000-0000-0000-0000-000000000001', v_suv,
    'a2a2a2a2-0000-0000-0000-000000000002');
  if r.amount_minor <> 8000 then
    raise exception 'ÉCHEC — repli sur le tarif par type de véhicule (%)', r.amount_minor;
  end if;
  raise notice 'ok — repli sur le tarif par type de véhicule';

  -- 3. Type sans tarif dédié : tarif général du service.
  select * into r from public.resoudre_prix(
    '5e000000-0000-0000-0000-000000000001', v_moto,
    'a1a1a1a1-0000-0000-0000-000000000001');
  if r.amount_minor <> 5000 or r.specificite <> 'SERVICE' then
    raise exception 'ÉCHEC — repli sur le tarif général (%, %)', r.amount_minor, r.specificite;
  end if;
  raise notice 'ok — repli sur le tarif général du service';

  -- 4. La devise vient de l'organisation, pas de l'appelant.
  if r.currency <> 'XOF' then
    raise exception 'ÉCHEC — devise inattendue : %', r.currency;
  end if;
  raise notice 'ok — la devise est celle de l''organisation';

  -- 5. Aucun tarif → aucune ligne. Jamais un zéro implicite.
  insert into public.services (id, name)
    values ('5e000000-0000-0000-0000-000000000002', 'Polish carrosserie');
  select count(*) into n from public.resoudre_prix('5e000000-0000-0000-0000-000000000002');
  if n <> 0 then
    raise exception 'ÉCHEC — un service sans tarif a renvoyé un prix';
  end if;
  raise notice 'ok — un service sans tarif ne renvoie aucun prix';
end;
$$;

-- La devise envoyée par le client est ignorée.
do $$
declare v_devise text;
begin
  insert into public.service_prices (service_id, currency, amount_minor, valid_from)
    values ('5e000000-0000-0000-0000-000000000002', 'EUR', 12000, current_date)
    returning currency into v_devise;
  if v_devise <> 'XOF' then
    raise exception 'ÉCHEC — devise falsifiable depuis le client : %', v_devise;
  end if;
  raise notice 'ok — la devise envoyée par le client est écrasée';
end;
$$;

-- Deux tarifs de même spécificité valables le même jour : indéterminé, refusé.
do $$
begin
  insert into public.service_prices (service_id, amount_minor)
    values ('5e000000-0000-0000-0000-000000000001', 7777);
  raise exception 'ÉCHEC — deux tarifs concurrents acceptés';
exception
  when exclusion_violation then
    raise notice 'ok — chevauchement de tarifs refusé';
end;
$$;

-- Un montant négatif n'est pas une remise.
do $$
begin
  insert into public.service_prices (service_id, amount_minor, valid_from)
    values ('5e000000-0000-0000-0000-000000000002', -1, current_date + 400);
  raise exception 'ÉCHEC — montant négatif accepté';
exception
  when check_violation then raise notice 'ok — montant négatif refusé';
end;
$$;

-- Cloisonnement : une station d'une autre organisation ne peut pas porter un tarif.
do $$
begin
  insert into public.service_prices (service_id, station_id, amount_minor)
    values ('5e000000-0000-0000-0000-000000000001',
            'b1b1b1b1-0000-0000-0000-000000000003', 100);
  raise exception 'ÉCHEC — tarif rattaché à la station d''une autre organisation';
exception
  when insufficient_privilege then
    raise notice 'ok — tarif sur une station étrangère refusé';
end;
$$;

-- Cloisonnement : l'organisation B ne voit ni le catalogue ni les tarifs de A.
select pg_temp.login('22222222-2222-2222-2222-222222222222',
                     'bbbbbbbb-0000-0000-0000-000000000002', 'OWNER');
select pg_temp.check('l''organisation B ne voit aucun service de A',
  (select count(*) from public.services), 0);
select pg_temp.check('l''organisation B ne voit aucun tarif de A',
  (select count(*) from public.service_prices), 0);
select pg_temp.check('resoudre_prix ne traverse pas les organisations',
  (select count(*) from public.resoudre_prix('5e000000-0000-0000-0000-000000000001')), 0);

-- B ne peut pas non plus tarifer un service de A, même en connaissant son id.
do $$
begin
  insert into public.service_prices (service_id, amount_minor)
    values ('5e000000-0000-0000-0000-000000000001', 1);
  raise exception 'ÉCHEC — tarif posé sur le service d''une autre organisation';
exception
  when insufficient_privilege then
    raise notice 'ok — tarifer le service d''une autre organisation est refusé';
end;
$$;

-- Remplacer un tarif : l'ancien se ferme la veille, le nouveau s'ouvre.
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');
do $$
declare v_ancien uuid; v_nouveau uuid; r record;
begin
  select id into v_ancien from public.service_prices
   where service_id = '5e000000-0000-0000-0000-000000000001'
     and vehicle_type_id is null and station_id is null;

  v_nouveau := public.remplacer_tarif(v_ancien, 6000, current_date + 1);

  if (select valid_to from public.service_prices where id = v_ancien) <> current_date then
    raise exception 'ÉCHEC — l''ancien tarif n''a pas été fermé la veille';
  end if;
  raise notice 'ok — l''ancien tarif est fermé, pas supprimé';

  select * into r from public.resoudre_prix(
    '5e000000-0000-0000-0000-000000000001', null, null, current_date);
  if r.amount_minor <> 5000 then
    raise exception 'ÉCHEC — le prix d''aujourd''hui a changé (%)', r.amount_minor;
  end if;
  raise notice 'ok — le prix du jour est inchangé';

  select * into r from public.resoudre_prix(
    '5e000000-0000-0000-0000-000000000001', null, null, current_date + 1);
  if r.amount_minor <> 6000 then
    raise exception 'ÉCHEC — le nouveau tarif ne prend pas effet demain (%)', r.amount_minor;
  end if;
  raise notice 'ok — le nouveau tarif prend effet demain';
end;
$$;

-- Un tarif ne peut pas être remplacé rétroactivement : un dossier d'hier a été
-- facturé au prix d'hier.
do $$
declare v_ancien uuid;
begin
  select id into v_ancien from public.service_prices
   where service_id = '5e000000-0000-0000-0000-000000000001'
     and vehicle_type_id is null and station_id is null and valid_to is not null;
  perform public.remplacer_tarif(v_ancien, 1, current_date - 10);
  raise exception 'ÉCHEC — remplacement rétroactif accepté';
exception
  when check_violation then raise notice 'ok — remplacement rétroactif refusé';
end;
$$;

-- Un rôle sans `services.manage` lit le catalogue mais ne le modifie pas.
select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');
select pg_temp.check('un OPERATOR lit le catalogue',
  (select count(*) from public.services), 2);
do $$
begin
  insert into public.services (name) values ('Service pirate');
  raise exception 'ÉCHEC — service créé sans services.manage';
exception
  when insufficient_privilege then
    raise notice 'ok — gérer le catalogue exige services.manage';
end;
$$;

-- Un caissier lit les prix (il encaisse) mais ne les fixe pas.
select pg_temp.login('44444444-4444-4444-4444-444444444444',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'CASHIER');
select pg_temp.check('un CASHIER lit les tarifs',
  (select count(*) from public.service_prices), 5);
do $$
declare v_tarif uuid;
begin
  select id into v_tarif from public.service_prices where valid_to is null limit 1;
  perform public.remplacer_tarif(v_tarif, 1, current_date + 30);
  raise exception 'ÉCHEC — un caissier a remplacé un tarif';
exception
  when insufficient_privilege then
    raise notice 'ok — remplacer un tarif exige prices.manage';
end;
$$;

-- Une policy UPDATE ne lève pas d'erreur : elle rend la ligne invisible à
-- l'écriture. L'assertion doit donc porter sur le montant, pas sur l'exception.
do $$
declare n integer;
begin
  update public.service_prices set amount_minor = 1 where amount_minor = 9500;
  get diagnostics n = row_count;
  if n <> 0 or not exists (select 1 from public.service_prices where amount_minor = 9500) then
    raise exception 'ÉCHEC — un caissier a modifié un tarif';
  end if;
  raise notice 'ok — modifier un tarif exige prices.manage';
end;
$$;

-- ===========================================================================
-- Phase 9 — Service Order
-- ===========================================================================
select pg_temp.login('11111111-1111-1111-1111-111111111111',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OWNER');

do $$
declare v_vehicule uuid; v_dossier public.service_orders;
begin
  select id into v_vehicule from public.vehicles limit 1;

  insert into public.service_orders (station_id, vehicle_id)
  values ('a1a1a1a1-0000-0000-0000-000000000001', v_vehicule)
  returning * into v_dossier;

  if v_dossier.number <> 1 or v_dossier.status <> 'ARRIVED' then
    raise exception 'ÉCHEC — dossier mal initialisé (n° %, statut %)',
      v_dossier.number, v_dossier.status;
  end if;
  raise notice 'ok — dossier ouvert, numéroté 1, en ARRIVED';

  insert into public.service_orders (station_id, vehicle_id)
  values ('a1a1a1a1-0000-0000-0000-000000000001', v_vehicule)
  returning number into v_dossier.number;
  if v_dossier.number <> 2 then
    raise exception 'ÉCHEC — numérotation non séquentielle (%)', v_dossier.number;
  end if;
  raise notice 'ok — la numérotation est séquentielle par organisation';
end;
$$;

-- Le prix de la ligne vient du serveur, jamais de l'appelant.
do $$
declare v_dossier uuid; v_ligne public.service_order_items;
begin
  select id into v_dossier from public.service_orders order by number limit 1;

  insert into public.service_order_items (service_order_id, service_id,
                                          service_name, unit_amount_minor, currency)
  values (v_dossier, '5e000000-0000-0000-0000-000000000002',
          'Prix cassé', 1, 'EUR')
  returning * into v_ligne;

  if v_ligne.unit_amount_minor <> 12000 then
    raise exception 'ÉCHEC — montant imposé par le client (%)', v_ligne.unit_amount_minor;
  end if;
  raise notice 'ok — le montant envoyé par le client est écrasé par le tarif';

  if v_ligne.currency <> 'XOF' then
    raise exception 'ÉCHEC — devise imposée par le client (%)', v_ligne.currency;
  end if;
  raise notice 'ok — la devise vient du tarif, pas du client';

  if v_ligne.service_name <> 'Polish carrosserie' then
    raise exception 'ÉCHEC — nom de prestation non copié (%)', v_ligne.service_name;
  end if;
  raise notice 'ok — le nom de la prestation est copié dans la ligne';

  if v_ligne.line_total_minor <> 12000 then
    raise exception 'ÉCHEC — total de ligne incohérent (%)', v_ligne.line_total_minor;
  end if;
  raise notice 'ok — le total de ligne est calculé par la base';
end;
$$;

-- Une prestation sans tarif ne peut pas être vendue.
do $$
declare v_dossier uuid; v_service uuid;
begin
  select id into v_dossier from public.service_orders order by number limit 1;
  insert into public.services (id, name) values
    ('5e000000-0000-0000-0000-000000000003', 'Prestation sans tarif');
  insert into public.service_order_items (service_order_id, service_id)
  values (v_dossier, '5e000000-0000-0000-0000-000000000003');
  raise exception 'ÉCHEC — prestation sans tarif ajoutée au dossier';
exception
  when check_violation then raise notice 'ok — une prestation sans tarif est refusée';
end;
$$;

-- Le prix historisé ne bouge pas quand le tarif change.
do $$
declare v_ligne uuid; v_prix uuid; v_avant bigint; v_apres bigint;
begin
  select id, unit_amount_minor into v_ligne, v_avant
    from public.service_order_items limit 1;

  select id into v_prix from public.service_prices
   where service_id = '5e000000-0000-0000-0000-000000000002' and valid_to is null;
  perform public.remplacer_tarif(v_prix, 99000, current_date + 1);

  select unit_amount_minor into v_apres
    from public.service_order_items where id = v_ligne;

  if v_apres <> v_avant then
    raise exception 'ÉCHEC — le prix du dossier a suivi le tarif (% → %)', v_avant, v_apres;
  end if;
  raise notice 'ok — modifier un tarif ne modifie pas un dossier existant';
end;
$$;

-- Le statut ne se change pas par UPDATE direct.
do $$
declare v_dossier uuid;
begin
  select id into v_dossier from public.service_orders order by number limit 1;
  update public.service_orders set status = 'DELIVERED' where id = v_dossier;
  raise exception 'ÉCHEC — statut modifié par UPDATE direct';
exception
  when insufficient_privilege then
    raise notice 'ok — le statut ne se change pas par UPDATE';
end;
$$;

-- Une transition hors matrice est refusée.
do $$
declare v_dossier uuid;
begin
  select id into v_dossier from public.service_orders order by number limit 1;
  perform public.transitionner_dossier(v_dossier, 'DELIVERED');
  raise exception 'ÉCHEC — transition ARRIVED → DELIVERED acceptée';
exception
  when check_violation then raise notice 'ok — transition hors matrice refusée';
end;
$$;

-- Le parcours prévu fonctionne, et l'historique est écrit.
do $$
declare v_dossier uuid; v_vehicule uuid; d public.service_orders; n integer;
begin
  select id, vehicle_id into v_dossier, v_vehicule
    from public.service_orders order by number limit 1;

  d := public.transitionner_dossier(v_dossier, 'INSPECTION');
  if d.status <> 'INSPECTION' then
    raise exception 'ÉCHEC — passage en INSPECTION refusé';
  end if;
  raise notice 'ok — ARRIVED → INSPECTION';

  -- Sans inspection enregistrée, la file d'attente est refusée.
  begin
    perform public.transitionner_dossier(v_dossier, 'WAITING');
    raise exception 'ÉCHEC — mise en file sans inspection';
  exception
    when check_violation then raise notice 'ok — la file d''attente exige l''inspection';
  end;

  insert into public.vehicle_inspections (vehicle_id, service_order_id)
  values (v_vehicule, v_dossier);

  d := public.transitionner_dossier(v_dossier, 'WAITING');
  if d.status <> 'WAITING' then
    raise exception 'ÉCHEC — passage en WAITING refusé';
  end if;
  raise notice 'ok — INSPECTION → WAITING une fois l''inspection enregistrée';

  select count(*) into n from public.service_order_status_history
   where service_order_id = v_dossier;
  if n <> 2 then
    raise exception 'ÉCHEC — historique incomplet (% lignes)', n;
  end if;
  raise notice 'ok — chaque transition laisse une ligne d''historique';
end;
$$;

-- L'annulation exige un motif, et fige le dossier.
do $$
declare v_dossier uuid; d public.service_orders;
begin
  select id into v_dossier from public.service_orders order by number limit 1;

  begin
    perform public.transitionner_dossier(v_dossier, 'CANCELLED');
    raise exception 'ÉCHEC — annulation sans motif acceptée';
  exception
    when check_violation then raise notice 'ok — annuler exige un motif';
  end;

  d := public.transitionner_dossier(v_dossier, 'CANCELLED', 'Client reparti');
  if d.cancellation_reason <> 'Client reparti' or d.cancelled_at is null then
    raise exception 'ÉCHEC — motif ou horodatage d''annulation absent';
  end if;
  raise notice 'ok — annulation enregistrée avec son motif';

  if not exists (select 1 from public.audit_logs
                  where action = 'service_order.transition'
                    and resource_id = v_dossier::text) then
    raise exception 'ÉCHEC — annulation non auditée';
  end if;
  raise notice 'ok — l''annulation est auditée';

  begin
    update public.service_orders set notes = 'rouvert' where id = v_dossier;
    raise exception 'ÉCHEC — dossier annulé encore modifiable';
  exception
    when insufficient_privilege then
      raise notice 'ok — un dossier annulé est immuable';
  end;
end;
$$;

-- Une ligne ne s'ajoute plus une fois le travail engagé.
do $$
declare v_dossier uuid;
begin
  select id into v_dossier from public.service_orders
   where status = 'CANCELLED' limit 1;
  insert into public.service_order_items (service_order_id, service_id)
  values (v_dossier, '5e000000-0000-0000-0000-000000000002');
  raise exception 'ÉCHEC — ligne ajoutée à un dossier clos';
exception
  when insufficient_privilege then
    raise notice 'ok — aucune ligne ajoutée après le démarrage du travail';
end;
$$;

-- Une remise au-delà du plafond exige `payments.refund`.
select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'RECEPTIONIST');
do $$
declare v_dossier uuid; v_vehicule uuid;
begin
  select id into v_vehicule from public.vehicles limit 1;
  insert into public.service_orders (station_id, vehicle_id)
  values ('a1a1a1a1-0000-0000-0000-000000000001', v_vehicule)
  returning id into v_dossier;

  -- 12 000 × 10 % = 1 200 au maximum pour un réceptionniste.
  insert into public.service_order_items (service_order_id, service_id, discount_amount_minor)
  values (v_dossier, '5e000000-0000-0000-0000-000000000002', 400);
  raise notice 'ok — une remise dans le plafond est acceptée';

  begin
    insert into public.service_order_items (service_order_id, service_id, discount_amount_minor)
    values (v_dossier, '5e000000-0000-0000-0000-000000000001', 3000);
    raise exception 'ÉCHEC — remise excessive acceptée sans payments.refund';
  exception
    when insufficient_privilege then
      raise notice 'ok — une remise au-delà du plafond exige payments.refund';
  end;
end;
$$;

-- Un opérateur lit les dossiers de sa station mais n'en ouvre pas.
select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');
select pg_temp.check('un OPERATOR lit les dossiers de sa station',
  (select count(*) from public.service_orders
    where station_id = 'a1a1a1a1-0000-0000-0000-000000000001'), 3);
do $$
declare v_vehicule uuid;
begin
  select id into v_vehicule from public.vehicles limit 1;
  insert into public.service_orders (station_id, vehicle_id)
  values ('a1a1a1a1-0000-0000-0000-000000000001', v_vehicule);
  raise exception 'ÉCHEC — dossier ouvert sans service_orders.write';
exception
  when insufficient_privilege then
    raise notice 'ok — ouvrir un dossier exige service_orders.write';
end;
$$;

-- Un rôle de portée STATION ne voit pas les dossiers d'une autre station.
set local role postgres;
insert into public.service_orders (organization_id, station_id, vehicle_id, created_by)
select 'aaaaaaaa-0000-0000-0000-000000000001',
       'a2a2a2a2-0000-0000-0000-000000000002', id,
       '11111111-1111-1111-1111-111111111111'
  from public.vehicles limit 1;
set local role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');
select pg_temp.check('un rôle de station ne voit pas l''autre station',
  (select count(*) from public.service_orders
    where station_id = 'a2a2a2a2-0000-0000-0000-000000000002'), 0);

-- Il ne le voit pas — mais un identifiant se devine. La fonction de transition
-- contourne la RLS : elle doit refaire le cloisonnement par station elle-même.
do $$
declare v_dossier uuid;
begin
  set local role postgres;
  select id into v_dossier from public.service_orders
   where station_id = 'a2a2a2a2-0000-0000-0000-000000000002' limit 1;
  set local role authenticated;
  perform pg_temp.login('33333333-3333-3333-3333-333333333333',
                        'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');

  perform public.transitionner_dossier(v_dossier, 'INSPECTION');
  raise exception 'ÉCHEC — transition sur le dossier d''une autre station';
exception
  when insufficient_privilege then
    raise notice 'ok — transitionner hors de sa station est refusé';
end;
$$;

-- Et un identifiant d'une autre organisation ne passe pas davantage.
do $$
declare v_dossier uuid;
begin
  set local role postgres;
  select id into v_dossier from public.service_orders limit 1;
  set local role authenticated;
  perform pg_temp.login('22222222-2222-2222-2222-222222222222',
                        'bbbbbbbb-0000-0000-0000-000000000002', 'OWNER');

  perform public.transitionner_dossier(v_dossier, 'INSPECTION');
  raise exception 'ÉCHEC — transition sur le dossier d''une autre organisation';
exception
  when insufficient_privilege then
    raise notice 'ok — transitionner hors de son organisation est refusé';
end;
$$;

select pg_temp.login('33333333-3333-3333-3333-333333333333',
                     'aaaaaaaa-0000-0000-0000-000000000001', 'OPERATOR');

-- Une autre organisation ne voit rien et ne transitionne rien.
select pg_temp.login('22222222-2222-2222-2222-222222222222',
                     'bbbbbbbb-0000-0000-0000-000000000002', 'OWNER');
select pg_temp.check('l''organisation B ne voit aucun dossier de A',
  (select count(*) from public.service_orders), 0);
select pg_temp.check('l''organisation B ne voit aucune ligne de dossier',
  (select count(*) from public.service_order_items), 0);
select pg_temp.check('l''organisation B ne voit aucun historique',
  (select count(*) from public.service_order_status_history), 0);
select pg_temp.check('l''organisation B ne voit aucun total',
  (select count(*) from public.service_order_totals), 0);

set local role postgres;

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
