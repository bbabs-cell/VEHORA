-- VEHORA — Phase 1 : durcissement du search_path des fonctions.
--
-- Constat des advisors Supabase (13 occurrences) : une fonction sans
-- `search_path` fixe résout ses noms selon le search_path de l'appelant. Sur une
-- fonction SECURITY DEFINER, c'est un vecteur d'escalade classique : un
-- utilisateur crée `mon_schema.profiles`, place son schéma en tête de son
-- search_path, et la fonction privilégiée lit sa table au lieu de la vraie.
--
-- Toutes nos fonctions utilisent déjà des noms pleinement qualifiés
-- (`public.x`, `vehora.y`) : figer le search_path à vide est donc sans risque
-- de régression, et supprime la classe de faille entière.

alter function vehora.jwt_claims()                         set search_path = '';
alter function vehora.current_org_id()                     set search_path = '';
alter function vehora.current_profile_id()                 set search_path = '';
alter function vehora.is_platform_admin()                  set search_path = '';
alter function vehora.is_impersonating()                   set search_path = '';
alter function vehora.has_permission(text)                 set search_path = '';
alter function vehora.can_access_station(uuid)             set search_path = '';
alter function vehora.can_read(uuid, text, uuid)           set search_path = '';
alter function vehora.can_write(uuid, text, uuid)          set search_path = '';
alter function vehora.check_station_user_tenancy()         set search_path = '';
alter function vehora.check_last_owner()                   set search_path = '';
alter function vehora.touch_updated_at()                   set search_path = '';
alter function vehora.forbid_audit_mutation()              set search_path = '';
