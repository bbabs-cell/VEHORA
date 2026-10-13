/**
 * Brouillon local d'une saisie longue (méthode MagyaPro, mobile-vitesse §6).
 *
 * Une inspection, c'est dix zones constatées debout à côté du véhicule. Un
 * réseau qui coupe pendant l'envoi, un appel qui fait recharger l'onglet sur
 * un Android modeste, et tout était à refaire. Le brouillon garde la saisie
 * sur l'appareil jusqu'à l'enregistrement réussi.
 *
 * Règles :
 * - la clé est préfixée et porte l'organisation : deux entreprises sur le
 *   même téléphone ne se partagent rien ;
 * - TOUJOURS dans un `try/catch` : navigation privée, stockage plein ou
 *   bloqué ne doivent rien casser — sans brouillon, l'écran marche quand même ;
 * - un brouillon trop vieux est ignoré : retrouver un constat d'avant-hier sur
 *   un autre passage du même véhicule serait pire que rien.
 */

interface Enveloppe<T> {
  readonly le: number;
  readonly valeur: T;
}

export function cleBrouillon(
  organisation: string | null,
  sujet: string,
  id: string,
): string | null {
  return organisation ? `vehora:${organisation}:${sujet}:${id}` : null;
}

export function lireBrouillon<T>(
  cle: string | null,
  ageMaxMs: number,
): { valeur: T; le: Date } | null {
  if (!cle) return null;
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return null;
    const enveloppe = JSON.parse(brut) as Enveloppe<T>;
    if (typeof enveloppe?.le !== 'number' || Date.now() - enveloppe.le > ageMaxMs) {
      localStorage.removeItem(cle);
      return null;
    }
    return { valeur: enveloppe.valeur, le: new Date(enveloppe.le) };
  } catch {
    return null;
  }
}

export function ecrireBrouillon<T>(cle: string | null, valeur: T): void {
  if (!cle) return;
  try {
    localStorage.setItem(cle, JSON.stringify({ le: Date.now(), valeur } satisfies Enveloppe<T>));
  } catch {
    // Stockage plein ou bloqué : la saisie continue, seulement sans filet.
  }
}

export function effacerBrouillon(cle: string | null): void {
  if (!cle) return;
  try {
    localStorage.removeItem(cle);
  } catch {
    // Rien à faire : il expirera.
  }
}
