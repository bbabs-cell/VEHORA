-- VEHORA — Phase 9, correction de sécurité (MEDIUM).
--
-- Faille trouvée par l'advisor : `transitionner_dossier` était appelable par le
-- rôle `anon`, c'est-à-dire sans être connecté.
--
-- La cause est un défaut de PostgreSQL, pas un oubli de `grant` : **EXECUTE est
-- accordé à PUBLIC automatiquement** à la création d'une fonction. Écrire
-- `grant execute … to authenticated` ne retire rien — ça ajoute à un droit déjà
-- universel. Il faut révoquer explicitement.
--
-- L'impact réel était limité : sans JWT, `current_org_id()` est null et la
-- fonction refuse. Mais une fonction SECURITY DEFINER atteignable sans compte
-- est une surface d'attaque offerte, et le raisonnement « de toute façon ça
-- échoue » est exactement celui qui finit par être démenti par une régression.
--
-- Règle à appliquer désormais à toute fonction exposée dans `public` :
-- révoquer de `public` et `anon`, puis accorder au seul rôle qui en a besoin.

revoke execute on function public.transitionner_dossier(uuid, text, text)
  from public, anon;
grant execute on function public.transitionner_dossier(uuid, text, text) to authenticated;

revoke execute on function public.resoudre_prix(uuid, uuid, uuid, date) from public, anon;
grant execute on function public.resoudre_prix(uuid, uuid, uuid, date) to authenticated;

revoke execute on function public.remplacer_tarif(uuid, bigint, date) from public, anon;
grant execute on function public.remplacer_tarif(uuid, bigint, date) to authenticated;

-- Les deux points d'entrée de provisionnement restent volontairement ouverts
-- aux comptes connectés (ils vérifient eux-mêmes leurs conditions et auditent),
-- mais pas aux visiteurs anonymes.
revoke execute on function public.provisionner_organisation(text, text, text, text)
  from public, anon;
grant execute on function public.provisionner_organisation(text, text, text, text)
  to authenticated;

revoke execute on function public.accepter_invitation(text) from public, anon;
grant execute on function public.accepter_invitation(text) to authenticated;

-- Les trois fonctions SECURITY DEFINER restent signalées par l'advisor pour le
-- rôle `authenticated`. C'est un choix, documenté en base : chacune vérifie
-- elle-même ses conditions et audite. Le signalement est attendu.
comment on function public.transitionner_dossier is
  'Seul chemin pour changer le statut d''un dossier (fondation 4). SECURITY DEFINER parce qu''elle écrit l''historique, qui n''a aucune policy INSERT ; elle refait donc elle-même le contrôle d''organisation, de station et de permission. Signalée par l''advisor Supabase : c''est voulu. Ne pas révoquer son EXECUTE à `authenticated`.';
