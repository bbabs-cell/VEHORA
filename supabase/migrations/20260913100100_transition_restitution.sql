-- VEHORA — Phase 11 : la fonction de transition apprend la règle de paiement.
--
-- `READY → DELIVERED` est la transition la plus surveillée du produit : c'est
-- celle où le véhicule quitte la station. Deux régimes, portés par
-- `organization_settings.payment_before_delivery` (ADR-004) :
--
--   STRICT      restitution refusée tant que le solde n'est pas nul.
--   ALLOW_DEBT  restitution possible avec solde, MAIS elle exige alors la
--               permission `payments.refund` et un motif — et elle est auditée.
--
-- `ALLOW_DEBT` est le défaut parce que le client régulier qui règle en fin de
-- semaine est une réalité du marché visé. Ce n'est pas une porte ouverte : la
-- créance est tracée, nominative et motivée.

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
  v_total      integer;
  v_faites     integer;
  v_assignees  integer;
  v_solde      bigint;
begin
  select * into v_dossier from public.service_orders
   where id = p_service_order_id for update;

  if v_dossier.id is null then
    raise exception 'VEHORA_DOSSIER_INTROUVABLE: ce dossier n''existe pas'
      using errcode = 'insufficient_privilege';
  end if;

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

  if v_regle.condition_code in ('OPERATIONS_ASSIGNED', 'OPERATIONS_DONE') then
    select count(*),
           count(*) filter (where status = 'DONE'),
           count(*) filter (where employee_id is not null)
      into v_total, v_faites, v_assignees
      from public.service_order_operations
     where service_order_id = v_dossier.id;
  end if;

  if v_regle.condition_code = 'OPERATIONS_ASSIGNED' and coalesce(v_assignees, 0) = 0 then
    raise exception 'VEHORA_AUCUNE_ASSIGNATION: assignez au moins une opération à un employé'
      using errcode = 'check_violation';
  end if;

  if v_regle.condition_code = 'OPERATIONS_DONE'
     and (coalesce(v_total, 0) = 0 or v_faites < v_total) then
    raise exception 'VEHORA_OPERATIONS_EN_COURS: toutes les opérations doivent être terminées'
      using errcode = 'check_violation';
  end if;

  if v_regle.condition_code = 'QUALITY_OPTIONAL'
     and coalesce(v_settings.require_quality_control, true) then
    raise exception 'VEHORA_CONTROLE_REQUIS: votre organisation exige un contrôle qualité avant restitution'
      using errcode = 'check_violation';
  end if;

  -- Règle de paiement avant restitution (fondation 5, ADR-004).
  if v_regle.condition_code = 'PAYMENT_RULE' then
    select balance_minor into v_solde
      from public.service_order_payment_state where service_order_id = v_dossier.id;

    if coalesce(v_solde, 0) > 0 then
      if coalesce(v_settings.payment_before_delivery, 'ALLOW_DEBT') = 'STRICT' then
        raise exception 'VEHORA_SOLDE_RESTANT: le dossier doit être soldé avant restitution'
          using errcode = 'check_violation';
      end if;

      -- Laisser partir un véhicule impayé est une décision, pas un clic : elle
      -- exige le droit d'accorder une créance, et elle se motive.
      if not vehora.has_permission('payments.refund') then
        raise exception 'VEHORA_CREANCE_NON_AUTORISEE: restituer avec un solde exige la permission payments.refund'
          using errcode = 'insufficient_privilege';
      end if;

      if coalesce(trim(p_reason), '') = '' then
        raise exception 'VEHORA_MOTIF_REQUIS: restituer avec un solde exige un motif'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  perform set_config('vehora.transition_autorisee', v_dossier.id::text, true);

  update public.service_orders
     set status       = v_cible,
         started_at   = case when v_cible = 'IN_PROGRESS' then coalesce(started_at, now())
                             else started_at end,
         completed_at = case when v_cible = 'READY' then now() else completed_at end,
         delivered_at = case when v_cible = 'DELIVERED' then now() else delivered_at end,
         cancelled_at = case when v_cible = 'CANCELLED' then now() else cancelled_at end,
         cancellation_reason =
           case when v_cible = 'CANCELLED' then p_reason else cancellation_reason end
   where id = v_dossier.id
   returning * into v_dossier;

  perform set_config('vehora.transition_autorisee', '', true);

  if v_cible = 'WAITING' then
    perform vehora.creer_operations_du_dossier(v_dossier.id);
  end if;

  insert into public.service_order_status_history
    (organization_id, service_order_id, from_status, to_status, changed_by, reason)
  values (v_dossier.organization_id, v_dossier.id,
          v_regle.from_status, v_cible, vehora.current_profile_id(), p_reason);

  if v_regle.must_audit then
    perform vehora.write_audit_log(
      'service_order.transition', 'service_order', v_dossier.id::text,
      v_dossier.organization_id, v_dossier.station_id,
      jsonb_build_object('status', v_regle.from_status),
      jsonb_build_object('status', v_cible, 'numero', v_dossier.number,
                         'solde_minor', coalesce(v_solde, 0)),
      p_reason);
  end if;

  return v_dossier;
end;
$$;

revoke execute on function public.transitionner_dossier(uuid, text, text) from public, anon;
grant execute on function public.transitionner_dossier(uuid, text, text) to authenticated;

comment on function public.transitionner_dossier is
  'Seul chemin pour changer le statut d''un dossier (fondation 4). SECURITY DEFINER parce qu''elle écrit l''historique, qui n''a aucune policy INSERT ; elle refait donc elle-même le contrôle d''organisation, de station et de permission. Signalée par l''advisor Supabase : c''est voulu. Ne pas révoquer son EXECUTE à `authenticated`.';
