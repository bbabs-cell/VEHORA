-- VEHORA — Phase 3 : `organization_id` déduit du JWT, plus jamais fourni par le
-- client.
--
-- Constat. L'écran des stations envoyait `organization_id` depuis le frontend,
-- récupéré d'un chargement asynchrone. En ouvrant `/stations` directement, le
-- chargement n'était pas terminé et la création échouait.
--
-- La bonne correction n'est pas d'attendre côté client, mais de supprimer le
-- besoin : le serveur connaît déjà l'organisation, elle est dans le jeton.
--
-- Bénéfice de sécurité : une valeur que le client n'envoie plus est une valeur
-- qu'il ne peut plus falsifier. Le `with check` de la policy reste en place —
-- défense en profondeur, pas en remplacement.

alter table public.stations
  alter column organization_id set default vehora.current_org_id();

comment on column public.stations.organization_id is
  'Rempli automatiquement depuis le JWT. Le client ne doit jamais le fournir.';
