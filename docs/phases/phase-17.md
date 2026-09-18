# Phase 17 — Dette d'outillage : une session par rôle, un proxy nommé

## Pourquoi cette phase

Rien de neuf côté produit. La phase 16 laissait deux dettes qui coûtaient à
chaque exécution : la suite de parcours se reconnectait à chaque test (quinze
fichiers, deux projets, deux cent trente-deux tests → autant de connexions,
10,3 minutes, et des refus de la part de la limite de débit de Supabase Auth),
et l'environnement cloud faisait échouer toute connexion Supabase depuis Node
avec un message qui accusait Supabase à tort.

## Ce qui a été fait

### Une connexion par rôle, pas une par test

- `e2e/session-partagee.ts` — les quatre rôles de test (`proprietaire`,
  `caissier`, `admin`, `sans-org`), leurs identifiants, le fichier d'état
  correspondant et la page où chacun doit atterrir.
- `e2e/global-setup.ts` — une connexion par rôle avant la suite, par l'écran
  réel, et l'état de session enregistré dans `e2e/.etats/` (ignoré par Git).
  Le dossier est effacé à chaque exécution : un jeton périmé réutilisé
  silencieusement ferait échouer des tests pour une raison étrangère à ce
  qu'ils vérifient. Une connexion qui échoue nomme le rôle, l'adresse et le
  message affiché à l'écran.
- Les quinze fichiers de test déclarent `test.use({ storageState: etat(...) })`
  et n'ont plus de fonction de connexion locale.

**Résultat : 10,3 minutes → 3,4 minutes**, et plus aucun refus de la limite de
débit d'authentification.

### Le proxy qui accusait Supabase

Depuis que `fetch` est natif, Node n'achemine plus ses requêtes par le proxy de
l'environnement sans `NODE_USE_ENV_PROXY`, et il lit cette variable **au
démarrage du processus**. Sans elle, en cloud, toute connexion Supabase depuis
Node échoue avec un `Service Unavailable` **503 émis par le proxy** — un message
qui désigne Supabase alors que Supabase répond parfaitement (vérifié : la même
connexion aboutit en `curl`, et le projet est `ACTIVE_HEALTHY`).

- `scripts/e2e.mjs` — `npm run e2e` relance Playwright dans un processus fils
  qui naît avec la variable. La poser depuis `playwright.config.ts` ou depuis un
  module de test arrive trop tard.
- `e2e/proxy-node.ts` — importé avant le premier `fetch` : si un proxy est
  détecté sans le drapeau, il **échoue en nommant la cause** au lieu de laisser
  chercher une panne qui n'existe pas.
- `scripts/proxy-node.mjs` — même garde pour les sept campagnes d'intrusion.

### `validate:sql` sous root

PostgreSQL refuse de démarrer sous root, et le conteneur cloud est root :
`npm run validate:sql` échouait à `initdb`. Le script se relance désormais sous
un compte non privilégié.

### Deux faux verts découverts par le remaniement

En retirant les connexions locales, trois `beforeEach` se sont retrouvés sans
navigation : les tests s'exécutaient sur `about:blank`. Quatre ont échoué
franchement — mais **deux autres passaient**, parce qu'ils vérifient une
absence (`toHaveCount(0)`), et qu'une page vide ne contient rien.

> **Une assertion d'absence sur une page qu'on n'a pas ouverte passe toujours.**
> Tout test qui vérifie qu'une chose n'est pas là doit d'abord établir qu'il est
> au bon endroit.

Corrigés dans `stations.spec.ts` et `tableau-de-bord.spec.ts`.

Un troisième défaut de même famille : sur mobile, `isVisible()` interrogé sur un
bouton pas encore rendu répond « non » sans erreur, et le clic suivant échoue
pour une raison étrangère au test. La coquille est maintenant attendue d'abord.

## Validation

| Contrôle | Résultat |
|---|---|
| `npm run types:check` (app et tests) | ✅ |
| `npm run build` | ✅ budgets respectés |
| `npm run validate:sql` | ✅ 243 assertions |
| `npm run e2e` | ✅ **231 passés, 1 ignoré, 3,4 min** |
| 7 campagnes d'intrusion par l'API réelle | ✅ 156 assertions, tout bloqué |

Audit de sécurité : aucune surface nouvelle. La phase ne touche ni migration, ni
policy, ni fonction serveur, ni composant applicatif — uniquement l'outillage de
test et deux fichiers de script. Les états de session enregistrés contiennent de
vrais jetons : `e2e/.etats/` est ignoré par Git et effacé à chaque exécution.

## Reste à faire (propriétaire)

- Activer la protection contre les mots de passe divulgués dans Supabase.
- Supprimer les comptes de démonstration et les deux organisations
  `Test plateforme mobile|desktop` avant la production.
