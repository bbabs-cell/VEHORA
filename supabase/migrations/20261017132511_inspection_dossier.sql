-- Rattacher une inspection à son dossier.
--
-- Constaté sur la base réelle le 17 octobre : le dossier n° 1 est resté neuf
-- jours à l'étape « Inspection ». Le passage INSPECTION → WAITING exige une
-- inspection dont `service_order_id` désigne le dossier (condition
-- INSPECTION_DONE de `transitionner_dossier`) ; or l'écran d'inspection n'a
-- jamais rempli cette colonne. Elle avait été créée en phase 6 « pour la
-- phase 8 », sans clé étrangère ni contrôle, et la phase 8 ne l'a jamais
-- branchée. Quatre inspections enregistrées, quatre refus. Les tests de
-- parcours ne l'ont pas vu : leur fixture créait l'inspection par l'API, déjà
-- rattachée — elle sautait précisément l'étape cassée.
--
-- Cette migration ferme le côté base ; l'écran est corrigé dans le même
-- commit :
-- 1. la clé étrangère qui manquait ;
-- 2. un garde-fou de cohérence. Une policy vérifie la ligne, pas ce qu'elle
--    référence : sans lui, une organisation pouvait rattacher son inspection
--    au dossier d'une autre et lui faire franchir l'étape (il suffisait d'en
--    connaître l'identifiant), et une inspection du véhicule A débloquait le
--    dossier du véhicule B ;
-- 3. la station de l'inspection, reprise du dossier quand l'écran ne la donne
--    pas : une donnée rattachée à un site porte son site.

alter table public.vehicle_inspections
  add constraint vehicle_inspections_service_order_id_fkey
  foreign key (service_order_id) references public.service_orders (id) on delete set null;

-- `transitionner_dossier` cherche l'inspection par dossier ; la file aussi.
create index vehicle_inspections_dossier_idx
  on public.vehicle_inspections (service_order_id)
  where service_order_id is not null;

-- SECURITY INVOKER, comme `check_inspection_tenancy` : le dossier est lu sous
-- la RLS de l'appelant. Le dossier d'une autre organisation lui est donc
-- invisible et se signale « introuvable » — on ne confirme pas qu'il existe.
-- Tous les rôles qui ont `inspections.write` ont aussi `service_orders.read`.
create or replace function vehora.check_inspection_dossier()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org     uuid;
  v_vehicle uuid;
  v_station uuid;
begin
  -- Sans dossier, rien à vérifier. C'est aussi le cas de la mise à NULL par
  -- la cascade quand un dossier disparaît avec son organisation : un garde-fou
  -- qui parlerait pendant une cascade rendrait l'organisation insupprimable
  -- (quatre incidents de ce genre dans l'histoire du projet).
  if new.service_order_id is null then
    return new;
  end if;

  select organization_id, vehicle_id, station_id
    into v_org, v_vehicle, v_station
    from public.service_orders
   where id = new.service_order_id;

  if v_org is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: ce dossier est introuvable'
      using errcode = 'insufficient_privilege';
  end if;

  if v_vehicle is distinct from new.vehicle_id then
    raise exception 'VEHORA_INSPECTION_AUTRE_VEHICULE: cette inspection porte sur un autre véhicule que celui du dossier'
      using errcode = 'check_violation';
  end if;

  if new.station_id is null then
    new.station_id := v_station;
  end if;

  return new;
end;
$$;

comment on function vehora.check_inspection_dossier() is
  'Une inspection ne désigne qu''un dossier de la même organisation et du même véhicule, et en reprend la station. Muette quand service_order_id est NULL (cascade comprise).';

-- Déclenché avant `vehicle_inspections_tenancy` (ordre alphabétique) : la
-- station reprise du dossier passe ensuite par le contrôle de station.
create trigger vehicle_inspections_dossier
  before insert or update of service_order_id, vehicle_id, organization_id
  on public.vehicle_inspections
  for each row execute function vehora.check_inspection_dossier();
