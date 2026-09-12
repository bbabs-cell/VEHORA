-- VEHORA — Phase 9 : le Service Order (fondation 4).
--
-- C'est le cœur du produit : le dossier qui relie un client, un véhicule, une
-- station, des prestations tarifées, et bientôt un paiement.
--
-- Deux règles gouvernent tout ce fichier :
--
-- 1. **Le statut ne se modifie pas par UPDATE.** Une fonction est le seul
--    chemin ; un trigger rejette tout le reste. Sans ce trigger, la RLS
--    laisserait passer « READY » envoyé directement par l'API REST, et le
--    cycle de vie ne voudrait plus rien dire.
--
-- 2. **Le prix est copié, pas référencé.** Modifier un tarif demain ne doit
--    jamais modifier un dossier d'hier. La copie est faite par la base, depuis
--    `resoudre_prix()` : le client n'envoie aucun montant.

-- ---------------------------------------------------------------------------
-- Numérotation : séquentielle par organisation, générée en base.
--
-- Un numéro construit côté client serait deviné, dupliqué, ou sauté selon la
-- qualité du réseau. Ici c'est un UPSERT atomique : deux réceptionnistes qui
-- ouvrent un dossier en même temps obtiennent deux numéros distincts.
--
-- Des trous restent possibles si une transaction échoue après avoir pris son
-- numéro. C'est acceptable pour un dossier ; les reçus, eux, exigeront une
-- numérotation sans trou et auront leur propre mécanisme.
-- ---------------------------------------------------------------------------
-- Elle vit dans le schéma `vehora`, pas dans `public` : c'est de la mécanique
-- interne, et `vehora` n'est pas exposé à PostgREST. Une table sans policy dans
-- `public` serait au mieux une exception à justifier, au pire un oubli.
create table vehora.service_order_sequences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_number     bigint not null default 0
);

create table public.service_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade
                       default vehora.current_org_id(),
  station_id      uuid not null references public.stations(id) on delete restrict,
  number          bigint not null,
  customer_id     uuid references public.customers(id) on delete set null,
  vehicle_id      uuid not null references public.vehicles(id) on delete restrict,
  status          public.service_order_status not null default 'ARRIVED',
  notes           text,
  -- Jalons : ils servent aux durées réelles (attente, travail), donc à tous
  -- les indicateurs. On les pose au passage, pas après coup.
  arrived_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  delivered_at    timestamptz,
  cancelled_at    timestamptz,
  cancellation_reason text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, number)
);

-- La file d'attente d'une station se lit des dizaines de fois par jour : c'est
-- la requête la plus fréquente du produit.
create index service_orders_file_idx
  on public.service_orders (organization_id, station_id, status, arrived_at);
create index service_orders_vehicule_idx on public.service_orders (vehicle_id, arrived_at desc);
create index service_orders_client_idx on public.service_orders (customer_id, arrived_at desc);
create index service_orders_created_by_idx on public.service_orders (created_by);

create trigger service_orders_touch before update on public.service_orders
  for each row execute function vehora.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Lignes du dossier : ce qui est vendu, au prix du jour où ça a été vendu.
-- ---------------------------------------------------------------------------
create table public.service_order_items (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade
                          default vehora.current_org_id(),
  service_order_id   uuid not null references public.service_orders(id) on delete cascade,
  service_id         uuid not null references public.services(id) on delete restrict,
  -- Nom copié : si la prestation est renommée ou retirée du catalogue, le
  -- dossier d'hier doit continuer à dire ce qui a été vendu.
  service_name       text not null,
  price_id           uuid references public.service_prices(id) on delete set null,
  unit_amount_minor  bigint not null check (unit_amount_minor >= 0),
  currency           text not null,
  quantity           integer not null default 1 check (quantity between 1 and 99),
  discount_amount_minor bigint not null default 0 check (discount_amount_minor >= 0),
  line_total_minor   bigint generated always as
                       (unit_amount_minor * quantity - discount_amount_minor) stored,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  -- Une même prestation n'est pas ajoutée deux fois : on augmente la quantité.
  unique (service_order_id, service_id)
);

create index service_order_items_dossier_idx
  on public.service_order_items (service_order_id);
create index service_order_items_service_idx on public.service_order_items (service_id);
create index service_order_items_created_by_idx on public.service_order_items (created_by);

-- ---------------------------------------------------------------------------
-- Historique des statuts. Source des durées réelles — il ne se reconstitue
-- pas, donc il s'écrit dès maintenant.
-- ---------------------------------------------------------------------------
create table public.service_order_status_history (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  from_status      public.service_order_status,
  to_status        public.service_order_status not null,
  changed_by       uuid references public.profiles(id) on delete set null,
  changed_at       timestamptz not null default now(),
  reason           text
);

create index service_order_history_dossier_idx
  on public.service_order_status_history (service_order_id, changed_at);
create index service_order_history_org_idx
  on public.service_order_status_history (organization_id, changed_at desc);
create index service_order_history_par_idx
  on public.service_order_status_history (changed_by);

-- ---------------------------------------------------------------------------
-- La matrice des transitions est une TABLE, pas un `case` dans une fonction.
--
-- Ajouter une transition demain — celles qui dépendent des opérations et du
-- contrôle qualité — sera une ligne de plus, pas une réécriture de la fonction.
-- C'est le même principe que les rôles : la règle est une donnée.
-- ---------------------------------------------------------------------------
create table public.service_order_transitions (
  from_status         public.service_order_status not null,
  to_status           public.service_order_status not null,
  required_permission text not null references public.permissions(key),
  -- Condition supplémentaire évaluée par la fonction. `null` = aucune.
  condition_code      text,
  requires_reason     boolean not null default false,
  must_audit          boolean not null default false,
  primary key (from_status, to_status)
);

alter table public.service_order_transitions enable row level security;
create policy "transitions readable" on public.service_order_transitions
  for select to authenticated using (true);

-- Les lignes livrées en phase 9. Les transitions qui dépendent des opérations
-- (WAITING → IN_PROGRESS, IN_PROGRESS → CONTROL…) arriveront avec la table des
-- opérations : ce sont des lignes à insérer, rien d'autre.
insert into public.service_order_transitions
  (from_status, to_status, required_permission, condition_code, requires_reason, must_audit)
values
  ('ARRIVED',    'INSPECTION', 'inspections.write',        null,                  false, false),
  ('ARRIVED',    'WAITING',    'service_orders.transition', 'INSPECTION_OPTIONAL', false, false),
  ('INSPECTION', 'WAITING',    'inspections.write',        'INSPECTION_DONE',      false, false),
  ('ARRIVED',    'CANCELLED',  'service_orders.cancel',     null,                  true,  true),
  ('INSPECTION', 'CANCELLED',  'service_orders.cancel',     null,                  true,  true),
  ('WAITING',    'CANCELLED',  'service_orders.cancel',     null,                  true,  true);

-- ---------------------------------------------------------------------------
-- Invariants et valeurs imposées par la base
-- ---------------------------------------------------------------------------

-- Numéro de dossier.
create or replace function vehora.attribuer_numero_dossier()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into vehora.service_order_sequences (organization_id, last_number)
  values (new.organization_id, 1)
  on conflict (organization_id)
    do update set last_number = vehora.service_order_sequences.last_number + 1
  returning last_number into new.number;
  return new;
end;
$$;

create trigger service_orders_numero
  before insert on public.service_orders
  for each row execute function vehora.attribuer_numero_dossier();

-- Le véhicule, le client et la station appartiennent à l'organisation du
-- dossier, et le client est bien celui du véhicule s'il en a un.
create or replace function vehora.check_service_order_tenancy()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.stations where id = new.station_id;
  if v_org is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: cette station appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  select organization_id into v_org from public.vehicles where id = new.vehicle_id;
  if v_org is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: ce véhicule appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if new.customer_id is not null then
    select organization_id into v_org from public.customers where id = new.customer_id;
    if v_org is distinct from new.organization_id then
      raise exception 'VEHORA_TENANCY_VIOLATION: ce client appartient à une autre organisation'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger service_orders_tenancy
  before insert or update of station_id, vehicle_id, customer_id, organization_id
  on public.service_orders
  for each row execute function vehora.check_service_order_tenancy();

-- Le statut ne change que par `vehora.transition_service_order`, qui pose un
-- drapeau de transaction avant d'écrire. Sans ce garde-fou, un PATCH REST
-- suffirait à faire passer un dossier impayé en « restitué ».
create or replace function vehora.protect_service_order_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('vehora.transition_autorisee', true), '') <> old.id::text then
    raise exception 'VEHORA_STATUT_DIRECT: le statut se change par transition_service_order, pas par UPDATE'
      using errcode = 'insufficient_privilege';
  end if;

  -- Un dossier terminal est figé : plus rien ne bouge, statut compris.
  if old.status in ('DELIVERED', 'CANCELLED') then
    raise exception 'VEHORA_DOSSIER_CLOS: un dossier restitué ou annulé est immuable'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger service_orders_statut_protege
  before update on public.service_orders
  for each row execute function vehora.protect_service_order_status();

-- Le prix d'une ligne vient du serveur, jamais de l'appelant.
create or replace function vehora.set_service_order_item_price()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_dossier   public.service_orders;
  v_type      uuid;
  v_prix      record;
  v_service   public.services;
  v_plafond   numeric;
  v_maximum   bigint;
begin
  select * into v_dossier from public.service_orders where id = new.service_order_id;
  if v_dossier.id is null then
    raise exception 'VEHORA_DOSSIER_INTROUVABLE: ce dossier n''existe pas ou ne vous est pas visible'
      using errcode = 'insufficient_privilege';
  end if;

  -- Une ligne ne s'ajoute qu'avant le début du travail. Après, le dossier a
  -- été annoncé au client à un montant : on ne le gonfle pas en silence.
  if v_dossier.status not in ('ARRIVED', 'INSPECTION', 'WAITING') then
    raise exception 'VEHORA_DOSSIER_ENGAGE: les prestations se figent au démarrage du travail'
      using errcode = 'insufficient_privilege';
  end if;

  new.organization_id := v_dossier.organization_id;

  select * into v_service from public.services where id = new.service_id;
  if v_service.id is null or v_service.organization_id <> v_dossier.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: cette prestation appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;
  new.service_name := v_service.name;

  select vehicle_type_id into v_type from public.vehicles where id = v_dossier.vehicle_id;

  -- Le prix du jour où le dossier a été ouvert, pas celui d'aujourd'hui : un
  -- dossier ouvert hier soir et complété ce matin ne change pas de tarif.
  select * into v_prix from public.resoudre_prix(
    new.service_id, v_type, v_dossier.station_id, v_dossier.arrived_at::date);

  if v_prix.price_id is null then
    raise exception 'VEHORA_SANS_TARIF: aucun tarif défini pour « % » sur ce véhicule', v_service.name
      using errcode = 'check_violation';
  end if;

  new.price_id          := v_prix.price_id;
  new.unit_amount_minor := v_prix.amount_minor;
  new.currency          := v_prix.currency;

  -- Une remise au-delà du plafond de l'organisation exige `payments.refund`.
  -- Sans cela, la « remise » devient le moyen standard de faire disparaître
  -- de l'argent (fondation 5).
  if new.discount_amount_minor > 0 then
    select max_discount_percent into v_plafond
      from public.organization_settings
     where organization_id = v_dossier.organization_id;

    v_maximum := floor(
      (new.unit_amount_minor * new.quantity) * coalesce(v_plafond, 0) / 100.0);

    if new.discount_amount_minor > v_maximum
       and not vehora.has_permission('payments.refund') then
      raise exception 'VEHORA_REMISE_EXCESSIVE: cette remise dépasse le plafond de l''organisation'
        using errcode = 'insufficient_privilege';
    end if;

    if new.discount_amount_minor > new.unit_amount_minor * new.quantity then
      raise exception 'VEHORA_REMISE_SUPERIEURE: une remise ne peut pas dépasser le montant de la ligne'
        using errcode = 'check_violation';
    end if;

    perform vehora.write_audit_log(
      'service_order_item.discount', 'service_order_item', new.id::text,
      v_dossier.organization_id, v_dossier.station_id, null,
      jsonb_build_object('service', v_service.name,
                         'remise_minor', new.discount_amount_minor,
                         'plafond_minor', v_maximum));
  end if;

  return new;
end;
$$;

create trigger service_order_items_prix
  before insert or update on public.service_order_items
  for each row execute function vehora.set_service_order_item_price();

-- ---------------------------------------------------------------------------
-- La transition : seul chemin pour changer un statut.
--
-- SECURITY DEFINER parce qu'elle écrit l'historique, qui n'a aucune policy
-- INSERT — un historique que l'API peut écrire ne prouve rien. Elle vérifie
-- donc elle-même la permission, comme `provisionner_organisation()`.
-- ---------------------------------------------------------------------------
create or replace function public.transitionner_dossier(
  p_service_order_id uuid,
  p_to_status        text,
  p_reason           text default null
)
returns public.service_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dossier    public.service_orders;
  v_regle      public.service_order_transitions;
  v_cible      public.service_order_status := p_to_status::public.service_order_status;
  v_settings   public.organization_settings;
begin
  -- Verrou : deux opérateurs qui valident la même inspection en même temps ne
  -- doivent pas produire deux transitions.
  select * into v_dossier from public.service_orders
   where id = p_service_order_id for update;

  if v_dossier.id is null then
    raise exception 'VEHORA_DOSSIER_INTROUVABLE: ce dossier n''existe pas'
      using errcode = 'insufficient_privilege';
  end if;

  -- La fonction contourne la RLS : elle doit donc refaire le cloisonnement
  -- elle-même, organisation ET station.
  if v_dossier.organization_id is distinct from vehora.current_org_id()
     or not vehora.can_access_station(v_dossier.station_id) then
    raise exception 'VEHORA_HORS_PERIMETRE: ce dossier n''est pas dans votre périmètre'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_regle from public.service_order_transitions
   where from_status = v_dossier.status and to_status = v_cible;

  if v_regle.from_status is null then
    raise exception 'VEHORA_TRANSITION_INTERDITE: passage de % à % non prévu', v_dossier.status, v_cible
      using errcode = 'check_violation';
  end if;

  if not vehora.can_write(v_dossier.organization_id, v_regle.required_permission,
                          v_dossier.station_id) then
    raise exception 'VEHORA_PERMISSION: cette transition exige la permission %', v_regle.required_permission
      using errcode = 'insufficient_privilege';
  end if;

  if v_regle.requires_reason and coalesce(trim(p_reason), '') = '' then
    raise exception 'VEHORA_MOTIF_REQUIS: cette transition exige un motif'
      using errcode = 'check_violation';
  end if;

  select * into v_settings from public.organization_settings
   where organization_id = v_dossier.organization_id;

  if v_regle.condition_code = 'INSPECTION_OPTIONAL'
     and coalesce(v_settings.require_inspection, true) then
    raise exception 'VEHORA_INSPECTION_REQUISE: votre organisation exige une inspection avant la file d''attente'
      using errcode = 'check_violation';
  end if;

  if v_regle.condition_code = 'INSPECTION_DONE'
     and not exists (select 1 from public.vehicle_inspections
                      where service_order_id = v_dossier.id) then
    raise exception 'VEHORA_INSPECTION_ABSENTE: enregistrez l''inspection avant de mettre en file d''attente'
      using errcode = 'check_violation';
  end if;

  -- Le trigger de protection n'accepte l'UPDATE que si ce drapeau porte
  -- l'identifiant du dossier : il ne peut pas être posé par hasard, ni servir
  -- à un autre dossier dans la même transaction.
  perform set_config('vehora.transition_autorisee', v_dossier.id::text, true);

  update public.service_orders
     set status       = v_cible,
         started_at   = case when v_cible = 'IN_PROGRESS' then now() else started_at end,
         completed_at = case when v_cible = 'READY' then now() else completed_at end,
         delivered_at = case when v_cible = 'DELIVERED' then now() else delivered_at end,
         cancelled_at = case when v_cible = 'CANCELLED' then now() else cancelled_at end,
         cancellation_reason =
           case when v_cible = 'CANCELLED' then p_reason else cancellation_reason end
   where id = v_dossier.id
   returning * into v_dossier;

  perform set_config('vehora.transition_autorisee', '', true);

  insert into public.service_order_status_history
    (organization_id, service_order_id, from_status, to_status, changed_by, reason)
  values (v_dossier.organization_id, v_dossier.id,
          v_regle.from_status, v_cible, vehora.current_profile_id(), p_reason);

  if v_regle.must_audit then
    perform vehora.write_audit_log(
      'service_order.transition', 'service_order', v_dossier.id::text,
      v_dossier.organization_id, v_dossier.station_id,
      jsonb_build_object('status', v_regle.from_status),
      jsonb_build_object('status', v_cible, 'numero', v_dossier.number),
      p_reason);
  end if;

  return v_dossier;
end;
$$;

grant execute on function public.transitionner_dossier(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Total d'un dossier : calculé, jamais stocké (fondation 5).
--
-- `security_invoker` : la vue applique la RLS de l'appelant. Sans cela, une
-- vue appartenant à `postgres` exposerait les totaux de toutes les
-- organisations.
-- ---------------------------------------------------------------------------
create view public.service_order_totals
with (security_invoker = true) as
select
  o.id               as service_order_id,
  o.organization_id,
  count(i.id)        as lignes,
  coalesce(sum(i.line_total_minor), 0)::bigint     as total_amount_minor,
  coalesce(sum(i.discount_amount_minor), 0)::bigint as discount_amount_minor,
  max(i.currency)    as currency
from public.service_orders o
left join public.service_order_items i on i.service_order_id = o.id
group by o.id, o.organization_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.service_orders               enable row level security;
alter table public.service_order_items          enable row level security;
alter table public.service_order_status_history enable row level security;

create policy "read service orders" on public.service_orders
  for select to authenticated
  using (vehora.can_read(organization_id, 'service_orders.read', station_id));

create policy "insert service orders" on public.service_orders
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'service_orders.write', station_id));

-- Le statut est protégé par trigger : cette policy couvre les notes, le client
-- rattaché, et rien de plus sensible.
create policy "update service orders" on public.service_orders
  for update to authenticated
  using (vehora.can_write(organization_id, 'service_orders.write', station_id))
  with check (organization_id = vehora.current_org_id());

-- Aucune policy DELETE : un dossier ne se supprime pas, il s'annule.

create policy "read service order items" on public.service_order_items
  for select to authenticated
  using (vehora.can_read(organization_id, 'service_orders.read'));

create policy "insert service order items" on public.service_order_items
  for insert to authenticated
  with check (vehora.can_write(organization_id, 'service_orders.write'));

create policy "update service order items" on public.service_order_items
  for update to authenticated
  using (vehora.can_write(organization_id, 'service_orders.write'))
  with check (organization_id = vehora.current_org_id());

create policy "delete service order items" on public.service_order_items
  for delete to authenticated
  using (vehora.can_write(organization_id, 'service_orders.write'));

create policy "read status history" on public.service_order_status_history
  for select to authenticated
  using (vehora.can_read(organization_id, 'service_orders.read'));

-- Aucune policy d'écriture sur l'historique : il s'écrit par
-- `transitionner_dossier` seulement. Un historique modifiable ne prouve rien.

-- Suppression d'une ligne : même règle que l'ajout, et jamais après le
-- démarrage du travail.
create or replace function vehora.protect_service_order_item()
returns trigger language plpgsql set search_path = '' as $$
declare v_statut public.service_order_status;
begin
  select status into v_statut from public.service_orders where id = old.service_order_id;
  if v_statut not in ('ARRIVED', 'INSPECTION', 'WAITING') then
    raise exception 'VEHORA_DOSSIER_ENGAGE: les prestations se figent au démarrage du travail'
      using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;

create trigger service_order_items_protege
  before delete on public.service_order_items
  for each row execute function vehora.protect_service_order_item();
