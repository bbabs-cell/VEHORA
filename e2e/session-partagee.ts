import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Sessions de test réutilisées.
 *
 * La suite se connectait par l'interface à presque chaque test : plus de deux
 * cents authentifications pour une exécution complète. C'est lent (une dizaine
 * de minutes), et surtout c'est ce qui faisait atteindre la limite
 * d'authentification de Supabase depuis une seule adresse IP.
 *
 * Chaque rôle se connecte donc une fois, avant la suite, et son état de session
 * est réutilisé par tous les tests qui en ont besoin. Les tests qui éprouvent la
 * connexion elle-même (`auth.spec.ts`, `session.spec.ts`) n'utilisent aucun état
 * enregistré : ce sont eux qui vérifient que se connecter fonctionne.
 */
export type Role = 'proprietaire' | 'caissier' | 'admin' | 'sans-org';

/** Identifiants d'un rôle, tels qu'ils arrivent de l'environnement. */
export function identifiants(role: Role): { email?: string; motDePasse?: string } {
  switch (role) {
    case 'proprietaire':
      return {
        email: process.env['VEHORA_TEST_EMAIL'],
        motDePasse: process.env['VEHORA_TEST_PASSWORD'],
      };
    case 'caissier':
      return {
        email: process.env['VEHORA_TEST_EMAIL_CAISSIER'],
        motDePasse: process.env['VEHORA_TEST_PASSWORD_CAISSIER'],
      };
    case 'admin':
      return {
        email: 'admin@vehora.test',
        motDePasse: process.env['VEHORA_TEST_PASSWORD_ADMIN'],
      };
    case 'sans-org':
      return {
        email: process.env['VEHORA_TEST_EMAIL_SANS_ORG'],
        motDePasse: process.env['VEHORA_TEST_PASSWORD_SANS_ORG'],
      };
  }
}

/** Où l'état de session d'un rôle est enregistré. Jamais commité. */
export function fichierEtat(role: Role): string {
  return path.join(process.cwd(), 'e2e', '.etats', `${role}.json`);
}

/**
 * L'état à donner à `test.use({ storageState })`.
 *
 * `undefined` quand le rôle n'a pas d'identifiants : le contexte démarre alors
 * vierge, et les tests concernés s'ignorent d'eux-mêmes par leur `test.skip`.
 */
export function etat(role: Role): string | undefined {
  const fichier = fichierEtat(role);
  return existsSync(fichier) ? fichier : undefined;
}

/** Où chaque rôle atterrit après connexion : c'est ce qu'on attend. */
export const DESTINATION: Readonly<Record<Role, RegExp>> = {
  proprietaire: /tableau-de-bord/,
  caissier: /tableau-de-bord/,
  admin: /plateforme/,
  'sans-org': /sans-organisation/,
};
