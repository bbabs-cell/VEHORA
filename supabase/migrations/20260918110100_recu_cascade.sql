-- ---------------------------------------------------------------------------
-- Phase 20 — Correctif : une organisation ayant émis un reçu restait
-- supprimable en théorie seulement.
--
-- **Quatrième occurrence** de la règle « un trigger de protection doit se taire
-- quand l'écriture vient d'une cascade » (dernier propriétaire en phase 1,
-- opérations en phase 10, journal d'audit en phase 14). `receipts` référence
-- `organizations` en `ON DELETE CASCADE`, et `vehora.protect_receipt()` refuse
-- **tout** DELETE, cascade comprise : depuis la phase 13, aucune organisation
-- ayant émis un seul reçu ne pouvait plus être supprimée.
--
-- Le défaut est resté invisible trois phases parce que l'assertion existante
-- supprimait une organisation sans reçu. Il est apparu en écrivant celle de la
-- facturation, qui supprime une organisation réelle — avec ses dossiers, ses
-- paiements, ses reçus et ses factures.
--
-- Le repère est simple et ne demande aucun drapeau : lors d'une cascade,
-- PostgreSQL supprime la ligne parente **avant** les filles. Si l'organisation
-- du reçu n'existe plus, la suppression vient de la cascade. Si elle existe
-- encore, quelqu'un s'en prend au reçu lui-même, et c'est refusé.
-- ---------------------------------------------------------------------------
create or replace function vehora.protect_receipt()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.organizations o
                      where o.id = old.organization_id) then
    return old;
  end if;

  raise exception 'VEHORA_RECU_IMMUABLE: un reçu ne se modifie ni ne se supprime ; émettez-en un nouveau'
    using errcode = 'insufficient_privilege';
end;
$$;
