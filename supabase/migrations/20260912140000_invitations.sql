-- VEHORA — Phase 4 : invitations d'utilisateurs.
--
-- Choix de conception : on n'invite pas en créant le compte à la place de la
-- personne. Un administrateur qui crée un compte doit en choisir le mot de
-- passe, donc le connaître — c'est un mauvais schéma. Et créer un compte exige
-- la clé `service_role`, qui n'a rien à faire dans ce flux.
--
-- À la place : une invitation nommée par e-mail, portant un jeton. La personne
-- crée son propre compte avec son propre mot de passe, puis l'accepte. Aucun
-- secret ne circule, et l'invitation reste révocable.

create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

create table public.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade
                       default vehora.current_org_id(),
  email           text not null,
  role_id         uuid not null references public.roles(id) on delete restrict,
  -- Jeton secret : 32 octets aléatoires. Non devinable, et jamais exposé en
  -- lecture à qui n'a pas déjà `users.manage` sur l'organisation.
  token           text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  status          public.invitation_status not null default 'PENDING',
  expires_at      timestamptz not null default now() + interval '14 days',
  invited_by      uuid references public.profiles(id) on delete set null,
  accepted_by     uuid references public.profiles(id) on delete set null,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- L'e-mail est normalisé en minuscules : sinon « Awa@… » et « awa@… »
-- créeraient deux invitations pour la même personne.
create unique index organization_invitations_en_attente_idx
  on public.organization_invitations (organization_id, lower(email))
  where status = 'PENDING';

create index organization_invitations_org_idx
  on public.organization_invitations (organization_id, status);
create index organization_invitations_role_idx
  on public.organization_invitations (role_id);
create index organization_invitations_invited_by_idx
  on public.organization_invitations (invited_by);
create index organization_invitations_accepted_by_idx
  on public.organization_invitations (accepted_by);

alter table public.organization_invitations enable row level security;

-- Lecture et gestion réservées aux porteurs de `users.manage` de l'organisation.
-- L'invité, lui, ne lit jamais la ligne : il passe par la fonction d'acceptation.
create policy "managers read invitations" on public.organization_invitations
  for select to authenticated
  using (vehora.can_read(organization_id, 'users.manage'));

create policy "managers create invitations" on public.organization_invitations
  for insert to authenticated
  with check (
    vehora.can_write(organization_id, 'users.manage')
    -- Même garde que sur les adhésions : on n'invite jamais à un rôle de
    -- plateforme depuis une organisation, sinon `users.manage` ouvrirait la
    -- porte du Super Admin.
    and exists (
      select 1 from public.roles r where r.id = role_id and r.scope <> 'PLATFORM'
    )
  );

create policy "managers update invitations" on public.organization_invitations
  for update to authenticated
  using (vehora.can_write(organization_id, 'users.manage'))
  with check (organization_id = vehora.current_org_id());
