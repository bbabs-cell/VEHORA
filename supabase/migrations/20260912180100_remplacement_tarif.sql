-- VEHORA — Phase 8, correction : remplacer un tarif en une seule opération.
--
-- Défaut trouvé par la campagne d'intrusion : un tarif en vigueur n'a pas de
-- fin (`valid_to` null), donc il couvre toutes les dates futures. Insérer le
-- tarif de demain se heurte à la contrainte de non-chevauchement. Pour
-- augmenter un prix — l'opération tarifaire la plus fréquente — il fallait
-- fermer l'ancien puis ouvrir le nouveau, dans cet ordre, avec un message
-- d'erreur entre les deux si on se trompait.
--
-- Deux écritures qui doivent réussir ensemble, c'est une fonction, pas deux
-- appels depuis le navigateur : une coupure réseau entre les deux laisserait la
-- prestation sans tarif, donc invendable.
--
-- SECURITY INVOKER : la RLS s'applique aux deux écritures. Sans
-- `prices.manage`, la fermeture ne touche aucune ligne et l'insertion est
-- refusée — la fonction n'accorde rien que les policies n'accordent déjà.
create or replace function public.remplacer_tarif(
  p_price_id     uuid,
  p_amount_minor bigint,
  p_valid_from   date default current_date
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_ancien public.service_prices;
  v_id     uuid;
  v_lignes integer;
begin
  select * into v_ancien from public.service_prices where id = p_price_id;
  if v_ancien.id is null then
    raise exception 'VEHORA_TARIF_INTROUVABLE: ce tarif n''existe pas ou ne vous est pas visible'
      using errcode = 'insufficient_privilege';
  end if;

  if p_valid_from <= v_ancien.valid_from then
    raise exception 'VEHORA_TARIF_ANTERIEUR: le nouveau tarif doit commencer après le précédent'
      using errcode = 'check_violation';
  end if;

  update public.service_prices
     set valid_to = p_valid_from - 1
   where id = p_price_id;

  get diagnostics v_lignes = row_count;
  if v_lignes = 0 then
    raise exception 'VEHORA_PERMISSION: modifier un tarif exige la permission prices.manage'
      using errcode = 'insufficient_privilege';
  end if;

  -- La devise et l'organisation restent posées par les triggers : on ne les
  -- recopie pas, pour qu'un seul endroit en décide.
  insert into public.service_prices (
    organization_id, service_id, vehicle_type_id, station_id,
    amount_minor, currency, valid_from
  ) values (
    v_ancien.organization_id, v_ancien.service_id, v_ancien.vehicle_type_id,
    v_ancien.station_id, p_amount_minor, v_ancien.currency, p_valid_from
  )
  returning id into v_id;

  perform vehora.write_audit_log(
    'service_price.replace', 'service_price', v_id::text,
    v_ancien.organization_id, v_ancien.station_id,
    to_jsonb(v_ancien),
    jsonb_build_object('amount_minor', p_amount_minor, 'valid_from', p_valid_from)
  );

  return v_id;
end;
$$;

grant execute on function public.remplacer_tarif(uuid, bigint, date) to authenticated;

comment on function public.remplacer_tarif is
  'Ferme le tarif courant la veille et ouvre le nouveau, en une transaction. Le prix d''hier reste consultable : un dossier passé s''y réfère.';
