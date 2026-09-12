import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Tables } from '../../types/database.types';

export type Organisation = Pick<
  Tables<'organizations'>,
  'id' | 'name' | 'city' | 'country_code' | 'currency' | 'status'
>;

/**
 * Organisation active de l'utilisateur.
 *
 * Aucun filtre sur `organization_id` n'est nécessaire ici : la RLS ne renvoie
 * déjà que l'organisation portée par le JWT. Filtrer côté client en plus
 * donnerait l'illusion que c'est le filtre qui protège.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly supabase = inject(SupabaseService);

  private readonly _organisation = signal<Organisation | null>(null);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly organisation = this._organisation.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  async charger(): Promise<void> {
    if (this._chargement()) return;

    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client
      .from('organizations')
      .select('id, name, city, country_code, currency, status')
      .limit(1)
      .maybeSingle();

    this._chargement.set(false);

    if (error) {
      this._erreur.set('Impossible de charger votre organisation.');
      return;
    }
    this._organisation.set(data);
  }
}
