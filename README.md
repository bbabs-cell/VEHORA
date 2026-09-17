# VEHORA

Système de gestion opérationnelle des centres de lavage et services automobiles.
SaaS multi-tenant — Angular + Supabase.

## Documentation

- `CLAUDE.md` — guide de travail
- `docs/architecture/` — les cinq fondations, design system, sécurité
- `docs/decisions/` — décisions d'architecture (ADR)
- `docs/phases/` — rapports de phase

## Vérifier la base sans projet Supabase

```bash
bash scripts/validate-sql.sh
```

Applique toutes les migrations sur un PostgreSQL 16 jetable et exécute les tests
de sécurité (couverture RLS, isolation multi-tenant, escalade de privilèges,
immuabilité du journal d'audit).

Nécessite les binaires PostgreSQL 16 et un utilisateur non-root.

## État

Phase 0 terminée — voir `docs/phases/phase-00.md`.

## Lancer les tests de parcours (Playwright)

```bash
npx playwright install chromium   # une seule fois, en local
cp .env.example .env.local        # puis renseignez les mots de passe
npm run e2e
```

`.env.local` est lu automatiquement par `playwright.config.ts` et n'est jamais
commité. Sans identifiants, la suite connectée est **ignorée** — un
« skipped » massif n'est pas un succès : vérifiez le nombre de tests exécutés.

Le serveur de développement est démarré par Playwright lui-même ; inutile de
lancer `npm start` à côté.
