-- VEHORA — Phase 11, correction ergonomique.
--
-- Un caissier qui tentait un remboursement était bien refusé, mais par le
-- message « ouvrez votre caisse » : le trigger BEFORE s'exécute avant le
-- WITH CHECK de la policy, et sa recherche de caisse ouverte échouait la
-- première. Refus correct, explication fausse — donc un caissier qui ouvre sa
-- caisse, réessaie, et se heurte alors à un autre refus.
--
-- La policy reste la règle qui protège. Le contrôle ajouté ici ne fait que
-- rendre le refus lisible au bon moment : il est redondant par construction, et
-- c'est assumé.

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
