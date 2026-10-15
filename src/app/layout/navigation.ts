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
  /**
   * Fonctionnalité dont dépend l'entrée (feature flag). Masquer l'entrée est un
   * confort : l'API refuse de son côté si la fonctionnalité n'est pas ouverte.
   */
  readonly fonctionnalite?: string;
  readonly disponible: boolean;
}

export const NAVIGATION: readonly EntreeNavigation[] = [
  { libelle: 'Tableau de bord', libelleCourt: 'Accueil', chemin: '/tableau-de-bord', icone: 'accueil', disponible: true },
  { libelle: "File d'attente", libelleCourt: 'File', chemin: '/file-attente', icone: 'file', permission: 'service_orders.read', disponible: true },
  { libelle: 'Opérations', libelleCourt: 'Travaux', chemin: '/operations', icone: 'prestation', permission: 'service_orders.read', disponible: true },
  { libelle: 'Clients', chemin: '/clients', icone: 'client', permission: 'customers.read', disponible: true },
  { libelle: 'Véhicules', chemin: '/vehicules', icone: 'vehicule', permission: 'vehicles.read', disponible: true },
  { libelle: 'Stations', chemin: '/stations', icone: 'station', permission: 'stations.manage', disponible: true },
  { libelle: 'Catalogue et tarifs', libelleCourt: 'Catalogue', chemin: '/catalogue', icone: 'catalogue', disponible: true },
  { libelle: 'Utilisateurs', chemin: '/utilisateurs', icone: 'employe', permission: 'users.manage', disponible: true },
  { libelle: 'Employés', chemin: '/employes', icone: 'employe', permission: 'employees.manage', disponible: true },
  { libelle: 'Caisse', chemin: '/caisse', icone: 'caisse', permission: 'payments.read', disponible: true },
  { libelle: 'Rapports', chemin: '/rapports', icone: 'rapport', permission: 'reports.read', fonctionnalite: 'rapports', disponible: true },
  { libelle: 'Messages aux clients', libelleCourt: 'Messages', chemin: '/messages', icone: 'message', permission: 'service_orders.read', fonctionnalite: 'notifications', disponible: true },
  { libelle: 'Abonnement', chemin: '/abonnement', icone: 'abonnement', permission: 'organization.manage', disponible: true },
  { libelle: 'Paramètres', chemin: '/parametres', icone: 'parametres', permission: 'organization.manage', disponible: true },
];

/**
 * Barre basse mobile : les QUATRE écrans les plus ouverts parmi ceux que la
 * personne a le droit de voir, dans cet ordre de priorité, puis « Plus »
 * (méthode MagyaPro, `BottomNav`).
 *
 * La liste était figée à quatre chemins : un rôle sans le droit « Opérations »
 * n'avait que trois entrées, et la caisse — ouverte cent fois par jour par un
 * caissier — n'y figurait jamais. Tout le reste passait par ☰ : deux gestes
 * par changement d'écran, des dizaines de fois par jour.
 */
export const PRIORITE_MOBILE: readonly string[] = [
  '/tableau-de-bord',
  '/file-attente',
  '/operations',
  '/caisse',
  '/clients',
  '/vehicules',
];

/** Nombre d'entrées directes de la barre basse, « Plus » non compris. */
export const ENTREES_BARRE_BASSE = 4;
