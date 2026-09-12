/**
 * Modèle de navigation de l'application cliente.
 *
 * `permission` sert uniquement à masquer ce qui est inutile à l'utilisateur :
 * la sécurité reste appliquée par la RLS et par les gardes de route.
 *
 * `disponible: false` marque les écrans prévus mais pas encore construits. Ils
 * apparaissent estompés et non cliquables : cela donne la forme du produit sans
 * créer de lien mort — un lien qui ne mène nulle part coûte plus de confiance
 * qu'il n'en fait gagner.
 */
export interface EntreeNavigation {
  readonly libelle: string;
  /**
   * Libellé de la barre basse mobile, où la place est comptée : un texte qui
   * passe sur deux lignes rend la cible moins lisible d'un coup d'œil.
   */
  readonly libelleCourt?: string;
  readonly chemin: string;
  readonly icone: string;
  readonly permission?: string;
  readonly disponible: boolean;
}

export const NAVIGATION: readonly EntreeNavigation[] = [
  { libelle: 'Tableau de bord', libelleCourt: 'Accueil', chemin: '/tableau-de-bord', icone: 'accueil', disponible: true },
  { libelle: "File d'attente", libelleCourt: 'File', chemin: '/file-attente', icone: 'file', permission: 'service_orders.read', disponible: false },
  { libelle: 'Prestations', chemin: '/prestations', icone: 'prestation', permission: 'service_orders.read', disponible: false },
  { libelle: 'Clients', chemin: '/clients', icone: 'client', permission: 'customers.read', disponible: false },
  { libelle: 'Véhicules', chemin: '/vehicules', icone: 'vehicule', permission: 'vehicles.read', disponible: false },
  { libelle: 'Stations', chemin: '/stations', icone: 'accueil', permission: 'stations.manage', disponible: true },
  { libelle: 'Services', chemin: '/services', icone: 'service', permission: 'services.manage', disponible: false },
  { libelle: 'Utilisateurs', chemin: '/utilisateurs', icone: 'employe', permission: 'users.manage', disponible: true },
  { libelle: 'Employés', chemin: '/employes', icone: 'employe', permission: 'employees.manage', disponible: false },
  { libelle: 'Caisse', chemin: '/caisse', icone: 'caisse', permission: 'cash.move', disponible: false },
  { libelle: 'Paramètres', chemin: '/parametres', icone: 'parametres', permission: 'organization.manage', disponible: false },
];

/** Entrées mises en avant sur mobile : les gestes quotidiens, rien d'autre. */
export const NAVIGATION_MOBILE: readonly string[] = [
  '/tableau-de-bord',
  '/file-attente',
  '/prestations',
  '/clients',
];
