-- VEHORA — Phase 0 : RBAC.
-- Les rôles sont attribués aux utilisateurs, les permissions aux rôles.
-- Le code et les policies testent une PERMISSION, jamais un rôle (fondation 1).

create table public.permissions (
  key         text primary key,
  description text not null,
  created_at  timestamptz not null default now()
);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  scope       public.role_scope not null,
  label       text not null,
  description text not null default '',
  -- Rôle fourni par VEHORA : non modifiable et non supprimable par un client.
  is_system   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id        uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create index on public.role_permissions (permission_key);

comment on table public.roles is
  'Ajouter un rôle = une ligne ici + des lignes dans role_permissions. Aucune policy RLS à modifier.';

-- ---------------------------------------------------------------------------
-- Permissions de référence (fondation 1).
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('customers.read',            'Consulter les clients'),
  ('customers.write',           'Créer et modifier des clients'),
  ('customers.delete',          'Supprimer un client'),
  ('vehicles.read',             'Consulter les véhicules'),
  ('vehicles.write',            'Créer et modifier des véhicules'),
  ('service_orders.read',       'Consulter les prestations'),
  ('service_orders.write',      'Créer et modifier des prestations'),
  ('service_orders.cancel',     'Annuler une prestation'),
  ('service_orders.transition', 'Faire évoluer le statut d''une prestation'),
  ('inspections.write',         'Réaliser une inspection de véhicule'),
  ('operations.assign',         'Assigner une opération à un employé'),
  ('operations.execute',        'Exécuter une opération'),
  ('quality_controls.execute',  'Réaliser un contrôle qualité'),
  ('payments.read',             'Consulter les paiements'),
  ('payments.record',           'Enregistrer un paiement'),
  ('payments.refund',           'Rembourser, annuler un paiement, accorder une remise exceptionnelle'),
  ('cash.open',                 'Ouvrir une session de caisse'),
  ('cash.move',                 'Enregistrer un mouvement de caisse'),
  ('cash.close',                'Clôturer une session de caisse'),
  ('cash.reconcile',            'Valider un écart de caisse'),
  ('restitutions.execute',      'Restituer un véhicule au client'),
  ('services.manage',           'Gérer le catalogue de services'),
  ('prices.manage',             'Gérer les tarifs'),
  ('employees.manage',          'Gérer les employés'),
  ('users.manage',              'Gérer les utilisateurs et leurs accès'),
  ('roles.manage',              'Gérer les rôles et permissions'),
  ('stations.manage',           'Gérer les stations'),
  ('organization.manage',       'Gérer l''organisation, son abonnement et ses paramètres'),
  ('reports.read',              'Consulter les rapports et statistiques'),
  ('audit.read',                'Consulter le journal d''audit de l''organisation'),
  ('platform.organizations.read',    'Plateforme : consulter les organisations'),
  ('platform.organizations.suspend', 'Plateforme : suspendre ou réactiver une organisation'),
  ('platform.users.read',            'Plateforme : consulter les utilisateurs'),
  ('platform.impersonate',           'Plateforme : ouvrir une session d''assistance'),
  ('platform.settings.manage',       'Plateforme : gérer la configuration globale'),
  ('platform.audit.read',            'Plateforme : consulter le journal d''audit global');

-- ---------------------------------------------------------------------------
-- Rôles de référence.
-- ---------------------------------------------------------------------------
insert into public.roles (code, scope, label, description) values
  ('SUPER_ADMIN',        'PLATFORM',     'Super Admin',          'Équipe VEHORA — contrôle total de la plateforme'),
  ('PLATFORM_SUPPORT',   'PLATFORM',     'Support plateforme',   'Équipe VEHORA — support en lecture seule (ADR-002)'),
  ('OWNER',              'ORGANIZATION', 'Propriétaire',         'Propriétaire de l''entreprise cliente'),
  ('ORG_ADMIN',          'ORGANIZATION', 'Administrateur',       'Administrateur de l''organisation'),
  ('MANAGER',            'ORGANIZATION', 'Responsable',          'Responsable multi-stations'),
  ('STATION_MANAGER',    'STATION',      'Chef de station',      'Responsable d''une station'),
  ('RECEPTIONIST',       'STATION',      'Réceptionniste',       'Accueil client et ouverture des dossiers'),
  ('OPERATOR',           'STATION',      'Opérateur',            'Exécute les prestations'),
  ('CASHIER',            'STATION',      'Caissier',             'Encaissement et caisse'),
  ('QUALITY_CONTROLLER', 'STATION',      'Contrôleur qualité',   'Contrôle avant restitution');

-- ---------------------------------------------------------------------------
-- Matrice rôles × permissions (fondation 1).
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join lateral (
  select unnest(
    case r.code
      when 'SUPER_ADMIN' then array[
        'platform.organizations.read','platform.organizations.suspend',
        'platform.users.read','platform.settings.manage','platform.audit.read']
      when 'PLATFORM_SUPPORT' then array[
        'platform.organizations.read','platform.users.read']
      when 'OWNER' then array[
        'customers.read','customers.write','customers.delete',
        'vehicles.read','vehicles.write',
        'service_orders.read','service_orders.write','service_orders.cancel','service_orders.transition',
        'inspections.write','operations.assign','operations.execute','quality_controls.execute',
        'payments.read','payments.record','payments.refund',
        'cash.open','cash.move','cash.close','cash.reconcile',
        'restitutions.execute','services.manage','prices.manage',
        'employees.manage','users.manage','roles.manage','stations.manage',
        'organization.manage','reports.read','audit.read']
      when 'ORG_ADMIN' then array[
        'customers.read','customers.write','customers.delete',
        'vehicles.read','vehicles.write',
        'service_orders.read','service_orders.write','service_orders.cancel','service_orders.transition',
        'inspections.write','operations.assign','operations.execute','quality_controls.execute',
        'payments.read','payments.record','payments.refund',
        'cash.open','cash.move','cash.close','cash.reconcile',
        'restitutions.execute','services.manage','prices.manage',
        'employees.manage','users.manage','roles.manage','stations.manage',
        'reports.read','audit.read']
      when 'MANAGER' then array[
        'customers.read','customers.write','vehicles.read','vehicles.write',
        'service_orders.read','service_orders.write','service_orders.cancel','service_orders.transition',
        'inspections.write','operations.assign','operations.execute','quality_controls.execute',
        'payments.read','payments.record',
        'cash.open','cash.move','cash.close','cash.reconcile',
        'restitutions.execute','employees.manage','reports.read']
      when 'STATION_MANAGER' then array[
        'customers.read','customers.write','vehicles.read','vehicles.write',
        'service_orders.read','service_orders.write','service_orders.cancel','service_orders.transition',
        'inspections.write','operations.assign','operations.execute','quality_controls.execute',
        'payments.read','payments.record','payments.refund',
        'cash.open','cash.move','cash.close','cash.reconcile',
        'restitutions.execute','employees.manage','reports.read']
      when 'RECEPTIONIST' then array[
        'customers.read','customers.write','vehicles.read','vehicles.write',
        'service_orders.read','service_orders.write','service_orders.transition',
        'inspections.write','operations.assign',
        'payments.read','payments.record','restitutions.execute']
      when 'OPERATOR' then array[
        'customers.read','vehicles.read',
        'service_orders.read','service_orders.transition',
        'inspections.write','operations.execute']
      when 'CASHIER' then array[
        'customers.read','vehicles.read',
        'service_orders.read','service_orders.transition',
        'payments.read','payments.record',
        'cash.open','cash.move','cash.close','restitutions.execute']
      when 'QUALITY_CONTROLLER' then array[
        'customers.read','vehicles.read',
        'service_orders.read','service_orders.transition','quality_controls.execute']
      else array[]::text[]
    end
  ) as key
) p on true;
