# Phase 10 — Employés et opérations

Le cycle de vie va désormais de l'arrivée jusqu'à « prêt ». Ce qui manquait
entre les deux : **qui fait le travail**.

## Fondation 2, appliquée pour de bon

« Personne qui travaille » et « personne qui se connecte » sont deux choses
différentes. Un laveur n'a souvent pas de compte, mais son travail doit être
tracé ; un comptable a un compte et ne lave aucune voiture.

`employees.profile_id` est donc **nullable**, et c'est le cas par défaut : le
chef d'équipe assigne et valide pour lui. Les opérations référencent
`employee_id`, jamais `profile_id` — un employé qui part est désactivé, son
historique de travail reste intact, et la suppression de son compte de connexion
n'efface rien.

Rattacher un compte à un employé n'est possible que si ce compte est **déjà
membre de l'organisation** : sinon, créer un employé serait devenu un moyen
détourné d'associer n'importe quel compte à n'importe quelle entreprise.

## Assigner n'est pas exécuter

Deux permissions différentes portées par **deux colonnes de la même ligne**.
Une policy RLS ne voit pas quelle colonne a changé ; c'est donc un trigger qui
tranche : `employee_id` modifié → `operations.assign` ; `status` modifié →
`operations.execute`. Un opérateur fait avancer son travail sans pouvoir se le
réattribuer, ni l'attribuer à un autre.

Le trigger vérifie aussi que l'employé est **actif** et, s'il a des compétences
déclarées, qu'il est bien déclaré pour cette prestation. Aucune compétence
déclarée = aucune restriction : on n'impose pas de décrire les compétences de
tout le monde le premier jour pour que le produit serve.

## Les opérations naissent du travail vendu

Une opération par ligne de dossier, créées **à la mise en file d'attente** —
c'est-à-dire au moment précis où les lignes se figent. La correspondance entre
ce qui a été vendu et ce qui doit être fait ne peut donc plus diverger. Aucune
policy `INSERT` ni `DELETE` : les opérations vivent et meurent avec le dossier.

Les horodatages de début et de fin sont posés par la base. Les accepter depuis
le client reviendrait à laisser le navigateur dicter une durée de travail.

## Huit transitions de plus — huit lignes, zéro réécriture

La matrice étant une table, ouvrir `WAITING → IN_PROGRESS`,
`IN_PROGRESS → CONTROL`, `CONTROL → READY`, le rejet de contrôle et les
annulations tardives a consisté à **insérer huit lignes**. Seule l'évaluation de
trois nouveaux codes de condition a demandé du code :

- `OPERATIONS_ASSIGNED` — au moins une opération assignée ;
- `OPERATIONS_DONE` — toutes terminées, et au moins une (un dossier sans
  prestation ne doit pas passer parce que « tout est fait ») ;
- `QUALITY_OPTIONAL` — le raccourci vers « prêt » n'existe que si
  l'organisation a désactivé le contrôle qualité.

## Faille trouvée pendant la mise en place (HIGH)

**La cascade de suppression était bloquée par un garde-fou métier.**

Supprimer un employé échouait dès qu'il avait travaillé sur un dossier clos :
`employee_id` est en `on delete set null`, ce `SET NULL` fait un `UPDATE` sur
l'opération, et le trigger de protection refusait parce que le dossier est
restitué ou annulé.

Conséquence bien plus grave que le symptôme : **supprimer une organisation
empruntait le même chemin**. L'invariant « une organisation doit rester
supprimable » était en danger — et il n'était pas testé avec des employés et des
opérations en base.

C'est la **deuxième fois** qu'un invariant métier bloque une cascade (le premier
était « dernier propriétaire », corrigé en phase 1). La règle qui s'en dégage :
un trigger de protection doit reconnaître ce qui vient d'une cascade et se
taire — il protège l'utilisateur, pas la base contre elle-même. Deux assertions
de régression le vérifient désormais.

## Défauts d'interface vus à l'écran

| Défaut | Gravité | Correction |
|---|---|---|
| « Démarrer » proposé **en action principale** sur une opération non assignée, que la base refuse | MEDIUM | bouton inerte avec sa raison |
| Démarrer le travail laissait le dossier en « en attente » : il fallait aller le dire sur un second écran | MEDIUM | le dossier suit ses opérations, en base, par la fonction de transition (donc avec historique) |
| Une opération démarrée par erreur ne pouvait pas être reprise, alors que la base l'autorise | MEDIUM | action « Remettre à faire » |

Le premier est la **répétition exacte** du défaut corrigé en phase 9 sur les
prestations sans tarif. La règle est désormais générale : une action que le
serveur refusera ne s'affiche pas comme une action possible.

## Défauts de méthode de test

Deux, découverts en série :

1. **Une exception attrapée en PL/pgSQL annule tout ce que son bloc a écrit**,
   y compris les lignes préparatoires. Un employé créé dans le même bloc qu'une
   assertion d'échec disparaissait, et le test suivant échouait sur une
   violation de clé étrangère — à des dizaines de lignes de là.

2. **Des tests partageaient un jeu de données mutable.** Un test qui faisait
   avancer une opération vidait la colonne que les autres lisaient, et l'ordre
   d'exécution décidait du coupable apparent. Corrigé par `e2e/fixtures.ts` :
   chaque test qui modifie l'état monte son propre dossier par l'API réelle et
   le referme en sortant. Les tests de la file d'attente ont été repris de la
   même façon.

## Validation

| Contrôle | Résultat |
|---|---|
| Migrations sur PostgreSQL jetable | ✅ |
| Assertions SQL de sécurité | ✅ 115 (dont 27 nouvelles) |
| Campagne d'intrusion par l'API réelle | ✅ 17 assertions, tout bloqué |
| Playwright | ✅ 169 passés, 1 ignoré |
| Vérification des types | ✅ |
| Build de production | ✅ 478,09 kB (119,49 kB compressé) |
| Advisors sécurité | ✅ aucun nouveau signalement |

`scripts/intrusion-operations.mjs` rejoue la campagne à volonté.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| `READY → DELIVERED` n'existe pas encore | — | assumé : la restitution dépend de la règle de paiement (fondation 5), donc de la phase suivante |
| Les compétences ne se déclarent pas depuis l'interface | LOW | la table et la règle existent ; l'écran viendra avec les besoins réels |
| Le contrôle qualité n'a pas encore de checklist | LOW | la transition existe, la checklist est une phase à part |
| `confirm()` natif sur trois écrans | LOW | dette assumée, à reprendre d'un coup |

Les trois avertissements d'advisor restants sont les fonctions `SECURITY
DEFINER` volontairement ouvertes aux comptes connectés, documentées en base, et
la protection contre les mots de passe compromis.

Aucune vulnérabilité CRITICAL ou HIGH non corrigée. **Phase 10 validée.**

## Suite

Le **paiement** et la **caisse** : `READY → DELIVERED` n'existera qu'une fois la
règle de paiement avant restitution appliquée (`STRICT` ou `ALLOW_DEBT`). C'est
là que se referme le cycle — et c'est la partie que le patron vérifiera en
premier.
