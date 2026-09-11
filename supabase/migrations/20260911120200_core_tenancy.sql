-- VEHORA — Phase 0 : entités de cloisonnement (fondation 2).
-- Toute donnée métier portera `organization_id`. Sans exception.

create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  status       public.organization_status not null default 'TRIAL',
  country_code text not null,                    -- ISO 3166-1 alpha-2 : SN, ML, CI…
  city         text,
  address      text,
  phone        text,
  email        text,
  logo_path    text,                             -- chemin Storage, jamais une URL publique
  currency     text not null default 'XOF',      -- ISO 4217
  timezone     text not null default 'Africa/Dakar',
  locale       text not null default 'fr',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Paramètres métier d'une organisation. Table séparée : ces valeurs sont lues
-- par les règles serveur (transitions, restitution) et changent de rythme.
create table public.organization_settings (
  organization_id          uuid primary key references public.organizations(id) on delete cascade,
  require_inspection       boolean not null default true,
  require_quality_control  boolean not null default true,
  payment_before_delivery  public.payment_before_delivery_rule not null default 'ALLOW_DEBT',
  -- Au-delà de ce pourcentage, une remise exige `payments.refund` et est auditée.
  max_discount_percent     numeric(5,2) not null default 10 check (max_discount_percent between 0 and 100),
  updated_at               timestamptz not null default now()
);

-- Miroir applicatif de auth.users. Ne contient aucune donnée d'organisation :
-- un même compte peut appartenir à plusieurs organisations.
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  phone      text,
  avatar_path text,
  locale     text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  kind            public.station_kind not null default 'FIXED',
  status          public.station_status not null default 'ACTIVE',
  city            text,
  address         text,
  phone           text,
  timezone        text,                          -- hérite de l'organisation si null
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create index on public.stations (organization_id);

-- Table pivot centrale : « ce compte appartient à cette organisation, avec ce rôle ».
create table public.organization_memberships (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id         uuid not null references public.roles(id) on delete restrict,
  status          public.membership_status not null default 'ACTIVE',
  invited_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (profile_id, organization_id)
);

create index on public.organization_memberships (organization_id, status);
create index on public.organization_memberships (profile_id);

-- Affectation à une station. N'a de sens que pour un rôle de portée STATION :
-- un rôle de portée ORGANIZATION couvre toutes les stations sans ligne ici.
create table public.station_users (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  station_id    uuid not null references public.stations(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (membership_id, station_id)
);

create index on public.station_users (station_id);

-- Révocation immédiate : contourne la latence du JWT (ADR-001). Consultée par
-- les policies des opérations sensibles uniquement — une lecture indexée.
create table public.session_revocations (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  revoked_at   timestamptz not null default now(),
  reason       text
);

-- Journal d'audit. Deux portées : organisation (organization_id renseigné) et
-- plateforme (organization_id null ou cible d'une action Super Admin).
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_label     text,                          -- conservé même si le compte disparaît
  organization_id uuid references public.organizations(id) on delete set null,
  station_id      uuid references public.stations(id) on delete set null,
  action          text not null,                 -- ex. 'service_order.transition'
  resource_type   text not null,
  resource_id     text,
  old_value       jsonb,
  new_value       jsonb,
  reason          text,
  context         jsonb not null default '{}'::jsonb  -- ip, user agent, session d'assistance
);

create index on public.audit_logs (organization_id, occurred_at desc);
create index on public.audit_logs (actor_profile_id, occurred_at desc);
create index on public.audit_logs (action, occurred_at desc);

comment on table public.audit_logs is
  'Écriture seule. Aucun UPDATE ni DELETE n''est autorisé, pour personne.';

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------

-- Une station appartient à la même organisation que le membre qui y est affecté.
create or replace function vehora.check_station_user_tenancy()
returns trigger language plpgsql as $$
declare
  v_membership_org uuid;
  v_station_org    uuid;
begin
  select organization_id into v_membership_org
    from public.organization_memberships where id = new.membership_id;
  select organization_id into v_station_org
    from public.stations where id = new.station_id;

  if v_membership_org is distinct from v_station_org then
    raise exception 'VEHORA_TENANCY_VIOLATION: la station et l''adhésion appartiennent à des organisations différentes';
  end if;
  return new;
end;
$$;

create trigger station_users_tenancy
  before insert or update on public.station_users
  for each row execute function vehora.check_station_user_tenancy();

-- Une organisation garde toujours au moins un OWNER actif.
create or replace function vehora.check_last_owner()
returns trigger language plpgsql as $$
declare
  v_owner_role uuid;
  v_remaining  integer;
begin
  select id into v_owner_role from public.roles where code = 'OWNER';

  if old.role_id = v_owner_role and old.status = 'ACTIVE' then
    select count(*) into v_remaining
      from public.organization_memberships
     where organization_id = old.organization_id
       and role_id = v_owner_role
       and status = 'ACTIVE'
       and id <> old.id;

    if v_remaining = 0 then
      raise exception 'VEHORA_LAST_OWNER: une organisation doit conserver au moins un propriétaire actif';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_last_owner
  before update or delete on public.organization_memberships
  for each row execute function vehora.check_last_owner();

-- Horodatage de modification.
create or replace function vehora.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_touch before update on public.organizations
  for each row execute function vehora.touch_updated_at();
create trigger organization_settings_touch before update on public.organization_settings
  for each row execute function vehora.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function vehora.touch_updated_at();
create trigger stations_touch before update on public.stations
  for each row execute function vehora.touch_updated_at();
create trigger memberships_touch before update on public.organization_memberships
  for each row execute function vehora.touch_updated_at();

-- Création automatique du profil à l'inscription.
create or replace function vehora.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function vehora.handle_new_user();
