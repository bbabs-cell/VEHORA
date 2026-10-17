-- Réparations de parcours (phase 26).
--
-- Trouvées en relisant chaque geste de l'écran contre ce que la base accepte,
-- après qu'un dossier réel est resté bloqué neuf jours. Cinq trous, tous du
-- même genre : une règle tenue par un seul chemin, qu'un autre chemin contourne
-- ou n'atteint jamais. Chacune est donc posée ici comme un INVARIANT sur la
-- donnée — par déclencheur — et non comme une condition d'une ligne de la
-- matrice des transitions : un invariant ne doit pas dépendre de ce qu'on n'a
-- pas encore ouvert.
--
-- Aucun de ces déclencheurs ne parle pendant une cascade : ils ne regardent
-- que des changements de statut, des insertions de ligne et des créations
-- d'invitation — jamais ce qu'une suppression en cascade écrit.

-- ---------------------------------------------------------------------------
-- 1. Pas de file d'attente sans prestation.
--
-- Les opérations naissent de la mise en attente (`creer_operations_du_dossier`)
-- et le dossier ne démarre que quand l'une d'elles démarre. Un dossier mis en
-- attente SANS ligne n'avait donc aucune opération : il restait « En attente »
-- pour toujours, et seule l'annulation l'en sortait.
-- ---------------------------------------------------------------------------
create or replace function vehora.check_dossier_statut()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_net bigint;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'WAITING'
     and not exists (select 1 from public.service_order_items where service_order_id = new.id) then
    raise exception 'VEHORA_DOSSIER_SANS_PRESTATION: ajoutez au moins une prestation avant la file d''attente'
      using errcode = 'check_violation';
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Pas de « prêt » avec du travail en cours.
  --
  -- Avec le contrôle qualité désactivé, IN_PROGRESS → READY ne vérifiait que
  -- le réglage (condition QUALITY_OPTIONAL) : un véhicule pouvait être marqué
  -- prêt, puis restitué, opérations inachevées. Le passage par le contrôle,
  -- lui, exige déjà toutes les opérations terminées ; l'invariant vaut pour
  -- les deux chemins.
  -- -------------------------------------------------------------------------
  if new.status = 'READY'
     and exists (select 1 from public.service_order_operations
                  where service_order_id = new.id and status <> 'DONE') then
    raise exception 'VEHORA_OPERATIONS_EN_COURS: toutes les opérations doivent être terminées'
      using errcode = 'check_violation';
  end if;

  -- -------------------------------------------------------------------------
  -- 3. Pas d'annulation tant que de l'argent reçu n'est pas rendu.
  --
  -- Fondation 4 : « tout sauf terminal → CANCELLED : aucun paiement encaissé
  -- non remboursé ». Ce n'était écrit nulle part. Or un dossier annulé refuse
  -- tout paiement, remboursement compris (`preparer_paiement`) : annuler un
  -- dossier payé rendait le remboursement impossible, et l'argent restait dans
  -- la caisse théorique et dans le chiffre du jour.
  -- -------------------------------------------------------------------------
  if new.status = 'CANCELLED' then
    select coalesce(sum(case when kind = 'PAYMENT' then amount_minor else -amount_minor end), 0)
      into v_net
      from public.payments
     where service_order_id = new.id and status = 'COMPLETED';

    if v_net > 0 then
      raise exception 'VEHORA_PAIEMENT_A_REMBOURSER: remboursez d''abord les % reçus avant d''annuler', v_net
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

comment on function vehora.check_dossier_statut() is
  'Invariants de statut : pas de WAITING sans prestation, pas de READY avec une opération non terminée, pas de CANCELLED avec de l''argent reçu non rendu. SECURITY DEFINER pour compter lignes et paiements quelle que soit la RLS de l''appelant.';

create trigger service_orders_invariants
  before update of status on public.service_orders
  for each row execute function vehora.check_dossier_statut();

-- ---------------------------------------------------------------------------
-- 4. Une prestation ajoutée pendant l'attente a son opération.
--
-- Les lignes restent modifiables jusqu'au démarrage du travail (statut
-- WAITING compris), mais les opérations n'étaient créées qu'une fois, au
-- passage en attente. Une prestation ajoutée ensuite était facturée sans
-- jamais apparaître aux Opérations — et « toutes les opérations terminées »
-- passait sans elle. Retirer une ligne retire déjà son opération (clé
-- étrangère en cascade).
-- ---------------------------------------------------------------------------
create or replace function vehora.operation_de_ligne_en_attente()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.service_orders
     where id = new.service_order_id and status = 'WAITING'
  ) then
    perform vehora.creer_operations_du_dossier(new.service_order_id);
  end if;
  return new;
end;
$$;

create trigger service_order_items_operation
  after insert on public.service_order_items
  for each row execute function vehora.operation_de_ligne_en_attente();

-- ---------------------------------------------------------------------------
-- 5. Une invitation expirée ne bloque plus la suivante.
--
-- `accepter_invitation` passe une invitation expirée à EXPIRED puis lève une
-- exception — qui annule la transaction, donc le passage à EXPIRED. Elle
-- restait PENDING pour toujours, et l'index unique « une invitation en attente
-- par adresse » refusait toute nouvelle invitation : réinviter la personne
-- répondait « déjà en attente ». On expire ici, au moment où l'on réinvite.
-- ---------------------------------------------------------------------------
create or replace function vehora.expirer_invitations_perimees()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.organization_invitations
     set status = 'EXPIRED'
   where organization_id = new.organization_id
     and lower(email) = lower(new.email)
     and status = 'PENDING'
     and expires_at < now();
  return new;
end;
$$;

create trigger organization_invitations_expirer
  before insert on public.organization_invitations
  for each row execute function vehora.expirer_invitations_perimees();

-- Fonctions de déclencheur : personne n'a à les appeler directement.
revoke execute on function vehora.check_dossier_statut()          from public, anon, authenticated;
revoke execute on function vehora.operation_de_ligne_en_attente() from public, anon, authenticated;
revoke execute on function vehora.expirer_invitations_perimees()  from public, anon, authenticated;
