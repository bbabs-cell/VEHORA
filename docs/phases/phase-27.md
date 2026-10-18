# Phase 27 — Le tiroir d'où sort l'argent

Demande du propriétaire, parmi les points restants de la phase 26 : un
remboursement en espèces sortait de la caisse de la personne qui rembourse, pas
du tiroir d'où sortaient les billets. Décision : **le tiroir d'où sort
l'argent** (ADR-006), choisie parmi trois options.

## Le défaut

Seuls le propriétaire, l'administrateur et le chef de station remboursent. Un
caissier encaisse 50 000 F au lieu de 5 000 F ; la propriétaire doit ouvrir sa
propre caisse pour rendre 45 000 F, que le caissier sort de son tiroir. Le
soir, le caissier clôture avec un manque de 45 000 F, la propriétaire avec un
excédent de 45 000 F. Les deux s'annulent, rien ne les relie, et le caissier
passe pour avoir perdu de l'argent.

## Ce qui est fait

- **Fondation 5 modifiée d'abord**, puis ADR-006.
- **Base** (`20261017200000_tiroir_remboursement.sql`) : la personne qui
  rembourse désigne la caisse ouverte, de la station du dossier, d'où sortent
  les billets. Sans désignation : la caisse qui a reçu le paiement si elle est
  encore ouverte, sinon la sienne, sinon refus. Un **encaissement** ne choisit
  jamais son tiroir. La sortie porte le motif du remboursement et le nom de qui
  l'a autorisée. Chaque remboursement est **audité** (`payment.refund`), avec
  la caisse touchée et sa titulaire.
- **Écran de remboursement** : le montant se saisit (proposé au maximum
  remboursable, refusé au-delà) — avant, on rendait toujours le paiement
  entier, sans voir le montant ; et pour les espèces, « Caisse d'où sortent les
  billets », par défaut celle qui a reçu le paiement (« Ma caisse — a reçu ce
  paiement », « Caisse d'Ousmane Gueye »). Sans caisse ouverte dans la station,
  le bouton est inerte et l'écran dit pourquoi.
- **Écran de caisse** : une sortie inscrite par quelqu'un d'autre dit « par
  Khady Mbaye » et son motif.

## Failles trouvées en chemin

En écrivant les tests, trois références de caisse se sont révélées vérifiées
par rien. Chacune a été **reproduite avant correction** (assertions lancées
sur la base avant la migration, et constatées en échec) :

| Gravité | Défaut | Correction |
| --- | --- | --- |
| **Haute** | Un mouvement libre pouvait viser la caisse d'une **autre organisation** (il fallait connaître l'UUID de la session, que rien ne lui laissait lire). Invisible pour les membres de la victime, mais compté par `cloturer_caisse` (SECURITY DEFINER) : la clôture d'un client pouvait être faussée de l'extérieur. | `vehora.check_mouvement_caisse()` |
| Moyenne | Un caissier pouvait inscrire une sortie dans la caisse d'un **collègue**. | même déclencheur : un mouvement libre s'écrit dans sa propre caisse |
| Faible | Une caisse pouvait s'ouvrir sur la **station d'un autre client**, qui ne pouvait plus la supprimer (clé en RESTRICT). | `vehora.check_caisse_station()` |
| Faible | Les remboursements n'étaient **pas audités**, contrairement à la fondation 5. | `vehora.auditer_remboursement()` |
| Info | La policy d'insertion des paiements ne regardait pas la station ; la lecture du dossier sous RLS bloquait déjà le cas, par accident. | la policy passe `station_id` à `can_write` |

**Aucune trace d'exploitation** sur la base réelle avant correction : zéro
mouvement dont la caisse appartient à une autre organisation, zéro mouvement
libre écrit dans la caisse d'autrui, zéro caisse sur une station étrangère.

## Validation

| Contrôle | Résultat |
| --- | --- |
| `npm run validate:sql` | vert — **326 assertions** (307 avant) : autorisé, non autorisé, malveillant |
| `npm run types:check` + `tsc -p tsconfig.spec.json` | vert |
| `npm run test:unit`, `test:contraste`, `test:csp` | vert |
| `npm run build` | vert, initial 499,82 Ko |
| `npm run audit:mobile` à 320, 375 et 1280 px, deux thèmes | vert |
| Captures regardées | fenêtre de remboursement (deux thèmes), caisse avec la sortie « par Khady Mbaye » |
| `npm run e2e` | suite connectée non jouée (secrets absents) ; le test de remboursement vérifie désormais le montant proposé, le tiroir par défaut et un remboursement partiel. Les 14 tests sans secret : verts (deux réparés, voir plus bas) |

## Base réelle

**Appliquée le 18 octobre par le propriétaire, dans l'éditeur SQL de
Supabase**, puis inscrite dans `schema_migrations` sous la version de son
fichier (`20261017200000`) : 50 migrations, dépôt et base alignés. Les
déclencheurs, la fonction et la policy ont été vérifiés en place ; advisors
sans nouveau signalement.

Pourquoi pas par le connecteur : `apply_migration` a expiré quatre fois (60 s)
sans rien atteindre. Le connecteur demande une confirmation avant toute
instruction destructrice — la migration contient un `DROP POLICY` — et cette
demande n'arrive pas au propriétaire dans une session cloud. La réécrire pour
échapper au garde-fou a été refusé, à juste titre ; le fichier commité est
celui qui a été appliqué.

Un premier essai dans l'éditeur a tourné dans un **autre projet** que celui de
l'application (« Success », mais rien dans `liragiqjtwlwqkfiyedk`) : donner
toujours le lien direct de l'éditeur du bon projet, et vérifier après coup.

## « Afficher le mot de passe »

Demande du propriétaire, après un compte bloqué sur PC alors qu'il marchait
sur téléphone : sur un clavier AZERTY, les chiffres demandent Maj, et sans voir
ce qu'on tape, « 1234 » devient « &é"' ». Un bouton « Afficher » / « Masquer »
dans le champ, sur les trois écrans où l'on tape un mot de passe (connexion,
création de compte, nouveau mot de passe), le même partout :
`shared/ui/mot-de-passe.component.ts`.

- **Le bundle initial avait pris 820 octets** et dépassé son seuil, alors que
  ces écrans sont chargés à la demande : `contentChild()` faisait entrer le
  moteur des requêtes de contenu dans le morceau initial partagé. Le champ
  demande désormais l'état à sa boîte par injection : 499,87 Ko.
- **Le champ dépassait de la carte de 51 px à 320 px**, audit vert. Dans la
  boîte, il perdait l'étirement de la colonne flex de `.vh-field`. Vu sur la
  capture, pas par l'audit : son contrôle de débordement ignore ce qui est sous
  un `overflow: hidden`, et les écrans de connexion en posent un pour leurs
  halos. Nouveau contrôle n° 7, « champ hors de son cadre » ; vérifié en échec
  avant la correction (connexion et inscription), vert après, sans faux
  positif sur les autres écrans.
- **Le formulaire du nouveau mot de passe n'avait jamais été audité** : sans la
  session qu'ouvre le lien de récupération, l'écran affiche « Ce lien a
  expiré ». Il est désormais audité aussi sous un profil connecté.
- Test de parcours : la bascule masque, affiche, garde la saisie et ne soumet
  pas le formulaire. Il ne demande ni compte ni secret.

## Intégration continue : rouge depuis le 8 octobre

En regardant l'état de l'intégration continue avant de pousser : **toutes les
exécutions terminées depuis le 8 octobre sont en échec**. Sans les secrets
`VEHORA_TEST_*`, 14 tests tournent, et deux étaient faux :

| Test | Rouge depuis | Cause | Correction |
| --- | --- | --- | --- |
| aucun secret dans le bundle | au moins le 8 octobre | il cherchait le **mot** `sb_secret_`, que supabase-js contient lui-même (`key.startsWith('sb_secret_')`) — deuxième occurrence de « un test qui cherche un mot » ; vert en local par hasard de chargement | il cherche une **clé** : le préfixe suivi d'au moins 20 caractères. Vérifié sur le bundle réel : l'ancienne règle crie au loup, la nouvelle se tait et attrape une clé glissée |
| cibles tactiles ≥ 44 px | phase 24 | `boundingBox()` mesure la boîte transformée : pendant le zoom d'entrée (`scale(0.96)`), 44 px en valaient 42,24 | taille de mise en page (`offsetWidth`, `offsetHeight`) ; reproduit sur le code commité avant correction |

**Pourquoi l'étape durait près de deux heures** pour 11 à 19 secondes de
tests : en échouant, `expect(tout).not.toContain(…)` imprimait tout le
JavaScript servi, sources comprises — un journal de 640 000 caractères sur une
ligne. Le test n'extrait plus que ce qu'il cherche.

## Leçons

- **Une référence de caisse est une clé étrangère multi-tenant comme les
  autres.** Troisième occurrence de « une policy vérifie la ligne, pas ce
  qu'elle référence » — et la plus grave, parce qu'une fonction SECURITY
  DEFINER (la clôture) additionnait ce que la RLS cachait.
- **`pg_temp.login` lit les stations sous les droits de la session en cours.**
  Connecter un caissier de A juste après le propriétaire de B lui donne zéro
  station : se connecter sous `postgres` dans ce cas.
- **Un écran d'argent montre le montant.** La fenêtre de remboursement rendait
  le paiement entier sans l'afficher.
- **Une capture montre ce qu'un contrôle ignore.** L'audit était vert sur un
  champ sorti de sa carte ; le contrôle qui manquait a été ajouté, et vérifié
  en échec avant la correction.
- **Rouge n'est pas un état normal.** Dix jours d'intégration continue rouge,
  pris pour l'effet des secrets absents. Regarder ce qui échoue avant de
  pousser, à chaque fois.
