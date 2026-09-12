-- VEHORA — Phase 5 : clients.
--
-- Choix dictés par le terrain (skill vehora-west-africa) :
--
-- 1. Le TÉLÉPHONE est l'identifiant naturel, pas l'e-mail — souvent absent.
--    Il est stocké au format international et indexé sur ses seuls chiffres,
--    pour que « 77 123 45 67 », « +221771234567 » et « 00221 77 123 45 67 »
--    désignent la même personne.
--
-- 2. L'ORTHOGRAPHE DES NOMS VARIE (Moussa/Mousa, Cheikh/Sheikh). Une recherche
--    par égalité exacte serait inutilisable : on indexe en trigrammes pour une
--    recherche tolérante.
--
-- 3. On ARCHIVE, on ne supprime pas : un client porte un historique de
--    prestations et de paiements.

create extension if not exists pg_trgm with schema extensions;

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade
                       default vehora.current_org_id(),
  full_name       text not null check (length(trim(full_name)) between 2 and 120),
  phone           text,
  -- Chiffres seuls, calculés par la base : la normalisation ne peut pas être
  -- oubliée par un appelant, ni contournée par un client manipulé.
  phone_digits    text generated always as (
                    nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
                  ) stored,
  email           text,
  notes           text,
  archived_at     timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Un numéro identifie un client actif et un seul : c'est la première source
-- d'erreur en station (deux fiches pour la même personne).
create unique index customers_telephone_unique_idx
  on public.customers (organization_id, phone_digits)
  where archived_at is null and phone_digits is not null;

create index customers_org_nom_idx on public.customers (organization_id, full_name);
create index customers_nom_trgm_idx on public.customers
  using gin (full_name extensions.gin_trgm_ops);
create index customers_created_by_idx on public.customers (created_by);

create trigger customers_touch before update on public.customers
  for each row execute function vehora.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.customers enable row level security;

create policy "read customers" on public.customers
  for select to authenticated
  using (vehora.can_read(organization_id, 'customers.read'));

create policy "write customers" on public.customers
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'customers.write'));

create policy "update customers" on public.customers
  for update to authenticated
  using (vehora.can_write(organization_id, 'customers.write'))
  with check (organization_id = vehora.current_org_id());

-- La suppression définitive reste possible pour les porteurs de
-- `customers.delete` (correction d'une saisie erronée), mais l'interface
-- propose l'archivage : l'historique prime.
create policy "delete customers" on public.customers
  for delete to authenticated
  using (vehora.can_write(organization_id, 'customers.delete'));

-- ---------------------------------------------------------------------------
-- Recherche tolérante : nom approximatif OU chiffres du téléphone.
-- ---------------------------------------------------------------------------
create or replace function public.rechercher_clients(
  p_recherche text default null,
  p_limite    integer default 25,
  p_decalage  integer default 0
) returns setof public.customers
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
    from public.customers c
   where c.archived_at is null
     and (
       p_recherche is null
       or length(trim(p_recherche)) = 0
       or c.full_name ilike '%' || trim(p_recherche) || '%'
       or extensions.similarity(c.full_name, trim(p_recherche)) > 0.25
       or (
         nullif(regexp_replace(p_recherche, '[^0-9]', '', 'g'), '') is not null
         and c.phone_digits like '%' || regexp_replace(p_recherche, '[^0-9]', '', 'g') || '%'
       )
     )
   order by
     case when p_recherche is null or length(trim(p_recherche)) = 0 then 0
          else -extensions.similarity(c.full_name, trim(p_recherche)) end,
     c.full_name
   limit least(coalesce(p_limite, 25), 100)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

-- `security invoker` : la fonction ne contourne rien, la RLS s'applique
-- normalement. C'est une commodité de recherche, pas une porte dérobée.
grant execute on function public.rechercher_clients(text, integer, integer) to authenticated;
