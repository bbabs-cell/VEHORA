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
| `npm run e2e` | non joué (secrets absents) ; le test de remboursement vérifie désormais le montant proposé, le tiroir par défaut et un remboursement partiel |

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
