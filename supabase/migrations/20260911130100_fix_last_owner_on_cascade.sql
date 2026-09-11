-- VEHORA — Phase 1 : correction de l'invariant « dernier propriétaire ».
--
-- Constat de l'audit de phase 1 : le trigger `memberships_last_owner` protège
-- bien contre la perte du dernier OWNER d'une organisation vivante, mais il se
-- déclenche AUSSI lors de la suppression en cascade d'une organisation
-- (organizations → organization_memberships). Résultat : une organisation ne
-- pouvait plus jamais être supprimée — la suppression échouait toujours sur son
-- propre propriétaire.
--
-- En PostgreSQL, la ligne parente est supprimée avant que la cascade ne
-- s'applique aux lignes filles. Si l'organisation n'existe plus, la suppression
-- de l'adhésion fait partie d'une cascade légitime : l'invariant n'a plus
-- d'objet et doit être ignoré.

create or replace function vehora.check_last_owner()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_owner_role uuid;
  v_remaining  integer;
begin
  -- Cascade de suppression d'organisation : l'invariant ne s'applique plus.
  if not exists (
    select 1 from public.organizations where id = old.organization_id
  ) then
    return coalesce(new, old);
  end if;

  select id into v_owner_role from public.roles where code = 'OWNER';

  if old.role_id = v_owner_role and old.status = 'ACTIVE' then
    select count(*) into v_remaining
      from public.organization_memberships
     where organization_id = old.organization_id
       and role_id = v_owner_role
       and status = 'ACTIVE'
       and id <> old.id;

    if v_remaining = 0 then
      raise exception 'VEHORA_LAST_OWNER: une organisation doit conserver au moins un propriétaire actif';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
