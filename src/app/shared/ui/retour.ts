/**
 * Le retour d'une action : un texte, et s'il s'agit d'une réussite.
 *
 * Quatre écrans rangeaient « Fiche enregistrée. » et « Vous n'avez pas le
 * droit… » dans le même signal, affiché dans le même bandeau ROUGE : une
 * réussite avait l'air d'une panne (« le rouge est réservé à ce qui est
 * cassé », phase 21) — et depuis la phase 24, le bandeau d'erreur tremble.
 */
export interface Retour {
  readonly texte: string;
  readonly ok: boolean;
}

/** `erreur` nulle : l'action a réussi, et c'est `succes` qui s'affiche. */
export function retour(erreur: string | null, succes: string): Retour {
  return erreur ? { texte: erreur, ok: false } : { texte: succes, ok: true };
}
