-- VEHORA — Phase 13 : rapports d'exploitation (fondation 5).
--
-- Deux niveaux financiers à ne jamais mélanger :
--   CA de l'organisation  ce que la station encaisse de ses clients ;
--   revenus VEHORA        les abonnements payés par les organisations.
-- Ces fonctions ne rendent que le premier. Aucune requête ici ne touche à une
-- table de plateforme, et les vues de plateforme n'exposent aucun montant.
--
-- SECURITY INVOKER : la RLS de l'appelant s'applique, donc une organisation ne
-- peut pas lire le chiffre d'une autre, ni un rôle de station celui d'un autre
-- site. S'y ajoute un contrôle explicite de `reports.read` : sans lui, un
-- réceptionniste — qui a `payments.read` pour encaisser — lirait le chiffre
-- d'affaires de la station. Le droit de faire n'est pas le droit de savoir.

create or replace function public.rapport_journalier(
  p_debut   date,
  p_fin     date,
  p_station uuid default null
)
returns table (
  jour              date,
  station_id        uuid,
  station_nom       text,
  dossiers_livres   bigint,
  encaisse_minor    bigint,
  especes_minor     bigint,
  mobile_minor      bigint,
  autres_minor      bigint,
  panier_moyen_minor bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not vehora.has_permission('reports.read') then
    raise exception 'VEHORA_PERMISSION: consulter les rapports exige la permission reports.read'
      using errcode = 'insufficient_privilege';
  end if;

  if p_fin < p_debut then
    raise exception 'VEHORA_PERIODE_INVALIDE: la fin de période précède son début'
      using errcode = 'check_violation';
  end if;

  -- Une période ouverte ferait une requête sans borne sur un téléphone lent.
  if p_fin - p_debut > 366 then
    raise exception 'VEHORA_PERIODE_TROP_LONGUE: 366 jours au maximum par rapport'
      using errcode = 'check_violation';
  end if;

  return query
  with encaissements as (
    -- Le CA est ce qui est ENTRÉ, à la date où c'est entré : un dossier
    -- d'hier payé aujourd'hui compte aujourd'hui. Un remboursement se
    -- soustrait le jour où il est rendu.
    select
      (p.created_at at time zone coalesce(o.timezone, 'UTC'))::date as jour,
      p.station_id,
      sum(case when p.kind = 'REFUND' then -p.amount_minor else p.amount_minor end) as encaisse,
      sum(case when p.method = 'CASH'
               then (case when p.kind = 'REFUND' then -p.amount_minor else p.amount_minor end)
               else 0 end) as especes,
      sum(case when p.method = 'MOBILE_MONEY'
               then (case when p.kind = 'REFUND' then -p.amount_minor else p.amount_minor end)
               else 0 end) as mobile,
      sum(case when p.method not in ('CASH', 'MOBILE_MONEY')
               then (case when p.kind = 'REFUND' then -p.amount_minor else p.amount_minor end)
               else 0 end) as autres
      from public.payments p
      join public.organizations o on o.id = p.organization_id
     where p.status = 'COMPLETED'
       and (p_station is null or p.station_id = p_station)
       and (p.created_at at time zone coalesce(o.timezone, 'UTC'))::date between p_debut and p_fin
     group by 1, 2
  ),
  restitutions as (
    select
      (d.delivered_at at time zone coalesce(o.timezone, 'UTC'))::date as jour,
      d.station_id,
      count(*) as livres
      from public.service_orders d
      join public.organizations o on o.id = d.organization_id
     where d.status = 'DELIVERED'
       and d.delivered_at is not null
       and (p_station is null or d.station_id = p_station)
       and (d.delivered_at at time zone coalesce(o.timezone, 'UTC'))::date between p_debut and p_fin
     group by 1, 2
  )
  select
    coalesce(e.jour, r.jour),
    coalesce(e.station_id, r.station_id),
    s.name,
    coalesce(r.livres, 0)::bigint,
    -- `sum()` sur un bigint rend un numeric : sans ces casts, la structure
    -- renvoyée ne correspond pas au type déclaré et la fonction échoue.
    coalesce(e.encaisse, 0)::bigint,
    coalesce(e.especes, 0)::bigint,
    coalesce(e.mobile, 0)::bigint,
    coalesce(e.autres, 0)::bigint,
    case when coalesce(r.livres, 0) = 0 then 0
         else (coalesce(e.encaisse, 0) / r.livres)::bigint end
  from encaissements e
  full outer join restitutions r on r.jour = e.jour and r.station_id = e.station_id
  join public.stations s on s.id = coalesce(e.station_id, r.station_id)
  order by 1 desc, 3;
end;
$$;

-- Ce qui se vend le plus, sur la période. Volumes et montants historisés des
-- lignes — pas le tarif d'aujourd'hui.
create or replace function public.rapport_prestations(
  p_debut   date,
  p_fin     date,
  p_station uuid default null
)
returns table (
  prestation      text,
  quantite        bigint,
  montant_minor   bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not vehora.has_permission('reports.read') then
    raise exception 'VEHORA_PERMISSION: consulter les rapports exige la permission reports.read'
      using errcode = 'insufficient_privilege';
  end if;

  if p_fin < p_debut or p_fin - p_debut > 366 then
    raise exception 'VEHORA_PERIODE_INVALIDE: période absente ou trop longue'
      using errcode = 'check_violation';
  end if;

  return query
  select
    i.service_name,
    sum(i.quantity)::bigint,
    sum(i.line_total_minor)::bigint
    from public.service_order_items i
    join public.service_orders d on d.id = i.service_order_id
    join public.organizations o on o.id = d.organization_id
   where d.status = 'DELIVERED'
     and d.delivered_at is not null
     and (p_station is null or d.station_id = p_station)
     and (d.delivered_at at time zone coalesce(o.timezone, 'UTC'))::date between p_debut and p_fin
   group by i.service_name
   order by 3 desc, 1;
end;
$$;

revoke execute on function public.rapport_journalier(date, date, uuid) from public, anon;
grant execute on function public.rapport_journalier(date, date, uuid) to authenticated;
revoke execute on function public.rapport_prestations(date, date, uuid) from public, anon;
grant execute on function public.rapport_prestations(date, date, uuid) to authenticated;

comment on function public.rapport_journalier is
  'Chiffre d''affaires encaissé et dossiers restitués, par jour et par station. SECURITY INVOKER : la RLS de l''appelant s''applique. Exige en plus `reports.read` — encaisser n''est pas savoir combien la station encaisse. Ne rend jamais les revenus de la plateforme.';
