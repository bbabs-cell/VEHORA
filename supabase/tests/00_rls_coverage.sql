-- VEHORA — test structurel permanent (fondation 3 / doc 08).
-- Échoue si une table de `public` n'a pas RLS activée, ou n'a aucune policy.
-- Rend impossible l'oubli d'une table lors d'une phase ultérieure.
-- CE TEST NE DOIT JAMAIS ÊTRE DÉSACTIVÉ NI ASSOUPLI.

do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;

  if v_missing is not null then
    raise exception 'RLS DÉSACTIVÉE sur : %', v_missing;
  end if;

  select string_agg(c.relname, ', ' order by c.relname)
    into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if v_missing is not null then
    raise exception 'AUCUNE POLICY sur : %', v_missing;
  end if;

  raise notice 'OK — toutes les tables publiques ont RLS et au moins une policy.';
end;
$$;
