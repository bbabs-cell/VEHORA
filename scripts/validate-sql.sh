#!/usr/bin/env bash
# Applique toutes les migrations sur un PostgreSQL jetable et lance les tests
# structurels. Permet de valider le SQL sans projet Supabase rattaché.
set -euo pipefail

# PostgreSQL refuse de démarrer sous root. En conteneur (cloud, CI) on est root :
# on se relance sous un compte non privilégié plutôt que d'échouer à `initdb`.
if [ "$(id -u)" = "0" ] && [ -z "${VEHORA_SQL_REEXEC:-}" ]; then
  utilisateur=${VEHORA_SQL_USER:-postgres}
  if id "$utilisateur" >/dev/null 2>&1; then
    echo "Exécution sous « $utilisateur » (PostgreSQL ne démarre pas sous root)."
    exec su "$utilisateur" -s /bin/bash -c \
      "cd $(pwd) && VEHORA_SQL_REEXEC=1 bash $0"
  fi
  echo "Ce script ne peut pas s'exécuter sous root et aucun compte de repli n'existe." >&2
  exit 1
fi

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
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
-- Schéma `storage` : Supabase le fournit, on en reproduit le minimum pour que
-- les policies de fichiers soient validées comme le reste.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(p_name text)
returns text[] language sql immutable as $f$
  select (string_to_array(p_name, '/'))[1:array_length(string_to_array(p_name,'/'),1)-1];
$f$;

do $$ begin create role anon;                exception when duplicate_object then null; end $$;
do $$ begin create role authenticated;       exception when duplicate_object then null; end $$;
do $$ begin create role service_role;        exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin; exception when duplicate_object then null; end $$;
SQL

# Supabase accorde par défaut les privilèges de table aux rôles API ; la RLS est
# ce qui filtre réellement. On reproduit ces GRANT pour tester les policies.
#
# Ils sont posés AVANT les migrations, et en `alter default privileges` : c'est
# ainsi que Supabase procède (les droits suivent les tables créées ensuite).
# Les rejouer après aurait défait les `revoke` écrits par une migration — ce qui
# est arrivé, et faisait passer pour ouvert ce qui était fermé en réalité.
# Le schéma `vehora` est créé par la première migration : son USAGE se donne
# juste après elle. On n'y pose AUCUN privilège par défaut sur les fonctions :
# Supabase n'en pose pas non plus, c'est le défaut de PostgreSQL (EXECUTE à
# PUBLIC) qui les rend appelables. Poser un `grant … to authenticated` ici
# survivrait à un `revoke … from public` écrit par une migration, et ferait
# passer pour ouvert ce qui est fermé en production — la phase 14 l'a vérifié
# à ses dépens.
$PSQL <<'SQL'
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
SQL

premiere=true
for f in supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  $PSQL -f "$f"
  if $premiere; then
    $PSQL <<'SQL'
grant usage on schema vehora to anon, authenticated;
SQL
    premiere=false
  fi
done

for f in supabase/tests/*.sql; do
  echo "→ test $(basename "$f")"
  $PSQL -f "$f"
done

echo "✅ Migrations et tests structurels valides."
