import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Tables } from '../../types/database.types';

export type TypeVehicule = Tables<'vehicle_types'>;

/** Vue de liste : le véhicule, son type et son propriétaire en une requête. */
export interface VehiculeListe {
  readonly id: string;
  readonly customer_id: string | null;
  readonly vehicle_type_id: string;
  readonly plate: string | null;
  readonly make: string | null;
  readonly model: string | null;
  readonly color: string | null;
  readonly notes: string | null;
  readonly type_label: string;
  readonly customer_name: string | null;
}

export interface VehiculeSaisi {
  readonly vehicle_type_id: string;
  readonly customer_id: string | null;
  readonly plate: string | null;
  readonly make: string | null;
  readonly model: string | null;
  readonly color: string | null;
  readonly notes: string | null;
}

const PAGE = 25;

function message(code: string | undefined, brut: string): string {
  if (code === '23505') return 'Un véhicule actif porte déjà cette plaque.';
  if (brut.includes('VEHORA_TENANCY_VIOLATION')) {
    return "Ce client n'appartient pas à votre organisation.";
  }
  if (code === '42501') return "Vous n'avez pas le droit d'effectuer cette action.";
  if (code === '23503') return 'Sélectionnez un type de véhicule.';
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return "L'opération a échoué. Réessayez dans un instant.";
}

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly supabase = inject(SupabaseService);

  private readonly _vehicules = signal<VehiculeListe[]>([]);
  private readonly _types = signal<TypeVehicule[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);
  private readonly _finDeListe = signal(false);
  private readonly _recherche = signal('');

  readonly vehicules = this._vehicules.asReadonly();
  readonly types = this._types.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();
  readonly finDeListe = this._finDeListe.asReadonly();
  readonly recherche = this._recherche.asReadonly();

  /** Réponses hors séquence sur réseau instable : la plus ancienne ne doit pas
   *  écraser la plus récente. */
  private requeteCourante = 0;

  async chargerTypes(): Promise<void> {
    if (this._types().length > 0) return;
    const { data } = await this.supabase.client
      .from('vehicle_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    this._types.set(data ?? []);
  }

  async rechercher(terme: string): Promise<void> {
    this._recherche.set(terme);
    await this.charger(terme, 0);
  }

  async chargerSuite(): Promise<void> {
    if (this._chargement() || this._finDeListe()) return;
    await this.charger(this._recherche(), this._vehicules().length);
  }

  private async charger(terme: string, decalage: number): Promise<void> {
    const identifiant = ++this.requeteCourante;
    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client.rpc('rechercher_vehicules', {
      p_recherche: terme.trim() || undefined,
      p_limite: PAGE,
      p_decalage: decalage,
    });

    if (identifiant !== this.requeteCourante) return;
    this._chargement.set(false);

    if (error) {
      this._erreur.set(message(error.code, error.message));
      return;
    }

    const page = data ?? [];
    this._finDeListe.set(page.length < PAGE);
    this._vehicules.set(decalage === 0 ? page : [...this._vehicules(), ...page]);
  }

  async creer(vehicule: VehiculeSaisi): Promise<string | null> {
    const { error } = await this.supabase.client.from('vehicles').insert(vehicule);
    if (error) return message(error.code, error.message);
    await this.charger(this._recherche(), 0);
    return null;
  }

  async modifier(id: string, vehicule: VehiculeSaisi): Promise<string | null> {
    const { error } = await this.supabase.client.from('vehicles').update(vehicule).eq('id', id);
    if (error) return message(error.code, error.message);
    await this.charger(this._recherche(), 0);
    return null;
  }

  /** Archiver, pas supprimer : le véhicule porte un historique de prestations.
   *  L'archivage libère sa plaque pour un autre véhicule. */
  async archiver(id: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('vehicles')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return message(error.code, error.message);
    await this.charger(this._recherche(), 0);
    return null;
  }
}
