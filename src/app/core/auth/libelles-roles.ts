/**
 * Libellés français des rôles et des portées.
 *
 * Le code (`OWNER`, `ORGANIZATION`) est un identifiant technique : affiché tel
 * quel dans la barre latérale et sur le tableau de bord, il obligeait un
 * propriétaire de station à lire de l'anglais pour savoir qui il était
 * (méthode MagyaPro : « pas de jargon »). Les libellés sont ceux de la table
 * `roles` (migration 20260911120100_rbac) ; un code inconnu s'affiche tel quel
 * plutôt que de disparaître.
 */
export const LIBELLES_ROLE: Readonly<Record<string, string>> = {
  SUPER_ADMIN: 'Super Admin',
  PLATFORM_SUPPORT: 'Support plateforme',
  OWNER: 'Propriétaire',
  ORG_ADMIN: 'Administrateur',
  MANAGER: 'Responsable',
  STATION_MANAGER: 'Chef de station',
  RECEPTIONIST: 'Réceptionniste',
  OPERATOR: 'Opérateur',
  CASHIER: 'Caissier',
  QUALITY_CONTROLLER: 'Contrôleur qualité',
};

export const LIBELLES_PORTEE: Readonly<Record<string, string>> = {
  PLATFORM: 'Toute la plateforme',
  ORGANIZATION: 'Toute l’organisation',
  STATION: 'Ses stations',
};

export function libelleRole(code: string | null): string {
  return code ? (LIBELLES_ROLE[code] ?? code) : '—';
}

export function libellePortee(code: string | null): string {
  return code ? (LIBELLES_PORTEE[code] ?? code) : '—';
}
