-- VEHORA — Phase 0 : schéma technique et types énumérés.
-- Le schéma `vehora` porte les fonctions internes (helpers RLS, règles métier).
-- Il n'est pas exposé à l'API PostgREST.

create schema if not exists vehora;
revoke all on schema vehora from public, anon, authenticated;
grant usage on schema vehora to authenticated, service_role;

create extension if not exists "pgcrypto" with schema extensions;

-- Portée d'un rôle : plateforme, organisation entière, ou station précise.
create type public.role_scope as enum ('PLATFORM', 'ORGANIZATION', 'STATION');

-- Statut d'une organisation cliente (§10 du prompt maître).
create type public.organization_status as enum (
  'TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'DEACTIVATED'
);

-- Statut d'une adhésion : suspendre ici coupe l'accès sans toucher au compte.
create type public.membership_status as enum ('ACTIVE', 'SUSPENDED');

-- Une station mobile est une station comme une autre (§41) : pas de modèle parallèle.
create type public.station_kind as enum ('FIXED', 'MOBILE');

create type public.station_status as enum ('ACTIVE', 'INACTIVE');

-- Cycle de vie du Service Order (fondation 4).
create type public.service_order_status as enum (
  'ARRIVED', 'INSPECTION', 'WAITING', 'IN_PROGRESS',
  'CONTROL', 'READY', 'DELIVERED', 'CANCELLED'
);

-- Règle de paiement avant restitution (ADR-004).
create type public.payment_before_delivery_rule as enum ('STRICT', 'ALLOW_DEBT');
