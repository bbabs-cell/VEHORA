-- VEHORA — Phase 10, correction ergonomique.
--
-- Défaut vu à l'écran : démarrer la première opération laissait le dossier en
-- « En attente ». L'exploitant devait aller sur un second écran pour dire que
-- le travail avait commencé — un geste que personne ne fera en station, et un
-- tableau de file d'attente qui ment dans la minute qui suit.
--
-- Le dossier suit donc ses opérations, en base et non dans le navigateur : la
-- règle vaut pour tous les appelants, et elle passe par la fonction de
-- transition, donc par ses contrôles et son historique. Si la transition est
-- refusée (permission, condition), l'opération reste démarrée : les deux faits
-- sont indépendants, et un travail commencé reste un travail commencé.

create or replace function vehora.avancer_dossier_au_demarrage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_statut public.service_order_status;
begin
  if new.status <> 'IN_PROGRESS' or old.status = 'IN_PROGRESS' then
    return new;
  end if;

  select status into v_statut from public.service_orders where id = new.service_order_id;
  if v_statut <> 'WAITING' then
    return new;
  end if;

  begin
    perform public.transitionner_dossier(new.service_order_id, 'IN_PROGRESS');
  exception
    when others then
      -- Le dossier n'a pas pu suivre : ce n'est pas une raison pour annuler le
      -- démarrage du travail. L'écran de file d'attente reste le recours.
      null;
  end;

  return new;
end;
$$;

create trigger operations_demarrage_dossier
  after update on public.service_order_operations
  for each row execute function vehora.avancer_dossier_au_demarrage();
