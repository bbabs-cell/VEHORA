-- VEHORA — Phase 6 : véhicules.
--
-- Décisions :
--
-- 1. La PLAQUE est l'identifiant opérationnel. Elle est normalisée par la base
--    (majuscules, sans séparateur) : « dk-1234-a », « DK 1234 A » et
--    « DK1234A » désignent le même véhicule. Même raisonnement que pour les
--    numéros de téléphone — le doublon est l'ennemi.
--
-- 2. Le propriétaire est FACULTATIF et non exclusif. Un véhicule peut être
--    amené par un proche, un chauffeur, un collègue. Le client qui l'amène sera
--    enregistré sur la prestation, pas ici.
--
-- 3. On ARCHIVE, on ne supprime pas : un véhicule porte un historique de
--    prestations. L'archivage libère sa plaque.

create table public.vehicles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade
                        default vehora.current_org_id(),
  customer_id      uuid references public.customers(id) on delete set null,
  vehicle_type_id  uuid not null references public.vehicle_types(id) on delete restrict,
  plate            text,
  -- Normalisation par la base : elle ne peut être ni oubliée ni contournée.
  plate_normalized text generated always as (
                     nullif(upper(regexp_replace(coalesce(plate, ''), '[^A-Za-z0-9]', '', 'g')), '')
                   ) stored,
  make             text,
  model            text,
  color            text,
  notes            text,
  archived_at      timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Une plaque identifie un véhicule actif et un seul dans l'organisation.
create unique index vehicles_plaque_unique_idx
  on public.vehicles (organization_id, plate_normalized)
  where archived_at is null and plate_normalized is not null;

create index vehicles_org_idx on public.vehicles (organization_id, created_at desc);
create index vehicles_client_idx on public.vehicles (customer_id);
create index vehicles_type_idx on public.vehicles (vehicle_type_id);
create index vehicles_created_by_idx on public.vehicles (created_by);

create trigger vehicles_touch before update on public.vehicles
  for each row execute function vehora.touch_updated_at();

-- Le client rattaché doit appartenir à la même organisation que le véhicule.
-- Sans ce garde-fou, un identifiant client d'une autre organisation passerait :
-- la policy vérifie le véhicule, pas ce qu'il référence.
create or replace function vehora.check_vehicle_customer_tenancy()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org_client uuid;
begin
  if new.customer_id is null then
    return new;
  end if;

  select organization_id into v_org_client
    from public.customers where id = new.customer_id;

  if v_org_client is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: ce client appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger vehicles_tenancy
  before insert or update of customer_id, organization_id on public.vehicles
  for each row execute function vehora.check_vehicle_customer_tenancy();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.vehicles enable row level security;

create policy "read vehicles" on public.vehicles
  for select to authenticated
  using (vehora.can_read(organization_id, 'vehicles.read'));

create policy "insert vehicles" on public.vehicles
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'vehicles.write'));

create policy "update vehicles" on public.vehicles
  for update to authenticated
  using (vehora.can_write(organization_id, 'vehicles.write'))
  with check (organization_id = vehora.current_org_id());

-- ---------------------------------------------------------------------------
-- Recherche : par plaque, par marque/modèle, ou par nom du propriétaire.
-- ---------------------------------------------------------------------------
create or replace function public.rechercher_vehicules(
  p_recherche text default null,
  p_limite    integer default 25,
  p_decalage  integer default 0
) returns table (
  id               uuid,
  organization_id  uuid,
  customer_id      uuid,
  vehicle_type_id  uuid,
  plate            text,
  plate_normalized text,
  make             text,
  model            text,
  color            text,
  notes            text,
  created_at       timestamptz,
  type_label       text,
  customer_name    text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.organization_id, v.customer_id, v.vehicle_type_id,
         v.plate, v.plate_normalized, v.make, v.model, v.color, v.notes,
         v.created_at, t.label, c.full_name
    from public.vehicles v
    join public.vehicle_types t on t.id = v.vehicle_type_id
    left join public.customers c on c.id = v.customer_id
   where v.archived_at is null
     and (
       p_recherche is null
       or length(trim(p_recherche)) = 0
       or v.plate_normalized like
            '%' || upper(regexp_replace(p_recherche, '[^A-Za-z0-9]', '', 'g')) || '%'
       or v.make  ilike '%' || trim(p_recherche) || '%'
       or v.model ilike '%' || trim(p_recherche) || '%'
       or c.full_name ilike '%' || trim(p_recherche) || '%'
       or extensions.similarity(coalesce(c.full_name, ''), trim(p_recherche)) > 0.25
     )
   order by v.created_at desc
   limit least(coalesce(p_limite, 25), 100)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

comment on function public.rechercher_vehicules(text, integer, integer) is
  'security invoker : la RLS s''applique normalement, sur les véhicules comme sur les clients joints.';

grant execute on function public.rechercher_vehicules(text, integer, integer) to authenticated;
