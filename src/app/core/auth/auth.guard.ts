import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/** Délai maximal d'attente de la restauration de session, en millisecondes. */
const DELAI_MAX_AUTH = 5_000;

/**
 * Attend la fin de la restauration de session avant de décider.
 * L'attente est bornée : une garde qui boucle sans fin fige l'application,
 * ce qui est pire qu'une redirection vers la connexion.
 */
async function waitForAuth(auth: AuthService): Promise<void> {
  const echeance = Date.now() + DELAI_MAX_AUTH;
  while (auth.status() === 'chargement' && Date.now() < echeance) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Réserve une route aux utilisateurs connectés. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForAuth(auth);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/connexion'], {
    queryParams: { redirection: state.url },
  });
};

/** Réserve une route aux comptes rattachés à une organisation active. */
export const organizationGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForAuth(auth);

  if (auth.hasOrganization()) return true;
  return router.createUrlTree(['/sans-organisation']);
};

/**
 * Réserve une route aux porteurs d'une permission.
 *
 * Confort d'interface uniquement : la RLS refuse de toute façon l'accès aux
 * données. Une route protégée seulement ici serait une faille.
 */
export function permissionGuard(permission: string): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await waitForAuth(auth);

    if (auth.hasPermission(permission)) return true;
    return router.createUrlTree(['/tableau-de-bord']);
  };
}

/**
 * Réserve une route à l'espace de plateforme.
 *
 * L'espace Super Admin n'est pas un onglet de l'application cliente : c'est un
 * arbre de routes séparé, avec sa coquille et sa navigation. Cette garde n'est
 * qu'un aiguillage — la sécurité réelle tient au fait que la plateforme n'a
 * aucune policy de lecture sur les données clientes, et que ses vues portent
 * leur propre filtre `is_platform_admin()`.
 */
export const platformGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForAuth(auth);

  if (!auth.isAuthenticated()) return router.createUrlTree(['/connexion']);
  if (auth.isPlatformAdmin()) return true;

  // Un compte client qui arrive ici se trompe d'espace : on le renvoie chez lui
  // plutôt que de lui afficher un refus dont il ne peut rien faire.
  return router.createUrlTree(['/tableau-de-bord']);
};

/** L'inverse : un compte de plateforme n'a rien à faire dans l'espace client. */
export const nonPlatformGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForAuth(auth);

  if (auth.isPlatformAdmin()) return router.createUrlTree(['/plateforme']);
  return true;
};
