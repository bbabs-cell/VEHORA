import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Tables, TablesInsert } from '../../types/database.types';
import { rempliParLaBase, uneLigneDeVue } from '../../types/frontiere';

export type CategorieService = Tables<'service_categories'>;
export type PrestationService = Tables<'services'>;
export type TarifService = Tables<'service_prices'>;

export interface PrestationSaisie {
  readonly name: string;
  readonly description: string | null;
  readonly duration_minutes: number | null;
  readonly category_id: string | null;
  readonly is_active: boolean;
}

export interface TarifSaisi {
  readonly service_id: string;
  readonly vehicle_type_id: string | null;
  readonly station_id: string | null;
  readonly amount_minor: number;
  readonly valid_from: string;
  readonly valid_to: string | null;
}

/** Résultat de `resoudre_prix`. `null` = aucun tarif : l'appelant doit refuser. */
export interface PrixResolu {
  readonly price_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly specificite: 'SERVICE_TYPE_STATION' | 'SERVICE_TYPE' | 'SERVICE_STATION' | 'SERVICE';
}

function message(code: string | undefined, brut: string): string {
  if (code === '23505') return 'Ce nom est déjà utilisé dans votre catalogue.';
  if (code === '23P01' || brut.includes('service_prices_no_overlap')) {
    return 'Un tarif identique couvre déjà cette période. Fermez-le avant d’en ouvrir un autre.';
  }
  if (brut.includes('VEHORA_TENANCY_VIOLATION')) {
    return "Cet élément n'appartient pas à votre organisation.";
  }
  if (code === '42501') return "Vous n'avez pas le droit d'effectuer cette action.";
  if (code === '23514') return 'Vérifiez le montant et les dates saisis.';
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return "L'opération a échoué. Réessayez dans un instant.";
}

@Injectable({ providedIn: 'root' })
export class CatalogueService {
  private readonly supabase = inject(SupabaseService);

  private readonly _categories = signal<CategorieService[]>([]);
  private readonly _prestations = signal<PrestationService[]>([]);
  private readonly _tarifs = signal<TarifService[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly categories = this._categories.asReadonly();
  readonly prestations = this._prestations.asReadonly();
  readonly tarifs = this._tarifs.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  async charger(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    // Un catalogue de station tient largement sous ces bornes ; la limite est
    // là pour qu'une organisation atypique ne fasse pas ramer un téléphone.
    const [categories, prestations, tarifs] = await Promise.all([
      this.supabase.client
        .from('service_categories')
        .select('*')
        .order('sort_order')
        .order('name')
        .limit(100),
      this.supabase.client
        .from('services')
        .select('*')
        .order('sort_order')
        .order('name')
        .limit(300),
      this.supabase.client
        .from('service_prices')
        .select('*')
        .order('valid_from', { ascending: false })
        .limit(1000),
    ]);

    this._chargement.set(false);

    const echec = categories.error ?? prestations.error ?? tarifs.error;
    if (echec) {
      this._erreur.set(message(echec.code, echec.message));
      return;
    }

    this._categories.set(categories.data ?? []);
    this._prestations.set(prestations.data ?? []);
    this._tarifs.set(tarifs.data ?? []);
  }

  async creerCategorie(nom: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('service_categories')
      .insert({ name: nom.trim() });
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  async creerPrestation(prestation: PrestationSaisie): Promise<string | null> {
    const { error } = await this.supabase.client.from('services').insert(prestation);
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  async modifierPrestation(id: string, prestation: PrestationSaisie): Promise<string | null> {
    const { error } = await this.supabase.client.from('services').update(prestation).eq('id', id);
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /**
   * `currency` n'est volontairement pas envoyée : la base la remplit depuis
   * l'organisation. Un client ne choisit pas la devise dans laquelle il facture.
   */
  async creerTarif(tarif: TarifSaisi): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('service_prices')
      .insert(rempliParLaBase<TablesInsert<'service_prices'>>(tarif));
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /**
   * On ne supprime pas un tarif passé : on le ferme à la veille de sa
   * succession. L'historique des prix est une donnée comptable.
   */
  async fermerTarif(id: string, finDeValidite: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('service_prices')
      .update({ valid_to: finDeValidite })
      .eq('id', id);
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /**
   * Augmenter un prix, c'est fermer l'ancien et ouvrir le nouveau. Les deux
   * écritures doivent réussir ensemble : une coupure réseau entre les deux
   * laisserait la prestation sans tarif, donc invendable. D'où une seule
   * fonction serveur plutôt que deux appels d'ici.
   */
  async remplacerTarif(
    id: string,
    montantMineur: number,
    aPartirDu: string,
  ): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('remplacer_tarif', {
      p_price_id: id,
      p_amount_minor: montantMineur,
      p_valid_from: aPartirDu,
    });
    if (error) {
      if (error.message.includes('VEHORA_TARIF_ANTERIEUR')) {
        return 'Le nouveau tarif doit commencer après le début du tarif actuel.';
      }
      return message(error.code, error.message);
    }
    await this.charger();
    return null;
  }

  /**
   * Un tarif qui n'a jamais pris effet n'a rien facturé : le supprimer ne
   * réécrit aucun passé. La base refuse de toute façon l'écriture à qui n'a
   * pas `prices.manage` — la garde d'interface n'est qu'un confort.
   */
  async supprimerTarifFutur(id: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('service_prices')
      .delete()
      .eq('id', id)
      .gt('valid_from', new Date().toISOString().slice(0, 10));
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /** Le prix applicable, déterminé par le serveur. Jamais calculé ici. */
  async resoudrePrix(
    serviceId: string,
    vehicleTypeId: string | null = null,
    stationId: string | null = null,
  ): Promise<PrixResolu | null> {
    const { data, error } = await this.supabase.client.rpc('resoudre_prix', {
      p_service_id: serviceId,
      // Omettre l'argument laisse la fonction appliquer son défaut, qui est
      // `null` : c'est la même chose, dit dans le langage du générateur.
      p_vehicle_type_id: vehicleTypeId ?? undefined,
      p_station_id: stationId ?? undefined,
    });
    if (error || !data || data.length === 0) return null;
    // `specificite` est un `text` côté serveur : la fonction ne peut pas le
    // typer plus finement, l'écran si.
    return uneLigneDeVue<PrixResolu>(data[0]);
  }
}
