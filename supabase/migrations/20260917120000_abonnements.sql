-- VEHORA — Phase 14 : abonnements et feature flags (fondation 3, ADR-002).
--
-- Pas de moteur de facturation dans le MVP : aucune passerelle de paiement,
-- aucune relance, aucune facture. Ce que cette migration pose, c'est ce dont le
-- produit a besoin AVANT d'avoir des clients payants :
--   — savoir quel plan porte une organisation, et donc ses limites ;
--   — savoir si une fonctionnalité est ouverte pour elle ;
--   — faire appliquer les deux PAR LA BASE, pas par un écran.
--
-- Deux niveaux financiers, jamais mélangés (fondation 5) : le chiffre
-- d'affaires d'une organisation est à elle ; les revenus de VEHORA sont ces
-- abonnements. Aucune requête d'ici ne touche à `payments`, et
-- `rapport_journalier` ne touche à rien d'ici.

-- ---------------------------------------------------------------------------
-- Plans.
--
-- `null` sur une limite veut dire « pas de limite », pas « zéro ». C'est la
-- seule lecture possible d'une case vide sur un plan sur mesure, et elle doit
-- être explicite dans chaque comparaison.
-- ---------------------------------------------------------------------------
create table public.plans (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  label        text not null,
  description  text,
  price_minor  bigint not null default 0 check (price_minor >= 0),
  currency     text not null default 'XOF',
  max_stations integer check (max_stations is null or max_stations > 0),
  max_users    integer check (max_users is null or max_users > 0),
  is_public    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on column public.plans.max_stations is
  'Nombre de stations autorisées. NULL = illimité, jamais zéro.';

insert into public.plans (code, label, description, price_minor, max_stations, max_users, sort_order)
values
  ('DECOUVERTE', 'Découverte', 'Essai : une station, trois comptes.', 0, 1, 3, 1),
  ('ESSENTIEL', 'Essentiel', 'Une ou deux stations, dix comptes.', 25000, 2, 10, 2),
  ('PRO', 'Pro', 'Jusqu''à dix stations, cinquante comptes, rapports inclus.', 60000, 10, 50, 3),
  ('SUR_MESURE', 'Sur mesure', 'Sans limite de stations ni de comptes.', 0, null, null, 4);

-- ---------------------------------------------------------------------------
-- Abonnements. Une organisation n'en a qu'un en cours à la fois.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id         uuid not null references public.plans(id) on delete restrict,
  status          text not null default 'TRIAL'
                    check (status in ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED')),
  started_at      timestamptz not null default now(),
  trial_ends_at   timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Un seul abonnement en cours par organisation : l'index le garantit, plutôt
-- qu'un booléen « courant » que deux écritures concurrentes pourraient poser
-- toutes les deux.
create unique index subscriptions_en_cours_idx
  on public.subscriptions (organization_id)
  where status in ('TRIAL', 'ACTIVE', 'PAST_DUE');

create index subscriptions_plan_idx on public.subscriptions (plan_id);

-- ---------------------------------------------------------------------------
-- Feature flags.
--
-- Trois niveaux, du plus précis au plus général : organisation → plan → défaut
-- global. C'est la résolution décrite par la fondation 3, et elle a lieu DANS
-- LA BASE. Le frontend ne fait que lire le résultat : un flag lu côté client
-- est un affichage, jamais une autorisation.
-- ---------------------------------------------------------------------------
create table public.feature_flags (
  key                text primary key,
  label              text not null,
  description        text,
  enabled_by_default boolean not null default false,
  created_at         timestamptz not null default now()
);

create table public.plan_features (
  plan_id  uuid not null references public.plans(id) on delete cascade,
  flag_key text not null references public.feature_flags(key) on delete cascade,
  enabled  boolean not null,
  primary key (plan_id, flag_key)
);

create table public.organization_feature_overrides (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flag_key        text not null references public.feature_flags(key) on delete cascade,
  enabled         boolean not null,
  reason          text,
  created_at      timestamptz not null default now(),
  primary key (organization_id, flag_key)
);

insert into public.feature_flags (key, label, description, enabled_by_default)
values
  ('rapports', 'Rapports d''exploitation',
   'Chiffre d''affaires par jour et par station, et ce qui se vend.', false),
  ('recus', 'Reçus imprimables',
   'Émission de reçus numérotés remis au client.', true),
  ('inspections_photos', 'Photos d''inspection',
   'Pièces jointes aux inspections de véhicule.', true);

-- Les rapports ne sont ouverts qu'à partir du plan Pro ; le reste suit le
-- défaut global. Une ligne ici n'existe que lorsqu'elle dit autre chose que ce
-- défaut : une table de flags qui répète le défaut ment dès qu'il change.
insert into public.plan_features (plan_id, flag_key, enabled)
select p.id, 'rapports', true from public.plans p where p.code in ('PRO', 'SUR_MESURE');

-- ---------------------------------------------------------------------------
-- Rattachement des organisations existantes.
--
-- Elles précèdent la facturation : leur imposer une limite rétroactivement
-- couperait des stations et des comptes déjà créés, en production, sans que
-- personne ait rien demandé. Elles reçoivent donc un plan large et actif ; les
-- organisations créées ensuite commencent en essai.
-- ---------------------------------------------------------------------------
insert into public.subscriptions (organization_id, plan_id, status)
select o.id, p.id, 'ACTIVE'
  from public.organizations o
  cross join public.plans p
 where p.code = 'PRO'
   and o.is_platform = false;

-- Une organisation nouvelle naît avec son essai. `provisionner_organisation()`
-- n'a pas à le savoir : le déclencheur suit l'organisation, quel que soit le
-- chemin par lequel elle est créée.
create or replace function vehora.creer_abonnement_essai()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_plan uuid;
begin
  if new.is_platform then return new; end if;

  select id into v_plan from public.plans where code = 'DECOUVERTE';
  if v_plan is null then return new; end if;

  insert into public.subscriptions (organization_id, plan_id, status, trial_ends_at)
  values (new.id, v_plan, 'TRIAL', now() + interval '30 days')
  on conflict do nothing;

  return new;
end;
$$;

create trigger organizations_abonnement_essai
  after insert on public.organizations
  for each row execute function vehora.creer_abonnement_essai();

-- ---------------------------------------------------------------------------
-- Résolution.
--
-- `security definer` : ces fonctions lisent des tables que le client n'a pas le
-- droit de lire ligne à ligne. Elles ne rendent jamais que la réponse
-- concernant l'organisation passée, et elles sont la seule source de vérité —
-- côté serveur comme côté écran.
-- ---------------------------------------------------------------------------
create or replace function vehora.plan_courant(p_organization_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
   where s.organization_id = p_organization_id
     and s.status in ('TRIAL', 'ACTIVE', 'PAST_DUE')
   limit 1;
$$;

create or replace function vehora.flag_actif(
  p_cle text,
  p_organization_id uuid default vehora.current_org_id()
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_valeur boolean;
begin
  if p_organization_id is null then return false; end if;

  -- 1. Décision prise pour cette organisation.
  select enabled into v_valeur
    from public.organization_feature_overrides
   where organization_id = p_organization_id and flag_key = p_cle;
  if found then return v_valeur; end if;

  -- 2. Ce que son plan ouvre.
  select pf.enabled into v_valeur
    from public.subscriptions s
    join public.plan_features pf on pf.plan_id = s.plan_id
   where s.organization_id = p_organization_id
     and s.status in ('TRIAL', 'ACTIVE', 'PAST_DUE')
     and pf.flag_key = p_cle;
  if found then return v_valeur; end if;

  -- 3. Le défaut du produit. Une clé inconnue est fermée, pas ouverte.
  select enabled_by_default into v_valeur
    from public.feature_flags where key = p_cle;
  return coalesce(v_valeur, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Quotas.
--
-- Une limite qui n'est vérifiée qu'à l'écran n'est pas une limite. Ces
-- déclencheurs sont la règle ; l'interface ne fait que l'annoncer plus tôt.
-- ---------------------------------------------------------------------------
create or replace function vehora.verifier_quota_stations()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
  v_utilisees integer;
begin
  select max_stations into v_max from vehora.plan_courant(new.organization_id);
  if v_max is null then return new; end if;

  select count(*) into v_utilisees from public.stations
   where organization_id = new.organization_id;

  if v_utilisees >= v_max then
    raise exception 'VEHORA_QUOTA_STATIONS: votre plan autorise % station(s) ; changez de plan pour en ouvrir une autre', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger stations_quota
  before insert on public.stations
  for each row execute function vehora.verifier_quota_stations();

create or replace function vehora.verifier_quota_membres()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
  v_actifs integer;
begin
  -- Seule l'arrivée d'un compte actif consomme un siège. Réactiver en consomme
  -- un aussi ; changer le rôle d'un membre déjà actif, non.
  if new.status <> 'ACTIVE' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'ACTIVE' then return new; end if;

  select max_users into v_max from vehora.plan_courant(new.organization_id);
  if v_max is null then return new; end if;

  select count(*) into v_actifs from public.organization_memberships
   where organization_id = new.organization_id and status = 'ACTIVE';

  if v_actifs >= v_max then
    raise exception 'VEHORA_QUOTA_MEMBRES: votre plan autorise % compte(s) actif(s) ; changez de plan pour en ajouter', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger memberships_quota
  before insert or update of status on public.organization_memberships
  for each row execute function vehora.verifier_quota_membres();

-- ---------------------------------------------------------------------------
-- Ce que l'organisation a le droit de savoir d'elle-même.
--
-- Pas de policy de lecture sur `plans`, `subscriptions` ou les flags : une
-- organisation lirait la grille tarifaire et les décisions prises pour les
-- autres. Elle interroge une fonction, qui ne parle que d'elle.
-- ---------------------------------------------------------------------------
create or replace function public.mon_abonnement()
returns table (
  plan_code       text,
  plan_label      text,
  statut          text,
  essai_jusqu_au  timestamptz,
  max_stations    integer,
  max_users       integer,
  stations_utilisees bigint,
  membres_actifs  bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := vehora.current_org_id();
begin
  if v_org is null then return; end if;

  return query
  select p.code, p.label, s.status, s.trial_ends_at, p.max_stations, p.max_users,
         (select count(*) from public.stations st where st.organization_id = v_org),
         (select count(*) from public.organization_memberships m
           where m.organization_id = v_org and m.status = 'ACTIVE')
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
   where s.organization_id = v_org
     and s.status in ('TRIAL', 'ACTIVE', 'PAST_DUE');
end;
$$;

create or replace function public.mes_fonctionnalites()
returns table (cle text, libelle text, actif boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := vehora.current_org_id();
begin
  if v_org is null then return; end if;

  return query
  select f.key, f.label, vehora.flag_actif(f.key, v_org)
    from public.feature_flags f
   order by f.label;
end;
$$;

revoke execute on function public.mon_abonnement() from public, anon;
grant execute on function public.mon_abonnement() to authenticated;
revoke execute on function public.mes_fonctionnalites() from public, anon;
grant execute on function public.mes_fonctionnalites() to authenticated;
revoke execute on function vehora.flag_actif(text, uuid) from public, anon;
revoke execute on function vehora.plan_courant(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- RLS.
--
-- Ces quatre tables sont des données de plateforme. Aucune policy pour
-- `authenticated` : un client ne lit ni la grille tarifaire, ni l'abonnement
-- d'un autre, ni les dérogations accordées ailleurs. La plateforme lit par ses
-- propres policies ; le client passe par les deux fonctions ci-dessus.
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.feature_flags enable row level security;
alter table public.plan_features enable row level security;
alter table public.organization_feature_overrides enable row level security;

create policy "platform reads plans" on public.plans
  for select to authenticated using (vehora.is_platform_admin());
create policy "platform reads subscriptions" on public.subscriptions
  for select to authenticated using (vehora.is_platform_admin());
create policy "platform reads flags" on public.feature_flags
  for select to authenticated using (vehora.is_platform_admin());
create policy "platform reads plan features" on public.plan_features
  for select to authenticated using (vehora.is_platform_admin());
create policy "platform reads overrides" on public.organization_feature_overrides
  for select to authenticated using (vehora.is_platform_admin());

-- Aucune policy d'écriture nulle part : changer un plan ou une dérogation passe
-- par une fonction privilégiée qui vérifie le droit, exige un motif et audite.
