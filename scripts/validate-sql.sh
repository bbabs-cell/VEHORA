#!/usr/bin/env bash
# Applique toutes les migrations sur un PostgreSQL jetable et lance les tests
# structurels. Permet de valider le SQL sans projet Supabase rattaché.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDATA=$(mktemp -d)
PORT=${PORT:-55432}
SOCK=$(mktemp -d)

cleanup() { "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGDATA" "$SOCK"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -w start >/dev/null

PSQL="psql -h $SOCK -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

# Objets fournis par la plateforme Supabase : simulés pour valider hors plateforme.
$PSQL <<'SQL'
create schema if not exists auth;
create schema if not exists extensions;
create table if not exists auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb default '{}'::jsonb
);
do $$ begin create role anon;                exception when duplicate_object then null; end $$;
do $$ begin create role authenticated;       exception when duplicate_object then null; end $$;
do $$ begin create role service_role;        exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin; exception when duplicate_object then null; end $$;
SQL

for f in supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  $PSQL -f "$f"
done

# Supabase accorde par défaut les privilèges de table aux rôles API ; la RLS est
# ce qui filtre réellement. On reproduit ces GRANT pour tester les policies.
$PSQL <<'SQL'
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage on schema vehora to anon, authenticated;
grant execute on all functions in schema vehora to authenticated;
SQL

for f in supabase/tests/*.sql; do
  echo "→ test $(basename "$f")"
  $PSQL -f "$f"
done

echo "✅ Migrations et tests structurels valides."
