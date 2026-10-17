# Sécurité — audit, corrigé, à décider

Document de fond demandé par la méthode MagyaPro (`processus.md` §6,
`securite.md` §9) : ce qui a tenu, ce qui a été corrigé (avec gravité), ce qui
reste à décider. **À relire à chaque correctif.** La stratégie elle-même est dans
`docs/architecture/03-rls-super-admin.md` et `08-securite-tests.md` ; ce fichier
en est le registre.

Dernière mise à jour : phase 24 (refonte de l'interface).

## Correspondance avec la méthode

La méthode est écrite pour un serveur Next.js ; VEHORA n'a pas de serveur
applicatif. Chaque brique a son équivalent, et c'est lui qu'on audite :

| Méthode | VEHORA | Où |
|---|---|---|
| `requireX(permission)` : session + tenant + droit | claims du JWT (`custom_access_token_hook`) + RLS + `vehora.has_permission()` | fondations 1 à 3 |
| Tenant venu de la session, jamais du corps | `organization_id` posé par la base depuis le JWT ; le client ne l'envoie pas | triggers `*_set_org` |
| Identifiant re-filtré par le tenant | RLS sur chaque table + triggers de cohérence des clés étrangères | `01_tenant_isolation.sql` |
| Montants recalculés côté serveur | `resoudre_prix()`, prix copié dans la ligne, devise imposée par trigger | fondation 5 |
| Double action → mise à jour conditionnelle | transitions par `transitionner_dossier()`, caisse unique par index, reçu correctif une seule fois | fondations 4 et 5 |
| `route()` : conversion d'erreur unique | `core/erreurs/traduire-erreur.ts` (phase 24) | — |
| Contrôle d'origine (CSRF) | **sans objet** : l'authentification passe par l'en-tête `Authorization`, jamais par un cookie — un site tiers ne peut pas la faire envoyer | — |
| IP client fiable | **sans objet** : aucun code serveur ne lit l'IP | — |
| `hit()` : limitation de débit | Supabase Auth limite la connexion ; **rien sur les écritures** | à décider, ci-dessous |
| Envoi de fichiers par signature binaire | bucket privé, types déclarés JPEG/PNG/WebP, SVG exclu, chemin imposé | à décider, ci-dessous |

## Ce qui a tenu

- **295 assertions SQL** (`npm run validate:sql`) rejouent l'isolement entre
  organisations table par table, l'absence de policy de lecture du Super Admin
  sur les données clientes, l'immuabilité des reçus, factures et journaux, et
  la suppression en cascade d'une organisation réelle. Vertes en phase 24.
- **Campagnes d'intrusion** par l'API réelle (`scripts/intrusion-*.mjs`, 231
  assertions écrites, dont les 14 de `intrusion-parametres.mjs` jamais jouées —
  voir phase 23) : identifiant d'un autre client, rôle, montant, statut,
  fichier.
- **CSP** stricte, vérifiée sur le build réel (`npm run test:csp`) : aucun
  script en ligne sauf un, autorisé par son **empreinte** (phase 24, voir
  plus bas) — jamais `'unsafe-inline'` pour les scripts.
- **Aucune clé `service_role`** dans le bundle (recherche par préfixe
  `sb_secret_` et par JWT décodé, pas par mot).

## Corrigé

| Phase | Gravité | Défaut | Correction |
|---|---|---|---|
| 26 | Moyenne | `vehicle_inspections.service_order_id` n'avait ni clé étrangère ni contrôle : une organisation pouvait rattacher son inspection au dossier d'une autre (en connaissant son UUID) et lui faire franchir l'étape « Inspection » ; une inspection du véhicule A débloquait le dossier du véhicule B. | Clé étrangère et `vehora.check_inspection_dossier()` (SECURITY INVOKER : le dossier d'autrui est « introuvable »). |
| 26 | Moyenne | Annuler un dossier payé rendait le remboursement impossible : l'argent restait dans la caisse théorique et dans le chiffre du jour, sans trace de restitution. | Invariant `VEHORA_PAIEMENT_A_REMBOURSER` (`vehora.check_dossier_statut()`). |
| 26 | Faible | Contrôle qualité désactivé : un dossier passait « prêt », puis restitué, opérations inachevées. | Invariant `VEHORA_OPERATIONS_EN_COURS`. |
| 26 | — (nouvelle surface) | Création de compte et mot de passe oublié. | Même réponse que l'adresse ait un compte ou non ; le lien de réinitialisation n'ouvre qu'un changement de mot de passe ; la longueur minimale est celle de Supabase Auth. |
| 24 | Faible | Le message de `VEHORA_TENANCY_VIOLATION` disait « Cet élément n'appartient pas à votre organisation » : il confirmait l'existence d'une donnée chez un autre client (méthode, règle 5). | Le frontend dit « introuvable » (`traduire-erreur.ts`). Le serveur distingue encore les deux cas : voir « à décider ». |
| 24 | Faible | Une photo dans un format refusé par le stockage (HEIC) partait étiquetée `image/jpeg`. | `image-compression.ts` refuse plutôt que de mentir sur le type ; l'envoi est compté comme un échec et l'écran le dit. |
| 24 | Faible | Les brouillons d'inspection (nouveaux) auraient survécu à la déconnexion sur un téléphone partagé. | `AuthService.signOut()` efface les clés `vehora:*` ; un brouillon expire de toute façon au bout de 12 heures et sa clé porte l'organisation. |
| 24 | — (accessibilité) | Le tiroir de navigation fermé restait atteignable à la tabulation, hors écran. | `visibility: hidden` une fois refermé. |
| 23 | **Haute** | Un propriétaire pouvait écrire `currency`, `slug`, `status` de son organisation. | `vehora.protect_organization()` (SECURITY INVOKER). |

Les phases antérieures sont détaillées dans `docs/phases/` et dans CLAUDE.md.

## À décider

1. **Oracle d'existence entre organisations — faible.** Écrire une ligne qui
   référence l'identifiant d'un autre client lève `VEHORA_TENANCY_VIOLATION` ;
   un identifiant inexistant lève une violation de clé étrangère (`23503`).
   Les deux réponses diffèrent au niveau de l'API. Les identifiants sont des
   UUID v4 (non devinables), d'où la gravité faible. Correction possible : que
   les triggers de cohérence lèvent la même erreur que la clé étrangère.
2. **Limitation de débit des écritures — faible à moyenne.** Un membre
   authentifié peut enchaîner les écritures dans sa propre organisation sans
   frein (rien ne déborde vers les autres : la RLS tient). La méthode met
   `hit()` sur chaque écriture. Équivalent possible : une table de tentatives
   consultée par les fonctions sensibles (encaissement, émission de reçu), ou
   les restrictions réseau de Supabase. À peser contre le coût d'une requête
   de plus sur 3G.
3. **Type des fichiers par signature binaire — faible.** Le bucket vérifie le
   type **déclaré**, pas les octets. Un client modifié peut déposer un HTML
   nommé `.jpg` dans le dossier de SON organisation ; il est servi par URL
   signée courte. L'application, elle, ré-encode toujours l'image (canvas) et
   n'envoie donc que de vraies images. Correction possible :
   une fonction Edge qui vérifie la signature avant d'accepter le dépôt.
4. **File hors-ligne des encaissements.** Recommandée par la méthode pour
   l'action vitale, elle demande une clé d'idempotence côté serveur et une
   règle de rejeu : à écrire d'abord dans la fondation 5.
5. **Remboursement en espèces — moyenne (phase 26).** Il sort de la caisse
   ouverte par la personne qui rembourse, pas de celle qui a reçu l'argent :
   l'écart apparaît dans la mauvaise session. Structurel, à trancher dans la
   fondation 5 avant de corriger.
6. **Drapeaux `recus` et `inspections_photos` — faible (phase 26).** Déclarés,
   lus par l'écran, vérifiés par aucune fonction serveur : un client modifié
   les ignore. Contraire à « un flag qui n'empêche rien n'est pas un flag ».
7. **Essai sans échéance — faible (phase 26).** Une organisation en essai le
   reste indéfiniment.

## Dépendances — `npm audit` (phase 24)

Jugement d'atteignabilité, alerte par alerte (méthode, sécurité §9.4) :

| Paquet | Gravité annoncée | Atteignable ? |
|---|---|---|
| `@angular/router` < 22.2 — déni de service par paramètres de matrice numériques **en rendu serveur** | haute | **Non** : VEHORA est une SPA sans SSR (ADR-005). À monter de version à la prochaine mise à jour d'Angular, sans urgence. |
| `piscina`, `proxy-addr`, `source-map-js`, `fast-uri`, `ip-address`, `@modelcontextprotocol/sdk` (via `@angular/build` et `@angular/cli`) | critique à modérée | **Non** : outillage de développement et de build. Rien n'est livré au navigateur, rien ne tourne en production. |

`npm audit --omit=dev` ne signale que `@angular/router`.
