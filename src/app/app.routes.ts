import type { Routes } from '@angular/router';
import {
  authGuard,
  nonPlatformGuard,
  organizationGuard,
  permissionGuard,
  platformGuard,
} from './core/auth/auth.guard';

/**
 * Les écrans authentifiés vivent dans la coquille applicative ; la connexion et
 * les écrans de rattrapage restent en dehors (aucune navigation à afficher).
 *
 * L'espace Super Admin aura son propre arbre (`/plateforme`), avec sa coquille
 * et son garde — ce n'est pas un onglet de l'application cliente.
 */
export const routes: Routes = [
  {
    path: 'connexion',
    title: 'Connexion — VEHORA',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'creer-organisation',
    title: 'Créer votre entreprise — VEHORA',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/organization/create-organization.component').then(
        (m) => m.CreateOrganizationComponent,
      ),
  },
  {
    path: 'sans-organisation',
    title: 'Aucune organisation — VEHORA',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/no-organization/no-organization.component').then(
        (m) => m.NoOrganizationComponent,
      ),
  },
  /**
   * Espace de plateforme : arbre de routes séparé, coquille séparée, garde
   * séparée. Ce n'est pas un onglet de l'application cliente, et il ne doit
   * jamais apparaître dans sa navigation.
   */
  {
    path: 'plateforme',
    canActivate: [platformGuard],
    loadComponent: () =>
      import('./features/platform/shell/platform-shell.component').then(
        (m) => m.PlatformShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'organisations' },
      {
        path: 'organisations',
        title: 'Organisations — VEHORA plateforme',
        loadComponent: () =>
          import('./features/platform/organisations/organisations.component').then(
            (m) => m.PlatformOrganisationsComponent,
          ),
      },
      {
        path: 'facturation',
        title: 'Facturation — VEHORA plateforme',
        loadComponent: () =>
          import('./features/platform/facturation/facturation.component').then(
            (m) => m.PlatformFacturationComponent,
          ),
      },
      {
        path: 'journal',
        title: 'Journal — VEHORA plateforme',
        loadComponent: () =>
          import('./features/platform/journal/journal.component').then(
            (m) => m.PlatformJournalComponent,
          ),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard, nonPlatformGuard, organizationGuard],
    loadComponent: () =>
      import('./layout/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      {
        path: 'file-attente',
        title: 'File d’attente — VEHORA',
        canActivate: [permissionGuard('service_orders.read')],
        loadComponent: () =>
          import('./features/file-attente/file-attente.component').then(
            (m) => m.FileAttenteComponent,
          ),
      },
      {
        path: 'operations',
        title: 'Opérations — VEHORA',
        canActivate: [permissionGuard('service_orders.read')],
        loadComponent: () =>
          import('./features/operations/operations.component').then((m) => m.OperationsComponent),
      },
      {
        path: 'employes',
        title: 'Employés — VEHORA',
        canActivate: [permissionGuard('employees.manage')],
        loadComponent: () =>
          import('./features/employes/employes.component').then((m) => m.EmployesComponent),
      },
      {
        path: 'caisse',
        title: 'Caisse — VEHORA',
        canActivate: [permissionGuard('payments.read')],
        loadComponent: () =>
          import('./features/caisse/caisse.component').then((m) => m.CaisseComponent),
      },
      {
        path: 'caisse/historique',
        title: 'Historique de caisse — VEHORA',
        // La garde n'ouvre que l'écran : ce qu'il montre est décidé par la
        // policy de `cash_registers` — ses propres sessions, ou toutes avec
        // `cash.reconcile`. Un caissier y trouve donc les siennes, et rien
        // d'autre.
        canActivate: [permissionGuard('payments.read')],
        loadComponent: () =>
          import('./features/caisse-historique/caisse-historique.component').then(
            (m) => m.CaisseHistoriqueComponent,
          ),
      },
      {
        path: 'abonnement',
        title: 'Abonnement — VEHORA',
        // Lecture seule : changer de plan passe par VEHORA. La garde évite
        // seulement d'ouvrir un écran qui ne concerne pas un opérateur.
        canActivate: [permissionGuard('organization.manage')],
        loadComponent: () =>
          import('./features/abonnement/abonnement.component').then((m) => m.AbonnementComponent),
      },
      {
        path: 'rapports',
        title: 'Rapports — VEHORA',
        // Encaisser n'est pas savoir combien la station encaisse : les
        // fonctions de rapport exigent `reports.read`, la garde évite
        // simplement d'ouvrir un écran qui n'afficherait qu'un refus.
        canActivate: [permissionGuard('reports.read')],
        loadComponent: () =>
          import('./features/rapports/rapports.component').then((m) => m.RapportsComponent),
      },
      {
        path: 'recus/:id',
        title: 'Reçu — VEHORA',
        canActivate: [permissionGuard('payments.read')],
        loadComponent: () => import('./features/recus/recu.component').then((m) => m.RecuComponent),
      },
      {
        path: 'clients',
        title: 'Clients — VEHORA',
        canActivate: [permissionGuard('customers.read')],
        loadComponent: () =>
          import('./features/customers/customers.component').then((m) => m.CustomersComponent),
      },
      {
        path: 'vehicules/:id/inspection',
        title: 'Inspection — VEHORA',
        canActivate: [permissionGuard('inspections.write')],
        loadComponent: () =>
          import('./features/inspections/inspection.component').then((m) => m.InspectionComponent),
      },
      {
        path: 'vehicules',
        title: 'Véhicules — VEHORA',
        canActivate: [permissionGuard('vehicles.read')],
        loadComponent: () =>
          import('./features/vehicles/vehicles.component').then((m) => m.VehiclesComponent),
      },
      {
        path: 'catalogue',
        title: 'Catalogue et tarifs — VEHORA',
        // Tout membre consulte le catalogue (l'accueil et la caisse en ont
        // besoin) ; la RLS seule décide qui peut le modifier.
        loadComponent: () =>
          import('./features/catalogue/catalogue.component').then((m) => m.CatalogueComponent),
      },
      {
        path: 'stations',
        title: 'Stations — VEHORA',
        // Confort d'interface : la RLS refuse de toute façon l'écriture sans
        // `stations.manage`. La garde évite simplement un écran inutile.
        canActivate: [permissionGuard('stations.manage')],
        loadComponent: () =>
          import('./features/stations/stations.component').then((m) => m.StationsComponent),
      },
      {
        path: 'utilisateurs',
        title: 'Utilisateurs — VEHORA',
        canActivate: [permissionGuard('users.manage')],
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'tableau-de-bord',
        title: 'Tableau de bord — VEHORA',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
