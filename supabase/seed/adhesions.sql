-- VEHORA — rattachement des comptes de démonstration.
--
-- À exécuter APRÈS `demonstration.sql` et après avoir créé les six comptes dans
-- le dashboard (Authentication → Users → Add user, « Auto Confirm User » coché).
-- Les comptes ne sont pas dans ce fichier : ils demandent un mot de passe, qui
-- n'a rien à faire dans un dépôt.
--
-- Le script est IDEMPOTENT et SILENCIEUX sur un compte absent : il ne rattache
-- que ce qu'il trouve. Le compte final dit lesquels manquent.
--
-- `sansorg@vehora.test` n'apparaît volontairement nulle part ici. Des tests
-- vérifient qu'un compte sans adhésion n'obtient aucun claim et n'accède à
-- rien : lui donner une organisation casserait silencieusement cette garantie.

begin;

-- ---------------------------------------------------------------------------
-- Adhésions
-- ---------------------------------------------------------------------------
insert into public.organization_memberships (profile_id, organization_id, role_id, status)
select p.id, o.id, r.id, 'ACTIVE'
  from (values
    ('awa@vehora.test',      'station-awa',      'OWNER'),
    ('ousmane@vehora.test',  'station-awa',      'CASHIER'),
    ('ibrahima@vehora.test', 'station-awa',      'CASHIER'),
    ('fatou@vehora.test',    'lavage-fatou',     'OWNER'),
    ('admin@vehora.test',    'vehora-platform',  'SUPER_ADMIN')
  ) as v(courriel, slug, role)
  join auth.users u on lower(u.email) = v.courriel
  join public.profiles p on p.id = u.id
  join public.organizations o on o.slug = v.slug
  join public.roles r on r.code = v.role
on conflict (profile_id, organization_id) do nothing;

-- ---------------------------------------------------------------------------
-- Affectations de station
--
-- Un rôle de portée STATION ne voit que les stations où il est affecté — c'est
-- le sens de `can_access_station`. Les deux caissiers sont donc sur deux
-- stations différentes : c'est ce qui rend vérifiable qu'un caissier de
-- Liberté 6 ne lit pas la file d'Ouakam.
--
-- Awa (OWNER) et Fatou n'ont aucune ligne ici, et c'est correct : un rôle de
-- portée ORGANIZATION couvre toutes les stations sans affectation.
-- ---------------------------------------------------------------------------
insert into public.station_users (membership_id, station_id)
select m.id, st.id
  from (values
    ('ousmane@vehora.test',  'station-awa', 'Liberté 6'),
    ('ibrahima@vehora.test', 'station-awa', 'Ouakam')
  ) as v(courriel, slug, station)
  join auth.users u on lower(u.email) = v.courriel
  join public.organizations o on o.slug = v.slug
  join public.organization_memberships m
    on m.profile_id = u.id and m.organization_id = o.id
  join public.stations st on st.organization_id = o.id and st.name = v.station
on conflict (membership_id, station_id) do nothing;

-- ---------------------------------------------------------------------------
-- Noms affichés
--
-- Le profil naît vide : `handle_new_user` ne lit que `raw_user_meta_data`, que
-- la création manuelle ne remplit pas. Sans cela, l'écran afficherait une
-- adresse e-mail là où il doit afficher un nom.
-- ---------------------------------------------------------------------------
update public.profiles p
   set full_name = v.nom
  from (values
    ('awa@vehora.test',      'Awa Diouf'),
    ('ousmane@vehora.test',  'Ousmane Fall'),
    ('ibrahima@vehora.test', 'Ibrahima Ndoye'),
    ('fatou@vehora.test',    'Fatou Sene'),
    ('admin@vehora.test',    'Équipe VEHORA'),
    ('sansorg@vehora.test',  'Compte sans organisation')
  ) as v(courriel, nom),
       auth.users u
 where lower(u.email) = v.courriel
   and p.id = u.id
   and p.full_name is distinct from v.nom;

commit;

-- ---------------------------------------------------------------------------
-- Ce qui est en place, et ce qui manque
-- ---------------------------------------------------------------------------
select v.courriel,
       case when u.id is null then 'COMPTE ABSENT'
            when u.email_confirmed_at is null then 'e-mail non confirmé'
            when v.courriel = 'sansorg@vehora.test'
              then case when m.id is null then 'ok — sans organisation, comme prévu'
                        else 'ANOMALIE : ce compte ne doit appartenir à aucune organisation' end
            when m.id is null then 'ADHÉSION MANQUANTE'
            else 'ok — ' || r.label || ' / ' || o.name
       end as etat
  from (values
    ('awa@vehora.test'), ('ousmane@vehora.test'), ('ibrahima@vehora.test'),
    ('fatou@vehora.test'), ('admin@vehora.test'), ('sansorg@vehora.test')
  ) as v(courriel)
  left join auth.users u on lower(u.email) = v.courriel
  left join public.organization_memberships m on m.profile_id = u.id
  left join public.organizations o on o.id = m.organization_id
  left join public.roles r on r.id = m.role_id
 order by v.courriel;
