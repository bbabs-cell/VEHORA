import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables, TablesInsert } from '../../types/database.types';
import { MessagesErreur, traduireErreur } from '../erreurs/traduire-erreur';

export type Station = Tables<'stations'>;
export type StationNouvelle = Pick<
  TablesInsert<'stations'>,
  'name' | 'city' | 'address' | 'phone' | 'kind'
>;

/** Traduction des erreurs PostgreSQL en messages utilisables. */
/** Messages propres à ce service ; le reste vient de `traduireErreur`. */
const MESSAGES: MessagesErreur = {
  codes: { '23505': 'Une station porte déjà ce nom dans votre organisation.' },
};

function messageErreur(code: string | undefined, message: string): string {
  return traduireErreur({ code, message: message }, MESSAGES);
}

@Injectable({ providedIn: 'root' })
export class StationService {
  private readonly supabase = inject(SupabaseService);

  private readonly _stations = signal<Station[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly stations = this._stations.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  /**
   * Aucun filtre sur `organization_id` : la RLS ne renvoie déjà que les
   * stations accessibles. Un filtre client donnerait l'illusion qu'il protège.
   */
  async charger(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client
      .from('stations')
      .select('*')
      .order('name', { ascending: true })
      .limit(100);

    this._chargement.set(false);

    if (error) {
      this._erreur.set(messageErreur(error.code, error.message));
      return;
    }
    this._stations.set(data ?? []);
  }

  /**
   * `organization_id` n'est pas envoyé : la base le remplit depuis le JWT
   * (migration 20260912120000). Une valeur que le client n'envoie pas est une
   * valeur qu'il ne peut pas falsifier.
   */
  async creer(station: StationNouvelle): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('stations')
      // Le type généré exige organization_id ; la base fournit la valeur.
      .insert(station as StationNouvelle & { organization_id: string });

    if (error) return messageErreur(error.code, error.message);
    await this.charger();
    return null;
  }

  async modifier(id: string, station: StationNouvelle): Promise<string | null> {
    const { error } = await this.supabase.client.from('stations').update(station).eq('id', id);

    if (error) return messageErreur(error.code, error.message);
    await this.charger();
    return null;
  }

  async changerStatut(id: string, statut: Enums<'station_status'>): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('stations')
      .update({ status: statut })
      .eq('id', id);

    if (error) return messageErreur(error.code, error.message);
    await this.charger();
    return null;
  }
}
