-- VEHORA — Phase 10 : employés et opérations (fondations 2 et 4).
--
-- Fondation 2, règle centrale : « personne qui travaille » et « personne qui se
-- connecte » sont deux choses différentes. Un laveur n'a souvent pas de compte,
-- mais son travail doit être tracé ; un comptable a un compte et ne lave aucune
-- voiture. Les opérations référencent donc `employee_id`, jamais `profile_id`.
--
-- Conséquence pratique : un employé qui quitte l'entreprise est désactivé, son
-- historique de travail reste intact, et la suppression de son compte de
-- connexion — s'il en avait un — n'efface rien.

create type public.employee_status as enum ('ACTIVE', 'INACTIVE');

-- PENDING → IN_PROGRESS → DONE. Pas de retour arrière libre : une opération
-- reprise l'est explicitement, avec trace.
create type public.operation_status as enum ('PENDING', 'IN_PROGRESS', 'DONE');

create table public.employees (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade
                       default vehora.current_org_id(),
  -- Lien FACULTATIF vers un compte. C'est le cas par défaut du MVP : pas de
  -- compte. Le chef d'équipe assigne et valide pour lui.
  profile_id      uuid references public.profiles(id) on delete set null,
  station_id      uuid references public.stations(id) on delete set null,
  full_name       text not null check (length(trim(full_name)) between 2 and 120),
  phone           text,
  -- Même invariant que pour les clients : un numéro se compare normalisé, ou
  -- ne se compare pas. Rempli par trigger, jamais par le client.
  phone_digits    text,
  status          public.employee_status not null default 'ACTIVE',
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Un même compte n'est pas deux employés de la même organisation.
  unique (organization_id, profile_id)
);

create index employees_org_idx on public.employees (organization_id, status, full_name);
create index employees_station_idx on public.employees (station_id);
create index employees_profile_idx on public.employees (profile_id);
create index employees_created_by_idx on public.employees (created_by);

create trigger employees_touch before update on public.employees
  for each row execute function vehora.touch_updated_at();

-- Le téléphone d'un employé suit la même normalisation que celui d'un client :
-- c'est la même réalité. La fonction de la phase 5 était écrite pour
-- `customers` ; on en extrait une version générique plutôt que d'en recopier
-- une seconde — deux normalisations finissent toujours par diverger.
create or replace function vehora.normaliser_telephone_ligne()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_pays text;
begin
  select country_code into v_pays
    from public.organizations where id = new.organization_id;

  new.phone_digits := vehora.normaliser_telephone(new.phone, v_pays);
  return new;
end;
$$;

create trigger employees_telephone
  before insert or update of phone, organization_id on public.employees
  for each row execute function vehora.normaliser_telephone_ligne();

-- Compétences : les services qu'un employé est autorisé à exécuter.
-- Aucune ligne = aucune restriction. On n'impose pas de déclarer les
-- compétences de tout le monde le premier jour pour que le produit serve.
create table public.employee_services (
  employee_id     uuid not null references public.employees(id) on delete cascade,
  service_id      uuid not null references public.services(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade
                       default vehora.current_org_id(),
  primary key (employee_id, service_id)
);

create index employee_services_service_idx on public.employee_services (service_id);
create index employee_services_org_idx on public.employee_services (organization_id);

-- ---------------------------------------------------------------------------
-- Opérations : le travail à faire sur un dossier, ligne par ligne.
-- ---------------------------------------------------------------------------
create table public.service_order_operations (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  service_order_id   uuid not null references public.service_orders(id) on delete cascade,
  -- Une opération par ligne de dossier : ce qui a été vendu est ce qui doit
  -- être fait. La ligne étant figée au démarrage du travail, la correspondance
  -- ne peut plus diverger.
  item_id            uuid not null references public.service_order_items(id) on delete cascade,
  service_name       text not null,
  employee_id        uuid references public.employees(id) on delete set null,
  status             public.operation_status not null default 'PENDING',
  started_at         timestamptz,
  completed_at       timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (item_id)
);

create index operations_dossier_idx on public.service_order_operations (service_order_id);
create index operations_employe_idx
  on public.service_order_operations (employee_id, status, created_at);
create index operations_org_idx
  on public.service_order_operations (organization_id, status, created_at);

create trigger operations_touch before update on public.service_order_operations
  for each row execute function vehora.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------

-- L'employé, la station et le compte lié appartiennent à l'organisation.
create or replace function vehora.check_employee_tenancy()
returns trigger language plpgsql set search_path = '' as $$
declare v_org uuid;
begin
  if new.station_id is not null then
    select organization_id into v_org from public.stations where id = new.station_id;
    if v_org is distinct from new.organization_id then
      raise exception 'VEHORA_TENANCY_VIOLATION: cette station appartient à une autre organisation'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Un compte ne se rattache à un employé que s'il est déjà membre de
  -- l'organisation : sinon, créer un employé deviendrait un moyen détourné
  -- d'associer n'importe quel compte à n'importe quelle entreprise.
  if new.profile_id is not null
     and not exists (select 1 from public.organization_memberships m
                      where m.profile_id = new.profile_id
                        and m.organization_id = new.organization_id) then
    raise exception 'VEHORA_TENANCY_VIOLATION: ce compte n''est pas membre de votre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger employees_tenancy
  before insert or update of station_id, profile_id, organization_id on public.employees
  for each row execute function vehora.check_employee_tenancy();

create or replace function vehora.check_employee_service_tenancy()
returns trigger language plpgsql set search_path = '' as $$
declare v_emp uuid; v_srv uuid;
begin
  select organization_id into v_emp from public.employees where id = new.employee_id;
  select organization_id into v_srv from public.services where id = new.service_id;
  if v_emp is distinct from new.organization_id or v_srv is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: employé et prestation doivent appartenir à votre organisation'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger employee_services_tenancy
  before insert or update on public.employee_services
  for each row execute function vehora.check_employee_service_tenancy();

-- Une opération se pilote par deux permissions distinctes : assigner n'est pas
-- exécuter. Une policy RLS ne voit pas quelle colonne a changé — un trigger, si.
create or replace function vehora.protect_operation()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_dossier public.service_orders;
  v_employe public.employees;
begin
  select * into v_dossier from public.service_orders where id = new.service_order_id;

  if v_dossier.status in ('DELIVERED', 'CANCELLED') then
    raise exception 'VEHORA_DOSSIER_CLOS: ce dossier est restitué ou annulé'
      using errcode = 'insufficient_privilege';
  end if;

  -- Assignation
  if new.employee_id is distinct from old.employee_id then
    if not vehora.can_write(new.organization_id, 'operations.assign', v_dossier.station_id) then
      raise exception 'VEHORA_PERMISSION: assigner une opération exige operations.assign'
        using errcode = 'insufficient_privilege';
    end if;

    if new.employee_id is not null then
      select * into v_employe from public.employees where id = new.employee_id;

      if v_employe.organization_id is distinct from new.organization_id then
        raise exception 'VEHORA_TENANCY_VIOLATION: cet employé appartient à une autre organisation'
          using errcode = 'insufficient_privilege';
      end if;

      if v_employe.status <> 'ACTIVE' then
        raise exception 'VEHORA_EMPLOYE_INACTIF: cet employé n''est plus actif'
          using errcode = 'check_violation';
      end if;

      -- Compétence : si l'employé a des compétences déclarées, la prestation
      -- doit en faire partie. Aucune compétence déclarée = aucune restriction.
      if exists (select 1 from public.employee_services
                  where employee_id = v_employe.id)
         and not exists (select 1 from public.employee_services es
                          join public.service_order_items i on i.service_id = es.service_id
                         where es.employee_id = v_employe.id and i.id = new.item_id) then
        raise exception 'VEHORA_COMPETENCE_MANQUANTE: cet employé n''exécute pas cette prestation'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  -- Exécution
  if new.status is distinct from old.status then
    if not vehora.can_write(new.organization_id, 'operations.execute', v_dossier.station_id) then
      raise exception 'VEHORA_PERMISSION: faire avancer une opération exige operations.execute'
        using errcode = 'insufficient_privilege';
    end if;

    if not ((old.status = 'PENDING'     and new.status = 'IN_PROGRESS')
         or (old.status = 'IN_PROGRESS' and new.status = 'DONE')
         or (old.status = 'IN_PROGRESS' and new.status = 'PENDING')) then
      raise exception 'VEHORA_OPERATION_TRANSITION: passage de % à % non prévu', old.status, new.status
        using errcode = 'check_violation';
    end if;

    -- On ne démarre pas un travail sans savoir qui le fait : sinon la trace
    -- ne sert à rien, et c'est précisément ce qu'on cherche à obtenir.
    if new.status = 'IN_PROGRESS' and new.employee_id is null then
      raise exception 'VEHORA_OPERATION_SANS_EMPLOYE: assignez un employé avant de démarrer'
        using errcode = 'check_violation';
    end if;

    new.started_at := case when new.status = 'IN_PROGRESS' then coalesce(old.started_at, now())
                           when new.status = 'PENDING' then null
                           else old.started_at end;
    new.completed_at := case when new.status = 'DONE' then now() else null end;
  end if;

  return new;
end;
$$;

create trigger operations_protege
  before update on public.service_order_operations
  for each row execute function vehora.protect_operation();

-- Les opérations naissent de la mise en file d'attente : le travail à faire,
-- c'est exactement ce qui a été vendu. Les créer là garantit qu'elles
-- correspondent aux lignes — lesquelles sont figées à partir de ce moment.
create or replace function vehora.creer_operations_du_dossier(p_dossier uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.service_order_operations
    (organization_id, service_order_id, item_id, service_name)
  select i.organization_id, i.service_order_id, i.id, i.service_name
    from public.service_order_items i
   where i.service_order_id = p_dossier
  on conflict (item_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nouvelles transitions de dossier : des lignes, pas du code.
-- ---------------------------------------------------------------------------
insert into public.service_order_transitions
  (from_status, to_status, required_permission, condition_code, requires_reason, must_audit)
values
  ('WAITING',     'IN_PROGRESS', 'operations.execute',        'OPERATIONS_ASSIGNED', false, false),
  ('IN_PROGRESS', 'CONTROL',     'operations.execute',        'OPERATIONS_DONE',     false, false),
  ('IN_PROGRESS', 'READY',       'service_orders.transition', 'QUALITY_OPTIONAL',    false, false),
  ('CONTROL',     'READY',       'quality_controls.execute',  null,                  false, false),
  ('CONTROL',     'IN_PROGRESS', 'quality_controls.execute',  null,                  true,  true),
  ('IN_PROGRESS', 'CANCELLED',   'service_orders.cancel',     null,                  true,  true),
  ('CONTROL',     'CANCELLED',   'service_orders.cancel',     null,                  true,  true),
  ('READY',       'CANCELLED',   'service_orders.cancel',     null,                  true,  true);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.employees                enable row level security;
alter table public.employee_services        enable row level security;
alter table public.service_order_operations enable row level security;

-- Lecture des employés : tout membre. Le tableau des opérations affiche qui
-- fait quoi ; exiger `employees.manage` pour lire un nom reviendrait à donner
-- la gestion des employés à toute la station.
create policy "read employees" on public.employees
  for select to authenticated
  using (organization_id = vehora.current_org_id());

create policy "insert employees" on public.employees
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'employees.manage'));

create policy "update employees" on public.employees
  for update to authenticated
  using (vehora.can_write(organization_id, 'employees.manage'))
  with check (organization_id = vehora.current_org_id());

-- Aucune policy DELETE : un employé se désactive. Son historique de travail
-- doit survivre à son départ.

create policy "read employee services" on public.employee_services
  for select to authenticated
  using (organization_id = vehora.current_org_id());

create policy "write employee services" on public.employee_services
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'employees.manage'));

create policy "delete employee services" on public.employee_services
  for delete to authenticated
  using (vehora.can_write(organization_id, 'employees.manage'));

create policy "read operations" on public.service_order_operations
  for select to authenticated
  using (vehora.can_read(organization_id, 'service_orders.read'));

-- L'écriture passe par l'UPDATE, dont le trigger distingue assignation et
-- exécution. La policy laisse entrer les deux permissions ; le trigger tranche.
create policy "update operations" on public.service_order_operations
  for update to authenticated
  using (
    organization_id = vehora.current_org_id()
    and (vehora.has_permission('operations.assign')
      or vehora.has_permission('operations.execute'))
  )
  with check (organization_id = vehora.current_org_id());

-- Aucune policy INSERT ni DELETE : les opérations naissent et meurent avec les
-- lignes du dossier, par la fonction de transition.
