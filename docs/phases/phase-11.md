# Phase 11 — Paiements, caisse et restitution

Le cycle se referme. `READY → DELIVERED` existe, et c'est la transition la plus
surveillée du produit : celle où le véhicule quitte la station.

## Trois concepts, jamais confondus (fondation 5)

| Concept | Question | Table |
|---|---|---|
| **PAYMENT** | combien le client a payé, sur quel dossier, comment | `payments` |
| **CASH TRANSACTION** | quel argent est entré ou sorti du tiroir | `cash_transactions` |
| **CASH REGISTER** | quelle session, ouverte par qui, avec quel fonds, quel écart | `cash_registers` |

Un paiement en espèces génère une transaction de caisse. Un paiement Mobile
Money n'en génère **pas** — l'argent n'est pas dans le tiroir. Un retrait pour
acheter du savon est une transaction de caisse **sans** paiement. Les confondre
rend une caisse infalsifiable impossible à obtenir, et c'est la première chose
que le patron vérifiera.

## Ce que la base impose

- **Encaisser en espèces exige une session de caisse ouverte** par cette
  personne à cette station. Sans session, l'argent irait nulle part.
- **Le mouvement de caisse est écrit par la base**, jamais par l'appelant. Un
  caissier qui pourrait écrire le paiement sans le mouvement pourrait faire
  disparaître de l'argent.
- **Une seule session ouverte par (station, utilisateur)**, garantie par un
  index unique partiel — pas par du code applicatif : deux onglets ouverts
  suffiraient sinon à en créer deux.
- **Aucun paiement ne se modifie ni ne se supprime.** Jamais. Un paiement erroné
  s'annule par un `REFUND` qui le référence, avec motif obligatoire, et on ne
  rembourse pas plus qu'on n'a reçu, ni en une fois ni en plusieurs. La méthode
  suit celle du paiement d'origine : on ne rend pas en espèces ce qui a été reçu
  par Mobile Money.
- **Un mouvement libre exige un motif** : « sortie de 50 000 » sans raison ne
  veut rien dire.
- **L'écart de clôture est calculé, jamais saisi** : `déclaré − théorique`, et
  la clôture passe par `cloturer_caisse()`, qu'un trigger rend obligatoire.
  « Clôturée avec 0 d'écart » ne doit pas être à la portée d'un `PATCH`.
- **Une session clôturée est immuable** et n'accepte plus aucun mouvement.
- **L'état financier d'un dossier est dérivé, jamais stocké** : total, encaissé,
  solde et statut viennent d'une vue `security_invoker`.

## La restitution, et les deux régimes

`READY → DELIVERED` évalue `organization_settings.payment_before_delivery` :

- **STRICT** — restitution refusée tant que le solde n'est pas nul.
- **ALLOW_DEBT** (défaut, ADR-004) — restitution possible avec solde, mais elle
  exige alors la permission `payments.refund` **et** un motif, et elle est
  auditée avec le solde restant.

`ALLOW_DEBT` est le défaut parce que le client régulier qui règle en fin de
semaine est une réalité du marché visé. Ce n'est pas une porte ouverte : la
créance est tracée, nominative et motivée. Un caissier ne peut pas l'accorder.

## Défauts corrigés pendant la phase

**La fonction de clôture ne posait pas le drapeau que son propre garde-fou
exigeait** — la clôture aurait été impossible. Trouvé en relisant la migration
avant d'écrire les tests, pas par un test.

**Le refus d'un remboursement était expliqué à l'envers.** Un caissier qui
tentait un remboursement lisait « ouvrez votre caisse » : le trigger `BEFORE`
s'exécute avant le `WITH CHECK` de la policy, et sa recherche de caisse ouverte
échouait la première. Refus correct, explication fausse — donc un caissier qui
ouvre sa caisse, réessaie, et se heurte alors à un autre refus. La policy reste
la règle ; le contrôle ajouté ne fait que rendre le refus lisible au bon moment.

## Défauts d'interface vus à l'écran

| Défaut | Gravité | Correction |
|---|---|---|
| La modale laissait la page défiler derrière elle : on perdait sa place dans la file en encaissant | MEDIUM | service de verrouillage du défilement, partagé |
| Deux contrôles nommés « Fermer » dans la même boîte de dialogue (la croix et le bouton) | MEDIUM | le bouton devient « Terminer » |
| Le champ montant se vidait après un premier paiement au lieu de proposer le reste | LOW | le solde restant est proposé |
| La carte derrière la modale pouvait afficher un solde périmé | LOW | la file est rafraîchie à chaque encaissement |

## Défaut de méthode de test

**La caisse est une ressource unique par (station, utilisateur).** Les deux
projets Playwright, qui tournent en parallèle sur le même compte, se fermaient
mutuellement leur session : l'échec tombait sur un test au hasard, et chaque
test passait en isolation. Deux corrections, toutes deux nécessaires : une
station par projet, et `mode: 'serial'` pour les tests d'un même projet.

Au passage, la seconde station manquait aussi pour éprouver l'affichage
multi-station ajouté en phase 9 — le jeu de démonstration n'en avait qu'une.

Et la règle de la phase 10 — *une exception attrapée en PL/pgSQL annule tout ce
que son bloc a écrit* — a été **refaite ici** : l'ouverture de caisse était dans
le bloc qui attendait l'échec. La leçon était écrite ; elle n'a pas suffi.

## Validation

| Contrôle | Résultat |
|---|---|
| Migrations sur PostgreSQL jetable | ✅ |
| Assertions SQL de sécurité | ✅ 154 (dont 39 nouvelles) |
| Campagne d'intrusion par l'API réelle | ✅ 25 assertions, tout bloqué |
| Playwright | ✅ 185 passés, 1 ignoré |
| Vérification des types | ✅ |
| Build de production | ✅ 478,28 kB (119,53 kB compressé) |
| Advisors sécurité | ✅ aucun nouveau signalement `anon` |

`scripts/intrusion-caisse.mjs` rejoue la campagne à volonté.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Pas de reçu imprimable ni numéroté | MEDIUM | la numérotation sans trou exige son propre mécanisme (fondation 5) ; c'est une phase à part |
| Les sessions de caisse passées ne sont pas consultables à l'écran | LOW | la donnée est en base et auditée ; l'écran de rapport viendra |
| Le verrou de défilement n'est posé que sur la file et la caisse | LOW | les autres écrans à modale suivront ; le service est prêt |
| Aucune intégration d'API Mobile Money | — | assumé (fondation 5) : `provider`, `external_ref` et `status` sont prêts |
| `confirm()` / `prompt()` natifs sur quatre écrans | LOW | dette assumée, à reprendre d'un coup |

Les quatre avertissements d'advisor restants sont les fonctions `SECURITY
DEFINER` volontairement ouvertes aux comptes connectés — `cloturer_caisse`
rejoint le groupe, documentée en base — et la protection contre les mots de
passe compromis.

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 11 validée.**

## Suite

Le **cycle métier est complet** : arrivée, inspection, file, travail, contrôle,
prêt, paiement, restitution. Trois directions possibles :

1. **Reçus et rapports** — numérotation sans trou, reçu imprimable, chiffre
   d'affaires par station et par jour ;
2. **Espace Super Admin** — la fondation 3 le prévoit, rien n'est construit ;
3. **Dette d'interface** — remplacer `confirm()` et `prompt()` natifs, poser le
   verrou de défilement partout, écran des sessions de caisse passées.
