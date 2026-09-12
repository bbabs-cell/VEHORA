-- VEHORA — Phase 1 : relais public pour le custom access token hook.
--
-- Le tableau de bord Supabase ne propose que certains schémas dans le
-- sélecteur du hook, et `vehora` n'y figure pas de façon fiable. On expose donc
-- un relais dans `public`, qui ne fait que déléguer à la vraie implémentation.
--
-- Sécurité : la fonction est retirée de `public`, `anon` et `authenticated`.
-- Seul `supabase_auth_admin` peut l'exécuter, donc PostgREST ne l'expose pas
-- comme RPC. La logique reste dans `vehora`, non exposé à l'API.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select vehora.custom_access_token_hook(event);
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public;
revoke all on function public.custom_access_token_hook(jsonb) from anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

comment on function public.custom_access_token_hook(jsonb) is
  'Relais pour le tableau de bord Supabase. Implémentation réelle : vehora.custom_access_token_hook.';
