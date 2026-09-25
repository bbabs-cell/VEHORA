# Déploiement

## En ligne aujourd'hui : `https://vehora.vercel.app`

Le projet Vercel existe et sert l'application. Vérifié le 25 septembre 2026,
depuis l'extérieur :

| Contrôle | Résultat |
|---|---|
| HTTPS public, sans protection de déploiement | ✅ |
| Réécriture SPA (`/caisse/historique` en accès direct) | ✅ 200 |
| En-têtes de sécurité et CSP | ✅ servis, aucune violation |
| `robots.txt` + `X-Robots-Tag: noindex` | ✅ |
| Cache `immutable` sur les fichiers versionnés | ✅ |
| Feuille de styles appliquée (`--vh-bg` lu à l'exécution) | ✅ |
| **Connexion réelle** (`awa@vehora.test`) → tableau de bord | ✅ claims lus (OWNER, 30 permissions) |

**Il reste une étape** : les URL d'Auth dans Supabase (partie 3 ci-dessous), avec
`https://vehora.vercel.app` pour valeur. La connexion par mot de passe fonctionne
sans elle ; les liens de réinitialisation, non.

Le sous-domaine `vehora.magyapro.com` s'ajoutera ensuite sans rien casser : les
deux adresses serviront la même application, et il suffira d'ajouter la seconde
URL dans Supabase sans retirer la première.

---

# Le sous-domaine — `vehora.magyapro.com`

Déploiement **de démonstration / préproduction** : sous-domaine
`vehora.magyapro.com`, DNS gérés par Cloudflare, et **le projet Supabase actuel
conservé**.

`magyapro.com` est déjà sur Vercel (projet `magya-pro`), et
`boutique.magyapro.com` y fonctionne : le plus sûr est d'ouvrir cet
enregistrement DNS et de le recopier pour `vehora`.

Ce choix a une conséquence qu'il faut assumer à voix haute :

> **Les données de ce déploiement sont celles du développement.** La suite de
> tests y crée et clôture des dossiers, y ouvre des caisses, y émet des reçus.
> Les comptes de démonstration y existent et leurs mots de passe sont dans ce
> dépôt. Ce site convient pour montrer le produit ; **il ne convient pas pour
> encaisser l'argent d'un vrai client.** Le passage en production réelle est
> décrit en dernière partie.

---

## 1. Vercel

### Le projet

1. Importer le dépôt GitHub `bbabs-cell/VEHORA` dans Vercel.
2. Branche de production : `claude/project-prompt-analysis-wdzoih` (ou `main`
   une fois la branche fusionnée).
3. **Ne rien configurer d'autre** : `vercel.json` porte déjà la commande de
   build, le dossier servi (`dist/vehora/browser`), la réécriture SPA, le cache
   et les en-têtes de sécurité. Laisser Vercel détecter le framework produirait
   une configuration concurrente.

Aucune variable d'environnement n'est nécessaire : la configuration publique
(URL et clé *publishable* Supabase) est compilée dans le bundle par
`fileReplacements`. La clé `service_role` n'y est pas, et ne doit jamais y être.

### Le domaine

Dans **Project → Settings → Domains**, ajouter `vehora.magyapro.com`. Vercel
affiche alors l'enregistrement DNS à créer.

---

## 2. Cloudflare

Dans la zone `magyapro.com` :

| Type | Nom | Contenu | Proxy |
|---|---|---|---|
| CNAME | `vehora` | `cname.vercel-dns.com` | **DNS only** (nuage **gris**) |

**Le nuage doit être gris.** Avec le proxy Cloudflare activé (orange), Vercel ne
peut pas valider le domaine ni émettre son certificat : il voit les adresses de
Cloudflare, pas les vôtres. Le symptôme est une boucle de redirection ou un
certificat qui n'arrive jamais, et on cherche longtemps ailleurs.

Si vous tenez au proxy Cloudflare plus tard, il faudra passer le mode SSL/TLS en
**Full (strict)** et accepter que le cache de Cloudflare se superpose à celui de
`vercel.json` — deux caches qui ne se connaissent pas.

Propagation : quelques minutes en général. Vercel passe le domaine en « Valid »
tout seul.

---

## 3. Supabase — la seule étape qu'on oublie

Le projet ne change pas, mais **Auth doit connaître la nouvelle adresse**.
Sans cela, les liens de réinitialisation de mot de passe et de confirmation
pointent vers `localhost` : l'utilisateur clique et n'arrive nulle part.

Dans **Authentication → URL Configuration** :

- **Site URL** : l'adresse servie — aujourd'hui `https://vehora.vercel.app`.
- **Redirect URLs** : `https://vehora.vercel.app/**`, puis
  `https://vehora.magyapro.com/**` quand le sous-domaine arrivera. Garder
  `http://localhost:4200/**` pour le développement. **On ajoute, on ne remplace
  pas** : plusieurs adresses peuvent servir la même application.

Et pendant qu'on y est, **Authentication → Policies** : activer la protection
contre les mots de passe divulgués. Elle est désactivée, l'advisor le signale à
chaque audit, et c'est deux clics.

---

## 4. Vérifications avant de communiquer l'adresse

```bash
npm run types:check     # types de l'application
npx tsc -p tsconfig.spec.json --noEmit   # types des tests
npm run test:unit       # fabrique de CSV
npm run build           # budgets de taille appliqués
npm run test:csp        # l'application tourne sous sa CSP réelle
npm run validate:sql    # migrations et assertions de sécurité
npm run e2e             # parcours, mobile et desktop
```

Puis, sur le site en ligne :

1. **Ouvrir `https://vehora.magyapro.com/caisse/historique` directement.** Si
   c'est un 404, la réécriture SPA n'est pas appliquée — c'est le premier
   symptôme d'une configuration Vercel concurrente.
2. **Se connecter** avec `awa@vehora.test`. Si la connexion échoue mais que
   l'écran s'affiche, regarder la console : une violation de CSP s'y lit en
   clair.
3. **Vérifier l'en-tête** : `curl -sI https://vehora.magyapro.com | grep -i
   content-security-policy`.

---

## 5. Ce que la CSP interdit — et ce qu'il faudra y toucher

`vercel.json` sert une politique de sécurité de contenu stricte : pas de script
externe, pas d'`eval`, pas de cadre parent. Deux points méritent d'être connus.

- **L'hôte Supabase y est écrit en dur** (`connect-src`, `img-src`). Le jour où
  un projet de production est créé, cette valeur change **en même temps** que
  `environment.prod.ts`. L'oublier donne une application qui s'affiche et ne
  charge rien.
- **L'inlining du CSS critique d'Angular est désactivé**
  (`optimization.styles.inlineCritical: false` dans `angular.json`). Il ajoutait
  un `onload="this.media='all'"` — un gestionnaire d'événement en ligne, que la
  CSP refuse. `npm run test:csp` l'a trouvé avant la mise en ligne ; il servira
  à le retrouver si quelqu'un le réactive.

`public/robots.txt` et l'en-tête `X-Robots-Tag: noindex` tiennent ce
sous-domaine hors des moteurs de recherche. **À retirer** le jour où un domaine
sert de vrais clients — un site de production absent de Google, c'est un autre
genre de problème.

---

## 6. Passer en production réelle, plus tard

Trois choses, dans cet ordre.

### 6.1 Un projet Supabase distinct

1. Créer un second projet Supabase.
2. Y rejouer `supabase/migrations/` **dans l'ordre**, sans en sauter aucune.
3. **Activer le custom access token hook** sur
   `vehora.custom_access_token_hook`. Sans lui, aucun JWT ne porte de rôle ni de
   permission : l'application entière se comporte comme si personne n'avait de
   droits, et rien dans l'interface ne l'explique.
4. Activer la protection contre les mots de passe divulgués.
5. Reporter l'URL et la clé *publishable* dans
   `src/environments/environment.prod.ts` **et dans la CSP de `vercel.json`**.

### 6.2 Les comptes de démonstration

Sur le projet de production, ils ne doivent pas exister. Sur le projet de
développement, **ils doivent rester** : la suite de parcours en dépend.

`awa@`, `ousmane@`, `ibrahima@`, `fatou@`, `sansorg@`, `admin@vehora.test`, et
les deux organisations `Test plateforme mobile|desktop`.

### 6.3 Le premier compte réel

Il n'y a pas d'inscription ouverte. Un compte naît par
`provisionner_organisation()` (première organisation, premier propriétaire) ou
par `accepter_invitation()`. Le Super Admin de plateforme se rattache à
l'organisation technique `vehora-platform`.

---

## 7. Intégration continue

`.github/workflows/verification.yml` rejoue à chaque poussée et chaque pull
request, en trois travaux séparés (un échec de type ne doit pas cacher une
policy cassée) :

| Travail | Ce qu'il vérifie |
|---|---|
| Types et build | types de l'application **et des tests**, build de production avec ses budgets |
| Migrations et assertions | les migrations rejouées sur un PostgreSQL jetable, puis les assertions de sécurité |
| Tests de parcours | la suite Playwright, mobile et desktop, rapport en artefact si ça casse |

Les campagnes d'intrusion n'y sont pas : elles écrivent dans la base réelle et
deux exécutions concurrentes se gêneraient. Elles se lancent à la main à la
clôture d'une phase.

### Secrets à déclarer dans GitHub

Sans eux, la suite connectée **s'ignore en bloc** — et un « skipped » massif
ressemble à un succès. `playwright.config.ts` l'affiche en avertissement.

`VEHORA_TEST_EMAIL`, `VEHORA_TEST_PASSWORD`,
`VEHORA_TEST_EMAIL_CAISSIER`, `VEHORA_TEST_PASSWORD_CAISSIER`,
`VEHORA_TEST_EMAIL_SANS_ORG`, `VEHORA_TEST_PASSWORD_SANS_ORG`,
`VEHORA_TEST_EMAIL_ADMIN`, `VEHORA_TEST_PASSWORD_ADMIN`.

Ils désignent les comptes du projet de **développement**. Jamais ceux de la
production.
