-- VEHORA — Phase 13 : reçus (fondation 5).
--
-- « Numérotation par organisation, séquentielle, sans trou, générée en base,
-- jamais côté client. Un reçu est immuable ; une correction émet un nouveau
-- reçu référençant l'ancien. »
--
-- Correction d'une note écrite en phase 9. Le commentaire de
-- `vehora.attribuer_numero_dossier()` annonce des trous possibles « si une
-- transaction échoue après avoir pris son numéro ». C'est faux : l'UPSERT prend
-- un verrou de ligne, et un échec annule l'incrément comme le reste. La
-- numérotation des dossiers est donc déjà sans trou, et celle des reçus le sera
-- par le même mécanisme. La note d'origine reste dans sa migration — on ne
-- réécrit pas une migration commitée — mais elle est démentie ici et dans le
-- rapport de phase.
--
-- Ce qui produirait vraiment un trou : prendre le numéro dans une transaction
-- séparée qui commite avant l'insertion du reçu. On ne le fait pas.

create table vehora.receipt_sequences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_number     bigint not null default 0
);

create table public.receipts (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  station_id         uuid not null references public.stations(id) on delete restrict,
  service_order_id   uuid not null references public.service_orders(id) on delete restrict,
  number             bigint not null,
  -- Un reçu qui en corrige un autre le référence. L'ancien reste, il n'est ni
  -- supprimé ni modifié : c'est la seule façon de corriger un document remis
  -- à un client.
  replaces_receipt_id uuid references public.receipts(id) on delete restrict,
  -- Copie figée de ce qui a été remis : lignes, paiements, totaux, identités.
  -- Un reçu doit pouvoir être relu dans dix ans même si la prestation a été
  -- renommée, le tarif changé et le véhicule archivé.
  contenu            jsonb not null,
  currency           text not null,
  total_minor        bigint not null check (total_minor >= 0),
  paid_minor         bigint not null,
  issued_by          uuid references public.profiles(id) on delete set null,
  issued_at          timestamptz not null default now(),
  unique (organization_id, number)
);

create index receipts_dossier_idx on public.receipts (service_order_id, issued_at desc);
create index receipts_org_idx on public.receipts (organization_id, issued_at desc);
create index receipts_station_idx on public.receipts (station_id, issued_at desc);
create index receipts_remplace_idx on public.receipts (replaces_receipt_id);
create index receipts_par_idx on public.receipts (issued_by);

-- ---------------------------------------------------------------------------
-- Émission.
--
-- SECURITY DEFINER : elle écrit la séquence, qui vit dans `vehora` et n'a aucune
-- policy. Elle vérifie donc elle-même le périmètre et la permission.
-- ---------------------------------------------------------------------------
create or replace function public.emettre_recu(
  p_service_order_id  uuid,
  p_replaces_receipt_id uuid default null
)
returns public.receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dossier   public.service_orders;
  v_etat      record;
  v_numero    bigint;
  v_contenu   jsonb;
  v_recu      public.receipts;
  v_remplace  public.receipts;
begin
  select * into v_dossier from public.service_orders where id = p_service_order_id;

  if v_dossier.id is null
     or v_dossier.organization_id is distinct from vehora.current_org_id()
     or not vehora.can_access_station(v_dossier.station_id) then
    raise exception 'VEHORA_DOSSIER_INTROUVABLE: ce dossier n''est pas dans votre périmètre'
      using errcode = 'insufficient_privilege';
  end if;

  if not vehora.can_write(v_dossier.organization_id, 'payments.record', v_dossier.station_id) then
    raise exception 'VEHORA_PERMISSION: émettre un reçu exige la permission payments.record'
      using errcode = 'insufficient_privilege';
  end if;

  if v_dossier.status = 'CANCELLED' then
    raise exception 'VEHORA_DOSSIER_ANNULE: un dossier annulé ne donne pas lieu à un reçu'
      using errcode = 'check_violation';
  end if;

  if p_replaces_receipt_id is not null then
    select * into v_remplace from public.receipts where id = p_replaces_receipt_id;
    if v_remplace.id is null or v_remplace.service_order_id <> v_dossier.id then
      raise exception 'VEHORA_RECU_INTROUVABLE: le reçu corrigé n''appartient pas à ce dossier'
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.receipts where replaces_receipt_id = v_remplace.id) then
      raise exception 'VEHORA_RECU_DEJA_CORRIGE: ce reçu a déjà été corrigé'
        using errcode = 'check_violation';
    end if;
  end if;

  select * into v_etat from public.service_order_payment_state
   where service_order_id = v_dossier.id;

  if coalesce(v_etat.total_amount_minor, 0) = 0 then
    raise exception 'VEHORA_DOSSIER_SANS_LIGNE: un dossier sans prestation n''a rien à imprimer'
      using errcode = 'check_violation';
  end if;

  -- Numéro : verrou de ligne, dans la même transaction que l'insertion. Un
  -- échec annule les deux, donc aucun numéro n'est brûlé.
  insert into vehora.receipt_sequences (organization_id, last_number)
  values (v_dossier.organization_id, 1)
  on conflict (organization_id)
    do update set last_number = vehora.receipt_sequences.last_number + 1
  returning last_number into v_numero;

  -- Copie figée. Tout ce qui pourrait changer demain est recopié aujourd'hui.
  select jsonb_build_object(
    'organisation', jsonb_build_object(
      'nom', o.name, 'ville', o.city, 'telephone', o.phone, 'pays', o.country_code),
    'station', jsonb_build_object('nom', s.name, 'ville', s.city, 'telephone', s.phone),
    'dossier', jsonb_build_object(
      'numero', v_dossier.number,
      'arrive_le', v_dossier.arrived_at,
      'restitue_le', v_dossier.delivered_at),
    'client', case when c.id is null then null
                   else jsonb_build_object('nom', c.full_name, 'telephone', c.phone) end,
    'vehicule', jsonb_build_object(
      'plaque', ve.plate, 'marque', ve.make, 'modele', ve.model,
      'type', t.label),
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'prestation', i.service_name,
               'quantite', i.quantity,
               'unitaire_minor', i.unit_amount_minor,
               'remise_minor', i.discount_amount_minor,
               'total_minor', i.line_total_minor) order by i.created_at)
        from public.service_order_items i where i.service_order_id = v_dossier.id), '[]'::jsonb),
    'paiements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'sens', p.kind,
               'moyen', p.method,
               'fournisseur', p.provider_name,
               'reference', p.external_ref,
               'montant_minor', p.amount_minor,
               'le', p.created_at) order by p.created_at)
        from public.payments p
       where p.service_order_id = v_dossier.id and p.status = 'COMPLETED'), '[]'::jsonb),
    'totaux', jsonb_build_object(
      'total_minor', v_etat.total_amount_minor,
      'encaisse_minor', v_etat.paid_amount_minor,
      'solde_minor', v_etat.balance_minor,
      'devise', o.currency)
  ) into v_contenu
  from public.organizations o
  join public.stations s on s.id = v_dossier.station_id
  join public.vehicles ve on ve.id = v_dossier.vehicle_id
  left join public.vehicle_types t on t.id = ve.vehicle_type_id
  left join public.customers c on c.id = v_dossier.customer_id
  where o.id = v_dossier.organization_id;

  insert into public.receipts (
    organization_id, station_id, service_order_id, number, replaces_receipt_id,
    contenu, currency, total_minor, paid_minor, issued_by
  ) values (
    v_dossier.organization_id, v_dossier.station_id, v_dossier.id, v_numero,
    p_replaces_receipt_id, v_contenu,
    v_contenu -> 'totaux' ->> 'devise',
    v_etat.total_amount_minor, v_etat.paid_amount_minor,
    vehora.current_profile_id()
  ) returning * into v_recu;

  -- Un reçu remis à un client est un document : son émission se trace.
  perform vehora.write_audit_log(
    case when p_replaces_receipt_id is null then 'receipt.issue' else 'receipt.correct' end,
    'receipt', v_recu.id::text,
    v_dossier.organization_id, v_dossier.station_id,
    case when v_remplace.id is null then null
         else jsonb_build_object('recu_corrige', v_remplace.number) end,
    jsonb_build_object('numero', v_numero, 'dossier', v_dossier.number,
                       'total_minor', v_recu.total_minor));

  return v_recu;
end;
$$;

revoke execute on function public.emettre_recu(uuid, uuid) from public, anon;
grant execute on function public.emettre_recu(uuid, uuid) to authenticated;

comment on function public.emettre_recu is
  'Émet un reçu numéroté sans trou pour un dossier, avec une copie figée de son contenu. SECURITY DEFINER pour écrire la séquence ; vérifie elle-même périmètre et permission. Ne pas révoquer son EXECUTE à `authenticated`.';

-- Un reçu ne se modifie ni ne se supprime, y compris en service_role : c'est un
-- document remis à quelqu'un. Une correction est un nouveau reçu.
create or replace function vehora.protect_receipt()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'VEHORA_RECU_IMMUABLE: un reçu ne se modifie ni ne se supprime ; émettez-en un nouveau'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger receipts_immuables
  before update or delete on public.receipts
  for each row execute function vehora.protect_receipt();

alter table public.receipts enable row level security;

create policy "read receipts" on public.receipts
  for select to authenticated
  using (vehora.can_read(organization_id, 'payments.read', station_id));

-- Aucune policy INSERT : l'émission passe par `emettre_recu`, seule capable de
-- prendre un numéro. Aucune policy UPDATE ni DELETE : le trigger refuserait de
-- toute façon, mais l'absence de policy le dit plus clairement.
