-- VEHORA — test structurel permanent (fondation 3, amendement phase 12).
--
-- Les vues `platform_*` s'exécutent avec les droits de leur propriétaire : leur
-- seul garde-fou est le filtre `vehora.is_platform_admin()` écrit dans leur
-- corps. Ce test échoue si une vue de plateforme perd ce filtre — par une
-- réécriture, un `create or replace` distrait, ou une copie d'une autre vue.
--
-- C'est le pendant du test de couverture RLS pour les tables.
-- CE TEST NE DOIT JAMAIS ÊTRE DÉSACTIVÉ NI ASSOUPLI.

do $$
declare
  v_sans_garde text;
  v_lisibles_anon text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_sans_garde
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'v'
     and c.relname like 'platform\_%'
     and pg_get_viewdef(c.oid) not like '%is_platform_admin%';

  if v_sans_garde is not null then
    raise exception 'VUE DE PLATEFORME SANS GARDE-FOU is_platform_admin() : %', v_sans_garde;
  end if;

  -- Une vue de plateforme n'est jamais lisible par un visiteur anonyme.
  select string_agg(c.relname, ', ' order by c.relname)
    into v_lisibles_anon
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'v'
     and c.relname like 'platform\_%'
     and has_table_privilege('anon', c.oid, 'SELECT');

  if v_lisibles_anon is not null then
    raise exception 'VUE DE PLATEFORME LISIBLE PAR anon : %', v_lisibles_anon;
  end if;

  raise notice 'OK — toutes les vues de plateforme portent leur garde-fou et sont fermées à anon.';
end;
$$;
