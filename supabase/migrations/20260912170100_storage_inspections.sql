-- VEHORA — Phase 7 : stockage des photos d'inspection.
--
-- C'est le point de sécurité le plus sensible depuis la RLS elle-même : un
-- chemin mal conçu et les photos d'une organisation deviennent lisibles par une
-- autre. Une photo de véhicule porte une plaque d'immatriculation — donnée
-- personnelle — et sert de preuve en cas de litige.
--
-- Conventions retenues :
--
-- 1. CHEMIN IMPOSÉ : {organization_id}/{inspection_id}/{fichier}
--    Le premier segment est l'organisation. Les policies ne comparent que lui :
--    c'est court, indexable, et impossible à contourner par un nom de fichier
--    fantaisiste.
--
-- 2. BUCKET PRIVÉ. Aucune URL publique, jamais. L'accès passe par des URL
--    signées à durée courte, générées pour un utilisateur déjà authentifié.
--
-- 3. TYPES RESTREINTS aux images matricielles. Le SVG est exclu
--    volontairement : c'est du XML exécutable, servi depuis notre domaine il
--    permettrait du script. Le HTML pour la même raison.
--
-- 4. TAILLE PLAFONNÉE à 5 Mo. Une photo de constat utile pèse moins de 1 Mo
--    une fois compressée ; au-delà, c'est un envoi non compressé — coûteux
--    pour un forfait payé au volume.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspections', 'inspections', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ---------------------------------------------------------------------------
-- Policies de fichiers
-- ---------------------------------------------------------------------------

-- Lecture : uniquement dans le dossier de son organisation, et uniquement si
-- l'on a le droit de voir les véhicules.
create policy "lire les photos de son organisation"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inspections'
    and (storage.foldername(name))[1] = vehora.current_org_id()::text
    and vehora.has_permission('vehicles.read')
  );

-- Envoi : même dossier, et permission d'inspecter. `can_write` ajoute le refus
-- des sessions d'assistance et des sessions révoquées.
create policy "envoyer une photo dans son organisation"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspections'
    and (storage.foldername(name))[1] = vehora.current_org_id()::text
    and vehora.has_permission('inspections.write')
    and not vehora.is_impersonating()
    and not vehora.is_revoked()
  );

-- Ni UPDATE ni DELETE, volontairement : une photo d'inspection est une pièce
-- du constat. Remplacer ou effacer une preuve après coup lui retirerait toute
-- valeur. Une photo erronée est corrigée par une nouvelle inspection, qui
-- laisse les deux visibles.
