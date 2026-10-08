-- VEHORA — jeu de démonstration.
--
-- Pourquoi ce fichier existe : le jeu de démonstration vivait dans la base et
-- nulle part ailleurs. Quand le projet Supabase a disparu, les 47 migrations
-- ont tout rendu sauf lui — organisations, stations, catalogue, tarifs,
-- employés, clients, véhicules ont dû être retapés. Ce qui n'est pas versionné
-- n'existe qu'une fois.
--
-- Ce script est IDEMPOTENT : le rejouer ne crée pas de doublon.
--
-- Ce qu'il ne fait PAS, volontairement : créer les comptes de connexion. Ils
-- demandent un mot de passe, qui n'a rien à faire dans un dépôt. Les six
-- comptes se créent dans le dashboard (Authentication → Users → Add user, avec
-- « Auto Confirm User »), puis `supabase/seed/adhesions.sql` les rattache.
--
--   awa@vehora.test        propriétaire de Station Awa
--   ousmane@vehora.test    caissier, Liberté 6
--   ibrahima@vehora.test   caissier, Ouakam
--   fatou@vehora.test      propriétaire de Lavage Fatou
--   admin@vehora.test      Super Admin de la plateforme
--   sansorg@vehora.test    AUCUNE organisation — des tests en dépendent
--
-- À exécuter avec les droits de `postgres` (SQL Editor du dashboard).

begin;

-- ---------------------------------------------------------------------------
-- Organisations
--
-- Le déclencheur `organizations_abonnement_essai` leur pose un plan
-- « Découverte » — une station, trois comptes. Trop étroit : le jeu de test a
-- besoin de deux stations et de trois comptes sur la même organisation. On les
-- passe en « Pro » juste après, comme la plateforme le ferait.
-- ---------------------------------------------------------------------------
insert into public.organizations (name, slug, country_code, city, currency, status)
values
  ('Station Awa',             'station-awa',             'SN', 'Dakar', 'XOF', 'ACTIVE'),
  ('Lavage Fatou',            'lavage-fatou',            'SN', 'Thiès', 'XOF', 'ACTIVE'),
  ('Test plateforme mobile',  'test-plateforme-mobile',  'SN', 'Dakar', 'XOF', 'ACTIVE'),
  ('Test plateforme desktop', 'test-plateforme-desktop', 'SN', 'Dakar', 'XOF', 'ACTIVE')
on conflict (slug) do nothing;

insert into public.organization_settings (organization_id)
select o.id from public.organizations o
 where not exists (select 1 from public.organization_settings s
                    where s.organization_id = o.id);

update public.subscriptions s
   set plan_id = (select id from public.plans where code = 'PRO'),
       status  = 'ACTIVE'
  from public.organizations o
 where o.id = s.organization_id
   and o.slug in ('station-awa', 'lavage-fatou',
                  'test-plateforme-mobile', 'test-plateforme-desktop');

-- ---------------------------------------------------------------------------
-- Stations
--
-- Station Awa en a DEUX, et ce n'est pas décoratif : la session de caisse est
-- une ressource unique par (station, personne), donc chaque projet Playwright
-- a besoin de la sienne. L'affichage multi-station en dépend aussi.
-- ---------------------------------------------------------------------------
insert into public.stations (organization_id, name, city, kind, status)
select o.id, v.nom, v.ville, 'FIXED', 'ACTIVE'
  from public.organizations o
  cross join (values ('Liberté 6', 'Dakar'), ('Ouakam', 'Dakar')) as v(nom, ville)
 where o.slug = 'station-awa'
on conflict (organization_id, name) do nothing;

insert into public.stations (organization_id, name, city, kind, status)
select o.id, 'Station principale', o.city, 'FIXED', 'ACTIVE'
  from public.organizations o
 where o.slug in ('lavage-fatou', 'test-plateforme-mobile', 'test-plateforme-desktop')
on conflict (organization_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
insert into public.service_categories (organization_id, name, sort_order)
select o.id, v.nom, v.rang
  from public.organizations o
  cross join (values ('Lavage', 10), ('Intérieur', 20), ('Detailing', 30)) as v(nom, rang)
 where o.slug = 'station-awa'
on conflict (organization_id, name) do nothing;

insert into public.services
  (organization_id, category_id, name, description, duration_minutes, sort_order)
select o.id, c.id, v.nom, v.descr, v.duree, v.rang
  from public.organizations o
  cross join (values
    ('Lavage',    'Lavage extérieur',      'Carrosserie, jantes, vitres.',       20,  10),
    ('Lavage',    'Lavage complet',        'Extérieur et intérieur.',            45,  20),
    ('Intérieur', 'Aspiration intérieur',  'Sièges, moquettes, coffre.',         25,  30),
    ('Intérieur', 'Nettoyage sièges',      'Shampoing des sièges tissu.',        60,  40),
    ('Detailing', 'Polissage carrosserie', 'Correction des micro-rayures.',     120,  50),
    ('Detailing', 'Traitement céramique',  'Protection longue durée.',          240,  60)
  ) as v(categorie, nom, descr, duree, rang)
  join public.service_categories c
    on c.organization_id = o.id and c.name = v.categorie
 where o.slug = 'station-awa'
on conflict (organization_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- Tarifs
--
-- En unité mineure : XOF n'a pas de décimale, donc 3 000 F s'écrit 3000. Un
-- tarif général par prestation, plus une majoration SUV et 4x4 sur les lavages —
-- c'est précisément ce que `resoudre_prix` doit départager, du plus spécifique
-- au plus général.
-- ---------------------------------------------------------------------------
insert into public.service_prices
  (organization_id, service_id, vehicle_type_id, amount_minor, currency, valid_from)
select o.id, s.id, null, v.prix, 'XOF', current_date - 30
  from public.organizations o
  cross join (values
    ('Lavage extérieur', 3000), ('Lavage complet', 6000),
    ('Aspiration intérieur', 2500), ('Nettoyage sièges', 12000),
    ('Polissage carrosserie', 45000), ('Traitement céramique', 150000)
  ) as v(nom, prix)
  join public.services s on s.organization_id = o.id and s.name = v.nom
 where o.slug = 'station-awa'
   and not exists (select 1 from public.service_prices p
                    where p.service_id = s.id and p.vehicle_type_id is null);

insert into public.service_prices
  (organization_id, service_id, vehicle_type_id, amount_minor, currency, valid_from)
select o.id, s.id, t.id, v.prix, 'XOF', current_date - 30
  from public.organizations o
  cross join (values
    ('Lavage extérieur', 'SUV', 4500), ('Lavage extérieur', 'FOUR_BY_4', 5000),
    ('Lavage complet',   'SUV', 8500), ('Lavage complet',   'FOUR_BY_4', 9500)
  ) as v(nom, type_code, prix)
  join public.services s on s.organization_id = o.id and s.name = v.nom
  join public.vehicle_types t on t.code = v.type_code
 where o.slug = 'station-awa'
   and not exists (select 1 from public.service_prices p
                    where p.service_id = s.id and p.vehicle_type_id = t.id);

-- ---------------------------------------------------------------------------
-- Employés
--
-- Sans compte de connexion, comme dans le cas courant : un laveur n'a pas de
-- session, et son travail est tracé par `employee_id`. Son historique survit
-- donc à son départ.
-- ---------------------------------------------------------------------------
insert into public.employees (organization_id, station_id, full_name, phone, status)
select o.id, st.id, v.nom, v.tel, 'ACTIVE'
  from public.organizations o
  cross join (values
    ('Liberté 6', 'Moussa Diallo', '77 123 45 67'),
    ('Liberté 6', 'Cheikh Ndiaye', '77 234 56 78'),
    ('Liberté 6', 'Aminata Sow',   '76 345 67 89'),
    ('Ouakam',    'Babacar Faye',  '78 456 78 90'),
    ('Ouakam',    'Khady Diop',    '70 567 89 01')
  ) as v(station, nom, tel)
  join public.stations st on st.organization_id = o.id and st.name = v.station
 where o.slug = 'station-awa'
   and not exists (select 1 from public.employees e
                    where e.organization_id = o.id and e.full_name = v.nom);

-- ---------------------------------------------------------------------------
-- Clients et véhicules
--
-- Les numéros et les plaques sont saisis comme en station — espacés, avec ou
-- sans tirets. La base les normalise : c'est ce qui empêche deux fiches pour la
-- même personne, et c'est vérifiable à l'œil dans le résultat.
-- ---------------------------------------------------------------------------
insert into public.customers (organization_id, full_name, phone, email)
select o.id, v.nom, v.tel, v.courriel
  from public.organizations o
  cross join (values
    ('Ibrahima Sarr',  '77 111 22 33', 'ibrahima.sarr@exemple.sn'),
    ('Awa Ba',         '78 222 33 44', null),
    ('Ousmane Gueye',  '76 333 44 55', null),
    ('Mariama Camara', '70 444 55 66', 'mariama.camara@exemple.sn'),
    ('Seydou Traoré',  '77 555 66 77', null)
  ) as v(nom, tel, courriel)
 where o.slug = 'station-awa'
   and not exists (select 1 from public.customers c
                    where c.organization_id = o.id and c.full_name = v.nom);

insert into public.vehicles
  (organization_id, customer_id, vehicle_type_id, plate, make, model, color)
select o.id, c.id, t.id, v.plaque, v.marque, v.modele, v.couleur
  from public.organizations o
  cross join (values
    ('Ibrahima Sarr',  'SEDAN',     'DK-1234-A', 'Toyota',     'Corolla',      'Gris'),
    ('Awa Ba',         'SUV',       'dk 5678 b', 'Hyundai',    'Tucson',       'Blanc'),
    ('Ousmane Gueye',  'FOUR_BY_4', 'DK9012C',   'Toyota',     'Land Cruiser', 'Noir'),
    ('Mariama Camara', 'CITY',      'DK-3456-D', 'Peugeot',    '208',          'Rouge'),
    ('Seydou Traoré',  'PICKUP',    'TH-7890-E', 'Mitsubishi', 'L200',         'Bleu')
  ) as v(client, type_code, plaque, marque, modele, couleur)
  join public.customers c on c.organization_id = o.id and c.full_name = v.client
  join public.vehicle_types t on t.code = v.type_code
 where o.slug = 'station-awa'
   and not exists (select 1 from public.vehicles ve
                    where ve.organization_id = o.id and ve.customer_id = c.id);

commit;
