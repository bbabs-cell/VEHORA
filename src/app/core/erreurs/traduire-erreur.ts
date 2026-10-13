/**
 * Conversion unique d'une erreur serveur en message affichable.
 *
 * Méthode MagyaPro, règle des « erreurs typées » : le message est destiné à
 * l'utilisateur, en français, précis et actionnable, et il est fabriqué en UN
 * point. Ici, ce point remplace la fonction `message()` recopiée dans quinze
 * services : chaque copie redisait « pas le droit », « connexion impossible »
 * et « réessayez », avec deux apostrophes différentes et une perte réseau
 * reconnue seulement sous Chrome (« Failed to fetch ») — Safari dit « Load
 * failed », Firefox « NetworkError ».
 *
 * Chaque service ne garde que ce qui lui est propre : les marqueurs métier
 * levés par ses fonctions SQL (`VEHORA_SANS_TARIF`…) et le sens d'un code dans
 * SON contexte (`23505` = « ce numéro existe déjà » chez les clients, « cette
 * station existe déjà » chez les stations).
 *
 * Aucun texte brut de la base ne sort d'ici : une erreur inconnue devient un
 * message générique, jamais un « violates foreign key constraint ».
 */

/** Ce que renvoient supabase-js et PostgREST : un code et un texte brut. */
export interface ErreurBrute {
  readonly code?: string | null;
  readonly message?: string | null;
}

/** Messages propres à un service. */
export interface MessagesErreur {
  /** Marqueur levé par une fonction SQL (`VEHORA_…`) → message. */
  readonly marqueurs?: Readonly<Record<string, string>>;
  /** Code PostgreSQL ou PostgREST → message, dans le contexte du service. */
  readonly codes?: Readonly<Record<string, string>>;
  /** Message quand rien n'est reconnu (« L'enregistrement a échoué… »). */
  readonly parDefaut?: string;
}

export const MESSAGE_DROIT = 'Vous n’avez pas le droit d’effectuer cette action.';
export const MESSAGE_RESEAU =
  'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
export const MESSAGE_ECHEC = 'L’opération a échoué. Réessayez dans un instant.';

/**
 * « Introuvable », jamais « appartient à une autre organisation » (méthode,
 * règle 5) : distinguer « n'existe pas » de « existe mais pas chez vous »
 * confirmerait l'existence d'une donnée d'un autre client.
 */
export const MESSAGE_INTROUVABLE = 'Cet élément est introuvable.';

/** Marqueurs communs à tous les services. */
const MARQUEURS_COMMUNS: Readonly<Record<string, string>> = {
  VEHORA_TENANCY_VIOLATION: MESSAGE_INTROUVABLE,
  VEHORA_PERMISSION: MESSAGE_DROIT,
  VEHORA_MOTIF_REQUIS: 'Un motif est obligatoire.',
  VEHORA_FONCTIONNALITE_FERMEE: 'Cette fonctionnalité n’est pas incluse dans votre abonnement.',
};

/** Codes communs, quand le service n'en a pas donné un sens plus précis. */
const CODES_COMMUNS: Readonly<Record<string, string>> = {
  // RLS ou EXECUTE refusé.
  '42501': MESSAGE_DROIT,
  // `.single()` sans ligne : ce que la RLS rend pour la donnée d'un autre.
  PGRST116: MESSAGE_INTROUVABLE,
  // Clé étrangère vers une ligne absente — ou invisible.
  '23503': MESSAGE_INTROUVABLE,
  // Jeton expiré ou invalide.
  PGRST301: 'Votre session a expiré. Reconnectez-vous.',
  PGRST303: 'Votre session a expiré. Reconnectez-vous.',
};

/** Les trois façons dont un navigateur dit « pas de réseau ». */
const RESEAU = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;

export function traduireErreur(
  erreur: ErreurBrute | null | undefined,
  messages: MessagesErreur = {},
): string {
  const brut = erreur?.message ?? '';
  const code = erreur?.code ?? undefined;

  for (const table of [messages.marqueurs, MARQUEURS_COMMUNS]) {
    if (!table) continue;
    for (const [marqueur, texte] of Object.entries(table)) {
      if (brut.includes(marqueur)) return texte;
    }
  }

  if (code) {
    const propre = messages.codes?.[code];
    if (propre) return propre;
    const commun = CODES_COMMUNS[code];
    if (commun) return commun;
  }

  if (RESEAU.test(brut)) return MESSAGE_RESEAU;
  if (/jwt expired/i.test(brut)) return CODES_COMMUNS['PGRST301']!;
  if (code === '429' || /rate limit|too many requests/i.test(brut)) {
    return 'Trop de tentatives. Patientez une minute, puis réessayez.';
  }

  return messages.parDefaut ?? MESSAGE_ECHEC;
}
