#!/bin/bash
# VEHORA — vérification d'environnement au démarrage de session.
# Installe les dépendances si le projet en a, et signale ce qui manque.
# Idempotent, non interactif.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR"

manquants=()

# --- Node ---------------------------------------------------------------
# Angular 22 exige Node >= 22.22.3 (ou 24.x). Une version antérieure fait
# échouer la CLI avec un message peu explicite.
if [ -x /opt/node24/bin/node ] && [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  export PATH="/opt/node24/bin:$PATH"
  echo 'export PATH="/opt/node24/bin:$PATH"' >> "${CLAUDE_ENV_FILE:-/dev/null}" 2>/dev/null || true
fi

if command -v node >/dev/null 2>&1; then
  node_version="$(node -v | sed 's/^v//')"
  if [ "$(printf '%s\n22.22.3\n' "$node_version" | sort -V | head -1)" != "22.22.3" ]; then
    manquants+=("Node >= 22.22.3 requis par Angular 22 (trouvé v$node_version)")
  fi
else
  manquants+=("Node >= 22.22.3 absent — https://nodejs.org")
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
