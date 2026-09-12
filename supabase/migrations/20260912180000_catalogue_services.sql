-- VEHORA — Phase 8 : catalogue de services et tarification (fondation 5).
--
-- Trois tables, une seule idée : le SERVEUR détermine le prix. Le client
-- envoie « service X, véhicule de type Y, station Z » ; il ne propose jamais
-- un montant. Un total accepté depuis le navigateur est un total négociable.
--
-- La tarification est un arbre de spécificité, pas une colonne `price` :
--   1. service + type de véhicule + station
--   2. service + type de véhicule (toutes stations)
--   3. service seul
-- Aucun prix trouvé → erreur explicite. Jamais de prix implicite à zéro :
-- un lavage à 0 FCFA passe inaperçu jusqu'à la clôture de caisse.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Catégories : regroupement d'affichage (Lavage, Intérieur, Detailing…).
-- Propres à chaque organisation — un centre de detailing ne range pas ses
-- prestations comme une station-service.
-- ---------------------------------------------------------------------------
create table public.service_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade
                       default vehora.current_org_id(),
  name            text not null check (length(trim(name)) between 2 and 60),
  sort_order      integer not null default 100,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create index service_categories_org_idx
  on public.service_categories (organization_id, sort_order, name);

create trigger service_categories_touch before update on public.service_categories
  for each row execute function vehora.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Services.
-- ---------------------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade
                        default vehora.current_org_id(),
  category_id      uuid references public.service_categories(id) on delete set null,
  name             text not null check (length(trim(name)) between 2 and 80),
  description      text,
  -- Durée indicative : sert à annoncer une attente au client et, plus tard, à
  -- estimer la charge de la file. `null` = non renseignée, jamais 0.
  duration_minutes integer check (duration_minutes between 1 and 1440),
  sort_order       integer not null default 100,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, name)
);

create index services_org_idx on public.services (organization_id, sort_order, name);
create index services_category_idx on public.services (category_id);

create trigger services_touch before update on public.services
  for each row execute function vehora.touch_updated_at();

-- La catégorie rattachée doit appartenir à la même organisation : la policy
-- vérifie la ligne, pas ce qu'elle référence.
create or replace function vehora.check_service_category_tenancy()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org uuid;
begin
  if new.category_id is null then
    return new;
  end if;

  select organization_id into v_org
    from public.service_categories where id = new.category_id;

  if v_org is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: cette catégorie appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger services_tenancy
  before insert or update of category_id, organization_id on public.services
  for each row execute function vehora.check_service_category_tenancy();

-- ---------------------------------------------------------------------------
-- Tarifs.
--
-- `vehicle_type_id` null = ce prix vaut pour tous les types de véhicule.
-- `station_id`      null = ce prix vaut pour toutes les stations.
-- `valid_to`        null = tarif toujours en vigueur.
--
-- On n'écrase jamais un tarif : on ferme l'ancien (`valid_to`) et on en ouvre
-- un nouveau. L'historique des prix est une donnée comptable.
-- ---------------------------------------------------------------------------
create table public.service_prices (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade
                        default vehora.current_org_id(),
  service_id       uuid not null references public.services(id) on delete cascade,
  vehicle_type_id  uuid references public.vehicle_types(id) on delete restrict,
  station_id       uuid references public.stations(id) on delete cascade,
  -- Entier, plus petite unité de la devise. Jamais de float pour de l'argent.
  amount_minor     bigint not null check (amount_minor >= 0),
  -- Renseignée par la base depuis l'organisation : le client ne choisit pas
  -- la devise dans laquelle il sera facturé.
  currency         text not null,
  valid_from       date not null default current_date,
  valid_to         date,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create index service_prices_resolution_idx
  on public.service_prices (organization_id, service_id, valid_from desc);
create index service_prices_station_idx on public.service_prices (station_id);
create index service_prices_vehicle_type_idx on public.service_prices (vehicle_type_id);
create index service_prices_created_by_idx on public.service_prices (created_by);

create trigger service_prices_touch before update on public.service_prices
  for each row execute function vehora.touch_updated_at();

-- Deux tarifs de même spécificité valables le même jour rendraient le prix
-- indéterminé — et c'est exactement le genre d'ambiguïté qu'un client
-- mécontent découvre avant nous. Les `null` ne s'excluant jamais entre eux,
-- on les projette sur une valeur sentinelle.
alter table public.service_prices
  add constraint service_prices_no_overlap
  exclude using gist (
    service_id with =,
    coalesce(vehicle_type_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    coalesce(station_id,      '00000000-0000-0000-0000-000000000000'::uuid) with =,
    daterange(valid_from, valid_to, '[]') with &&
  );

-- Service et station doivent appartenir à l'organisation du tarif.
create or replace function vehora.check_service_price_tenancy()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org
    from public.services where id = new.service_id;
  if v_org is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: ce service appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if new.station_id is not null then
    select organization_id into v_org
      from public.stations where id = new.station_id;
    if v_org is distinct from new.organization_id then
      raise exception 'VEHORA_TENANCY_VIOLATION: cette station appartient à une autre organisation'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger service_prices_tenancy
  before insert or update of service_id, station_id, organization_id
  on public.service_prices
  for each row execute function vehora.check_service_price_tenancy();

-- La devise vient de l'organisation, quoi qu'envoie l'appelant.
create or replace function vehora.set_service_price_currency()
returns trigger language plpgsql set search_path = '' as $$
begin
  select currency into new.currency
    from public.organizations where id = new.organization_id;
  if new.currency is null then
    raise exception 'VEHORA_DEVISE_INCONNUE: organisation introuvable'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger service_prices_currency
  before insert or update on public.service_prices
  for each row execute function vehora.set_service_price_currency();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Lecture : tout membre de l'organisation. Le catalogue et ses prix sont
-- affichés à l'accueil, en opérations et en caisse — exiger une permission
-- dédiée reviendrait à la donner à tout le monde.
-- Écriture : `services.manage` pour le catalogue, `prices.manage` pour les
-- tarifs. Ce sont deux métiers différents : un chef de station peut réorganiser
-- son catalogue sans pouvoir changer les prix.
-- ---------------------------------------------------------------------------
alter table public.service_categories enable row level security;
alter table public.services           enable row level security;
alter table public.service_prices     enable row level security;

create policy "read service categories" on public.service_categories
  for select to authenticated
  using (organization_id = vehora.current_org_id());

create policy "insert service categories" on public.service_categories
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'services.manage'));

create policy "update service categories" on public.service_categories
  for update to authenticated
  using (vehora.can_write(organization_id, 'services.manage'))
  with check (organization_id = vehora.current_org_id());

create policy "delete service categories" on public.service_categories
  for delete to authenticated
  using (vehora.can_write(organization_id, 'services.manage'));

create policy "read services" on public.services
  for select to authenticated
  using (organization_id = vehora.current_org_id());

create policy "insert services" on public.services
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'services.manage'));

create policy "update services" on public.services
  for update to authenticated
  using (vehora.can_write(organization_id, 'services.manage'))
  with check (organization_id = vehora.current_org_id());

create policy "delete services" on public.services
  for delete to authenticated
  using (vehora.can_write(organization_id, 'services.manage'));

create policy "read service prices" on public.service_prices
  for select to authenticated
  using (organization_id = vehora.current_org_id());

create policy "insert service prices" on public.service_prices
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'prices.manage'));

create policy "update service prices" on public.service_prices
  for update to authenticated
  using (vehora.can_write(organization_id, 'prices.manage'))
  with check (organization_id = vehora.current_org_id());

create policy "delete service prices" on public.service_prices
  for delete to authenticated
  using (vehora.can_write(organization_id, 'prices.manage'));

-- ---------------------------------------------------------------------------
-- Résolution du prix.
--
-- SECURITY INVOKER volontairement : la fonction lit `service_prices` sous la
-- RLS de l'appelant. Une organisation ne peut donc pas résoudre le tarif d'une
-- autre, même en devinant un identifiant.
-- ---------------------------------------------------------------------------
create or replace function public.resoudre_prix(
  p_service_id      uuid,
  p_vehicle_type_id uuid default null,
  p_station_id      uuid default null,
  p_date            date default current_date
)
returns table (
  price_id     uuid,
  amount_minor bigint,
  currency     text,
  specificite  text
)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    p.amount_minor,
    p.currency,
    case
      when p.vehicle_type_id is not null and p.station_id is not null then 'SERVICE_TYPE_STATION'
      when p.vehicle_type_id is not null then 'SERVICE_TYPE'
      when p.station_id is not null then 'SERVICE_STATION'
      else 'SERVICE'
    end
  from public.service_prices p
  where p.service_id = p_service_id
    and p.valid_from <= p_date
    and (p.valid_to is null or p.valid_to >= p_date)
    and (p.vehicle_type_id is null or p.vehicle_type_id = p_vehicle_type_id)
    and (p.station_id is null or p.station_id = p_station_id)
  -- Le type de véhicule prime sur la station : un SUV coûte plus cher partout,
  -- alors qu'une station ne pratique un tarif propre que par exception.
  order by
    (case when p.vehicle_type_id is not null then 2 else 0 end)
  + (case when p.station_id      is not null then 1 else 0 end) desc,
    p.valid_from desc
  limit 1;
$$;

grant execute on function public.resoudre_prix(uuid, uuid, uuid, date) to authenticated;

comment on function public.resoudre_prix is
  'Prix applicable, du plus spécifique au plus général. Aucune ligne = aucun tarif défini : l''appelant doit refuser, jamais facturer zéro.';
