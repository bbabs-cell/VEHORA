# VEHORA

Système de gestion opérationnelle des centres de lavage et services automobiles.
SaaS multi-tenant — Angular + Supabase.

## Documentation

- `CLAUDE.md` — guide de travail
- `docs/architecture/` — les cinq fondations, design system, sécurité
- `docs/decisions/` — décisions d'architecture (ADR)
- `docs/phases/` — rapports de phase
- `docs/design/DESIGN.md` — système visuel ; `docs/SECURITE.md` — registre de sécurité
- `.claude/skills/` — dont `methode-magyapro` et `animations-vivantes`, la méthode
  et le style de mouvement du propriétaire

## Vérifier la base sans projet Supabase

```bash
bash scripts/validate-sql.sh
```

Applique toutes les migrations sur un PostgreSQL 16 jetable et exécute les tests
de sécurité (couverture RLS, isolation multi-tenant, escalade de privilèges,
immuabilité du journal d'audit).

Nécessite les binaires PostgreSQL 16 et un utilisateur non-root.

## État

Phase 24 terminée — voir `docs/phases/phase-24.md` et `CLAUDE.md`.

## Regarder tous les écrans sur un téléphone, sans compte

```bash
npm run build && npm run audit:mobile
```

Ouvre chaque écran de chaque profil à 375 px avec un Supabase **simulé**
(`scripts/maquette/`), signale débordements, boutons écrasés, textes coupés ou
trop petits et second bouton principal, et enregistre une capture par écran —
à regarder.

## Lancer les tests de parcours (Playwright)

```bash
npx playwright install chromium   # une seule fois, en local
cp .env.example .env.local        # puis renseignez les mots de passe
npm run e2e
```

`.env.local` est lu automatiquement par `playwright.config.ts` et n'est jamais
commité. Sans identifiants, la suite connectée est **ignorée** — un
« skipped » massif n'est pas un succès : vérifiez le nombre de tests exécutés.

### Si la suite échoue sur « Request rate limit reached »

Supabase limite les authentifications par adresse IP. La suite se connecte des
dizaines de fois ; depuis un poste unique, la limite peut être atteinte.
Relancez quelques minutes plus tard, ou relevez le plafond dans le tableau de
bord Supabase (Authentication → Rate Limits → *Sign in / Sign up*).

Le serveur de développement est démarré par Playwright lui-même, sur le **port
4280** — pas 4200. Vous pouvez donc garder `npm start` ouvert à côté : les tests
ne s'y brancheront pas. C'est voulu : un serveur égaré sur 4200 (une version
antérieure, une autre fenêtre) serait réutilisé sans rien dire, et la suite
testerait la mauvaise application.
