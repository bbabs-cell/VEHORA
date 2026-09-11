#!/bin/bash
# VEHORA — vérification d'environnement au démarrage de session.
# Installe les dépendances si le projet en a, et signale ce qui manque.
# Idempotent, non interactif.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR"

manquants=()

# --- Node ---------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  node_major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$node_major" -lt 20 ]; then
    manquants+=("Node 20+ requis (trouvé $(node -v))")
  fi
else
  manquants+=("Node 20+ absent — https://nodejs.org")
fi

# --- PostgreSQL 16 : requis par scripts/validate-sql.sh -----------------
if ! ls /usr/lib/postgresql/16/bin/postgres >/dev/null 2>&1 \
   && ! command -v initdb >/dev/null 2>&1; then
  manquants+=("PostgreSQL 16 absent — nécessaire pour scripts/validate-sql.sh")
fi

# --- Dépendances du projet ----------------------------------------------
if [ -f package.json ]; then
  if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    echo "VEHORA : installation des dépendances npm…"
    npm install --no-audit --no-fund
  fi

  # Playwright est préinstallé dans l'environnement cloud ; en local il faut
  # télécharger Chromium une fois.
  if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] \
     && [ -d node_modules/@playwright ] \
     && [ ! -d "${HOME}/.cache/ms-playwright" ]; then
    echo "VEHORA : téléchargement de Chromium pour Playwright…"
    npx playwright install chromium || \
      manquants+=("Chromium Playwright non installé — lancer : npx playwright install chromium")
  fi
fi

# --- Rapport -------------------------------------------------------------
echo "──────────────────────────────────────────────"
echo "VEHORA — environnement"
echo "  dépôt      : $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
echo "  node       : $(command -v node >/dev/null 2>&1 && node -v || echo 'absent')"
echo "  postgres   : $(ls /usr/lib/postgresql/16/bin/postgres >/dev/null 2>&1 && echo '16 ok' || echo 'absent')"
echo "  playwright : $([ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && echo 'préinstallé (cloud)' || echo 'local')"

if [ ${#manquants[@]} -gt 0 ]; then
  echo ""
  echo "  ⚠ à installer :"
  for m in "${manquants[@]}"; do echo "    - $m"; done
fi
echo "──────────────────────────────────────────────"
