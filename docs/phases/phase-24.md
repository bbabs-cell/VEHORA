# Phase 24 — Refonte selon la méthode MagyaPro et les animations vivantes

Demande du propriétaire : appliquer **à la lettre** le skill `methode-magyapro`
pour remodeler le projet, et le skill **« animations vivantes »** d'Atelier Flow
pour le mouvement. Les deux skills sont versionnés dans `.claude/skills/`. Doc
de fonctionnalité : `docs/refonte-interface.md` ; registre de sécurité (nouveau,
exigé par la méthode) : `docs/SECURITE.md`.

Aucune migration, aucune règle serveur modifiée.

## Ce que la méthode a trouvé avant d'écrire une ligne

La méthode exige une capture à 375 px **regardée** de chaque écran. Aucun
identifiant de test n'étant disponible dans cette session, un banc a d'abord
été construit pour simuler Supabase dans le navigateur (`scripts/maquette/`).
La première capture de la file d'attente l'a montrée **en texte brut, puces de
liste comprises**.

Cause : en phase 15, la mutualisation des styles de modale (« 1 499 lignes
supprimées pour 87 ajoutées ») a emporté les styles **non modaux** de cinq
écrans — file d'attente, caisse, catalogue, opérations, organisations de la
plateforme. Le budget de la feuille de la file « repassait sous son seuil » : il
y repassait parce qu'il n'y avait plus rien. Aucun test ne le voyait : les
assertions lisaient des libellés et des rôles, tous présents. Neuf phases sans
mise en forme sur l'écran le plus ouvert du produit.

Autres constats de l'audit :

| Constat | Correction |
|---|---|
| `--vh-space-5` employé sur 3 écrans, déclaré nulle part : l'écart valait 0 | jeton déclaré ; `verifier-jetons.mjs` refuse désormais un jeton inconnu |
| 8 boutons principaux sur la file, 4 sur les opérations, 2 sur Paramètres et Facturation | `.vh-button--trait` pour l'action propre à une ligne ; formulaire modifié seul en principal |
| Neuf feuilles écrivaient du texte avec `--vh-error`, jeton de fond (≈ 4:1) | `--vh-error-text` ; contrôle automatique |
| « Fiche enregistrée. » dans le bandeau rouge (4 écrans) | `Retour` typé, `vh-alert--succes` |
| Barre basse à 11 px ; quatre entrées figées, jamais la caisse pour un caissier | 13 px ; 4 entrées selon les droits + « Plus » |
| Tiroir fermé atteignable à la tabulation, hors écran | `visibility: hidden` une fois refermé |
| Barre d'actions de l'inspection décalée de 264 px entre 900 et 1024 px | seuil aligné, `--vh-largeur-laterale` |
| « 976 500 FCFA » sortait de sa tuile (espace supprimé par Angular entre deux balises) | `&ngsp;` ; l'audit détecte le texte coupé |
| Reçu : « QtéMontant » | marges de colonnes |
| `message()` recopiée dans 15 services, « Failed to fetch » reconnu sous Chrome seulement | `traduire-erreur.ts`, trois navigateurs |
| « Rôle : OWNER, Portée : ORGANIZATION » sur le tableau de bord | libellés français |
| Thème clair : écran sombre puis bascule | script en ligne autorisé par empreinte SHA-256 |

## Ce qui a été fait

Le détail écran par écran est dans `docs/refonte-interface.md`. En bref :

- **Socle** : jetons (navigation sombre dans les deux thèmes, dégradé du bouton
  principal, lumière, voile, trame, impression), `_animations.css` (portage CSS
  du skill, en `backwards`), `_base.css` (bouton à dégradé et reflet, bouton
  trait, cartes cliquables, champs, modales à liseré, alertes, briques de page
  et de liste), `_police.css` (latin et latin étendu seulement).
- **Briques** : `vh-entete-page`, `vh-fond-vivant`, `vh-nombre-anime`,
  `vh-barre-progression`, `vh-scene`, `vh-navigation-laterale`,
  `vh-barre-basse`, `traduireErreur`, `Retour`, brouillon local.
- **Tous les écrans** convertis : en-tête partagé, un bouton principal, briques
  globales (six copies identiques de liste supprimées), animations.
- **Inspection** : brouillon local des constats ; photos réduites selon le
  gabarit de la méthode.
- **Outils** : `npm run audit:mobile` (et en intégration continue), banc
  Supabase simulé, `scripts/verifier-erreurs.mjs`, `scripts/verifier-jetons.mjs`.

## Validation

| Contrôle | Résultat |
|---|---|
| `npm run types:check` + `tsc -p tsconfig.spec.json` | vert |
| `npm run test:unit` | vert — CSV 16, erreurs 17, jetons (86 jetons, 0 couleur en dur, 0 jeton de fond en texte) |
| `npm run test:contraste` | vert — 56 paires (40 avant), deux thèmes |
| `npm run build` (budgets) | vert, **aucun avertissement** — initial 499,85 Ko bruts / 124 Ko transférés |
| `npm run test:csp` | vert — l'empreinte du script de thème correspond au build |
| `npm run validate:sql` | vert — 295 assertions (rien n'a changé côté base) |
| `npm run audit:mobile` | vert — 26 écrans × 2 thèmes à 375 px ; 320 et 1280 px verts |
| Captures regardées | tableau de bord, file, opérations, caisse, reçu, connexion, plateforme (sombre et clair, 375 et 1280 px) |
| Brouillon d'inspection | vérifié dans le navigateur : saisie, rechargement, reprise, « Repartir de zéro » |
| `npm audit` | une alerte de production (`@angular/router`, SSR seulement) jugée non atteignable — `docs/SECURITE.md` |
| `npm run e2e` | **non joué** : les secrets `VEHORA_TEST_*` ne sont pas dans cette session |

### Tests de parcours : ce qui a été vérifié à la main

Faute de pouvoir rejouer la suite, chaque sélecteur qu'elle lit a été
contrôlé contre le nouveau code : classes `.carte`, `.carte__nom`,
`.carte__detail`, `.barre-basse`, `.barre-basse__lien`, `.inspection__actions`,
`.modale__contenu`, `.tuile__valeur`, `.total`, `.zone`, `.zone__nom`
conservées ; libellés et noms accessibles inchangés (« Nouveau dossier »,
« Ouvrir le menu », « Fermer le menu », « Se déconnecter », titres de page —
le point final est décoratif, `content: '.' / ''`) ; « Nouveau dossier » reste
affiché même file vide. Les rôles `status`/`alert` des messages de Paramètres,
Facturation et Messages suivent désormais réussite/échec ; aucun test ne
lisait l'ancien rôle.

Constat sans lien avec la phase : `layout.spec.ts` attend un élément
`[aria-disabled="true"]` (« écran non construit ») ; toutes les entrées de
navigation sont `disponible: true` depuis la phase 23. Ce test ne peut que
tomber à la prochaine exécution — il a été laissé tel quel, à trancher avec la
suite complète.

## Reste dû

- **`npm run e2e` complète** et `scripts/intrusion-parametres.mjs` (dus depuis
  la phase 23), avec les secrets.
- File hors-ligne des encaissements et limitation de débit des écritures : à
  décider (`docs/SECURITE.md`).
- Fournisseur de SMS : décision toujours attendue ; les liens WhatsApp `wa.me`
  de la méthode sont une option à peser (`docs/refonte-interface.md`).
- Bundle initial à 150 octets de son seuil d'alerte : la prochaine règle globale
  devra être payée ailleurs.
