# Design System VEHORA

Direction : **dark-first, premium, automobile, technologique, calme.**
Le design sert l'opérationnel. En cas de conflit, l'opérationnel gagne.

## Tokens de couleur

Définis dans `src/styles/_tokens.css`. Le code n'utilise **jamais** une valeur
hexadécimale en dur — uniquement `var(--vh-…)`.

| Token | Dark (défaut) | Rôle |
|---|---|---|
| `--vh-bg` | `#0B1120` | fond de l'application |
| `--vh-surface-1` | `#111827` | cartes, panneaux |
| `--vh-surface-2` | `#172033` | éléments surélevés, en-têtes |
| `--vh-surface-3` | `#1E293B` | survol, sélection |
| `--vh-primary` | `#3B82F6` | action principale |
| `--vh-accent` | `#06B6D4` | accent, données |
| `--vh-success` | `#22C55E` | prêt, payé, validé |
| `--vh-warning` | `#F59E0B` | attente, partiel |
| `--vh-error` | `#EF4444` | erreur, refusé, annulé |
| `--vh-text` | `#F8FAFC` | texte principal |
| `--vh-text-muted` | `#94A3B8` | texte secondaire |
| `--vh-border` | `#263449` | bordures, séparateurs |

### Mode clair — exigence terrain, pas une option d'accessibilité

Les écrans opérationnels sont utilisés **dehors, en plein soleil, sur un
téléphone bon marché**. Un thème sombre y est illisible. Le mode clair est donc
prévu dès le design system (mêmes tokens, valeurs redéfinies sous
`[data-theme="light"]`) et livré **en phase 2**, pas en phase 20.

`--vh-text-muted` sur `--vh-surface-1` donne un contraste de 5,9:1 — conforme
AA pour le texte courant, insuffisant pour du texte fin. Ne jamais l'utiliser
en dessous de 14px ni pour une information critique.

## Statuts

Chaque statut de dossier a une couleur **et** une forme (point, icône, libellé).
Jamais la couleur seule : daltonisme, et écran de mauvaise qualité en plein jour.

| Statut | Couleur |
|---|---|
| ARRIVÉ | `--vh-text-muted` |
| INSPECTION | `--vh-accent` |
| EN ATTENTE | `--vh-warning` |
| EN COURS | `--vh-primary` |
| CONTRÔLE | `--vh-accent` |
| PRÊT | `--vh-success` |
| RESTITUÉ | `--vh-text-muted` |
| ANNULÉ | `--vh-error` |

## Typographie

**Inter**, chargée en local (`woff2`, sous-ensemble latin) — pas de CDN de
polices : latence et fiabilité réseau sur le marché visé.
Échelle : 12 / 14 / 16 / 20 / 24 / 32 / 40. Corps à 16px sur mobile — jamais en
dessous de 14px pour une donnée métier.

## Espacement, rayons, profondeur

Échelle sur 4px : 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
Rayons : 6px (contrôles), 10px (cartes), 16px (modales).
Profondeur par **surface + bordure** d'abord, ombres légères ensuite.
Pas de glassmorphism généralisé : réservé à la barre de navigation superposée et
aux modales. Jamais sur une liste opérationnelle — coût GPU sur mobile bas de gamme.

## Cibles tactiles

Minimum **44×44px**. Les actions primaires des écrans opérationnels
(démarrer, terminer, encaisser, restituer) visent 56px de hauteur et se situent
dans la moitié basse de l'écran, atteignables au pouce.

## Micro-interactions

150–300 ms, `ease-out`. Skeletons pour tout chargement > 300 ms. Retour visuel
immédiat sur toute action (< 100 ms), même si la requête réseau est lente.
`prefers-reduced-motion: reduce` supprime toutes les animations non essentielles.

## Budget de performance (vérifié en CI)

- bundle initial ≤ **250 Ko** compressé ;
- chaque feature lazy-loadée ≤ 100 Ko ;
- premier rendu utile < 2,5 s en 3G lente sur un appareil de milieu de gamme.

Configuré dans `angular.json` (`budgets`) : un dépassement casse le build. C'est
la seule manière de tenir l'exigence §43 face à Angular.
