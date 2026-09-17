# Phase 13 — Reçus et rapports

Deux objets que le cycle métier réclamait depuis la phase 11 : le **document
remis au client** et le **chiffre que le gérant lit le soir**. Ils obéissent à
deux règles opposées — l'un ne bouge jamais, l'autre se recalcule à chaque
lecture — et c'est cette opposition qui structure la phase.

## Un reçu est un constat, pas une vue

`public.receipts` porte une **copie figée** du dossier au moment de l'émission :
lignes, paiements, identités, totaux, tous recopiés dans `contenu jsonb`. Rien
n'est référencé. Renommer une prestation, changer un tarif, archiver un
véhicule : aucun reçu déjà émis n'en est modifié — une assertion le vérifie en
renommant réellement une prestation entre l'émission et la relecture.

C'est la même règle que l'inspection (phase 8) et que la ligne de dossier
(phase 9), appliquée au seul document qui sort de la station sur papier.

- **Aucune policy INSERT, UPDATE ni DELETE.** L'émission passe par
  `emettre_recu()`, seule capable de prendre un numéro ; un trigger refuse toute
  modification et toute suppression, `service_role` compris.
- **La correction est un nouveau reçu** qui référence l'ancien
  (`replaces_receipt_id`). L'ancien reste consultable, et ne se corrige qu'une
  fois.
- **Numérotation par organisation, sans trou.** L'UPSERT sur le compteur prend
  un verrou de ligne dans la transaction qui insère le reçu : un échec annule
  les deux. Une assertion échoue volontairement une émission avant d'en réussir
  une autre et vérifie que le numéro a avancé d'un.

Cela corrige une note écrite en phase 9, qui annonçait des trous possibles dans
la numérotation des dossiers « si une transaction échoue après avoir pris son
numéro ». C'est faux, et pour la même raison. Ce qui créerait vraiment un trou :
prendre le numéro dans une transaction séparée qui commite avant l'insertion.
On ne le fait nulle part.

## Encaisser n'est pas savoir combien la station encaisse

`rapport_journalier()` et `rapport_prestations()` sont en **SECURITY INVOKER** —
la RLS de l'appelant s'applique — **plus** un contrôle explicite de
`reports.read`. Sans ce contrôle, un réceptionniste ou un caissier, qui ont
`payments.record` et `payments.read` pour faire leur travail, liraient le
chiffre d'affaires de la station. Le droit de faire n'est pas le droit de
savoir : quatre rôles seulement portent `reports.read` (OWNER, ORG_ADMIN,
MANAGER, STATION_MANAGER).

Deux garde-fous de charge, sur un téléphone lent : une période inversée et une
période de plus de 366 jours sont refusées **avant** toute requête.

Le CA est compté **à la date où l'argent est entré**, dans le fuseau de
l'organisation : un dossier d'hier payé aujourd'hui compte aujourd'hui, et un
remboursement se soustrait le jour où il est rendu.

## Ce que la validation a trouvé

**Quatre défauts réels, dont deux qui n'avaient rien à voir avec la phase.**

1. **L'assertion d'immuabilité ne prouvait rien.** `receipts` n'ayant aucune
   policy UPDATE, la RLS ne fait correspondre aucune ligne : pas d'erreur, pas
   de modification, et le trigger n'est jamais atteint. Attendre l'exception,
   c'était tester le vide. Quatrième occurrence du piège « un UPDATE refusé par
   RLS est silencieux » sur ce projet. L'assertion vérifie désormais
   `row_count` **et** la valeur relue sous RLS, puis l'exception du trigger en
   contournant la RLS.

2. **`rapport_journalier` ne rendait pas son type déclaré.** `sum()` sur un
   `bigint` rend un `numeric` : la fonction se créait sans broncher et échouait
   à l'exécution. Casts explicites.

3. **La file d'attente affichait un solde faux passé 200 dossiers.** Les deux
   vues agrégées (`service_order_totals`, `service_order_payment_state`) étaient
   lues **en bloc avec une limite**, puis raccordées côté client. Passé ce
   nombre de dossiers dans l'organisation, la ligne du dossier le plus récent
   tombait hors de la réponse et sa carte affichait « Impayé » sur un dossier
   réglé. Silencieux, et faux au pire endroit : c'est le montant que lit le
   caissier avant de laisser partir une voiture. Elles sont désormais lues
   **pour les dossiers chargés** (`.in(...)`).

4. **L'écran Opérations se serait vidé passé 200 opérations.** Il demandait les
   200 **plus anciennes** opérations de l'organisation, puis filtrait côté
   client sur les dossiers ouverts : le travail du jour sortait de la réponse.
   Le filtre est maintenant posé sur le serveur (`!inner` + `not in`).

Ces deux derniers défauts sont de la même famille : **une limite posée sur une
requête dont on filtre le résultat ensuite**. Ce sont des bombes à retardement —
invisibles en démonstration, certaines en exploitation. Ils ont été trouvés
parce qu'un test de caisse s'est mis à échouer quand le jeu de données a
dépassé deux cents dossiers.

## Vérification

- **213 assertions SQL** (188 avant la phase), dont l'immuabilité, la
  numérotation sans trou, la copie figée, le refus d'un dossier annulé ou sans
  ligne, la double correction, et l'isolation entre organisations.
- **Campagne d'intrusion par l'API réelle** (`scripts/intrusion-recus.mjs`,
  **24 assertions**) : réécriture, suppression, fabrication d'un numéro,
  correction croisée, lecture par une autre organisation, accès anonyme, lecture
  du compteur de numérotation, rapport demandé par un caissier, station
  étrangère.
- **211 tests Playwright** (201 avant la phase), dont l'émission depuis la file,
  l'absence du bouton sur un dossier sans prestation, et le refus lisible d'une
  période inversée.
- **Captures d'écran** mobile et bureau des deux écrans, relues : elles ont
  servi à corriger un lien souligné dans un bouton et un libellé de quantité mal
  tourné.
- **Advisors Supabase** : aucun nouveau signalement. `emettre_recu` rejoint la
  liste assumée des fonctions `SECURITY DEFINER` appelables par `authenticated`
  — elle vérifie elle-même périmètre et permission, comme
  `transitionner_dossier` et `cloturer_caisse`.

## Dette laissée en connaissance de cause

- **`database.types.ts` n'est pas un fichier généré tel quel**, malgré son
  en-tête : il est annoté à la main (commentaires, `Insert` allégés là où la
  base remplit elle-même les colonnes). Le générateur actuel produit désormais
  des types plus stricts (`RejectExcessProperties`, colonnes NOT NULL exigées à
  l'insertion) : adopter sa sortie telle quelle demande de corriger vingt-et-une
  erreurs de compilation réparties sur huit services. C'est une phase en soi,
  pas un à-côté de celle-ci. Les entrées de la phase 13 ont donc été ajoutées
  dans le style du fichier, en reprenant les formes exactes du générateur.
- `file-attente.component.css` dépasse le budget d'avertissement (7,53 Ko pour
  6 Ko, plafond d'erreur à 10 Ko). Antérieur à cette phase, à traiter avec la
  dette d'interface.
