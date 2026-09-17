-- VEHORA — Phase 11 : paiements, caisse et restitution (fondation 5).
--
-- Trois concepts strictement séparés, parce que les confondre rend une caisse
-- infalsifiable impossible à obtenir :
--
--   PAYMENT           combien le client a payé, sur quel dossier, comment.
--   CASH TRANSACTION  quel argent est entré ou sorti du tiroir.
--   CASH REGISTER     quelle session, ouverte par qui, avec quel fonds, quel
--                     écart à la clôture.
--
-- Un paiement en espèces génère une transaction de caisse. Un paiement Mobile
-- Money n'en génère PAS — l'argent n'est pas dans le tiroir. Un retrait pour
-- acheter du savon est une transaction de caisse sans paiement.

create type public.payment_method as enum
  ('CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- Un remboursement est un paiement inversé, jamais une suppression.
create type public.payment_kind as enum ('PAYMENT', 'REFUND');

-- `PENDING` n'est pas utilisé par le MVP (le caissier saisit ce qu'il a reçu),
-- mais existe pour que Wave, Orange Money ou MTN MoMo s'y branchent plus tard
-- sans migration douloureuse.
create type public.payment_status as enum ('PENDING', 'COMPLETED', 'FAILED');

create type public.cash_register_status as enum ('OPEN', 'CLOSED');

create type public.cash_transaction_kind as enum
  ('PAYMENT_IN', 'REFUND_OUT', 'CASH_IN', 'CASH_OUT');

-- ---------------------------------------------------------------------------
-- Sessions de caisse
-- ---------------------------------------------------------------------------
create table public.cash_registers (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade
                              default vehora.current_org_id(),
  station_id             uuid not null references public.stations(id) on delete restrict,
  opened_by              uuid not null references public.profiles(id) on delete restrict,
  status                 public.cash_register_status not null default 'OPEN',
  opening_float_minor    bigint not null check (opening_float_minor >= 0),
  currency               text not null,
  opened_at              timestamptz not null default now(),
  -- Comptage déclaré à la clôture. L'écart est calculé, jamais saisi.
  declared_closing_minor bigint check (declared_closing_minor >= 0),
  theoretical_minor      bigint,
  variance_minor         bigint,
  closing_note           text,
  closed_by              uuid references public.profiles(id) on delete set null,
  closed_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Une seule session ouverte à la fois par (station, utilisateur). En base, pas
-- en code applicatif : deux onglets ouverts suffiraient sinon à en créer deux.
create unique index cash_registers_une_ouverte_idx
  on public.cash_registers (station_id, opened_by)
  where status = 'OPEN';

create index cash_registers_org_idx
  on public.cash_registers (organization_id, status, opened_at desc);
create index cash_registers_station_idx on public.cash_registers (station_id, opened_at desc);
create index cash_registers_closed_by_idx on public.cash_registers (closed_by);

create trigger cash_registers_touch before update on public.cash_registers
  for each row execute function vehora.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Paiements
-- ---------------------------------------------------------------------------
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade
                          default vehora.current_org_id(),
  service_order_id   uuid not null references public.service_orders(id) on delete restrict,
  station_id         uuid not null references public.stations(id) on delete restrict,
  kind               public.payment_kind not null default 'PAYMENT',
  method             public.payment_method not null,
  status             public.payment_status not null default 'COMPLETED',
  -- Toujours positif. Le sens est porté par `kind`, pas par le signe : un
  -- montant négatif se glisse trop facilement dans une somme.
  amount_minor       bigint not null check (amount_minor > 0),
  currency           text not null,
  -- Mobile Money : nom du fournisseur et référence de transaction, en clair.
  -- Aucune intégration d'API dans le MVP — le caissier saisit ce qu'il a reçu.
  provider_name      text,
  external_ref       text,
  -- Un remboursement référence le paiement qu'il annule, et porte un motif.
  reverses_payment_id uuid references public.payments(id) on delete restrict,
  reason             text,
  cash_register_id   uuid references public.cash_registers(id) on delete restrict,
  received_by        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  check (kind = 'PAYMENT' or reverses_payment_id is not null),
  check (kind = 'PAYMENT' or coalesce(trim(reason), '') <> '')
);

create index payments_dossier_idx on public.payments (service_order_id, created_at);
create index payments_org_idx on public.payments (organization_id, created_at desc);
create index payments_caisse_idx on public.payments (cash_register_id);
create index payments_station_idx on public.payments (station_id, created_at desc);
create index payments_reverses_idx on public.payments (reverses_payment_id);
create index payments_received_by_idx on public.payments (received_by);

-- ---------------------------------------------------------------------------
-- Mouvements de caisse
-- ---------------------------------------------------------------------------
create table public.cash_transactions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade
                        default vehora.current_org_id(),
  cash_register_id uuid not null references public.cash_registers(id) on delete cascade,
  kind             public.cash_transaction_kind not null,
  -- Positif pour une entrée, négatif pour une sortie : ici le signe a un sens,
  -- c'est un solde qu'on additionne.
  amount_minor     bigint not null check (amount_minor <> 0),
  currency         text not null,
  payment_id       uuid references public.payments(id) on delete restrict,
  reason           text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  -- Un mouvement lié à un paiement ne se saisit pas à la main ; un mouvement
  -- libre exige un motif — sinon « sortie de 50 000 » ne veut rien dire.
  check (payment_id is not null or coalesce(trim(reason), '') <> '')
);

create index cash_transactions_caisse_idx
  on public.cash_transactions (cash_register_id, created_at);
create index cash_transactions_org_idx
  on public.cash_transactions (organization_id, created_at desc);
create index cash_transactions_payment_idx on public.cash_transactions (payment_id);
create index cash_transactions_created_by_idx on public.cash_transactions (created_by);

-- ---------------------------------------------------------------------------
-- Valeurs imposées par la base
-- ---------------------------------------------------------------------------

-- La devise vient de l'organisation, partout. Le client ne choisit pas dans
-- quelle monnaie il encaisse.
create or replace function vehora.imposer_devise_organisation()
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

create trigger cash_registers_devise before insert or update on public.cash_registers
  for each row execute function vehora.imposer_devise_organisation();
create trigger payments_devise before insert or update on public.payments
  for each row execute function vehora.imposer_devise_organisation();
create trigger cash_transactions_devise before insert or update on public.cash_transactions
  for each row execute function vehora.imposer_devise_organisation();

-- Un paiement porte la station de son dossier, jamais celle que l'appelant
-- déclare : sinon un encaissement pourrait être attribué à une autre station.
create or replace function vehora.preparer_paiement()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_dossier public.service_orders;
  v_origine public.payments;
  v_caisse  public.cash_registers;
  v_deja    bigint;
begin
  select * into v_dossier from public.service_orders where id = new.service_order_id;
  if v_dossier.id is null or v_dossier.organization_id is distinct from new.organization_id then
    raise exception 'VEHORA_TENANCY_VIOLATION: ce dossier appartient à une autre organisation'
      using errcode = 'insufficient_privilege';
  end if;

  if v_dossier.status = 'CANCELLED' then
    raise exception 'VEHORA_DOSSIER_ANNULE: un dossier annulé ne s''encaisse pas'
      using errcode = 'check_violation';
  end if;

  new.station_id  := v_dossier.station_id;
  new.received_by := vehora.current_profile_id();

  if new.kind = 'REFUND' then
    select * into v_origine from public.payments where id = new.reverses_payment_id;

    if v_origine.id is null or v_origine.service_order_id <> new.service_order_id then
      raise exception 'VEHORA_REMBOURSEMENT_ORPHELIN: le paiement remboursé n''appartient pas à ce dossier'
        using errcode = 'check_violation';
    end if;

    if v_origine.kind <> 'PAYMENT' then
      raise exception 'VEHORA_REMBOURSEMENT_INVALIDE: on ne rembourse pas un remboursement'
        using errcode = 'check_violation';
    end if;

    -- On ne rembourse pas plus qu'on n'a reçu, même en plusieurs fois.
    select coalesce(sum(amount_minor), 0) into v_deja
      from public.payments
     where reverses_payment_id = v_origine.id and status = 'COMPLETED';

    if v_deja + new.amount_minor > v_origine.amount_minor then
      raise exception 'VEHORA_REMBOURSEMENT_EXCESSIF: le remboursement dépasse le paiement d''origine'
        using errcode = 'check_violation';
    end if;

    -- La méthode suit celle du paiement d'origine : on ne rend pas en espèces
    -- ce qui a été reçu par Mobile Money.
    new.method := v_origine.method;
  end if;

  -- Espèces : l'argent passe par un tiroir, donc par une session de caisse
  -- ouverte par cette personne à cette station. Sans session, pas de tiroir.
  if new.method = 'CASH' and new.status = 'COMPLETED' then
    select * into v_caisse from public.cash_registers
     where station_id = new.station_id
       and opened_by = vehora.current_profile_id()
       and status = 'OPEN';

    if v_caisse.id is null then
      raise exception 'VEHORA_CAISSE_FERMEE: ouvrez votre caisse avant d''encaisser en espèces'
        using errcode = 'check_violation';
    end if;
    new.cash_register_id := v_caisse.id;
  else
    new.cash_register_id := null;
  end if;

  return new;
end;
$$;

create trigger payments_preparation
  before insert on public.payments
  for each row execute function vehora.preparer_paiement();

-- Le mouvement de caisse suit le paiement en espèces. Il est écrit par la
-- base : un caissier qui pourrait écrire l'un sans l'autre pourrait faire
-- disparaître de l'argent.
create or replace function vehora.enregistrer_mouvement_caisse()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cash_register_id is null then
    return new;
  end if;

  insert into public.cash_transactions
    (organization_id, cash_register_id, kind, amount_minor, currency, payment_id, created_by)
  values (
    new.organization_id, new.cash_register_id,
    (case when new.kind = 'REFUND' then 'REFUND_OUT' else 'PAYMENT_IN' end)
      ::public.cash_transaction_kind,
    case when new.kind = 'REFUND' then -new.amount_minor else new.amount_minor end,
    new.currency, new.id, new.received_by);

  return new;
end;
$$;

create trigger payments_mouvement_caisse
  after insert on public.payments
  for each row execute function vehora.enregistrer_mouvement_caisse();

-- Une session clôturée est immuable, et un mouvement ne s'ajoute pas après.
create or replace function vehora.protect_caisse_close()
returns trigger language plpgsql set search_path = '' as $$
declare v_statut public.cash_register_status;
begin
  select status into v_statut from public.cash_registers
   where id = coalesce(new.cash_register_id, old.cash_register_id);

  if v_statut = 'CLOSED' then
    raise exception 'VEHORA_CAISSE_CLOTUREE: cette session de caisse est clôturée'
      using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger cash_transactions_caisse_ouverte
  before insert or update or delete on public.cash_transactions
  for each row execute function vehora.protect_caisse_close();

-- ---------------------------------------------------------------------------
-- État financier d'un dossier : dérivé, jamais stocké (fondation 5).
-- ---------------------------------------------------------------------------
create view public.service_order_payment_state
with (security_invoker = true) as
select
  o.id                       as service_order_id,
  o.organization_id,
  coalesce(t.total_amount_minor, 0) as total_amount_minor,
  coalesce(p.paid_minor, 0)         as paid_amount_minor,
  coalesce(t.total_amount_minor, 0) - coalesce(p.paid_minor, 0) as balance_minor,
  case
    when coalesce(p.paid_minor, 0) = 0 then 'UNPAID'
    when coalesce(p.paid_minor, 0) < coalesce(t.total_amount_minor, 0) then 'PARTIAL'
    when coalesce(p.paid_minor, 0) = coalesce(t.total_amount_minor, 0) then 'PAID'
    else 'OVERPAID'
  end as payment_status
from public.service_orders o
left join public.service_order_totals t on t.service_order_id = o.id
left join lateral (
  select sum(case when kind = 'REFUND' then -amount_minor else amount_minor end) as paid_minor
    from public.payments
   where service_order_id = o.id and status = 'COMPLETED'
) p on true;

-- Solde théorique d'une session de caisse : fonds d'ouverture + mouvements.
create view public.cash_register_state
with (security_invoker = true) as
select
  r.id as cash_register_id,
  r.organization_id,
  r.opening_float_minor
    + coalesce((select sum(amount_minor) from public.cash_transactions
                 where cash_register_id = r.id), 0) as theoretical_minor,
  coalesce((select count(*) from public.cash_transactions
             where cash_register_id = r.id), 0) as mouvements
from public.cash_registers r;

-- ---------------------------------------------------------------------------
-- Ouverture et clôture de caisse
-- ---------------------------------------------------------------------------
create or replace function public.cloturer_caisse(
  p_cash_register_id uuid,
  p_declared_minor   bigint,
  p_note             text default null
)
returns public.cash_registers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caisse      public.cash_registers;
  v_theorique   bigint;
begin
  select * into v_caisse from public.cash_registers
   where id = p_cash_register_id for update;

  if v_caisse.id is null
     or v_caisse.organization_id is distinct from vehora.current_org_id() then
    raise exception 'VEHORA_CAISSE_INTROUVABLE: cette session n''existe pas'
      using errcode = 'insufficient_privilege';
  end if;

  if not vehora.can_write(v_caisse.organization_id, 'cash.close', v_caisse.station_id) then
    raise exception 'VEHORA_PERMISSION: clôturer une caisse exige cash.close'
      using errcode = 'insufficient_privilege';
  end if;

  if v_caisse.status = 'CLOSED' then
    raise exception 'VEHORA_CAISSE_CLOTUREE: cette session est déjà clôturée'
      using errcode = 'check_violation';
  end if;

  if p_declared_minor is null or p_declared_minor < 0 then
    raise exception 'VEHORA_COMPTAGE_REQUIS: déclarez le montant compté dans le tiroir'
      using errcode = 'check_violation';
  end if;

  select theoretical_minor into v_theorique
    from public.cash_register_state where cash_register_id = v_caisse.id;

  -- Le trigger de protection n'accepte une clôture que si ce drapeau porte
  -- l'identifiant de la session : « clôturée avec 0 d'écart » ne doit pas être
  -- à la portée d'un PATCH.
  perform set_config('vehora.cloture_autorisee', v_caisse.id::text, true);

  -- L'écart n'est jamais masqué ni corrigé silencieusement. C'est la première
  -- chose que le patron regardera, et une caisse qui « tombe toujours juste »
  -- est une caisse à laquelle personne ne croit.
  update public.cash_registers
     set status                 = 'CLOSED',
         declared_closing_minor = p_declared_minor,
         theoretical_minor      = v_theorique,
         variance_minor         = p_declared_minor - v_theorique,
         closing_note           = p_note,
         closed_by              = vehora.current_profile_id(),
         closed_at              = now()
   where id = v_caisse.id
   returning * into v_caisse;

  perform set_config('vehora.cloture_autorisee', '', true);

  perform vehora.write_audit_log(
    'cash_register.close', 'cash_register', v_caisse.id::text,
    v_caisse.organization_id, v_caisse.station_id,
    jsonb_build_object('theorique_minor', v_theorique),
    jsonb_build_object('declare_minor', p_declared_minor,
                       'ecart_minor', v_caisse.variance_minor),
    p_note);

  return v_caisse;
end;
$$;

revoke execute on function public.cloturer_caisse(uuid, bigint, text) from public, anon;
grant execute on function public.cloturer_caisse(uuid, bigint, text) to authenticated;

comment on function public.cloturer_caisse is
  'Clôture une session de caisse : calcule l''écart entre le comptage déclaré et le solde théorique, et l''audite. SECURITY DEFINER pour écrire l''audit ; vérifie elle-même la permission cash.close. Ne pas révoquer son EXECUTE à `authenticated`.';

-- Une session clôturée ne se rouvre pas et ne se modifie plus.
create or replace function vehora.protect_cash_register()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'CLOSED' then
    raise exception 'VEHORA_CAISSE_CLOTUREE: une session clôturée est immuable'
      using errcode = 'insufficient_privilege';
  end if;

  -- La clôture passe par `cloturer_caisse`, qui pose ce drapeau : sinon
  -- « clôturée avec 0 d'écart » serait à la portée d'un PATCH.
  if new.status = 'CLOSED'
     and coalesce(current_setting('vehora.cloture_autorisee', true), '') <> old.id::text then
    raise exception 'VEHORA_CLOTURE_DIRECTE: la clôture passe par cloturer_caisse'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger cash_registers_protege
  before update on public.cash_registers
  for each row execute function vehora.protect_cash_register();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.cash_registers    enable row level security;
alter table public.payments          enable row level security;
alter table public.cash_transactions enable row level security;

create policy "read cash registers" on public.cash_registers
  for select to authenticated
  using (vehora.can_read(organization_id, 'payments.read', station_id));

create policy "open cash register" on public.cash_registers
  for insert to authenticated
  with check (
    vehora.can_write(organization_id, 'cash.open', station_id)
    -- On n'ouvre pas une caisse au nom de quelqu'un d'autre.
    and opened_by = vehora.current_profile_id()
  );

create policy "update cash register" on public.cash_registers
  for update to authenticated
  using (vehora.can_write(organization_id, 'cash.close', station_id))
  with check (organization_id = vehora.current_org_id());

-- Aucune policy DELETE : une session de caisse ne se supprime pas.

create policy "read payments" on public.payments
  for select to authenticated
  using (vehora.can_read(organization_id, 'payments.read', station_id));

create policy "record payments" on public.payments
  for insert to authenticated
  with check (
    case
      when kind = 'REFUND' then vehora.can_write(organization_id, 'payments.refund')
      else vehora.can_write(organization_id, 'payments.record')
    end
  );

-- Aucune policy UPDATE ni DELETE. Un paiement erroné s'annule par un
-- remboursement qui le référence, avec motif. Jamais autrement.

create policy "read cash transactions" on public.cash_transactions
  for select to authenticated
  using (vehora.can_read(organization_id, 'payments.read'));

-- Mouvement libre (achat de savon, appoint) : exige `cash.move` et un motif.
-- Les mouvements liés à un paiement sont écrits par la base, pas ici.
create policy "record cash movements" on public.cash_transactions
  for insert to authenticated
  with check (
    vehora.can_write(organization_id, 'cash.move')
    and payment_id is null
    and kind in ('CASH_IN', 'CASH_OUT')
  );

-- ---------------------------------------------------------------------------
-- Restitution : la dernière transition, et la plus surveillée.
-- ---------------------------------------------------------------------------
insert into public.service_order_transitions
  (from_status, to_status, required_permission, condition_code, requires_reason, must_audit)
values ('READY', 'DELIVERED', 'restitutions.execute', 'PAYMENT_RULE', false, true);
