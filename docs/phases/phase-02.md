# Phase 2 — Design system appliqué, layout, navigation, responsive

## Périmètre

Coquille applicative, navigation, thème clair/sombre, primitives d'interface
partagées, et première lecture de données réelles jusqu'à l'écran. Aucune
nouvelle surface en base : cette phase est entièrement frontend.

## Ce qui a été construit

| Élément | Emplacement |
|---|---|
| Service de thème (sombre / clair / système) | `src/app/core/theme/theme.service.ts` |
| Modèle de navigation, piloté par les permissions | `src/app/layout/navigation.ts` |
| Coquille applicative | `src/app/layout/app-shell/` |
| Service d'organisation | `src/app/core/organization/` |
| Icônes SVG inline | `src/app/shared/ui/icon.component.ts` |
| État vide, squelette de chargement | `src/app/shared/ui/` |
| Tests de coquille | `e2e/layout.spec.ts` |

**Desktop** : barre latérale persistante, en-tête avec l'organisation.
**Mobile** : en-tête compact, tiroir de navigation, et barre d'actions basse
atteignable au pouce.

Les icônes sont des tracés SVG inline — aucune bibliothèque, aucune police
d'icônes, aucun téléchargement supplémentaire. Sur un forfait payé au volume,
chaque kilo-octet évité compte.

## Preuve que la chaîne complète fonctionne

L'en-tête affiche **« Station Awa — Dakar »**, lu depuis la base via la RLS.
Aucun filtre `organization_id` n'est écrit côté client : la RLS ne renvoie déjà
que l'organisation portée par le JWT. Ajouter un filtre client donnerait
l'illusion que c'est lui qui protège.

## Défauts trouvés et corrigés

### MEDIUM — l'application démarrait en thème clair

**Constat.** Découvert par la capture d'écran, pas par un test : l'écran
attendu en sombre était clair. La préférence par défaut était « système », or la
grande majorité des appareils sont réglés en clair.

**Impact.** VEHORA se lançait en clair pour presque tous les utilisateurs, ce
qui contredit frontalement l'identité dark-first (§44, §65 du prompt maître).
Un défaut invisible aux tests fonctionnels — ils vérifiaient que le thème
*bascule*, pas qu'il *démarre* au bon endroit.

**Correction.** Défaut passé à `sombre`. « Système » reste disponible comme
choix explicite de l'utilisateur.

**Leçon.** Certains défauts ne se voient qu'à l'œil. La vérification visuelle
fait partie de la validation d'une phase d'interface, au même titre que les
tests.

### LOW — libellé tronqué dans la barre basse

« Tableau de bord » passait sur deux lignes sur un écran de 360 px, réduisant la
lisibilité d'un coup d'œil. Ajout d'un `libelleCourt` pour la barre basse :
« Accueil », « File ».

### Décision — les écrans à venir sont montrés, mais pas cliquables

Les entrées de navigation non construites apparaissent estompées avec la mention
« Bientôt », en `aria-disabled`, sans être des liens. Cela donne la forme du
produit sans créer de lien mort : un lien qui ne mène nulle part coûte plus de
confiance qu'il n'en fait gagner.

## Budgets de performance

| Mesure | Valeur |
|---|---|
| Bundle initial | 476 kB bruts → **117 kB transférés** |
| Coquille (morceau séparé) | 15,8 kB bruts → 4,4 kB transférés |
| Tableau de bord | 3,8 kB bruts → 1,4 kB transférés |

Cible : 250 kB transférés. On est à moins de la moitié. Les seuils bruts
d'`angular.json` ont été recalibrés (500/600 kB) pour correspondre à cette cible
réelle, et le budget par feuille de style de composant porté à 6 kB : la
coquille en porte légitimement plus qu'un composant métier.

## Tests

| Suite | Résultat |
|---|---|
| Types stricts | ✅ |
| Build, budgets appliqués | ✅ 117 kB transférés |
| Sécurité SQL | ✅ 17 assertions |
| Parcours Playwright (mobile + desktop) | ✅ **27 tests** |

Nouveaux tests de cette phase : organisation réelle affichée dans l'en-tête,
bascule de thème persistante après rechargement, écrans à venir non cliquables,
lien d'évitement au clavier, cibles tactiles de la barre basse ≥ 44 px, et
**absence de défilement horizontal**.

Deux tests existants ont dû être corrigés : ils ciblaient un texte devenu
présent à deux endroits. Un test qui dépend d'une occurrence unique casse dès
qu'on enrichit la page — les assertions sont désormais portées par région.

## Audit de sécurité

Phase frontend : aucune nouvelle surface en base, aucune policy modifiée.

Vérifié sur le diff : aucun `innerHTML`, aucun `bypassSecurityTrust`, aucun
`eval`, aucun `any`, aucun secret, aucun identifiant en dur dans les tests
(ils lisent l'environnement).

Point de vigilance conservé : les permissions du JWT servent **uniquement** à
masquer des entrées de navigation. Les gardes de route et la RLS restent les
seules barrières réelles — un menu masqué n'interdit rien.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Aucune route protégée par permission n'existe encore | — | `permissionGuard` est écrit et testé en phase 1, il servira en phase 4 |
| Contraste du mode clair non mesuré instrumentalement | LOW | vérifié à l'œil dans les deux thèmes ; mesure automatisée à ajouter en phase 20 |
| Policies Storage non écrites | MEDIUM | phase 5 |
| Aucun approvisionnement d'organisation | MEDIUM | prochaine étape |

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 2 validée.**

## Suite — phase 3

Tableau de bord orienté action, puis approvisionnement d'organisation : créer
une entreprise et son premier propriétaire depuis l'application, sans SQL.
