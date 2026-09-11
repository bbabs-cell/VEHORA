---
name: vehora-workflow
description: Workflow de développement VEHORA — environnement, commandes, Git, cycle de phase, commits, rapports. À charger au démarrage d'une session, avant un commit, ou à la clôture d'une phase.
---

# Workflow VEHORA

## Au démarrage d'une session

Le hook `SessionStart` (`.claude/hooks/session-start.sh`) vérifie
l'environnement automatiquement et signale ce qui manque. En cas de doute :

```bash
bash .claude/hooks/session-start.sh
```

Prérequis : Node 20+, PostgreSQL 16 (pour `validate-sql.sh`), Git.
Playwright est préinstallé dans l'environnement cloud
(`/opt/pw-browsers`) — **n'y lancer jamais `playwright install`**. En local,
en revanche, `npx playwright install chromium` est nécessaire.

## Commandes du projet

| But | Commande |
|---|---|
| Valider migrations + tests de sécurité | `bash scripts/validate-sql.sh` |
| Tests de parcours | `npx playwright test` |
| Build de production | `npm run build` |
| Serveur de développement | `npm start` |

`validate-sql.sh` exige un utilisateur non-root :
`su postgres -s /bin/bash -c "cd <projet> && bash scripts/validate-sql.sh"`.

## Cycle de phase — obligatoire

```
ANALYSER → CHOISIR LES SKILLS → PLANIFIER → IMPLÉMENTER → TESTER
→ AUDIT SÉCURITÉ → CORRIGER → RETESTER → AUDIT DE RÉGRESSION
→ BUILD → GIT DIFF → DOCUMENTER → COMMIT → RAPPORT DE PHASE
```

**Une phase à la fois. Jamais de génération massive.**
Une phase n'est close qu'après validation fonctionnelle **et** validation
sécurité. Une faille CRITICAL ou HIGH bloque la clôture.

Rapport de phase dans `docs/phases/phase-NN.md` : périmètre · tests ·
vulnérabilités et gravité · corrections · tests ajoutés · résultats · risques
résiduels.

## Git

- Branche de travail dédiée, jamais de commit direct sur la branche par défaut.
- Message : `type(scope): description` en français.
  `feat` · `fix` · `chore` · `docs` · `test` · `refactor` · `perf`.
  Exemple : `feat(service-orders): création d'un dossier depuis la file d'attente`.
- Avant chaque commit : relire `git diff`, supprimer le code temporaire et les
  traces de débogage, vérifier qu'aucun secret ne part.
- Un commit = un changement cohérent. Pas de commit fourre-tout.
- **Ne jamais** réécrire ou supprimer massivement une fonctionnalité existante
  sans justification écrite.

## Migrations

Une migration commitée n'est **jamais** modifiée : on en ajoute une nouvelle.
Cycle : écrire → `validate-sql.sh` → tests de sécurité → commit.
Après application sur Supabase : lancer les advisors (sécurité et performance)
et régénérer `database.types.ts`.

## Décisions

Tout choix d'architecture non évident donne lieu à un ADR dans
`docs/decisions/`, au format contexte → décision → conséquences → alternatives
écartées. Une décision ne se supprime pas : elle est remplacée par une nouvelle
qui la référence.

## Ce qui n'est jamais « terminé »

Du code qui compile. Une fonctionnalité est terminée quand elle passe la
checklist de `vehora-qa` — fonctionnel, sécurité, responsive, états vides,
performance, cohérence visuelle, absence de régression.
