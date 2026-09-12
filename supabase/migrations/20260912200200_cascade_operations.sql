-- VEHORA — Phase 10, correction (HIGH) : la cascade ne doit pas être bloquée
-- par un garde-fou métier.
--
-- Symptôme : supprimer un employé échouait dès qu'il avait travaillé sur un
-- dossier clos. La clé étrangère `employee_id` est en `on delete set null` ;
-- ce `SET NULL` fait un UPDATE sur l'opération, et le trigger de protection
-- refusait parce que le dossier est restitué ou annulé.
--
-- Conséquence beaucoup plus grave que le symptôme : **supprimer une
-- organisation empruntait le même chemin**. La suppression d'une organisation
-- cascade vers ses employés, donc vers ce même `SET NULL`. L'invariant
-- « une organisation doit rester supprimable » était en danger, et il n'était
-- pas testé avec des employés et des opérations en base.
--
-- C'est la deuxième fois qu'un invariant métier bloque une cascade (le premier
-- était « dernier propriétaire », corrigé en phase 1). La règle qui s'en dégage :
-- un trigger de protection doit reconnaître ce qui vient d'une cascade et se
-- taire — il protège l'utilisateur, pas la base contre elle-même.

create or replace function vehora.protect_operation()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_dossier public.service_orders;
  v_employe public.employees;
begin
  -- Désassignation provoquée par la disparition de l'employé : c'est une
  -- cascade, pas un geste d'utilisateur. Rien à protéger, rien à vérifier.
  if new.employee_id is null and old.employee_id is not null
     and not exists (select 1 from public.employees where id = old.employee_id) then
    return new;
  end if;

  select * into v_dossier from public.service_orders where id = new.service_order_id;

  -- Le dossier a disparu : on est dans sa propre cascade de suppression.
  if v_dossier.id is null then
    return new;
  end if;

  if v_dossier.status in ('DELIVERED', 'CANCELLED') then
    raise exception 'VEHORA_DOSSIER_CLOS: ce dossier est restitué ou annulé'
      using errcode = 'insufficient_privilege';
  end if;

  if new.employee_id is distinct from old.employee_id then
    if not vehora.can_write(new.organization_id, 'operations.assign', v_dossier.station_id) then
      raise exception 'VEHORA_PERMISSION: assigner une opération exige operations.assign'
        using errcode = 'insufficient_privilege';
    end if;

    if new.employee_id is not null then
      select * into v_employe from public.employees where id = new.employee_id;

      if v_employe.organization_id is distinct from new.organization_id then
        raise exception 'VEHORA_TENANCY_VIOLATION: cet employé appartient à une autre organisation'
          using errcode = 'insufficient_privilege';
      end if;

      if v_employe.status <> 'ACTIVE' then
        raise exception 'VEHORA_EMPLOYE_INACTIF: cet employé n''est plus actif'
          using errcode = 'check_violation';
      end if;

      if exists (select 1 from public.employee_services
                  where employee_id = v_employe.id)
         and not exists (select 1 from public.employee_services es
                          join public.service_order_items i on i.service_id = es.service_id
                         where es.employee_id = v_employe.id and i.id = new.item_id) then
        raise exception 'VEHORA_COMPETENCE_MANQUANTE: cet employé n''exécute pas cette prestation'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    if not vehora.can_write(new.organization_id, 'operations.execute', v_dossier.station_id) then
      raise exception 'VEHORA_PERMISSION: faire avancer une opération exige operations.execute'
        using errcode = 'insufficient_privilege';
    end if;

    if not ((old.status = 'PENDING'     and new.status = 'IN_PROGRESS')
         or (old.status = 'IN_PROGRESS' and new.status = 'DONE')
         or (old.status = 'IN_PROGRESS' and new.status = 'PENDING')) then
      raise exception 'VEHORA_OPERATION_TRANSITION: passage de % à % non prévu', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if new.status = 'IN_PROGRESS' and new.employee_id is null then
      raise exception 'VEHORA_OPERATION_SANS_EMPLOYE: assignez un employé avant de démarrer'
        using errcode = 'check_violation';
    end if;

    new.started_at := case when new.status = 'IN_PROGRESS' then coalesce(old.started_at, now())
                           when new.status = 'PENDING' then null
                           else old.started_at end;
    new.completed_at := case when new.status = 'DONE' then now() else null end;
  end if;

  return new;
end;
$$;
