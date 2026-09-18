-- ---------------------------------------------------------------------------
-- Phase 20 — Facturation des abonnements
--
-- Jusqu'ici un abonnement se changeait à la main et ne produisait rien : ni
-- échéance, ni facture, ni relance. VEHORA facturait de mémoire.
--
-- Quatre décisions structurent ce fichier.
--
-- 1. **Une facture est un constat, comme un reçu et comme une inspection.**
--    Elle fige ce qu'elle facture — le nom de l'organisation, le code du plan,
--    le montant — parce que renommer une organisation ou changer un tarif ne
--    doit modifier aucune facture émise. Aucune policy d'écriture : l'émission,
--    le règlement et l'annulation passent par des fonctions qui vérifient leur
--    droit et auditent.
--
-- 2. **Une facture appartient à la plateforme, pas au client.** C'est le
--    revenu de VEHORA, jamais le chiffre d'affaires d'une station. Les deux ne
--    s'additionnent pas. Elle vit donc du côté `platform_*`, et le client n'en
--    lit que les siennes, par une fonction qui ne parle que de lui.
--
-- 3. **Une organisation reste supprimable.** C'est l'invariant que trois
--    incidents ont déjà menacé (phases 1, 10 et 14). `organization_id` est donc
--    `ON DELETE SET NULL` et nullable — comme `audit_logs` —, et le nom de
--    l'organisation est recopié dans la facture pour qu'elle reste lisible
--    après coup. Le trigger d'immuabilité se tait sur cette cascade, écrit ici
--    d'emblée plutôt qu'après le quatrième incident.
--
-- 4. **La numérotation est sans trou** : UPSERT sur un compteur, dans la
--    transaction qui écrit. Un échec annule l'incrément.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Compteur de numérotation, par année
-- ---------------------------------------------------------------------------
create table vehora.invoice_sequences (
  year        integer primary key,
  last_number bigint not null default 0
);

comment on table vehora.invoice_sequences is
  'Compteur de factures, une ligne par année. Hors du schéma public : aucune '
  'API ne doit le lire ni l''écrire.';

-- ---------------------------------------------------------------------------
-- Factures
-- ---------------------------------------------------------------------------
create table public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  -- Nullable et SET NULL : une organisation doit rester supprimable. Le nom est
  -- figé juste en dessous, donc la facture reste lisible sans elle.
  organization_id    uuid references public.organizations(id) on delete set null,
  organization_label text not null,
  subscription_id    uuid references public.subscriptions(id) on delete set null,
  plan_code          text not null,

  reference          text not null unique,
  number             bigint not null,
  year               integer not null,

  period_start       date not null,
  period_end         date not null,
  amount_minor       bigint not null check (amount_minor >= 0),
  currency           text not null,

  status             text not null default 'ISSUED'
                       check (status in ('ISSUED', 'PAID', 'VOID')),
  issued_at          timestamptz not null default now(),
  due_date           date not null,
  paid_at            timestamptz,
  payment_reference  text,
  void_reason        text,

  created_at         timestamptz not null default now(),

  constraint invoices_periode_coherente check (period_end >= period_start),
  constraint invoices_echeance_coherente check (due_date >= period_start)
);

-- Une organisation n'est pas facturée deux fois pour la même période. L'index
-- le garantit en base : deux appels concurrents à l'émission ne peuvent pas
-- produire chacun leur facture.
create unique index invoices_periode_unique_idx
  on public.invoices (organization_id, period_start)
  where organization_id is not null and status <> 'VOID';

create index invoices_org_idx on public.invoices (organization_id, issued_at desc);
create index invoices_statut_idx on public.invoices (status, due_date);
create index invoices_subscription_idx on public.invoices (subscription_id);

-- ---------------------------------------------------------------------------
-- Immuabilité
--
-- Une facture émise ne se réécrit pas et ne se supprime pas. Elle change d'état
-- par les fonctions ci-dessous, qui posent un drapeau de transaction portant
-- l'identifiant de la facture — un booléen laisserait une opération légitime en
-- couvrir une autre dans la même transaction.
-- ---------------------------------------------------------------------------
create or replace function vehora.protect_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autorise text := current_setting('vehora.facture_en_cours', true);
  v_avant    jsonb;
  v_apres    jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'VEHORA_FACTURE_IMMUABLE : une facture ne se supprime pas ; on l''annule.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_autorise is not null and v_autorise = old.id::text then
    return new;
  end if;

  -- Cascade `ON DELETE SET NULL` : la suppression d'une organisation demande un
  -- UPDATE sur cette colonne. Le reste de la ligne doit être intact.
  v_avant := to_jsonb(old) - 'organization_id' - 'subscription_id';
  v_apres := to_jsonb(new) - 'organization_id' - 'subscription_id';
  if v_avant = v_apres
     and (new.organization_id is null or new.subscription_id is null) then
    return new;
  end if;

  raise exception 'VEHORA_FACTURE_IMMUABLE : une facture émise ne se modifie pas.'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger invoices_immuables
  before update or delete on public.invoices
  for each row execute function vehora.protect_invoice();

-- ---------------------------------------------------------------------------
-- Émission des échéances
--
-- Appelée par la plateforme. Elle est idempotente : rejouée sur la même
-- période, elle ne produit rien de plus (l'index unique le garantit, et la
-- requête l'évite).
-- ---------------------------------------------------------------------------
create or replace function public.emettre_factures(
  p_periode    date default date_trunc('month', now())::date,
  p_delai_jours integer default 15
)
returns table (reference text, organisation text, montant_minor bigint, devise text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debut date := date_trunc('month', p_periode)::date;
  v_fin   date := (date_trunc('month', p_periode) + interval '1 month - 1 day')::date;
  v_annee integer := extract(year from v_debut);
  v_num   bigint;
  v_ligne record;
begin
  if not vehora.has_permission('platform.subscriptions.manage') then
    raise exception 'VEHORA_DROIT_REQUIS : la facturation appartient à la plateforme.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_delai_jours < 0 or p_delai_jours > 180 then
    raise exception 'VEHORA_DELAI_INVALIDE : le délai de paiement va de 0 à 180 jours.';
  end if;

  for v_ligne in
    select s.id as subscription_id, s.organization_id, o.name as organisation,
           p.code as plan_code, p.price_minor, p.currency
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      join public.organizations o on o.id = s.organization_id
     where s.status in ('ACTIVE', 'PAST_DUE')
       -- Un plan gratuit ne produit pas de facture à zéro : une facture de zéro
       -- franc est du bruit qu'il faudra classer, relancer et expliquer.
       and p.price_minor > 0
       and not exists (
         select 1 from public.invoices i
          where i.organization_id = s.organization_id
            and i.period_start = v_debut
            and i.status <> 'VOID')
     order by o.name
  loop
    -- UPSERT sur le compteur : le verrou de ligne est pris dans cette
    -- transaction, un échec plus bas annule l'incrément. Pas de trou.
    insert into vehora.invoice_sequences (year, last_number)
    values (v_annee, 1)
    on conflict (year) do update set last_number = vehora.invoice_sequences.last_number + 1
    returning last_number into v_num;

    insert into public.invoices (
      organization_id, organization_label, subscription_id, plan_code,
      reference, number, year, period_start, period_end,
      amount_minor, currency, due_date)
    values (
      v_ligne.organization_id, v_ligne.organisation, v_ligne.subscription_id,
      v_ligne.plan_code,
      'VH-' || v_annee || '-' || lpad(v_num::text, 6, '0'), v_num, v_annee,
      v_debut, v_fin, v_ligne.price_minor, v_ligne.currency,
      v_debut + p_delai_jours);

    reference := 'VH-' || v_annee || '-' || lpad(v_num::text, 6, '0');
    organisation := v_ligne.organisation;
    montant_minor := v_ligne.price_minor;
    devise := v_ligne.currency;
    return next;
  end loop;

  insert into public.audit_logs (action, resource_type, resource_id, context, actor_label)
  values ('platform.invoices.issue', 'invoice', null,
          jsonb_build_object('periode', v_debut), 'plateforme');
end;
$$;

-- ---------------------------------------------------------------------------
-- Règlement et annulation
-- ---------------------------------------------------------------------------
create or replace function public.marquer_facture_payee(
  p_invoice_id uuid,
  p_reference  text default null
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare v_facture public.invoices;
begin
  if not vehora.has_permission('platform.subscriptions.manage') then
    raise exception 'VEHORA_DROIT_REQUIS : la facturation appartient à la plateforme.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_facture from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'VEHORA_FACTURE_INTROUVABLE : cette facture n''existe pas.';
  end if;
  if v_facture.status = 'PAID' then
    raise exception 'VEHORA_FACTURE_DEJA_PAYEE : cette facture est déjà réglée.';
  end if;
  if v_facture.status = 'VOID' then
    raise exception 'VEHORA_FACTURE_ANNULEE : une facture annulée ne se règle pas.';
  end if;

  perform set_config('vehora.facture_en_cours', p_invoice_id::text, true);
  update public.invoices
     set status = 'PAID', paid_at = now(), payment_reference = p_reference
   where id = p_invoice_id
  returning * into v_facture;
  perform set_config('vehora.facture_en_cours', '', true);

  -- Une organisation qui règle sort de l'impayé, si plus rien ne traîne.
  update public.subscriptions s
     set status = 'ACTIVE'
   where s.organization_id = v_facture.organization_id
     and s.status = 'PAST_DUE'
     and not exists (
       select 1 from public.invoices i
        where i.organization_id = s.organization_id
          and i.status = 'ISSUED'
          and i.due_date < current_date);

  insert into public.audit_logs (action, resource_type, resource_id, context,
                                 organization_id, actor_label)
  values ('platform.invoice.paid', 'invoice', p_invoice_id::text,
          jsonb_build_object('reference', v_facture.reference,
                             'montant_minor', v_facture.amount_minor),
          v_facture.organization_id, 'plateforme');

  return v_facture;
end;
$$;

create or replace function public.annuler_facture(
  p_invoice_id uuid,
  p_motif      text
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare v_facture public.invoices;
begin
  if not vehora.has_permission('platform.subscriptions.manage') then
    raise exception 'VEHORA_DROIT_REQUIS : la facturation appartient à la plateforme.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_motif is null or length(trim(p_motif)) < 3 then
    raise exception 'VEHORA_MOTIF_REQUIS : une annulation s''explique.';
  end if;

  select * into v_facture from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'VEHORA_FACTURE_INTROUVABLE : cette facture n''existe pas.';
  end if;
  if v_facture.status = 'PAID' then
    raise exception 'VEHORA_FACTURE_DEJA_PAYEE : une facture réglée ne s''annule pas ; on rembourse.';
  end if;

  perform set_config('vehora.facture_en_cours', p_invoice_id::text, true);
  update public.invoices
     set status = 'VOID', void_reason = trim(p_motif)
   where id = p_invoice_id
  returning * into v_facture;
  perform set_config('vehora.facture_en_cours', '', true);

  insert into public.audit_logs (action, resource_type, resource_id, reason, context,
                                 organization_id, actor_label)
  values ('platform.invoice.void', 'invoice', p_invoice_id::text, trim(p_motif),
          jsonb_build_object('reference', v_facture.reference),
          v_facture.organization_id, 'plateforme');

  return v_facture;
end;
$$;

-- ---------------------------------------------------------------------------
-- Relance
--
-- Une échéance dépassée fait passer l'abonnement en `PAST_DUE`. C'est un état,
-- pas une sanction : la suspension reste une décision, prise ailleurs et
-- auditée. Confondre les deux, c'est couper un client pour un virement en
-- retard de deux jours.
-- ---------------------------------------------------------------------------
create or replace function public.relancer_impayes()
returns table (reference text, organisation text, jours_de_retard integer,
               montant_minor bigint, devise text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not vehora.has_permission('platform.subscriptions.manage') then
    raise exception 'VEHORA_DROIT_REQUIS : la facturation appartient à la plateforme.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.subscriptions s
     set status = 'PAST_DUE'
   where s.status = 'ACTIVE'
     and exists (
       select 1 from public.invoices i
        where i.organization_id = s.organization_id
          and i.status = 'ISSUED'
          and i.due_date < current_date);

  insert into public.audit_logs (action, resource_type, context, actor_label)
  values ('platform.invoices.dunning', 'invoice',
          jsonb_build_object('le', current_date), 'plateforme');

  return query
  select i.reference, i.organization_label,
         (current_date - i.due_date)::integer,
         i.amount_minor, i.currency
    from public.invoices i
   where i.status = 'ISSUED' and i.due_date < current_date
   order by i.due_date;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecture
-- ---------------------------------------------------------------------------

-- Côté plateforme : même forme que les autres vues `platform_*` — SECURITY
-- DEFINER, garde-fou dans le corps. En `security_invoker` elle ne renverrait
-- rien, faute de policy de lecture pour qui que ce soit.
create view public.platform_invoices
with (security_invoker = false) as
select
  i.id, i.reference, i.organization_id, i.organization_label, i.plan_code,
  i.period_start, i.period_end, i.amount_minor, i.currency,
  i.status, i.issued_at, i.due_date, i.paid_at, i.payment_reference, i.void_reason,
  (i.status = 'ISSUED' and i.due_date < current_date) as en_retard,
  case when i.status = 'ISSUED' and i.due_date < current_date
       then (current_date - i.due_date)::integer else 0 end as jours_de_retard
from public.invoices i
where vehora.is_platform_admin();

revoke all on public.platform_invoices from public, anon;
grant select on public.platform_invoices to authenticated;

-- Côté client : ses factures, et rien d'autre. Comme `mon_abonnement()`, la
-- fonction ne prend aucun paramètre — il n'y a donc rien à falsifier.
create or replace function public.mes_factures()
returns table (reference text, periode_debut date, periode_fin date,
               montant_minor bigint, devise text, statut text,
               echeance date, payee_le timestamptz, en_retard boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_org uuid := vehora.current_org_id();
begin
  if v_org is null then return; end if;

  return query
  select i.reference, i.period_start, i.period_end, i.amount_minor, i.currency,
         i.status, i.due_date, i.paid_at,
         (i.status = 'ISSUED' and i.due_date < current_date)
    from public.invoices i
   where i.organization_id = v_org
   order by i.period_start desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS et droits
--
-- Une seule policy, de lecture, pour la plateforme — la même forme que `plans`
-- et `subscriptions`. Aucune policy d'écriture : l'émission, le règlement et
-- l'annulation passent par les fonctions ci-dessus. Le client n'a aucune
-- policy du tout ; il interroge `mes_factures()`, qui ne parle que de lui.
--
-- `EXECUTE` est accordé à `PUBLIC` par défaut sur toute fonction PostgreSQL :
-- on le retire explicitement, ici comme partout.
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;

create policy "platform reads invoices" on public.invoices
  for select to authenticated using (vehora.is_platform_admin());

revoke execute on function public.emettre_factures(date, integer) from public, anon;
revoke execute on function public.marquer_facture_payee(uuid, text) from public, anon;
revoke execute on function public.annuler_facture(uuid, text) from public, anon;
revoke execute on function public.relancer_impayes() from public, anon;
revoke execute on function public.mes_factures() from public, anon;

grant execute on function public.emettre_factures(date, integer) to authenticated;
grant execute on function public.marquer_facture_payee(uuid, text) to authenticated;
grant execute on function public.annuler_facture(uuid, text) to authenticated;
grant execute on function public.relancer_impayes() to authenticated;
grant execute on function public.mes_factures() to authenticated;
