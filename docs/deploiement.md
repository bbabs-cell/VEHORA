# Déploiement et exploitation

## Avant la première mise en production

Trois choses à faire dans l'ordre. Aucune n'est optionnelle.

### 1. Un projet Supabase distinct

Le projet `VAHORA` (`entpmxssjxllggsqhnwc`) sert au développement et aux tests :
la suite de parcours y crée et y clôture des dossiers, y ouvre des caisses, y
émet des reçus. Le laisser servir la production revient à laisser un test
toucher l'argent d'un vrai client.

1. Créer un second projet Supabase.
2. Y rejouer `supabase/migrations/` dans l'ordre, sans en sauter aucune.
3. Activer le custom access token hook sur `vehora.custom_access_token_hook` —
   **sans lui, aucun JWT ne porte de rôle ni de permission, et l'application
   entière se comporte comme si personne n'avait de droits.**
4. Reporter l'URL et la clé « publishable » dans
   `src/environments/environment.prod.ts`.
5. Activer la protection contre les mots de passe divulgués
   (Authentication → Policies → *leaked password protection*).

### 2. Supprimer les comptes de démonstration

Sur le projet de production, ils ne doivent pas exister. Sur le projet de
développement, **ils doivent rester** : la suite de parcours en dépend.

`awa@vehora.test`, `ousmane@vehora.test`, `ibrahima@vehora.test`,
`fatou@vehora.test`, `sansorg@vehora.test`, `admin@vehora.test`, et les deux
organisations `Test plateforme mobile|desktop`.

### 3. Le premier compte réel

Il n'y a pas d'inscription ouverte. Un compte naît par
`provisionner_organisation()` (première organisation, premier propriétaire) ou
par `accepter_invitation()`. Le Super Admin de plateforme, lui, se rattache à
l'organisation technique `vehora-platform`.

## Vercel

`vercel.json` est dans le dépôt. Il fixe :

- la commande de build et le dossier servi (`dist/vehora/browser`) ;
- la **réécriture SPA** : sans elle, ouvrir directement `/caisse/historique`
  renvoie un 404 — le serveur cherche un fichier qui n'existe pas. Le motif
  exclut les fichiers (tout ce qui porte une extension) pour ne pas servir
  `index.html` à la place d'un `.js` ;
- le cache : immuable sur les fichiers versionnés par leur nom, `no-cache` sur
  `index.html`. L'inverse sert une vieille application pendant un an ;
- les en-têtes de sécurité. `camera=(self)` est volontaire : l'inspection
  photographie les véhicules.

Aucune variable d'environnement n'est nécessaire côté Vercel : la configuration
publique est compilée dans le bundle par `fileReplacements`.

## Intégration continue

`.github/workflows/verification.yml` rejoue à chaque poussée et chaque pull
request :

| Travail | Ce qu'il vérifie |
|---|---|
| Types et build | types de l'application **et des tests**, build de production avec ses budgets |
| Migrations et assertions de sécurité | toutes les migrations rejouées sur un PostgreSQL jetable, puis les assertions de `supabase/tests/` |
| Tests de parcours | la suite Playwright, sur les deux projets (mobile et desktop) |

Les trois sont séparés à dessein : un échec de type ne doit pas cacher une
policy cassée.

### Secrets à déclarer

Sans eux, la suite connectée **s'ignore en bloc** — et un « skipped » massif
ressemble à un succès. `playwright.config.ts` l'affiche en avertissement.

`VEHORA_TEST_EMAIL`, `VEHORA_TEST_PASSWORD`,
`VEHORA_TEST_EMAIL_CAISSIER`, `VEHORA_TEST_PASSWORD_CAISSIER`,
`VEHORA_TEST_EMAIL_SANS_ORG`, `VEHORA_TEST_PASSWORD_SANS_ORG`,
`VEHORA_TEST_EMAIL_ADMIN`, `VEHORA_TEST_PASSWORD_ADMIN`.

Ils désignent les comptes de démonstration du projet de **développement**.
Jamais ceux de la production.

## Ce que l'intégration continue ne fait pas

- Elle ne joue pas les campagnes d'intrusion (`scripts/intrusion-*.mjs`) :
  elles écrivent dans la base réelle, et deux exécutions concurrentes se
  gêneraient. Elles se lancent à la main à la clôture d'une phase.
- Elle n'applique aucune migration à un projet Supabase. Une migration se
  pousse sciemment, jamais par un effet de bord d'un `git push`.
