/**
 * La frontière entre les types générés et le code de l'application.
 *
 * `database.types.ts` est désormais la sortie brute du générateur Supabase
 * (phase 22). Elle décrit fidèlement le **schéma**, mais pas le **contrat
 * d'exécution** de ce projet, et l'écart tombe toujours au même endroit.
 * Plutôt que de retoucher les types générés — ce qui les a fait diverger
 * pendant vingt phases — l'écart est nommé ici, une fois, et expliqué.
 *
 * Il y a trois écarts, et trois seulement. S'il en apparaissait un quatrième,
 * commencer par se demander si une règle serveur n'a pas changé — pas ajouter
 * un helper de plus.
 */

/**
 * **Écart 1 — les colonnes que la base remplit elle-même.**
 *
 * Le générateur exige à l'insertion toute colonne `NOT NULL` sans valeur par
 * défaut littérale. Or plusieurs d'entre elles sont posées par un trigger, et
 * le client **ne doit surtout pas** les envoyer : `organization_id` vient du
 * jeton, `currency` de l'organisation, `unit_amount_minor` et `service_name`
 * de la résolution de prix côté serveur, `number` d'un compteur. Les envoyer
 * depuis le navigateur, ce serait rendre falsifiable ce que la base impose.
 *
 * Ce helper dit donc au compilateur ce que la base sait déjà : ces colonnes
 * arrivent, mais pas d'ici. Il ne désactive aucune vérification sur les
 * colonnes réellement envoyées — une faute de frappe reste une erreur.
 */
export function rempliParLaBase<Insertion>(valeurs: Partial<Insertion>): Insertion {
  return valeurs as Insertion;
}

/**
 * **Écart 2 — une vue n'a pas d'information `NOT NULL`.**
 *
 * PostgreSQL ne propage pas la nullabilité à travers une vue : le générateur
 * rend donc *toutes* les colonnes `| null`, y compris celles qui viennent d'une
 * colonne `NOT NULL` ou d'un `coalesce`. Les traiter comme nullables dans tout
 * l'écran ajouterait des dizaines de garde-fous là où la base garantit déjà la
 * valeur.
 *
 * On restreint donc au type utile **à la frontière**, une fois, en nommant la
 * vue concernée. La garantie reste vérifiée où il faut : par les assertions SQL
 * et par les tests de parcours, pas par le compilateur.
 */
export function ligneDeVue<Ligne>(lignes: readonly unknown[] | null): Ligne[] {
  return (lignes ?? []) as Ligne[];
}

/** Même raison, pour une vue lue à l'unité (`maybeSingle`). */
export function uneLigneDeVue<Ligne>(ligne: unknown): Ligne | null {
  return (ligne ?? null) as Ligne | null;
}

/**
 * **Écart 3 — un paramètre SQL qui accepte `NULL`, typé non nullable.**
 *
 * PostgreSQL ne distingue pas « ce paramètre peut valoir NULL » de « ce
 * paramètre est obligatoire » : le générateur type donc tout argument sans
 * valeur par défaut comme non nullable. Or `basculer_fonctionnalite(…, p_actif,
 * …)` attend justement `null` pour **retirer** une dérogation et rendre
 * l'organisation à son plan — c'est un troisième état, pas une absence.
 *
 * Ce helper le dit à l'endroit de l'appel, avec son nom, plutôt que par un
 * transtypage muet.
 */
export function nullAccepte<Valeur>(valeur: Valeur | null): Valeur {
  return valeur as Valeur;
}
