-- Le tiroir d'où sort l'argent (phase 27, ADR-006).
--
-- 1. Un remboursement en espèces s'inscrivait dans la caisse de la personne
--    qui rembourse. Or seul un responsable rembourse, et les billets sortent
--    du tiroir du caissier : le soir, le caissier clôturait avec un manque, le
--    responsable avec un excédent, et rien ne reliait les deux. Désormais la
--    personne qui rembourse désigne la caisse ouverte, de la station du
--    dossier, d'où sort l'argent ; par défaut, celle qui a reçu le paiement si
--    elle est encore ouverte, sinon la sienne.
--
-- 2. Trois références de caisse n'étaient vérifiées par rien — « une policy
--    vérifie la ligne, pas ce qu'elle référence », une fois de plus :
--    - un mouvement libre pouvait viser la caisse d'un collègue ;
--    - il pouvait viser la caisse d'une AUTRE organisation (dont il fallait
--      connaître l'UUID) : invisible pour ses membres, mais compté par
--      `cloturer_caisse`, qui lit en SECURITY DEFINER — la clôture d'un client
--      pouvait être faussée de l'extérieur ;
--    - une caisse pouvait s'ouvrir sur la station d'un autre client, et
--      l'empêcher ensuite de supprimer cette station (clé en RESTRICT).
--
-- 3. Les remboursements n'étaient pas audités, contrairement à la fondation 5.
--
-- 4. La policy d'insertion des paiements ne regardait pas la station. Un
--    paiement porte celle de son dossier, posée par le déclencheur BEFORE, que
--    la policy voit : elle la vérifie désormais au lieu de compter sur la
--    lecture du dossier sous RLS.

-- ---------------------------------------------------------------------------
-- 1. La caisse d'un paiement et d'un remboursement
-- ---------------------------------------------------------------------------
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
    -- Dit avant tout le reste ce que la policy dira de toute façon.
    if not vehora.has_permission('payments.refund') then
      raise exception 'VEHORA_REMBOURSEMENT_NON_AUTORISE: rembourser exige la permission payments.refund'
        using errcode = 'insufficient_privilege';
    end if;

    select * into v_origine from public.payments where id = new.reverses_payment_id;

    if v_origine.id is null or v_origine.service_order_id <> new.service_order_id then
      raise exception 'VEHORA_REMBOURSEMENT_ORPHELIN: le paiement remboursé n''appartient pas à ce dossier'
        using errcode = 'check_violation';
    end if;

    if v_origine.kind <> 'PAYMENT' then
      raise exception 'VEHORA_REMBOURSEMENT_INVALIDE: on ne rembourse pas un remboursement'
        using errcode = 'check_violation';
    end if;

    select coalesce(sum(amount_minor), 0) into v_deja
      from public.payments
     where reverses_payment_id = v_origine.id and status = 'COMPLETED';

    if v_deja + new.amount_minor > v_origine.amount_minor then
      raise exception 'VEHORA_REMBOURSEMENT_EXCESSIF: le remboursement dépasse le paiement d''origine'
        using errcode = 'check_violation';
    end if;

    new.method := v_origine.method;
  end if;

  if new.method <> 'CASH' or new.status <> 'COMPLETED' then
    -- Pas d'espèces, pas de tiroir : une caisse envoyée par le client est ignorée.
    new.cash_register_id := null;

  elsif new.kind = 'REFUND' and new.cash_register_id is not null then
    -- Caisse désignée par la personne qui rembourse. Lue sous la RLS de
    -- l'appelant : la caisse d'une autre organisation lui est invisible, donc
    -- « introuvable » — on ne confirme pas qu'elle existe.
    select * into v_caisse from public.cash_registers where id = new.cash_register_id;

    if v_caisse.id is null or v_caisse.organization_id <> new.organization_id then
      raise exception 'VEHORA_CAISSE_INTROUVABLE: cette caisse est introuvable'
        using errcode = 'insufficient_privilege';
    end if;
    if v_caisse.station_id <> new.station_id then
      raise exception 'VEHORA_CAISSE_AUTRE_STATION: l''argent sort d''un tiroir de la station du dossier'
        using errcode = 'check_violation';
    end if;
    if v_caisse.status <> 'OPEN' then
      raise exception 'VEHORA_CAISSE_FERMEE: cette caisse est clôturée, choisissez une caisse ouverte'
        using errcode = 'check_violation';
    end if;

  else
    v_caisse := null;

    -- Un remboursement sans caisse désignée sort, de préférence, du tiroir qui
    -- a reçu le billet, s'il est encore ouvert.
    if new.kind = 'REFUND' and v_origine.cash_register_id is not null then
      select * into v_caisse from public.cash_registers
       where id = v_origine.cash_register_id
         and station_id = new.station_id
         and status = 'OPEN';
    end if;

    -- Sinon — et toujours pour un encaissement — la caisse de qui encaisse :
    -- un encaissement ne choisit pas son tiroir.
    if v_caisse.id is null then
      select * into v_caisse from public.cash_registers
       where station_id = new.station_id
         and opened_by = vehora.current_profile_id()
         and status = 'OPEN';
    end if;

    if v_caisse.id is null then
      raise exception 'VEHORA_CAISSE_FERMEE: aucune caisse ouverte pour ces espèces'
        using errcode = 'check_violation';
    end if;
    new.cash_register_id := v_caisse.id;
  end if;

  return new;
end;
$$;

-- La sortie d'un remboursement porte son motif : dans la caisse du caissier,
-- « Remboursement » seul ne dirait pas pourquoi l'argent est sorti.
create or replace function vehora.enregistrer_mouvement_caisse()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cash_register_id is null then
    return new;
  end if;

  insert into public.cash_transactions
    (organization_id, cash_register_id, kind, amount_minor, currency, payment_id,
     reason, created_by)
  values (
    new.organization_id, new.cash_register_id,
    (case when new.kind = 'REFUND' then 'REFUND_OUT' else 'PAYMENT_IN' end)
      ::public.cash_transaction_kind,
    case when new.kind = 'REFUND' then -new.amount_minor else new.amount_minor end,
    new.currency, new.id,
    case when new.kind = 'REFUND' then new.reason end,
    new.received_by);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Les références de caisse
-- ---------------------------------------------------------------------------

-- Un mouvement vise une caisse de SON organisation ; un mouvement libre, sa
-- PROPRE caisse. Les mouvements d'un paiement sont écrits par la base, dans la
-- caisse que `preparer_paiement` a validée. SECURITY DEFINER : la caisse d'un
-- collègue est invisible à un caissier, et le refus doit dire la bonne raison.
create or replace function vehora.check_mouvement_caisse()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_caisse public.cash_registers;
begin
  select * into v_caisse from public.cash_registers where id = new.cash_register_id;

  if v_caisse.id is null or v_caisse.organization_id <> new.organization_id then
    raise exception 'VEHORA_CAISSE_INTROUVABLE: cette caisse est introuvable'
      using errcode = 'insufficient_privilege';
  end if;

  if new.payment_id is null and v_caisse.opened_by <> vehora.current_profile_id() then
    raise exception 'VEHORA_CAISSE_PERSONNELLE: un mouvement libre s''écrit dans sa propre caisse'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger cash_transactions_coherence
  before insert on public.cash_transactions
  for each row execute function vehora.check_mouvement_caisse();

-- Une caisse s'ouvre sur une station de son organisation.
create or replace function vehora.check_caisse_station()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.stations
     where id = new.station_id and organization_id = new.organization_id
  ) then
    raise exception 'VEHORA_TENANCY_VIOLATION: cette station est introuvable'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger cash_registers_station
  before insert or update of station_id, organization_id on public.cash_registers
  for each row execute function vehora.check_caisse_station();

-- ---------------------------------------------------------------------------
-- 3. Un remboursement est audité, avec la caisse touchée et sa titulaire
-- ---------------------------------------------------------------------------
create or replace function vehora.auditer_remboursement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_titulaire uuid;
begin
  if new.cash_register_id is not null then
    select opened_by into v_titulaire
      from public.cash_registers where id = new.cash_register_id;
  end if;

  perform vehora.write_audit_log(
    'payment.refund', 'payment', new.id::text,
    new.organization_id, new.station_id,
    jsonb_build_object('reverses_payment_id', new.reverses_payment_id),
    jsonb_build_object('amount_minor', new.amount_minor,
                       'currency', new.currency,
                       'method', new.method,
                       'cash_register_id', new.cash_register_id,
                       'caisse_de', v_titulaire),
    new.reason);
  return new;
end;
$$;

create trigger payments_audit_remboursement
  after insert on public.payments
  for each row when (new.kind = 'REFUND')
  execute function vehora.auditer_remboursement();

-- ---------------------------------------------------------------------------
-- 4. Un paiement s'écrit dans une station à laquelle on a accès
-- ---------------------------------------------------------------------------
drop policy "record payments" on public.payments;

create policy "record payments" on public.payments
  for insert to authenticated
  with check (
    case
      when kind = 'REFUND' then vehora.can_write(organization_id, 'payments.refund', station_id)
      else vehora.can_write(organization_id, 'payments.record', station_id)
    end
  );

-- Fonctions de déclencheur : personne n'a à les appeler directement.
revoke execute on function vehora.check_mouvement_caisse()   from public, anon, authenticated;
revoke execute on function vehora.check_caisse_station()     from public, anon, authenticated;
revoke execute on function vehora.auditer_remboursement()    from public, anon, authenticated;
