import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { compresserPhoto } from '../photos/image-compression';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';

export type Zone = Tables<'inspection_zones'>;

/** Constat saisi pour une zone, avant enregistrement. */
export interface ConstatSaisi {
  readonly zoneId: string;
  readonly condition: Enums<'inspection_condition'>;
  readonly commentaire: string;
  readonly photos: readonly File[];
}

export interface ConstatZone {
  readonly zone: string;
  readonly condition: Enums<'inspection_condition'>;
  readonly comment: string | null;
}

export interface InspectionResume {
  readonly id: string;
  readonly performedAt: string;
  readonly notes: string | null;
  readonly anomalies: number;
  readonly total: number;
  readonly items: readonly ConstatZone[];
  /**
   * URL signées, valables 10 minutes. Rattachées à l'inspection et non à
   * chaque zone : sur un constat d'une minute, on ne demande pas à
   * l'utilisateur de ranger ses photos.
   */
  readonly urlsPhotos: readonly string[];
}

const BUCKET = 'inspections';

function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_TENANCY_VIOLATION')) {
    return "Ce véhicule n'appartient pas à votre organisation.";
  }
  if (code === '42501') return "Vous n'avez pas le droit de réaliser une inspection.";
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return "L'enregistrement a échoué. Réessayez dans un instant.";
}

@Injectable({ providedIn: 'root' })
export class InspectionService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly _zones = signal<Zone[]>([]);
  private readonly _historique = signal<InspectionResume[]>([]);
  private readonly _chargement = signal(false);
  private readonly _progression = signal<string | null>(null);

  readonly zones = this._zones.asReadonly();
  readonly historique = this._historique.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly progression = this._progression.asReadonly();

  async chargerZones(): Promise<void> {
    if (this._zones().length > 0) return;
    const { data } = await this.supabase.client
      .from('inspection_zones')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    this._zones.set(data ?? []);
  }

  /**
   * Enregistre l'inspection en trois temps : le constat, puis les zones, puis
   * les photos. Les photos passent en dernier : ce sont elles qui échouent sur
   * un réseau faible, et le constat écrit doit survivre à leur échec.
   */
  async enregistrer(
    vehiculeId: string,
    constats: readonly ConstatSaisi[],
    notes: string,
  ): Promise<{ erreur: string | null; photosEchouees: number }> {
    this._chargement.set(true);
    this._progression.set('Enregistrement du constat…');

    const { data: inspection, error } = await this.supabase.client
      .from('vehicle_inspections')
      .insert({
        vehicle_id: vehiculeId,
        notes: notes.trim() || null,
        performed_by: this.auth.claims().sub || null,
      })
      .select('id')
      .single();

    if (error || !inspection) {
      this._chargement.set(false);
      this._progression.set(null);
      return { erreur: message(error?.code, error?.message ?? ''), photosEchouees: 0 };
    }

    const { data: items, error: erreurItems } = await this.supabase.client
      .from('inspection_items')
      .insert(
        constats.map((c) => ({
          inspection_id: inspection.id,
          zone_id: c.zoneId,
          condition: c.condition,
          comment: c.commentaire.trim() || null,
        })),
      )
      .select('id, zone_id');

    if (erreurItems) {
      this._chargement.set(false);
      this._progression.set(null);
      return { erreur: message(erreurItems.code, erreurItems.message), photosEchouees: 0 };
    }

    const parZone = new Map((items ?? []).map((i) => [i.zone_id, i.id]));
    const photosEchouees = await this.envoyerPhotos(inspection.id, constats, parZone);

    this._chargement.set(false);
    this._progression.set(null);
    return { erreur: null, photosEchouees };
  }

  private async envoyerPhotos(
    inspectionId: string,
    constats: readonly ConstatSaisi[],
    parZone: Map<string, string>,
  ): Promise<number> {
    const orgId = this.auth.claims().orgId;
    if (!orgId) return 0;

    const aEnvoyer = constats.flatMap((c) =>
      c.photos.map((photo) => ({ photo, itemId: parZone.get(c.zoneId) ?? null })),
    );

    let echecs = 0;
    let envoyees = 0;

    for (const { photo, itemId } of aEnvoyer) {
      envoyees += 1;
      this._progression.set(`Envoi de la photo ${envoyees} sur ${aEnvoyer.length}…`);

      try {
        const compressee = await compresserPhoto(photo);
        // Chemin imposé : le premier segment est l'organisation, c'est lui que
        // les policies de fichiers vérifient.
        const chemin = `${orgId}/${inspectionId}/${crypto.randomUUID()}.${compressee.extension}`;

        const { error } = await this.supabase.client.storage
          .from(BUCKET)
          .upload(chemin, compressee.fichier, { contentType: compressee.type });

        if (error) {
          echecs += 1;
          continue;
        }

        await this.supabase.client.from('inspection_photos').insert({
          inspection_id: inspectionId,
          item_id: itemId,
          storage_path: chemin,
        });
      } catch {
        // Une photo perdue ne doit jamais faire perdre le constat.
        echecs += 1;
      }
    }

    return echecs;
  }

  /** Historique d'un véhicule, avec des URL signées à durée courte. */
  async chargerHistorique(vehiculeId: string): Promise<void> {
    this._chargement.set(true);

    const { data } = await this.supabase.client
      .from('vehicle_inspections')
      .select(
        'id, performed_at, notes, inspection_items(condition, comment, inspection_zones(label)), inspection_photos(storage_path, item_id)',
      )
      .eq('vehicle_id', vehiculeId)
      .order('performed_at', { ascending: false })
      .limit(10);

    const resumes: InspectionResume[] = [];

    for (const inspection of data ?? []) {
      const items = inspection.inspection_items ?? [];
      const photos = inspection.inspection_photos ?? [];

      const urls = await this.signer(photos.map((p) => p.storage_path));

      resumes.push({
        id: inspection.id,
        performedAt: inspection.performed_at,
        notes: inspection.notes,
        anomalies: items.filter((i) => i.condition === 'ANOMALY').length,
        total: items.length,
        items: items.map((i) => ({
          zone: i.inspection_zones?.label ?? '',
          condition: i.condition,
          comment: i.comment,
        })),
        urlsPhotos: urls,
      });
    }

    this._historique.set(resumes);
    this._chargement.set(false);
  }

  /**
   * Signature des chemins. On ne stocke jamais d'URL publique : une photo de
   * véhicule porte une plaque d'immatriculation, donnée personnelle.
   */
  private async signer(chemins: readonly string[]): Promise<string[]> {
    if (chemins.length === 0) return [];
    const { data } = await this.supabase.client.storage
      .from(BUCKET)
      .createSignedUrls([...chemins], 600);
    return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => Boolean(u));
  }
}
