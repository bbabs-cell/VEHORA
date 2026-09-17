-- VEHORA — Phase 12 : consolidation du garde-fou des vues de plateforme.
--
-- L'advisor Supabase signale `platform_organizations` et `platform_audit_logs`
-- au niveau ERROR : ce sont des vues `SECURITY DEFINER`, donc évaluées avec les
-- droits de leur propriétaire et non ceux de l'appelant.
--
-- C'est délibéré et sans alternative : le Super Admin n'ayant AUCUNE policy sur
-- les tables clientes, une vue en `security_invoker` ne renverrait rien — c'est
-- précisément la propriété qu'on veut conserver. Le garde-fou est donc dans le
-- corps de la vue (`where vehora.is_platform_admin()`), et ces vues ne rendent
-- que des agrégats et des métadonnées.
--
-- Un choix assumé se protège au lieu de se commenter. Trois mesures :
--   1. `anon` n'a aucun droit de lecture dessus — un visiteur anonyme n'a rien
--      à faire dans une vue de plateforme, même vide ;
--   2. un commentaire en base dit que le signalement est attendu ;
--   3. un test structurel permanent échoue si une vue `platform_%` perd son
--      filtre. C'est le même principe que le test de couverture RLS : la règle
--      ne doit pas pouvoir disparaître sans que quelque chose casse.

revoke all on public.platform_organizations from anon;
revoke all on public.platform_audit_logs   from anon;
grant select on public.platform_organizations to authenticated;
grant select on public.platform_audit_logs   to authenticated;

comment on view public.platform_organizations is
  'Métadonnées et volumes des organisations clientes. SECURITY DEFINER assumé (fondation 3, amendement phase 12) : le garde-fou est `vehora.is_platform_admin()` dans le corps de la vue, et un test structurel échoue s''il disparaît. N''expose aucune donnée métier ligne à ligne, ni aucun chiffre d''affaires. Signalée par l''advisor Supabase : c''est voulu.';

comment on view public.platform_audit_logs is
  'Journal des actions de plateforme uniquement. SECURITY DEFINER assumé, même garde-fou et même test que `platform_organizations`. Le journal métier d''une organisation reste à l''organisation. Signalée par l''advisor Supabase : c''est voulu.';
