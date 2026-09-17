-- VEHORA — Phase 14, correction : une fonction en droits d'appelant ne peut
-- appeler que ce que l'appelant a le droit d'appeler.
--
-- `rapport_journalier` est en SECURITY INVOKER — c'est ce qui fait appliquer la
-- RLS du demandeur. Elle appelait `vehora.flag_actif`, dont l'EXECUTE avait été
-- révoqué de `public` pour que personne ne puisse sonder les fonctionnalités
-- d'une AUTRE organisation (la fonction prend un identifiant d'organisation en
-- paramètre). Résultat : le rapport tombait sur « permission denied for function
-- flag_actif » au lieu de rendre le chiffre ou de refuser proprement.
--
-- La campagne d'intrusion l'a vu ; la validation locale, non : le harnais pose
-- `alter default privileges in schema vehora grant execute … to authenticated`,
-- ce que Supabase fait aussi par le défaut de PostgreSQL. La différence, c'est
-- que le harnais reposait le droit APRÈS la révocation.
--
-- La sortie n'est pas de rendre `flag_actif` appelable : c'est d'exposer une
-- fonction qui ne prend pas d'organisation en paramètre, et ne peut donc
-- répondre que sur la sienne.
create or replace function public.fonctionnalite_active(p_cle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select vehora.flag_actif(p_cle, vehora.current_org_id());
$$;

revoke execute on function public.fonctionnalite_active(text) from public, anon;
grant execute on function public.fonctionnalite_active(text) to authenticated;

comment on function public.fonctionnalite_active is
  'Répond « cette fonctionnalité est-elle ouverte pour MON organisation ? ». Ne prend aucun identifiant d''organisation : on ne sonde pas le voisin. C''est la seule porte ouverte à `authenticated` sur la résolution des flags.';

-- Les deux rapports passent par elle.
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

  if not public.fonctionnalite_active('rapports') then
    raise exception 'VEHORA_FONCTIONNALITE_FERMEE: les rapports ne sont pas inclus dans votre plan'
      using errcode = 'insufficient_privilege';
  end if;

  if p_fin < p_debut then
    raise exception 'VEHORA_PERIODE_INVALIDE: la fin de période précède son début'
      using errcode = 'check_violation';
  end if;

  if p_fin - p_debut > 366 then
    raise exception 'VEHORA_PERIODE_TROP_LONGUE: 366 jours au maximum par rapport'
      using errcode = 'check_violation';
  end if;

  return query
  with encaissements as (
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

  if not public.fonctionnalite_active('rapports') then
    raise exception 'VEHORA_FONCTIONNALITE_FERMEE: les rapports ne sont pas inclus dans votre plan'
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
