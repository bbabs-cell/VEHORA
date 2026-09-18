-- ---------------------------------------------------------------------------
-- Phase 21 — Notifications au client : la file, pas l'envoi
--
-- « Votre véhicule est prêt » est l'attente la plus évidente d'un client de
-- station, et la seule chose qui lui évite d'attendre sur place. Mais envoyer
-- un SMS demande un fournisseur, un compte et un budget — une décision qui
-- appartient au propriétaire du produit, pas au code.
--
-- Ce qui suit est donc **tout ce qui ne dépend pas du fournisseur**, et c'est
-- la part difficile : à qui on a le droit d'écrire, ce qu'on écrit, combien de
-- fois, et ce qu'on garde. L'adaptateur d'envoi viendra brancher une fonction
-- de bord sur cette file ; il ne changera rien de ce fichier.
--
-- Cinq décisions.
--
-- 1. **Le message est composé par la base.** Le client ne fournit ni le texte,
--    ni le destinataire : un SMS partant au nom de la station avec un contenu
--    choisi par un utilisateur, c'est un canal d'hameçonnage offert.
--
-- 2. **Le destinataire est figé dans la ligne.** Comme un reçu fige ce qu'il
--    constate : si le client change de numéro après coup, on saura à quel
--    numéro le message est parti.
--
-- 3. **Un refus se respecte partout.** `customers.accepte_notifications` :
--    aucune notification n'est mise en file pour quelqu'un qui a refusé, ni
--    pour un client sans numéro. La vérification est en base, pas à l'écran.
--
-- 4. **Une transition ne notifie qu'une fois.** Un index unique partiel le
--    garantit : rejouer `READY → IN_PROGRESS → READY` ne renvoie pas un
--    deuxième message au client, qui ne comprendrait pas.
--
-- 5. **Rien ne part.** Le statut naît `PENDING` et y reste : aucune fonction de
--    ce fichier n'envoie quoi que ce soit. `docs/notifications.md` dit ce qu'il
--    reste à brancher.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Consentement
-- ---------------------------------------------------------------------------
alter table public.customers
  add column accepte_notifications boolean not null default true;

comment on column public.customers.accepte_notifications is
  'Le client accepte d''être prévenu par message. Un refus est respecté par la '
  'base, pas seulement par l''écran : aucune notification n''est mise en file.';

-- ---------------------------------------------------------------------------
-- La file
-- ---------------------------------------------------------------------------
create type public.notification_status as enum ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade
                        default vehora.current_org_id(),
  station_id       uuid not null references public.stations(id) on delete restrict,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  customer_id      uuid references public.customers(id) on delete set null,

  -- Ce qu'on envoie, et à qui : figé à la mise en file.
  kind             text not null check (kind in ('READY', 'DELIVERED')),
  destination      text not null,
  body             text not null,

  status           public.notification_status not null default 'PENDING',
  attempts         integer not null default 0 check (attempts >= 0),
  last_error       text,
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

-- Une transition ne notifie qu'une fois. Une notification annulée ne compte
-- pas : on peut vouloir en remettre une après une annulation délibérée.
create unique index notifications_une_par_etape_idx
  on public.notifications (service_order_id, kind)
  where status <> 'CANCELLED';

create index notifications_file_idx
  on public.notifications (organization_id, status, created_at);
create index notifications_station_idx
  on public.notifications (station_id, created_at desc);
create index notifications_dossier_idx on public.notifications (service_order_id);
create index notifications_client_idx on public.notifications (customer_id);

-- ---------------------------------------------------------------------------
-- Mise en file automatique
--
-- `AFTER UPDATE` sur le dossier : la transition elle-même reste la seule
-- affaire de `transitionner_dossier()`, et ce trigger n'y touche pas.
-- ---------------------------------------------------------------------------
create or replace function vehora.mettre_en_file_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client      public.customers;
  v_organisation text;
  v_numero      bigint := new.number;
  v_texte       text;
  v_type        text;
begin
  if new.status = 'READY' and old.status is distinct from 'READY' then
    v_type := 'READY';
  elsif new.status = 'DELIVERED' and old.status is distinct from 'DELIVERED' then
    v_type := 'DELIVERED';
  else
    return new;
  end if;

  -- Une fonctionnalité fermée ne met rien en file : un flag qui n'empêche rien
  -- n'est pas un flag.
  if not vehora.flag_actif('notifications', new.organization_id) then
    return new;
  end if;

  if new.customer_id is null then return new; end if;

  select * into v_client from public.customers where id = new.customer_id;
  if not found
     or v_client.phone_digits is null
     or not v_client.accepte_notifications then
    return new;
  end if;

  select name into v_organisation
    from public.organizations where id = new.organization_id;

  -- Le texte est composé ici. Aucune donnée saisie par un utilisateur n'entre
  -- dans le message en dehors du nom de l'organisation et du prénom du client :
  -- ni les notes du dossier, ni le nom d'une prestation.
  v_texte := case v_type
    when 'READY' then
      format('%s : votre vehicule est pret (dossier %s). Merci de venir le recuperer.',
             v_organisation, v_numero)
    else
      format('%s : merci de votre visite (dossier %s). A bientot.',
             v_organisation, v_numero)
  end;

  insert into public.notifications
    (organization_id, station_id, service_order_id, customer_id, kind,
     destination, body)
  values
    (new.organization_id, new.station_id, new.id, new.customer_id, v_type,
     v_client.phone_digits, v_texte)
  -- Rejouer la même étape ne remet rien en file : l'index unique tranche, et
  -- `do nothing` évite de faire échouer une transition légitime pour ça.
  on conflict do nothing;

  return new;
end;
$$;

create trigger service_orders_notifient
  after update of status on public.service_orders
  for each row execute function vehora.mettre_en_file_notification();

-- ---------------------------------------------------------------------------
-- Annulation
--
-- Une notification en attente qu'on ne veut plus envoyer (le client est venu
-- entre-temps) s'annule avec un motif. Elle n'est jamais supprimée : savoir
-- qu'on a décidé de ne pas prévenir quelqu'un fait partie de l'histoire du
-- dossier.
-- ---------------------------------------------------------------------------
create or replace function public.annuler_notification(
  p_notification_id uuid,
  p_motif           text
)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare v_notif public.notifications;
begin
  if p_motif is null or length(trim(p_motif)) < 3 then
    raise exception 'VEHORA_MOTIF_REQUIS : une annulation s''explique.';
  end if;

  select * into v_notif from public.notifications
   where id = p_notification_id for update;
  if not found then
    raise exception 'VEHORA_NOTIFICATION_INTROUVABLE : cette notification n''existe pas.';
  end if;

  -- La fonction est SECURITY DEFINER : elle doit donc vérifier elle-même ce que
  -- la policy aurait vérifié.
  if not vehora.can_write(v_notif.organization_id, 'service_orders.write',
                          v_notif.station_id) then
    raise exception 'VEHORA_PERMISSION : vous ne pouvez pas agir sur cette notification.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_notif.status <> 'PENDING' then
    raise exception 'VEHORA_NOTIFICATION_PARTIE : seule une notification en attente s''annule.';
  end if;

  update public.notifications
     set status = 'CANCELLED', cancel_reason = trim(p_motif)
   where id = p_notification_id
  returning * into v_notif;

  insert into public.audit_logs (action, resource_type, resource_id, reason,
                                 organization_id, station_id, actor_profile_id)
  values ('notification.cancel', 'notification', p_notification_id::text, trim(p_motif),
          v_notif.organization_id, v_notif.station_id, vehora.current_profile_id());

  return v_notif;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Lecture : qui lit les dossiers de la station lit ce qu'on a écrit à ses
-- clients. Aucune policy d'écriture : la base met en file, la fonction annule.
-- Un utilisateur qui pourrait insérer ici enverrait un message au nom de la
-- station, avec le texte de son choix.
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "read notifications" on public.notifications
  for select to authenticated
  using (vehora.can_read(organization_id, 'service_orders.read', station_id));

revoke execute on function public.annuler_notification(uuid, text) from public, anon;
grant execute on function public.annuler_notification(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Le drapeau
--
-- Fermé par défaut, et fermé pour tous les plans : rien ne se met en file tant
-- que le fournisseur d'envoi n'est pas choisi. Ouvrir ce flag pour une
-- organisation remplit sa file — et rien ne part, ce qui est le comportement
-- voulu tant que l'adaptateur n'existe pas.
-- ---------------------------------------------------------------------------
insert into public.feature_flags (key, label, description, enabled_by_default)
values ('notifications', 'Notifications au client',
        'Mise en file des messages « votre véhicule est prêt ». L''envoi demande un fournisseur.',
        false);
