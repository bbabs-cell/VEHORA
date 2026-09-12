import type { Routes } from '@angular/router';
import { authGuard, organizationGuard } from './core/auth/auth.guard';

/**
 * Une feature = une route lazy-loadée. L'espace Super Admin aura son propre
 * arbre (`/plateforme`), avec son layout et son garde — ce n'est pas un onglet
 * de l'application cliente.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },

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
    path: 'tableau-de-bord',
    title: 'Tableau de bord — VEHORA',
    canActivate: [authGuard, organizationGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },

  { path: '**', redirectTo: 'tableau-de-bord' },
];
