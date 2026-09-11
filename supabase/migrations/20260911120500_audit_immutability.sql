-- VEHORA — Phase 0 : immuabilité du journal d'audit.
--
-- Constat de l'audit de phase 0 : l'absence de policy UPDATE/DELETE empêche
-- bien un utilisateur d'y toucher, mais `service_role` (Edge Functions, clé
-- d'administration) contourne la RLS entièrement. Un journal d'audit que le
-- porteur de la clé peut réécrire ne prouve rien.
--
-- Un trigger s'applique à TOUS les rôles, y compris service_role et postgres.

create or replace function vehora.forbid_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception
    'VEHORA_AUDIT_IMMUTABLE: le journal d''audit est en écriture seule (% interdit)',
    tg_op
  using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_logs_no_update
  before update on public.audit_logs
  for each row execute function vehora.forbid_audit_mutation();

create trigger audit_logs_no_delete
  before delete on public.audit_logs
  for each row execute function vehora.forbid_audit_mutation();

comment on trigger audit_logs_no_update on public.audit_logs is
  'Immuabilité — s''applique aussi à service_role, qui contourne la RLS.';

-- La purge légale (rétention) devra passer par une fonction dédiée qui désactive
-- temporairement ces triggers, avec sa propre trace. Hors périmètre du MVP.
