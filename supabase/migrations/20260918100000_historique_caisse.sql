-- ---------------------------------------------------------------------------
-- Phase 18 — Historique des sessions de caisse
--
-- Jusqu'ici, une session clôturée disparaissait de l'écran : le compte était
-- fait, l'écart calculé, et plus personne ne pouvait y revenir. Or c'est
-- précisément ce qu'on relit — « qui tenait la caisse mardi soir, et pourquoi
-- manquait-il 2 000 F ? ».
--
-- Deux choses ici, et la première est un resserrement de droits.
--
-- 1. L'écart d'un collègue ne regarde pas un caissier. La policy de lecture
--    ouvrait toutes les sessions de la station à quiconque porte
--    `payments.read` — donc le manque à gagner de la personne d'à côté. On la
--    restreint : sa propre session, ou `cash.reconcile` (« valider un écart de
--    caisse »), que le rôle CASHIER n'a pas. Même règle sur les mouvements,
--    sinon l'information repasse par la porte de derrière.
--
-- 2. Une vue d'historique, en SECURITY INVOKER : elle ne montre donc que ce
--    que la policy ci-dessus laisse voir. Elle porte les noms (station,
--    ouvreur, clôtureur) et les comptes, parce que PostgREST ne joint pas une
--    vue agrégée et que l'écran les afficherait sinon en deux requêtes.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Resserrement : une session de caisse est personnelle
-- ---------------------------------------------------------------------------
drop policy "read cash registers" on public.cash_registers;

create policy "read cash registers" on public.cash_registers
  for select to authenticated
  using (
    vehora.can_read(organization_id, 'payments.read', station_id)
    and (
      opened_by = vehora.current_profile_id()
      or vehora.has_permission('cash.reconcile')
    )
  );

-- « Est-ce ma session ? » se lit dans `cash_registers`, elle-même protégée par
-- RLS : posée en sous-requête dans une policy, elle serait réévaluée sous la
-- policy ci-dessus, donc circulaire — et réévaluée par ligne. D'où ce helper,
-- `stable`, `security definer` et pleinement qualifié, comme les autres.
create or replace function vehora.est_ma_caisse(p_cash_register_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cash_registers r
     where r.id = p_cash_register_id
       and r.opened_by = vehora.current_profile_id()
  );
$$;

revoke execute on function vehora.est_ma_caisse(uuid) from public, anon;
grant execute on function vehora.est_ma_caisse(uuid) to authenticated;

drop policy "read cash transactions" on public.cash_transactions;

create policy "read cash transactions" on public.cash_transactions
  for select to authenticated
  using (
    vehora.can_read(organization_id, 'payments.read')
    and (
      vehora.has_permission('cash.reconcile')
      or vehora.est_ma_caisse(cash_register_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. L'historique
-- ---------------------------------------------------------------------------
create view public.cash_register_history
with (security_invoker = true) as
select
  r.id                     as cash_register_id,
  r.organization_id,
  r.station_id,
  s.name                   as station_name,
  r.status,
  r.currency,
  r.opening_float_minor,
  r.theoretical_minor,
  r.declared_closing_minor,
  r.variance_minor,
  r.closing_note,
  r.opened_at,
  r.closed_at,
  r.opened_by,
  po.full_name             as opened_by_name,
  r.closed_by,
  pc.full_name             as closed_by_name,
  coalesce(m.mouvements, 0)      as mouvements,
  coalesce(m.entrees_minor, 0)   as entrees_minor,
  coalesce(m.sorties_minor, 0)   as sorties_minor
from public.cash_registers r
join public.stations s on s.id = r.station_id
left join public.profiles po on po.id = r.opened_by
left join public.profiles pc on pc.id = r.closed_by
left join lateral (
  select
    count(*)                                                  as mouvements,
    sum(case when t.amount_minor > 0 then t.amount_minor else 0 end) as entrees_minor,
    sum(case when t.amount_minor < 0 then -t.amount_minor else 0 end) as sorties_minor
    from public.cash_transactions t
   where t.cash_register_id = r.id
) m on true;

comment on view public.cash_register_history is
  'Historique des sessions de caisse. SECURITY INVOKER : ne montre que les '
  'sessions que la policy de `cash_registers` laisse voir — les siennes, ou '
  'toutes avec `cash.reconcile`.';

-- Une vue n'a pas de RLS propre : elle hérite de celle des tables, à condition
-- de rester en `security_invoker`. On ne l'ouvre pas à `anon`.
revoke all on public.cash_register_history from public, anon;
grant select on public.cash_register_history to authenticated;

-- L'historique se lit par station et par date de clôture.
create index if not exists cash_registers_closed_idx
  on public.cash_registers (organization_id, closed_at desc)
  where status = 'CLOSED';

-- La policy filtre désormais sur `opened_by` à chaque lecture, et cette clé
-- étrangère n'avait aucun index qui la couvre (relevé par l'advisor Supabase).
create index if not exists cash_registers_opened_by_idx
  on public.cash_registers (opened_by);
