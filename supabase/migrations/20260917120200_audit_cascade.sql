-- VEHORA — Phase 14 : le journal d'audit ne doit pas rendre une organisation
-- indestructible.
--
-- Troisième occurrence de la même erreur, et la règle était écrite : « un
-- trigger de protection doit se taire quand l'écriture vient d'une cascade »
-- (dernier propriétaire en phase 1, opérations en phase 10). Ici c'est
-- l'immuabilité du journal.
--
-- `audit_logs` référence `organizations`, `stations` et `profiles` en
-- `ON DELETE SET NULL`. Supprimer une organisation demande donc à PostgreSQL de
-- mettre `organization_id` à NULL sur ses lignes de journal — un UPDATE, que le
-- trigger refusait. Conséquence : toute organisation ayant une entrée d'audit
-- rattachée devenait indéboulonnable. Elle est apparue dès que la plateforme a
-- écrit un `platform.subscription.change` sur une organisation ensuite
-- supprimée ; elle attendait la production.
--
-- Ce qui reste interdit : toucher au contenu du journal. Ce qui est désormais
-- toléré : la mise à NULL d'une clé étrangère par la cascade, et rien d'autre.
-- Le contenu de l'entrée (action, valeurs, motif, horodatage, acteur affiché)
-- est comparé champ à champ : s'il bouge d'un caractère, l'exception revient.
create or replace function vehora.forbid_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_avant jsonb;
  v_apres jsonb;
begin
  if tg_op = 'UPDATE' then
    v_avant := to_jsonb(old) - 'organization_id' - 'station_id' - 'actor_profile_id';
    v_apres := to_jsonb(new) - 'organization_id' - 'station_id' - 'actor_profile_id';

    -- Le reste de la ligne est identique, et les clés qui ont bougé sont
    -- devenues NULL : c'est la signature d'un `ON DELETE SET NULL`. Aucune
    -- écriture d'utilisateur ne ressemble à cela.
    if v_avant = v_apres
       and (new.organization_id is not distinct from old.organization_id
            or new.organization_id is null)
       and (new.station_id is not distinct from old.station_id
            or new.station_id is null)
       and (new.actor_profile_id is not distinct from old.actor_profile_id
            or new.actor_profile_id is null) then
      return new;
    end if;
  end if;

  raise exception
    'VEHORA_AUDIT_IMMUTABLE: le journal d''audit est en écriture seule (% interdit)',
    tg_op
  using errcode = 'insufficient_privilege';
end;
$$;

comment on function vehora.forbid_audit_mutation is
  'Immuabilité du journal d''audit, y compris pour service_role. Seule exception : la mise à NULL d''une clé étrangère par une cascade de suppression — le contenu de l''entrée, lui, ne bouge jamais.';
