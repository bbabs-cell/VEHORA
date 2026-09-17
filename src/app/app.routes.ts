import type { Routes } from '@angular/router';
import { authGuard, organizationGuard, permissionGuard } from './core/auth/auth.guard';

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
  {
    path: '',
    canActivate: [authGuard, organizationGuard],
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
          import('./features/inspections/inspection.component').then(
            (m) => m.InspectionComponent,
          ),
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
