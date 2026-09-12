-- VEHORA — Phase 1 : suppression du relais public devenu inutile.
--
-- Le relais `public.custom_access_token_hook` avait été créé sur un diagnostic
-- erroné : on pensait que le tableau de bord Supabase ne proposait pas le
-- schéma `vehora`. En réalité il le proposait ; le hook était simplement resté
-- désactivé.
--
-- Le hook pointe donc sur `vehora.custom_access_token_hook`. Une fonction
-- inutilisée dans `public`, même verrouillée, reste de la surface exposée en
-- plus : on la retire (SIMPLICITÉ > COMPLEXITÉ).

drop function if exists public.custom_access_token_hook(jsonb);
