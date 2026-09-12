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
        path: 'stations',
        title: 'Stations — VEHORA',
        // Confort d'interface : la RLS refuse de toute façon l'écriture sans
        // `stations.manage`. La garde évite simplement un écran inutile.
        canActivate: [permissionGuard('stations.manage')],
        loadComponent: () =>
          import('./features/stations/stations.component').then((m) => m.StationsComponent),
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
