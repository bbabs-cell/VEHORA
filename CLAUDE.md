# VEHORA — Guide de travail (source de vérité opérationnelle)

VEHORA est un SaaS multi-tenant de gestion opérationnelle pour les centres de
lavage, de detailing et de services automobiles. Marché initial : Afrique de
l'Ouest. Qualité et architecture : internationales.

Le **PROMPT MAÎTRE** (`docs/PROMPT-MAITRE.md`) est la source de vérité produit.
Ce fichier est sa traduction opérationnelle pour le développement quotidien.

## Stack

| Couche | Choix | Notes |
|---|---|---|
| Frontend | Angular (standalone components + signals), TypeScript strict | SPA, **pas de SSR** |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) | |
| Base | PostgreSQL + Row Level Security | RLS dès le jour 1 |
| Déploiement | Vercel (build statique) | |
| Tests | Playwright (parcours) + pgTAP/SQL (sécurité RLS) + unitaires | |
| Migrations | `supabase/migrations/` versionnées en Git | jamais de modif manuelle en prod |

Interdits sauf nécessité démontrée : PHP, Laravel, MySQL, Firebase, Prisma,
microservices, Kubernetes.

## Les cinq fondations (à lire avant toute implémentation)

1. `docs/architecture/01-roles-permissions.md` — RBAC
2. `docs/architecture/02-organization-station-user-employee.md` — modèle d'identité
3. `docs/architecture/03-rls-super-admin.md` — stratégie RLS et Super Admin
4. `docs/architecture/04-service-order-lifecycle.md` — cycle de vie du Service Order
5. `docs/architecture/05-regles-financieres.md` — paiements, caisse, tarification

Aucune fonctionnalité ne doit contredire ces cinq documents. Si une
fonctionnalité l'exige, on modifie d'abord le document, avec justification.

Voir aussi :
- `docs/architecture/06-design-system.md`
- `docs/architecture/07-structure-projet.md`
- `docs/architecture/08-securite-tests.md`
- `docs/decisions/` — journal des décisions d'architecture (ADR)

## Règles de développement

**Hiérarchie des priorités** (en cas de conflit) :
CLARTÉ → RAPIDITÉ → FIABILITÉ → SÉCURITÉ → ÉVOLUTIVITÉ → ESTHÉTIQUE.
Et : OPÉRATIONNEL > ESTHÉTIQUE · SÉCURITÉ > VITESSE DE DEV · SIMPLICITÉ > COMPLEXITÉ.

- **Mobile-first.** Les écrans opérationnels (file d'attente, opérations,
  inspection, paiement) sont conçus pour un téléphone Android d'entrée de gamme
  tenu d'une main, dehors.
- **Jamais de sécurité côté frontend seul.** Un bouton masqué n'est pas une
  permission. Toute règle sensible est appliquée par RLS ou par une fonction
  serveur.
- **Code pédagogique.** Clair, modulaire, commenté là où c'est utile. Pas
  d'abstraction sans bénéfice concret. Pas de fichier géant.
- **Progressif.** Une phase à la fois. Jamais de génération massive.

## Skills projet — choisir avant d'agir

Les skills vivent dans `.claude/skills/`. **Ne jamais tous les charger.** Avant
chaque tâche importante : identifier le type de tâche, charger uniquement les
skills qui apportent une valeur directe, vérifier le résultat.

| Type de tâche | Skills à charger |
|---|---|
| Interface, composant, style | `vehora-design-system` + `vehora-frontend` |
| Parcours utilisateur, formulaire, navigation | `vehora-ux` + `vehora-frontend` |
| Composant Angular, service, route, performance, accessibilité | `vehora-frontend` |
| Démarrage de session, commit, clôture de phase, Git | `vehora-workflow` |
| Table, migration, policy, requête Supabase | `vehora-supabase` (+ `vehora-security` si données sensibles ou permissions) |
| Auth, RLS, permissions, audit | `vehora-security` + `vehora-supabase` |
| Espace Super Admin, abonnements, flags | `vehora-super-admin` + `vehora-security` + `vehora-supabase` |
| Paiements, caisse, devises, réseau, terrain | `vehora-west-africa` (+ `vehora-ux`) |
| Tests, validation, clôture de phase | `vehora-qa` |
| Toute construction, refonte, revue d'écran ou de sécurité | `methode-magyapro` (méthode du propriétaire, à appliquer à la lettre en adaptant les noms) |
| Animation, transition, micro-interaction, effet | `animations-vivantes` (style Atelier Flow) + `vehora-design-system` |

Skills natifs utiles : `/security-review` (revue de sécurité d'un diff),
`/code-review`, `/simplify`, `update-config`, `session-start-hook`.

**Outils réellement disponibles** : MCP Supabase, MCP GitHub, Chromium +
Playwright préinstallés en environnement cloud (`/opt/pw-browsers` — **ne jamais
y lancer `playwright install`** ; en local, si), PostgreSQL 16 pour
`scripts/validate-sql.sh`, Docker, Node 22.

Un hook `SessionStart` (`.claude/hooks/session-start.sh`) vérifie
l'environnement à chaque ouverture de session et installe les dépendances npm
quand un `package.json` existe.

Les plugins `frontend-design`, `web-design-guidelines`, `supabase`,
`playwright`, `claude-code-setup`, `claude-security` **n'existent pas** dans cet
environnement (catalogue, skills claude.ai et registre MCP vérifiés) : ne pas
tenter de les installer, ne pas prétendre les utiliser. Leurs besoins sont
couverts par le MCP Supabase, Playwright préinstallé, `/security-review` et les
skills projet `vehora-frontend` et `vehora-workflow`.

## Cycle obligatoire par phase

```
DÉVELOPPEMENT → TESTS FONCTIONNELS → AUDIT SÉCURITÉ → RECHERCHE DE FAILLES
→ CORRECTION → NOUVEAUX TESTS → AUDIT DE RÉGRESSION → BUILD → GIT DIFF
→ DOCUMENTATION → COMMIT → RAPPORT DE PHASE
```

Une phase n'est pas terminée tant qu'une faille CRITICAL ou HIGH n'est pas
corrigée ou explicitement documentée avec justification.

Chaque fonctionnalité est testée sous trois angles :
1. utilisateur autorisé → ça marche ;
2. utilisateur non autorisé → l'accès est refusé ;
3. utilisateur malveillant → les contournements (ID, rôle, org, station,
   montant, statut, fichier) sont bloqués.

## Conventions

- **SQL** : `snake_case`, tables au pluriel, clés `id uuid primary key`.
  Toute table métier porte `organization_id`, et `station_id` quand la donnée
  est rattachée à un site.
- **TypeScript** : `strict: true`. Pas de `any`. Types de base générés depuis
  Supabase (`database.types.ts`), jamais écrits à la main.
- **Angular** : composants standalone, `ChangeDetectionStrategy.OnPush`,
  signals pour l'état local, lazy loading par feature.
- **Commits** : `type(scope): description` — ex. `feat(service-orders): création depuis la file d'attente`.
- **Français** dans l'UI et la documentation. Anglais dans le code (identifiants, tables, colonnes).

## Commandes

| But | Commande |
|---|---|
| Serveur de développement | `npm start` |
| Build de production (budgets appliqués) | `npm run build` |
| Migrations + tests de sécurité SQL | `npm run validate:sql` |
| Tests de parcours | `npm run e2e` |
| Assertions unitaires (CSV, erreurs, jetons) | `npm run test:unit` |
| Contraste AA des jetons, deux thèmes | `npm run test:contraste` |
| Audit mobile 375 px, captures (Supabase simulé) | `npm run build && npm run audit:mobile` |
| Application sous sa CSP réelle | `npm run build && npm run test:csp` |
| Vérification des types | `npm run types:check` |

**Node ≥ 22.22.3 requis** par Angular 22. En environnement cloud, le hook
`SessionStart` bascule automatiquement sur `/opt/node24` — **s'il existe**. En
phase 24 il n'existait pas (Node 22.22.0 seulement) : Node 24.15.0 a été
téléchargé depuis nodejs.org, somme SHA-256 vérifiée contre `SHASUMS256.txt`,
et extrait dans `/opt/node24`.
Pour Playwright en cloud, exporter
`VEHORA_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (le
Chromium préinstallé) ; en local, laisser la variable vide.

## État du projet

**Phase 27** — le tiroir d'où sort l'argent (ADR-006) : un remboursement en
espèces s'inscrit dans la caisse d'où sortent les billets, désignée par qui
rembourse ; trois références de caisse non vérifiées corrigées, dont une
écriture **inter-organisations** (`docs/phases/phase-27.md`). **Migration
`20261017200000_tiroir_remboursement.sql` pas encore appliquée à la base
réelle** : elle contient un `DROP POLICY`, et le connecteur Supabase exige une
confirmation pour toute instruction destructrice — voir plus bas. Logo intégré
(`public/marque.svg`, icônes d'onglet et d'écran d'accueil).
**Phase 26 validée** — vérification de l'existant et réparation : un dossier
réel restait bloqué à l'inspection (l'écran ne rattachait jamais l'inspection
au dossier), et environ vingt-cinq chemins cassés dans la file, l'encaissement,
les comptes, les membres et les tarifs (`docs/phases/phase-26.md`). Création de
compte, mot de passe oublié et nouveau mot de passe existent enfin. **En
production** sur `vehora.vercel.app` depuis le 17 octobre (`29e1438`) ; le
dossier n° 1 est reparti par l'écran. **À faire hors du code** : régler Auth
dans Supabase — URL, SMTP (`docs/deploiement.md`, partie 3).
**Phase 25 validée** — couleur utile : une seule couleur ajoutée (indigo,
« l'équipe s'en occupe »), les étapes de dossier colorées selon qui doit agir,
la même correspondance partout (`TEINTE_STATUT`), fond vivant en dégradés
radiaux (`docs/phases/phase-25.md`). Même réserve sur `npm run e2e`.
**Phase 24 validée** — refonte selon la méthode MagyaPro et les animations
vivantes d'Atelier Flow (`docs/refonte-interface.md`, `docs/phases/phase-24.md`,
`docs/SECURITE.md`). Sous réserve : la suite `npm run e2e` n'a pas pu être
rejouée (secrets absents). **Phase 23 validée** (sous réserve : voir ci-dessous). Cycle métier complet, espace Super Admin, reçus immuables,
rapports, abonnements et feature flags, dette d'interface traitée, tableau de
bord chiffré, dette d'outillage de test traitée, historique des sessions de
caisse, export CSV des rapports et des sessions, facturation des abonnements
(échéances, relances, annulation), file des notifications au client, types de
base régénérés, écran « Paramètres » et colonnes d'organisation protégées.
**Deux contrôles de la phase 23 restent dus** : la suite `npm run e2e` complète
et `scripts/intrusion-parametres.mjs` (écrit, jamais exécuté). Le proxy sortant
du conteneur a cessé d'accepter l'hôte Supabase en fin de phase ; le garde-fou
lui-même a été vérifié sur la base réelle au moment de son application.
**Prochaine étape bloquée par une décision** : choisir un fournisseur de SMS.
Tout le reste des notifications est fait ; il ne manque que l'envoi
(`docs/notifications.md`).

- **Une mutualisation de styles se vérifie à l'écran, pas au diff.** En phase
  15, remonter les styles de modale dans `_base.css` a supprimé avec eux les
  styles NON modaux de cinq écrans (file d'attente, caisse, catalogue,
  opérations, organisations). Neuf phases en texte brut, puces comprises, sur
  l'écran le plus ouvert du produit ; tous les tests verts, parce qu'ils lisent
  des libellés. Trouvé en phase 24 par la première capture à 375 px. D'où
  `npm run audit:mobile`, en intégration continue, et la règle : **les
  captures se regardent.**
- **`npm run audit:mobile` simule Supabase** (`scripts/maquette/`) : tous les
  écrans de tous les profils, sans compte ni secret, sous la CSP réelle. Il
  échoue sur débordement, bouton écrasé, **deuxième bouton plein**, texte coupé
  par un `overflow: hidden`, texte sous 13 px, violation de CSP, erreur JS. Un
  écran ajouté = un chemin dans `PARCOURS` et ses lignes dans `donnees.mjs`.
- **Un seul bouton à fond de marque par écran** (méthode, règle 1). L'action
  propre à une ligne (« Démarrer », l'étape suivante d'un dossier) est en
  **trait** : `.vh-button--trait`. La file en avait un plein par véhicule.
  Deux formulaires sur un écran : seul celui qu'on modifie porte le bouton
  principal (`[class.vh-button--ghost]="form.pristine"`).
- **`var()` d'un jeton absent ne lève rien** : la propriété retombe sur sa
  valeur initiale. `--vh-space-5` a valu 0 sur trois écrans. `test:unit`
  lance `verifier-jetons.mjs` : jeton inconnu, couleur littérale hors de
  `src/styles/`, et jeton de FOND employé en texte (`--vh-error`,
  `--vh-primary` : ≈ 4:1 — neuf feuilles) sont refusés.
- **Une réussite ne s'affiche pas dans le bandeau rouge** : `Retour` typé
  (`shared/ui/retour.ts`) et `vh-alert--succes`. Quatre écrans mêlaient
  « Fiche enregistrée. » et les refus dans le même signal.
- **Les erreurs serveur se traduisent en UN point** : `traduireErreur`
  (`core/erreurs/`). Un service ne déclare que ses marqueurs et le sens de ses
  codes. « Failed to fetch » n'est que le mot de Chrome : Safari dit « Load
  failed », Firefox « NetworkError ». Une donnée d'un autre client est
  « introuvable ».
- **Animations : `backwards`, jamais `both`** — une transformation restée
  appliquée capture les `position: fixed` descendants. L'entrée d'un écran est
  un fondu d'**opacité** sur le conteneur (la barre d'actions de l'inspection
  est fixée). Le vocabulaire est dans `_animations.css` ; un effet du skill
  sans usage n'y entre pas. Un montant ne défile jamais à la caisse ni sur un
  reçu. Décor vivant dans la navigation et les écrans de présentation.
- **La navigation est sombre dans les deux thèmes** et a ses propres jetons
  (`--vh-nav-*`, accent compris) : le trait de marque du thème clair y serait
  illisible. Barre basse : quatre écrans **selon les droits** + « Plus ».
- **Le thème est posé avant le premier rendu** par un script en ligne de
  `index.html`, autorisé par son **empreinte SHA-256** dans la CSP. Le modifier
  d'un caractère impose de recalculer l'empreinte : `test:csp` échoue sinon.
- **Angular supprime l'espace seul entre deux balises.** Entre le nombre et
  l'unité d'un montant, c'est lui qui laisse « F CFA » passer à la ligne :
  `&ngsp;`. Sans lui, « 976 500 FCFA » sortait de sa tuile.
- **Le bundle initial est à 170 octets de son seuil d'alerte** (499,83 Ko bruts,
  124 Ko transférés). Ce qui ne sert qu'une fois par personne n'y va pas : les
  appels de création de compte et de mot de passe vivent dans `CompteService`,
  chargé avec leurs écrans — dans `AuthService`, ils dépassaient le seuil. Une règle globale que rien n'utilise est du poids pour
  chaque téléphone : `.vh-table-stack` a été retiré faute de tableau — le
  gabarit attend dans le skill de la méthode. En phase 25, cinq variantes de
  `.vh-pastille` jamais employées ont été retirées de la même façon. Un réglage
  par élément passe par un binding (`TEINTE_STATUT` → `[style.--vh-rail]`), pas
  par une règle globale par valeur.
- **Une couleur ajoutée doit dire quelque chose que le texte voisin ne dit
  pas, et la même chose partout.** Phase 25 : un premier essai donnait une
  teinte à chaque section du menu (indigo, violet, rose, laiton) — retiré à la
  demande du propriétaire, « trop de couleurs ». Reste l'indigo, une seule
  information : l'équipe s'occupe du véhicule. Les étapes disent qui doit agir
  (gris, indigo, ambre, vert). Avant, la marque disait deux états et le laiton
  un troisième : deux règles enfreintes.
- **Un halo est un dégradé radial, jamais un `filter: blur()`** : le flou d'un
  grand disque animé est l'effet le plus cher qu'un téléphone ait à composer
  pendant un défilement. `radial-gradient(closest-side, couleur 30%,
  transparent)` donne le même rendu.
- **Un lien sans règle prend la couleur du navigateur.** Aucune règle `a {}` :
  « Voir la file d'attente » s'affichait dans le bleu-violet de Chrome, la
  seule couleur de l'écran qui n'était pas la nôtre.
- **Brouillon des saisies longues** : `shared/brouillon/`, clé
  `vehora:<organisation>:…`, ignoré après 12 h, effacé à la réussite et à la
  déconnexion. L'inspection l'utilise ; ses photos ne survivent pas, l'écran
  le dit.
- Projet Supabase rattaché : `VEHORA` (`liragiqjtwlwqkfiyedk`, eu-west-3) —
  celui que servent `environment*.ts` et la CSP.
- 49 migrations appliquées. **Le MCP `apply_migration` horodate à
  l'application**, pas au nom du fichier : renommer le fichier (avant commit)
  avec la version enregistrée, sinon la CLI Supabase rejouerait la migration.
  Référentiel : 10 rôles, 37 permissions, 9 types de véhicules, 10 zones
  d'inspection, 15 transitions de dossier.
- **Le Super Admin n'a AUCUNE policy de lecture sur les données clientes.**
  Jamais de `or vehora.is_platform_admin()` sur une table métier. Il pilote par
  les vues `platform_*` (agrégats et métadonnées) et des fonctions privilégiées
  qui vérifient leur droit et auditent. Douze assertions le vérifient table par
  table — elles doivent tomber si la règle est franchie.
- **Les vues `platform_*` sont `SECURITY DEFINER` et portent leur garde-fou dans
  leur corps** (`where vehora.is_platform_admin()`). C'est assumé : en
  `security_invoker` elles ne renverraient rien. `supabase/tests/00_platform_views.sql`
  échoue si le filtre disparaît ou si `anon` retrouve la lecture — ce test ne
  doit jamais être désactivé.
- **La plateforme ne voit pas le chiffre d'affaires des clients**, seulement des
  volumes. Le CA appartient au client ; les revenus de VEHORA sont ses
  abonnements, dans leurs propres tables. Ne jamais additionner les deux.
- **Une suspension agit en deux temps** : `session_revocations` immédiatement
  (les écritures s'arrêtent dans la seconde), puis le hook refuse d'émettre des
  claims pour une organisation suspendue (les lectures s'arrêtent au
  renouvellement du token). Écrire `status = 'SUSPENDED'` seul ne coupe rien.
- **L'espace de plateforme est un arbre de routes séparé** (`/plateforme`), avec
  sa coquille, sa navigation et ses gardes. Deux gardes symétriques : un client
  n'y entre pas, un compte de plateforme ne descend pas dans l'espace client.
- **Un reçu est un constat, comme une inspection.** `receipts.contenu` porte une
  copie figée du dossier (lignes, paiements, identités, totaux) : renommer une
  prestation ne change aucun reçu émis. Aucune policy d'écriture ; l'émission
  passe par `emettre_recu()`, un trigger refuse tout UPDATE et DELETE, et la
  correction est un nouveau reçu qui référence l'ancien, une seule fois.
- **La numérotation par UPSERT sur un compteur est sans trou** : le verrou de
  ligne est pris dans la transaction qui écrit, un échec annule l'incrément.
  Cela vaut pour les dossiers comme pour les reçus, et dément une note écrite en
  phase 9. Un trou n'apparaîtrait que si le numéro était pris dans une
  transaction séparée qui commite avant.
- **Encaisser n'est pas savoir combien la station encaisse.** Les rapports sont
  en SECURITY INVOKER *et* exigent `reports.read` — quatre rôles l'ont. Une
  période inversée ou de plus de 366 jours est refusée avant toute requête.
- **Ne jamais limiter une requête dont on filtrera le résultat côté client.**
  Deux occurrences trouvées le même jour, toutes deux silencieuses : les vues
  agrégées de la file lues en bloc `limit(200)` (le dossier le plus récent
  tombait hors réponse et s'affichait « Impayé » alors qu'il était réglé), et
  les opérations lues « les 200 plus anciennes » avant filtrage (l'écran se
  vidait). On filtre sur le serveur, ou on lit pour les identifiants chargés.
- **Un feature flag se résout en base**, du plus précis au plus général :
  organisation → plan → défaut. Une clé inconnue est fermée. Le frontend lit le
  résultat et masque — **un flag qui n'empêche rien n'est pas un flag** : la
  fonction serveur vérifie aussi (`fonctionnalite_active`).
- **`flag_actif(cle, org)` reste fermée à `authenticated`** : elle prend une
  organisation en paramètre, donc l'ouvrir laisserait sonder le voisin. Seule
  `public.fonctionnalite_active(cle)`, qui n'en prend pas, est exposée. Une
  fonction SECURITY INVOKER ne peut appeler que ce que l'appelant peut appeler.
- **Les quotas de plan sont des déclencheurs**, pas des affichages. `null` =
  sans limite, jamais zéro. Un plan plus étroit que l'usage réel est refusé : le
  quota s'applique à ce qu'on ajoute, pas à ce qui tourne déjà. Les
  organisations antérieures gardent un plan large ; les nouvelles naissent en
  essai par un déclencheur sur `organizations`.
- **Ni la grille tarifaire, ni les abonnements, ni les dérogations ne sont
  lisibles par un client** : aucune policy pour `authenticated`. Il interroge
  `mon_abonnement()` et `mes_fonctionnalites()`, qui ne parlent que de lui.
- **Paiement, mouvement de caisse et session de caisse sont trois choses.**
  Les espèces génèrent un mouvement, le Mobile Money non, un achat de savon est
  un mouvement sans paiement. Le mouvement est écrit par la base : pouvoir
  écrire l'un sans l'autre, c'est pouvoir faire disparaître de l'argent.
- **La file de notifications est prête ; rien n'est envoyé.** Le drapeau
  `notifications` est fermé par défaut et pour tous les plans, et l'écran
  `/messages` le dit en toutes lettres — un écran qui ne s'explique pas fait
  douter du reste. `docs/notifications.md` dit ce qui reste à brancher.
- **Le message est composé par la base, jamais par un utilisateur.** Un SMS
  partant au nom de la station avec un texte choisi par quelqu'un, c'est un
  canal d'hameçonnage offert (« Envoyez 50 000 F au 77… pour récupérer votre
  véhicule », signé du lavage). Le texte ne porte que le nom de l'organisation
  et le numéro du dossier. Aucune policy d'insertion ni de mise à jour sur
  `notifications` : la base met en file, `annuler_notification()` renonce avec
  motif et audit, et une notification annulée reste dans la liste.
- **Le destinataire est figé dans la ligne** au moment de la mise en file : si
  le client change de numéro, on sait où le message est parti.
- **Un refus de notification se respecte dans le trigger**, pas à l'écran :
  `customers.accepte_notifications`, et rien n'est mis en file pour qui a refusé
  ou n'a pas de numéro.
- **Une étape ne notifie qu'une fois, et c'est l'index qui le garantit** — pas
  la matrice des transitions. Ouvrir une transition est une ligne à insérer :
  un invariant ne doit pas dépendre de ce qu'on n'a pas encore ouvert.
- **Un bandeau rouge dit que quelque chose est cassé.** « Aucun message n'est
  envoyé » est une information, pas une erreur : elle a d'abord été affichée en
  rouge, et l'état vide répétait la même phrase juste en dessous.
- **Une facture est un constat, et elle appartient à la plateforme.** Elle fige
  le nom de l'organisation, le code du plan et le montant : renommer une
  organisation ou changer un tarif ne modifie aucune facture émise. Aucune
  policy d'écriture, un trigger refuse UPDATE et DELETE, l'annulation est un
  état avec motif — jamais une suppression. Le client n'a aucune policy de
  lecture : il interroge `mes_factures()`, qui ne prend aucun paramètre.
  **Le revenu de VEHORA n'est jamais le chiffre d'affaires d'une station.**
- **Une échéance dépassée est un état (`PAST_DUE`), pas une sanction.** La
  suspension reste une décision prise ailleurs et auditée : confondre les deux,
  c'est couper un client pour un virement en retard de deux jours.
- **Un plan gratuit ne produit pas de facture à zéro** : ce serait du bruit à
  classer, relancer et expliquer.
- **Aucun paiement ne se modifie ni ne se supprime** : la correction est un
  remboursement qui le référence, avec motif, plafonné au montant reçu, et de
  la même méthode.
- **L'écart de caisse d'une personne ne regarde pas son collègue.** La lecture
  d'une session est personnelle : la sienne, ou toutes avec `cash.reconcile`
  (« valider un écart »), que le rôle CASHIER n'a pas. Même règle sur
  `cash_transactions` — les mouvements portent les mêmes montants, session par
  session, et la porte de derrière vaut la porte d'entrée.
  `public.cash_register_history` est en SECURITY INVOKER : elle ne rend que ce
  que cette policy laisse voir.
- **L'écart de caisse est calculé, jamais saisi** (`déclaré − théorique`), la
  clôture passe par `cloturer_caisse()`, et une session clôturée est immuable.
- **Restituer avec un solde** exige `payments.refund` + un motif, et c'est
  audité — sauf en `STRICT`, où c'est refusé. Un caissier ne l'accorde pas.
- **`vh-confirmation` accepte un champ projeté** (`<ng-content>`) et un
  `desactive` : un motif ou une référence que l'action exige se saisit **dans**
  la boîte. Le demander ailleurs obligerait à fermer pour saisir, puis rouvrir.
- **Une modale fige la page derrière elle** (`ScrollLockService`) : sinon on
  perd sa place dans la file en encaissant. `vh-confirmation` pose et lève le
  verrou lui-même — l'appelant n'a rien à gérer.
- **Jamais `confirm()`, `prompt()` ni `alert()`.** Une boîte native n'est ni
  dans le thème ni dans la langue, bloque le fil d'exécution, et **aucune
  assertion ne peut la lire** : quatre confirmations n'étaient testées par rien.
  Utiliser `shared/ui/confirmation.component.ts`, dont le bouton porte l'action
  (« Archiver », « Suspendre »), jamais « OK ».
- **Les styles de modale vivent dans `src/styles/_base.css`**, une seule fois.
  Recopiés dans dix feuilles, ils avaient déjà divergé sur trois propriétés.
  Un composant n'y met que son écart réel.
- **Deux contrôles ne portent jamais le même nom accessible** dans une même
  boîte de dialogue — la croix s'appelle déjà « Fermer ».
- **Un employé n'est pas un utilisateur.** `employees.profile_id` est nullable
  et le reste dans le cas courant. Les opérations référencent `employee_id` :
  l'historique de travail survit au départ de la personne et à la suppression
  de son compte. On désactive un employé, on ne le supprime pas.
- **Assigner n'est pas exécuter** : deux permissions sur deux colonnes de la
  même ligne. Une policy ne voit pas quelle colonne a changé — c'est un trigger
  qui tranche. Règle générale pour toute table où deux droits se partagent une
  ligne.
- **Une policy d'écriture sans restriction de colonne ouvre toute la ligne.**
  `owners update own organization` laissait un propriétaire écrire `currency` :
  rien n'est converti, donc 60 000 F CFA devenaient 60 000 € jusque dans les
  reçus déjà remis. Aussi `slug` (l'identité) et `status` (se réactiver soi-même
  annulait une suspension). Fermé par `vehora.protect_organization()`, qui doit
  être **SECURITY INVOKER** : en `SECURITY DEFINER`, `current_user` vaut le
  propriétaire de la fonction et le garde-fou laisse tout passer. Deuxième
  occurrence de « une policy ne voit pas quelle colonne a changé ».
- **Un trigger de protection doit se taire quand l'écriture vient d'une
  cascade.** **Quatre incidents** (dernier propriétaire en phase 1, opérations
  en phase 10, journal d'audit en phase 14, reçus — latent depuis la phase 13,
  trouvé en phase 20 : aucune organisation ayant émis un reçu n'était
  supprimable). La règle écrite n'a empêché aucun des trois suivants. Ce qui
  l'a trouvée la quatrième fois : une assertion qui supprime une organisation
  **réelle**, avec ses dossiers, ses paiements, ses reçus et ses factures — pas
  une organisation vide. `audit_logs` et `invoices` référencent `organizations`
  en `ON DELETE SET NULL` (la cascade demande un UPDATE), `receipts` en
  `ON DELETE CASCADE` (elle demande un DELETE). **Repère sans drapeau** : lors
  d'une cascade, PostgreSQL supprime la ligne parente **avant** les filles — si
  le parent n'existe plus, l'écriture vient de la cascade.
- **Une action que le serveur refusera ne s'affiche pas comme possible** :
  bouton inerte et raison visible, jamais un clic qui échoue. Trois occurrences
  (prestation sans tarif, opération non assignée, plan déjà en cours). De même,
  **on ne lance pas une requête qu'on sait refusée** : le tableau de bord ne
  demande le chiffre du jour que si la permission et la fonctionnalité sont là.
- **Un total qui vaut la taille de la page n'est pas un total.** L'historique de
  caisse a annoncé « 200 sessions clôturées » alors que la période en contenait
  davantage : c'était la limite de la requête, présentée comme un décompte.
  Quand la page est pleine, le dire et pourquoi.
- **`formaterDate` accepte un jour ou un horodatage.** Elle n'acceptait que
  `AAAA-MM-JJ` et rendait la chaîne d'origine sinon : l'historique de caisse a
  affiché `2026-09-18T18:10:21.262904+00:00` à l'écran. Rendre l'entrée telle
  quelle évite une page cassée, mais ne doit jamais devenir une sortie
  silencieuse.
- **Un total dont le détail ne fait pas la somme** fait douter du reste de
  l'écran : afficher tous les statuts, ou ne pas afficher de total.
- **Un écran qui promet une fonctionnalité doit être relu quand elle arrive.**
  Le tableau de bord a annoncé pendant sept phases que les prestations
  « seraient bientôt disponibles » alors qu'elles tournaient.
- **Le statut d'un dossier ne se change que par `transitionner_dossier()`.** Un
  trigger rejette tout autre `UPDATE`, `service_role` compris. Le drapeau de
  transaction porte l'identifiant du dossier : un booléen aurait laissé une
  transition légitime en couvrir une autre dans la même transaction.
- **La matrice des transitions est une table** (`service_order_transitions`),
  pas un `case`. Ouvrir une transition = insérer une ligne.
- **Le prix est copié dans la ligne de dossier**, à la date d'ouverture du
  dossier — pas à celle du jour. Modifier un tarif ne modifie aucun dossier
  existant. Le client n'envoie ni montant, ni devise, ni nom de prestation.
- **`EXECUTE` est accordé à `PUBLIC` par défaut sur toute fonction PostgreSQL.**
  Un `grant … to authenticated` n'enlève rien. Toute fonction exposée dans
  `public` doit être **révoquée de `public` et `anon`** explicitement.
- **PostgREST ne joint pas une vue agrégée** : sans clé étrangère déductible,
  pas de jointure. Lire la vue par une requête séparée.
- **Le prix est déterminé par le serveur** (`resoudre_prix`), du plus spécifique
  au plus général. Aucun tarif trouvé = aucune ligne, jamais un zéro implicite.
  Le client n'envoie jamais un montant ni une devise : un trigger impose celle
  de l'organisation.
- **Montants en entiers** (`amount_minor bigint`), jamais de `float`. Le nombre
  de décimales vient d'`Intl`, pas d'une constante : XOF n'en a pas, EUR en a
  deux. À l'écran, le symbole (« F CFA »), jamais le code ISO.
- **Un tarif ne s'écrase pas.** On ferme l'ancien la veille et on ouvre le
  nouveau, en une transaction (`remplacer_tarif`) : deux écritures depuis le
  navigateur peuvent être coupées au milieu, et la prestation se retrouverait
  sans tarif, donc invendable.
- **Un champ `<input type="date">` s'affiche dans la locale de l'appareil**, pas
  dans celle de la page : `09/13/2026` sur un Android en anglais. Toute date qui
  engage quelque chose est aussi écrite en toutes lettres à côté du champ.
- **Storage** : bucket `inspections` privé, chemin imposé
  `{organization_id}/{inspection_id}/{fichier}` — les policies ne comparent que
  le premier segment. Types limités à JPEG/PNG/WebP : **le SVG est exclu**, c'est
  du XML exécutable. Accès par URL signée courte, jamais publique.
- Une inspection est un **constat daté** : aucune policy UPDATE ni DELETE.
  Une erreur se corrige par une nouvelle inspection.
- **Une policy vérifie la ligne, pas ce qu'elle référence.** Toute clé
  étrangère vers une table multi-tenant demande un trigger de cohérence
  (`stations`↔`memberships`, `vehicles`↔`customers`).
- **Les numéros de téléphone sont normalisés par trigger** en forme
  internationale, à partir du pays de l'organisation. Ne jamais écrire
  `phone_digits` depuis le client, ni comparer des numéros bruts.
- Deux points d'entrée privilégiés volontairement exposés :
  `provisionner_organisation()` et `accepter_invitation()`. Ils vérifient
  eux-mêmes leurs conditions et auditent. **Ne pas révoquer leur EXECUTE** :
  l'advisor Supabase les signale, c'est un choix documenté en base.
- **`organization_id` est rempli par la base depuis le JWT** sur les tables qui
  le permettent : le client ne l'envoie pas, donc ne peut pas le falsifier.
  Appliquer le même principe à chaque nouvelle table métier.
- Custom access token hook **activé** sur `vehora.custom_access_token_hook`.
- **Un tableur exécute une cellule qui commence par `=`, `+`, `-`, `@`, une
  tabulation ou un retour chariot.** Un nom de prestation est saisi par un
  utilisateur : `=HYPERLINK(…)` partirait dans l'export et s'exécuterait chez le
  comptable. Ce n'est pas une faille de la base — la RLS a fait son travail —
  c'est une faille du fichier produit, et aucune assertion SQL ne la voit.
  `shared/export/csv.ts` désamorce ; ne jamais fabriquer un CSV ailleurs.
  Séparateur `;` et décimale à la virgule (Excel français), BOM UTF-8 (sinon
  « Libert� 6 ») — le seul BOM volontaire du projet. Les montants partent en
  unité principale avec une colonne « Devise » : dans un fichier qu'on trie et
  qu'on additionne, le code ISO est le bon choix, contrairement à l'écran.
- **Un test qui cherche un MOT trouve sa propre documentation.** « Aucune clé
  `service_role` dans le bundle » cherchait la chaîne `service_role` : elle est
  dans le commentaire d'`environment.ts` qui dit justement que cette clé ne doit
  jamais s'y trouver. Vert en local par un hasard de chargement, rouge dès que
  l'intégration continue a servi le bundle à froid. On cherche désormais une
  **clé** : le préfixe `sb_secret_`, et tout JWT dont la charge utile décodée
  porte `service_role`. Un garde-fou qui crie au loup discrédite les autres.
- **Sans les secrets `VEHORA_TEST_*` dans GitHub, la CI ignore 246 tests sur
  258 et met 17 secondes** : exactement le « skipped massif qui ressemble à un
  succès ». Les déclarer est la première chose à faire pour que l'intégration
  continue garde quelque chose.
- **Premier test unitaire** : `npm run test:unit` (`scripts/verifier-csv.mjs`,
  16 assertions). Node exécute le TypeScript tel quel depuis la 23.6 : un module
  sans réseau ni DOM se vérifie sans navigateur, en quelques millisecondes.
- **Intégration continue** : `.github/workflows/verification.yml` rejoue types
  (app **et** tests), build avec budgets, migrations et assertions SQL, et
  parcours Playwright, à chaque poussée. Trois travaux séparés : un échec de
  type ne doit pas cacher une policy cassée. Les campagnes d'intrusion n'y sont
  pas — elles écrivent dans la base réelle et se gêneraient entre exécutions.
  Sans les secrets `VEHORA_TEST_*`, la suite connectée s'ignore en bloc.
- **Déploiement : `vehora.magyapro.com`, en démonstration/préproduction.**
  `vercel.json` porte tout (réécriture SPA — sans elle `/caisse/historique`
  renvoie un 404 —, cache immuable sur les fichiers versionnés et `no-cache` sur
  `index.html`, en-têtes de sécurité, CSP). Marche à suivre complète dans
  `docs/deploiement.md`. **Ce déploiement sert les données de développement** :
  bon pour montrer le produit, jamais pour encaisser l'argent d'un vrai client.
  `public/robots.txt` et `X-Robots-Tag: noindex` le tiennent hors des moteurs —
  à retirer le jour d'un vrai domaine de production.
- **Sur Cloudflare, le nuage doit rester GRIS** (DNS only) pour le CNAME vers
  Vercel : proxifié, Vercel ne valide pas le domaine ni son certificat, et le
  symptôme (boucle de redirection, certificat qui n'arrive jamais) envoie
  chercher ailleurs.
- **Auth ignore le nouveau domaine tant qu'on ne le lui dit pas.** Site URL et
  Redirect URLs dans Supabase : sans ça, les liens de réinitialisation de mot de
  passe pointent vers `localhost` et l'utilisateur n'arrive nulle part.
- **La CSP porte l'hôte Supabase en dur** (`connect-src`, `img-src`) : il change
  **en même temps** que `environment.prod.ts` le jour d'un projet de production.
  L'oublier donne une application qui s'affiche et ne charge rien.
  `npm run test:csp` sert le build réel avec l'en-tête réel et échoue à la
  moindre violation — il a trouvé que l'inlining du CSS critique d'Angular pose
  un `onload=` en ligne, que la CSP refuse
  (`optimization.styles.inlineCritical: false` depuis).
- `src/environments/environment.prod.ts` remplace `environment.ts` au build.
  **Il pointe sur le projet de développement**, ce qui est le choix assumé de la
  préproduction ; la production réelle demande un second projet Supabase, les
  migrations rejouées, le hook activé, et les comptes de démonstration absents.
- Application Angular 22 : connexion, gardes, coquille applicative
  (barre latérale desktop, tiroir et barre basse mobile), thème sombre/clair.
- **Thème par défaut : sombre**, jamais « système » — la plupart des appareils
  sont en clair et l'application démarrerait à contre-identité.
- Parcours connecté vérifié de bout en bout ; **257 tests Playwright** (4,5 min),
  **326 assertions SQL**, et des campagnes d'intrusion par l'API réelle
  (`scripts/intrusion-abonnements.mjs`, 26 assertions ;
  `scripts/intrusion-recus.mjs`, 24 ;
  `scripts/intrusion-plateforme.mjs`, 20 ;
  `scripts/intrusion-caisse.mjs`, 25 ;
  `scripts/intrusion-operations.mjs`, 17 ; `scripts/intrusion-dossiers.mjs`, 23 ;
  `scripts/intrusion-catalogue.mjs`, 21 ;
  `scripts/intrusion-historique-caisse.mjs`, 11 ;
  `scripts/intrusion-facturation.mjs`, 24 ;
  `scripts/intrusion-notifications.mjs`, 12 ;
  `scripts/intrusion-parametres.mjs`, 14 (écrite en phase 23, pas encore jouée) ;
  14 sur le stockage).
- **Une connexion par rôle, pas une par test.** `e2e/global-setup.ts` se connecte
  une fois par rôle et enregistre l'état (`storageState`) dans `e2e/.etats/`,
  effacé à chaque exécution et ignoré par Git. La suite est passée de 10,3 à
  3,4 minutes, et la limite de débit de Supabase Auth ne refuse plus rien.
- **Une assertion d'absence sur une page qu'on n'a pas ouverte passe toujours.**
  Deux faux verts découverts en retirant les connexions locales : les tests
  tournaient sur `about:blank`, et `toHaveCount(0)` y est toujours vrai. Tout
  test qui vérifie qu'une chose n'est pas là établit d'abord qu'il est au bon
  endroit. De même, `isVisible()` sur un élément pas encore rendu répond
  « non » sans erreur : attendre la coquille avant d'interroger la navigation.
- **Node n'achemine plus `fetch` par le proxy sans `NODE_USE_ENV_PROXY`**, et il
  lit la variable **au démarrage du processus**. Sans elle, en cloud, toute
  connexion Supabase depuis Node échoue en `Service Unavailable` **503 émis par
  le proxy** — un message qui accuse Supabase alors que Supabase répond. D'où
  `npm run e2e` (et non `npx playwright test`), qui relance Playwright dans un
  processus fils correctement configuré ; `e2e/proxy-node.ts` et
  `scripts/proxy-node.mjs` échouent en nommant la cause si le drapeau manque.
- **`npm run validate:sql` se relance sous un compte non privilégié** : en
  conteneur on est root, et PostgreSQL refuse de démarrer sous root.
- **Un test ne doit pas modifier l'état que d'autres tests lisent**, ni épingler
  un numéro qui avance. `e2e/fixtures.ts` monte un dossier par l'API réelle ;
  chaque test qui fait avancer quelque chose crée le sien et le referme.
- **Une ressource unique par (station, utilisateur) — la caisse — casse le
  parallélisme.** Une station par projet Playwright, et `mode: 'serial'` dans
  le fichier : les deux sont nécessaires, sinon l'échec tombe au hasard. Même
  règle pour l'espace plateforme : une organisation de test par projet.
  **`mode: 'serial'` ne sérialise qu'à l'intérieur d'un fichier** : un test qui
  prend une ressource unique appartient au fichier qui la possède déjà.
- **`scripts/validate-sql.sh` doit refléter Supabase, pas l'arranger.** Deux
  fois il a masqué un défaut : les `grant … on all tables` rejoués après les
  migrations (phase 12), et un `alter default privileges … grant execute … to
  authenticated` dans le schéma `vehora` (phase 14) — Supabase n'en pose pas,
  c'est le défaut PostgreSQL (`EXECUTE` à `PUBLIC`) qui ouvre ces fonctions, et
  un droit explicite survit au `revoke … from public` d'une migration. Ne
  remettre ni l'un ni l'autre.
- **Une fixture qui contourne l'écran cache l'écran cassé.** Le parcours
  arrivée → inspection → attente passait depuis la phase 8 : sa fixture créait
  l'inspection par l'API, déjà rattachée au dossier. L'écran, lui, ne la
  rattachait pas — un dossier réel est resté neuf jours à l'inspection. Un
  parcours se teste par les gestes de l'utilisateur ; une fixture ne prépare
  que ce qui précède l'étape testée.
- **Une règle de parcours est un invariant sur la donnée** (déclencheur), pas
  une condition d'une ligne de la matrice : pas d'attente sans prestation, pas
  de « prêt » avec une opération ouverte, pas d'annulation avec de l'argent
  reçu non rendu (`vehora.check_dossier_statut()`). Chaque règle tenue par un
  seul chemin avait un autre chemin qui la contournait.
- **Les boutons d'étape viennent de la matrice** (`service_order_transitions`),
  filtrés par permission et réglage ; une étape impossible reste visible,
  inerte, avec sa raison. Codés en dur, ils proposaient ce que la base refusait.
- **Zéro ligne touchée n'est pas une erreur pour PostgREST.** Une mise à jour
  ou une suppression filtrée demande ce qu'elle a touché (`.select('id')`)
  avant d'annoncer une réussite.
- **Une sortie d'espèces s'inscrit dans le tiroir d'où sort l'argent**
  (ADR-006). Un remboursement désigne une caisse ouverte de la station du
  dossier (défaut : celle qui a reçu le paiement, sinon la sienne) ; un
  encaissement ne choisit jamais ; un mouvement libre s'écrit dans **sa**
  caisse. Écrire dans la caisse d'un autre n'est possible qu'en remboursant,
  avec `payments.refund`, et c'est audité et visible dans la caisse touchée.
- **Une référence de caisse est une clé multi-tenant comme les autres.**
  `cash_transactions.cash_register_id` n'était vérifié par rien : une autre
  organisation pouvait écrire dans la caisse d'un client, et `cloturer_caisse`
  (SECURITY DEFINER) comptait ce que la RLS cachait. Troisième occurrence de
  « une policy vérifie la ligne, pas ce qu'elle référence ».
- **Le connecteur Supabase demande une confirmation avant toute instruction
  destructrice** (`DROP`, `DELETE`). Dans une session cloud, cette demande
  n'arrive pas au propriétaire : l'outil expire à 60 s **sans rien exécuter**
  (quatre essais, aucune trace dans PostgreSQL). Ne jamais réécrire une
  migration pour échapper à ce garde-fou : faire exécuter par le propriétaire
  dans l'éditeur SQL, ou obtenir sa confirmation.
- **Le logo est un fichier** (`public/marque.svg`, favicons, icône d'écran
  d'accueil), pas un dessin recopié : ses couleurs sont celles de la marque,
  hors jetons de thème, et le contrôle des jetons refuse une couleur en dur dans
  `src/`. L'audit ne regardait aucune image : il a déclaré vert un logo cassé
  sur tous les écrans (serveur de test sans type `image/svg+xml`). Il signale
  désormais toute image chargée sans pixels.
- **Une exception attrapée en PL/pgSQL annule tout ce que son bloc a écrit.**
  Préparer les données hors du bloc qui attend l'échec, sinon la disparition se
  paie des dizaines de lignes plus loin. **Deux occurrences** : la règle écrite
  n'a pas empêché la seconde.
- **Leçon récurrente** : vingt-quatre défauts d'interface (trente et un depuis
  la phase 24 : file, caisse, catalogue, opérations et organisations sans
  styles, réussite en rouge, « QtéMontant » sur le reçu) (thème par défaut, sélecteur
  de rôle, affichage des numéros, groupement des chiffres, débordement de
  modale, actions sur deux lignes, deux mises en page pour la même liste, date
  au format américain, code ISO au lieu du symbole, erreur affichée nulle part,
  bouton sans effet sur formulaire invalide, station absente de la file,
  prestation sans tarif proposée quand même, « Démarrer » proposé sans employé,
  dossier resté en attente au démarrage du travail, opération démarrée par
  erreur sans retour possible, page qui défile sous une modale, deux boutons
  « Fermer » dans la même modale, champ montant vidé au lieu de proposer le
  reste, solde périmé derrière la modale, « 0 personne perdront l'accès »,
  navigation recouvrant le bandeau, intitulé de colonne tronqué, « dernière
  activité aucune activité ») ont échappé aux tests et se sont vus à l'écran. Sur un écran, une
  assertion doit décrire ce que l'œil doit voir. **Capturer l'écran fait partie
  de la validation d'une phase d'interface.**
- **Échec silencieux de formulaire** : deux occurrences (invitation, véhicule).
  La règle est dans `vehora-frontend` — désactiver l'ouverture tant que la
  donnée asynchrone manque, défaut par `effect`, message explicite sinon.
- **Pas de nombre magique partagé entre composants.** La hauteur de la barre
  basse était recopiée à deux endroits avec deux valeurs différentes : token
  `--vh-nav-basse`. Toute mesure utilisée par plus d'un composant devient un
  token. **Deuxième occurrence** : les styles de modale, recopiés dans dix
  feuilles et divergents sur trois propriétés (phase 15).
- **`database.types.ts` est la sortie BRUTE du générateur** depuis la phase 22 :
  on le **régénère**, on ne le complète jamais à la main. Il a prétendu être
  généré pendant treize phases sans l'être, et le coût s'est payé en blocs
  `Relationships` incomplets — ce sont eux qui typent les jointures PostgREST,
  et leur absence produit un message qui accuse la base. Quatre incidents.
- **L'écart entre le schéma et le contrat d'exécution vit dans
  `src/app/types/frontiere.ts`**, nommé une fois, jamais dans les types générés.
  Trois écarts, trois seulement : `rempliParLaBase` (les colonnes que la base
  pose — `organization_id`, `currency`, `number`, `unit_amount_minor` : le
  générateur a raison sur le schéma et tort sur le contrat, et les envoyer
  depuis le navigateur les rendrait falsifiables) ; `ligneDeVue` /
  `uneLigneDeVue` (une vue ne propage pas `NOT NULL`, tout revient `| null`) ;
  `nullAccepte` (un paramètre SQL qui accepte `NULL` mais que le générateur type
  non nullable — `p_actif = null` retire une dérogation, c'est un troisième
  état, pas une absence). Un quatrième écart signalerait plutôt un changement de
  règle serveur.
- **Un paramètre SQL facultatif se passe `undefined`, jamais `null`** : omettre
  l'argument laisse PostgreSQL appliquer son `DEFAULT`, qui vaut précisément
  `null`.
- **`npm run types:check` ne vérifie pas les gabarits Angular.** Une erreur de
  type dans un `.html` n'apparaît qu'au `ng build` — les deux sont dans
  l'intégration continue, dans cet ordre.
- Le jeu de démonstration a **deux stations** (Liberté 6, Ouakam) : les tests
  de caisse en dépendent, et l'affichage multi-station aussi.
- Comptes de démonstration (à supprimer avant production) : `awa@vehora.test`
  (OWNER), `ousmane@vehora.test` et `ibrahima@vehora.test` (CASHIER),
  `fatou@vehora.test` (OWNER d'une seconde organisation),
  `sansorg@vehora.test` (volontairement sans organisation — ne jamais le
  rattacher, des tests en dépendent),
  `admin@vehora.test` (SUPER_ADMIN, adhésion à l'organisation technique
  `vehora-platform`). Deux organisations `Test plateforme mobile|desktop`
  servent aux tests de suspension — ne pas les supprimer.
- Tests connectés : exporter `VEHORA_TEST_EMAIL` / `VEHORA_TEST_PASSWORD` et
  `VEHORA_TEST_EMAIL_CAISSIER` / `VEHORA_TEST_PASSWORD_CAISSIER`,
  sinon la suite est ignorée. En cloud, `e2e/relais-reseau.ts` rejoue les appels
  Supabase depuis Node — le proxy coupe le tunnel du navigateur.
- **Le rôle métier est porté par le claim `vehora_role`**, jamais `role` —
  ce dernier appartient à Supabase et détermine le rôle PostgreSQL de la
  session. Ne jamais réutiliser un nom de claim réservé.
