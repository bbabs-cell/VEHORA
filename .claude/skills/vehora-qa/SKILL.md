---
name: vehora-qa
description: Méthode de test et critères de fin de tâche VEHORA — tests SQL de sécurité, unitaires, Playwright, checklist de validation, workflow de phase. À charger avant d'écrire des tests, de valider une fonctionnalité ou de clôturer une phase.
---

# QA VEHORA

## Pyramide

| Niveau | Outil | Couvre |
|---|---|---|
| Sécurité base | SQL dans `supabase/tests/` | RLS, isolation multi-tenant, permissions, transitions interdites, invariants |
| Unitaire | Vitest | calculs : totaux, résolution de prix, soldes, matrice de transitions |
| Parcours | Playwright | arrivée → inspection → file → opération → contrôle → paiement → restitution |

Les tests d'isolation multi-tenant s'écrivent en **SQL**, pas en Playwright :
plus rapides, plus fiables, exhaustifs table par table.

## Lancer les tests base

```bash
bash scripts/validate-sql.sh
```

Applique toutes les migrations sur un PostgreSQL jetable puis exécute
`supabase/tests/`. À lancer après **chaque** migration.
Nécessite un utilisateur non-root (`su postgres`).

## Playwright

Chromium préinstallé (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).
**Ne jamais lancer `playwright install`.**

Couvrir en priorité : connexion · cloisonnement (un utilisateur de A ne voit
rien de B) · parcours complet d'une prestation · paiement partiel puis solde ·
restitution bloquée puis autorisée · ouverture et clôture de caisse.
Tester aussi au format mobile (360×740), pas seulement en desktop.

## Audit mobile — capture regardée (méthode MagyaPro)

```bash
npm run build && npm run audit:mobile
```

Sert le build réel sous sa CSP réelle, ouvre chaque écran de chaque profil à
375 px avec Supabase **simulé** (`scripts/maquette/` — aucun secret requis), et
échoue sur : défilement horizontal, bouton écrasé, **plus d'un bouton principal
visible**, texte coupé, texte sous 13 px, violation de CSP, erreur JavaScript.
`AUDIT_LARGEURS=320,375,1280`, `AUDIT_THEMES=sombre,clair`, `AUDIT_CHEMINS=…`.

**Puis REGARDER les captures** (dossier temporaire, jamais dans le dépôt). C'est
une capture qui a montré, en phase 24, que la file d'attente s'affichait en
texte brut depuis la phase 15 — aucune assertion ne le voyait.

Un écran ajouté = un chemin ajouté à `PARCOURS` dans `scripts/audit-mobile.mjs`
et, s'il lit une table nouvelle, ses lignes dans `scripts/maquette/donnees.mjs`.

## Test structurel permanent

`supabase/tests/00_rls_coverage.sql` échoue si une table de `public` n'a pas RLS
ou n'a aucune policy. **Ne jamais le désactiver ni l'assouplir.**

## Pièges de méthode

- Sous RLS, un `UPDATE` sans policy modifie **0 ligne sans erreur**. Ne jamais
  conclure d'une absence d'exception qu'une opération a été refusée : vérifier
  le nombre de lignes affectées.
- `service_role` contourne la RLS : ce qui doit tenir contre lui se teste sous
  un rôle qui ignore les policies.
- Un test qui passe du premier coup sur un cas « malveillant » mérite d'être
  vérifié : s'assure-t-il vraiment de ce qu'on croit ?

## Une fonctionnalité est terminée quand

- [ ] elle marche pour l'utilisateur autorisé
- [ ] elle est refusée côté serveur pour l'utilisateur non autorisé
- [ ] les contournements pertinents sont bloqués et testés
- [ ] les quatre états sont traités (chargement, vide, erreur, contenu)
- [ ] `npm run audit:mobile` est vert ET les captures ont été regardées, en
      thème sombre et clair
- [ ] un seul bouton principal par écran
- [ ] aucune couleur en dur, cibles tactiles ≥ 44px (`npm run test:unit`
      vérifie les jetons)
- [ ] les listes sont paginées
- [ ] `validate-sql.sh` est au vert
- [ ] le build passe, budgets de bundle respectés
- [ ] aucune régression sur l'existant

Le code qui compile n'est pas du travail terminé.

## Workflow de phase

```
ANALYSER → CHOISIR LES SKILLS → PLANIFIER → IMPLÉMENTER → TESTER
→ AUDIT SÉCURITÉ → CORRIGER → RETESTER → AUDIT DE RÉGRESSION
→ BUILD → GIT DIFF → DOCUMENTER → COMMIT → RAPPORT DE PHASE
```

Une phase n'est jamais close avec une faille CRITICAL ou HIGH non corrigée ou
non documentée avec justification.
