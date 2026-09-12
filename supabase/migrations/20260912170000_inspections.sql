-- VEHORA — Phase 7 : inspection du véhicule à l'arrivée.
--
-- Objectif métier (§27) : constater l'état du véhicule AVANT la prestation.
-- C'est ce qui protège la station d'une accusation de rayure, et le client
-- d'un dommage réel non signalé. L'inspection doit donc être rapide — une
-- minute, au comptoir, sur un téléphone — sinon elle ne sera pas faite.
--
-- L'inspection est rattachée au VÉHICULE. Elle portera aussi la prestation
-- (`service_order_id`) dès que celle-ci existera : la colonne est déjà là,
-- nullable, pour éviter une migration de données plus tard.

-- Zones de contrôle, référentiel global : un « pare-chocs avant » doit
-- désigner la même chose d'une station à l'autre.
create table public.inspection_zones (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,
  sort_order integer not null,
  is_active  boolean not null default true
);

-- Ordre de la ronde autour du véhicule : on tourne, on ne saute pas.
insert into public.inspection_zones (code, label, sort_order) values
  ('FRONT',        'Avant',            10),
  ('LEFT_SIDE',    'Côté gauche',      20),
  ('REAR',         'Arrière',          30),
  ('RIGHT_SIDE',   'Côté droit',       40),
  ('ROOF',         'Toit',             50),
  ('WINDSHIELD',   'Pare-brise',       60),
  ('WHEELS',       'Jantes et pneus',  70),
  ('MIRRORS',      'Rétroviseurs',     80),
  ('INTERIOR',     'Intérieur',        90),
  ('TRUNK',        'Coffre',          100);

alter table public.inspection_zones enable row level security;
create policy "inspection zones readable" on public.inspection_zones
  for select to authenticated using (true);

-- État constaté sur une zone.
create type public.inspection_condition as enum ('OK', 'ANOMALY');

create table public.vehicle_inspections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade
                        default vehora.current_org_id(),
  station_id       uuid references public.stations(id) on delete set null,
  vehicle_id       uuid not null references public.vehicles(id) on delete cascade,
  -- Rattachement à la prestation : arrive en phase 8.
  service_order_id uuid,
  notes            text,
  performed_by     uuid references public.profiles(id) on delete set null,
  performed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index vehicle_inspections_vehicule_idx
  on public.vehicle_inspections (vehicle_id, performed_at desc);
create index vehicle_inspections_org_idx
  on public.vehicle_inspections (organization_id, performed_at desc);
create index vehicle_inspections_station_idx on public.vehicle_inspections (station_id);
create index vehicle_inspections_par_idx on public.vehicle_inspections (performed_by);

create table public.inspection_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade
                       default vehora.current_org_id(),
  inspection_id   uuid not null references public.vehicle_inspections(id) on delete cascade,
  zone_id         uuid not null references public.inspection_zones(id) on delete restrict,
  condition       public.inspection_condition not null,
  comment         text,
  created_at      timestamptz not null default now(),
  -- Une zone n'est constatée qu'une fois par inspection.
  unique (inspection_id, zone_id)
);

create index inspection_items_inspection_idx on public.inspection_items (inspection_id);
create index inspection_items_zone_idx on public.inspection_items (zone_id);

create table public.inspection_photos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade
                       default vehora.current_org_id(),
  inspection_id   uuid not null references public.vehicle_inspections(id) on delete cascade,
  item_id         uuid references public.inspection_items(id) on delete set null,
  -- Chemin dans le bucket, JAMAIS une URL publique : l'accès passe par une URL
  -- signée à durée courte.
  storage_path    text not null unique,
  taken_at        timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);

create index inspection_photos_inspection_idx on public.inspection_photos (inspection_id);
create index inspection_photos_item_idx on public.inspection_photos (item_id);
create index inspection_photos_par_idx on public.inspection_photos (created_by);

-- ---------------------------------------------------------------------------
-- Cohérence multi-tenant : une policy vérifie la ligne, pas ce qu'elle
-- référence. Chaque clé étrangère vers une table cloisonnée a son garde-fou.
-- ---------------------------------------------------------------------------
create or replace function vehora.check_inspection_tenancy()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.vehicles where id = new.vehicle_id;
  if v_org is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: ce véhicule appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if new.station_id is not null then
    select organization_id into v_org from public.stations where id = new.station_id;
    if v_org is distinct from new.organization_id then
      raise exception 'VEHORA_TENANCY_VIOLATION: cette station appartient à une autre organisation'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger vehicle_inspections_tenancy
  before insert or update of vehicle_id, station_id, organization_id
  on public.vehicle_inspections
  for each row execute function vehora.check_inspection_tenancy();

create or replace function vehora.check_inspection_enfant_tenancy()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org
    from public.vehicle_inspections where id = new.inspection_id;
  if v_org is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: cette inspection appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger inspection_items_tenancy
  before insert or update of inspection_id, organization_id on public.inspection_items
  for each row execute function vehora.check_inspection_enfant_tenancy();

create trigger inspection_photos_tenancy
  before insert or update of inspection_id, organization_id on public.inspection_photos
  for each row execute function vehora.check_inspection_enfant_tenancy();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.vehicle_inspections enable row level security;
alter table public.inspection_items    enable row level security;
alter table public.inspection_photos   enable row level security;

-- Lecture : quiconque peut voir les véhicules peut voir leur état constaté —
-- c'est une information de travail, pas une donnée sensible.
create policy "read inspections" on public.vehicle_inspections
  for select to authenticated
  using (vehora.can_read(organization_id, 'vehicles.read', station_id));

create policy "write inspections" on public.vehicle_inspections
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'inspections.write', station_id));

-- Pas de policy UPDATE ni DELETE : une inspection est un CONSTAT daté.
-- La modifier après coup lui retirerait toute valeur de preuve. Une erreur se
-- corrige par une nouvelle inspection, qui laisse les deux visibles.

create policy "read inspection items" on public.inspection_items
  for select to authenticated
  using (vehora.can_read(organization_id, 'vehicles.read'));

create policy "write inspection items" on public.inspection_items
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'inspections.write'));

create policy "read inspection photos" on public.inspection_photos
  for select to authenticated
  using (vehora.can_read(organization_id, 'vehicles.read'));

create policy "write inspection photos" on public.inspection_photos
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'inspections.write'));
