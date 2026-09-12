-- VEHORA — Phase 7 : suppression contrôlée d'une photo d'inspection.
--
-- Constat de l'audit. Le choix initial — aucune suppression possible, la photo
-- est une preuve — était juste sur le principe et faux en pratique :
--
-- * une photo envoyée par erreur (photo personnelle, mauvais véhicule) reste
--   indéfiniment, sans aucun recours ;
-- * le droit à l'effacement impose de pouvoir retirer une donnée personnelle
--   sur demande — et une plaque d'immatriculation en est une ;
-- * la protection de Supabase interdit même la suppression en SQL direct, donc
--   il n'existait littéralement AUCUN chemin.
--
-- Compromis retenu : la suppression est possible, mais réservée au porteur de
-- `organization.manage` — le propriétaire, seul responsable légal de
-- l'organisation — et elle est tracée dans `audit_logs`.
--
-- Un opérateur ou un réceptionniste ne peut donc pas faire disparaître une
-- preuve gênante ; le responsable le peut, et cela se voit.

create policy "supprimer une photo de son organisation"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'inspections'
    and (storage.foldername(name))[1] = vehora.current_org_id()::text
    and vehora.has_permission('organization.manage')
    and not vehora.is_impersonating()
    and not vehora.is_revoked()
  );

-- Toute suppression laisse une trace : c'est ce qui rend le compromis
-- acceptable. Sans elle, on aurait simplement rouvert la porte.
create or replace function vehora.audit_suppression_photo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.bucket_id = 'inspections' then
    perform vehora.write_audit_log(
      'inspection_photo.deleted', 'storage_object', old.name,
      nullif((storage.foldername(old.name))[1], '')::uuid, null,
      jsonb_build_object('path', old.name), null,
      'Suppression d''une photo d''inspection');
  end if;
  return old;
end;
$$;

create trigger inspections_photo_suppression_auditee
  after delete on storage.objects
  for each row execute function vehora.audit_suppression_photo();
