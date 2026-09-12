-- VEHORA — Phase 6 : référentiel des types de véhicules.
--
-- Le référentiel est global à la plateforme, pas propre à chaque organisation
-- (§19 du prompt maître : le Super Admin gère les catégories de véhicules).
-- Raison pratique : le type conditionne le tarif, et un tarif « SUV » doit
-- vouloir dire la même chose partout — sinon les comparaisons entre stations
-- d'un même réseau n'ont plus de sens.
--
-- Une organisation qui aurait besoin d'un type propre passera plus tard par un
-- type personnalisé ; on ne crée pas cette complexité avant qu'elle serve.

create table public.vehicle_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text not null,
  -- Ordre d'affichage : du plus fréquent au plus rare en station, pas
  -- l'alphabet. Le réceptionniste doit trouver « Berline » sans chercher.
  sort_order  integer not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.vehicle_types (code, label, sort_order) values
  ('SEDAN',      'Berline',              10),
  ('CITY',       'Citadine',             20),
  ('SUV',        'SUV',                  30),
  ('PICKUP',     'Pick-up',              40),
  ('FOUR_BY_4',  '4x4',                  50),
  ('VAN',        'Utilitaire',           60),
  ('MOTORCYCLE', 'Moto',                 70),
  ('TRUCK',      'Camion',               80),
  ('OTHER',      'Autre',                99);

alter table public.vehicle_types enable row level security;

-- Référentiel : lisible par tout utilisateur connecté, modifiable par personne
-- via l'API. Sa gestion relève du Super Admin.
create policy "vehicle types readable" on public.vehicle_types
  for select to authenticated using (true);
