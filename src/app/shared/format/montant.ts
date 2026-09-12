/**
 * Les montants circulent en entiers, dans la plus petite unité de la devise
 * (fondation 5). Le nombre de décimales dépend de la devise : le franc CFA n'en
 * a pas, l'euro en a deux. On demande cette information à `Intl` plutôt que de
 * la coder en dur — l'architecture doit rester internationale.
 */
function decimales(devise: string): number {
  try {
    return (
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise })
        .resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** 9500 XOF → « 9 500 FCFA ». 1250 EUR → « 12,50 € ». */
export function formaterMontant(montantMineur: number, devise: string): string {
  const facteur = 10 ** decimales(devise);
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise }).format(
      montantMineur / facteur,
    );
  } catch {
    return `${montantMineur / facteur} ${devise}`;
  }
}

/**
 * Saisie → unité mineure. La saisie est en unité principale (« 9500 » francs,
 * « 12,50 » euros) : c'est ce que l'utilisateur a en tête et sur son affiche.
 * Renvoie `null` si la saisie n'est pas un montant positif exploitable.
 */
export function versMontantMineur(saisie: string, devise: string): number | null {
  const nettoye = saisie.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(nettoye)) return null;

  const facteur = 10 ** decimales(devise);
  const mineur = Math.round(Number(nettoye) * facteur);
  return Number.isFinite(mineur) ? mineur : null;
}

/** Unité mineure → saisie éditable, sans séparateur de milliers. */
export function versSaisie(montantMineur: number, devise: string): string {
  const d = decimales(devise);
  return (montantMineur / 10 ** d).toFixed(d).replace('.', ',');
}

/**
 * Symbole d'une devise tel qu'il s'écrit ici : « F CFA », pas « XOF ». Le code
 * ISO est un identifiant technique ; sur un écran de station, il n'apprend rien
 * à personne et fait douter de ce qu'on est en train de saisir.
 */
export function symboleDevise(devise: string): string {
  try {
    const parts = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: devise,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? devise;
  } catch {
    return devise;
  }
}

/** « 13 septembre 2026 » — lève l'ambiguïté d'un champ date rendu par le
 *  navigateur dans sa propre locale (09/13 ou 13/09 selon l'appareil). */
export function formaterDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(d);
}
