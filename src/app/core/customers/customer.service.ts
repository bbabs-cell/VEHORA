import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Tables } from '../../types/database.types';

export type Client = Tables<'customers'>;
export interface ClientSaisi {
  readonly full_name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly notes: string | null;
  /**
   * Le client accepte d'être prévenu par message. Un refus est respecté par la
   * base — aucune notification n'est mise en file —, pas seulement par l'écran.
   */
  readonly accepte_notifications: boolean;
}

/** Taille de page : assez pour remplir un écran, assez peu pour un réseau lent. */
const PAGE = 25;

function message(code: string | undefined, brut: string): string {
  if (code === '23505') return 'Un client existe déjà avec ce numéro de téléphone.';
  if (code === '23514') return 'Le nom doit comporter entre 2 et 120 caractères.';
  if (code === '42501') return "Vous n'avez pas le droit d'effectuer cette action.";
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return "L'opération a échoué. Réessayez dans un instant.";
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly supabase = inject(SupabaseService);

  private readonly _clients = signal<Client[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);
  private readonly _finDeListe = signal(false);
  private readonly _recherche = signal('');

  readonly clients = this._clients.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();
  readonly finDeListe = this._finDeListe.asReadonly();
  readonly recherche = this._recherche.asReadonly();

  /**
   * Identifie la dernière recherche lancée. Sur un réseau instable les réponses
   * arrivent dans le désordre : sans ce garde-fou, une réponse périmée
   * écraserait une plus récente et la liste afficherait le mauvais résultat.
   */
  private requeteCourante = 0;

  async rechercher(terme: string): Promise<void> {
    this._recherche.set(terme);
    await this.charger(terme, 0);
  }

  /** Page suivante, sans perdre ce qui est déjà affiché. */
  async chargerSuite(): Promise<void> {
    if (this._chargement() || this._finDeListe()) return;
    await this.charger(this._recherche(), this._clients().length);
  }

  private async charger(terme: string, decalage: number): Promise<void> {
    const identifiant = ++this.requeteCourante;
    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client.rpc('rechercher_clients', {
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
    this._clients.set(decalage === 0 ? page : [...this._clients(), ...page]);
  }

  async creer(client: ClientSaisi): Promise<string | null> {
    const { error } = await this.supabase.client.from('customers').insert(client);
    if (error) return message(error.code, error.message);
    await this.charger(this._recherche(), 0);
    return null;
  }

  async modifier(id: string, client: ClientSaisi): Promise<string | null> {
    const { error } = await this.supabase.client.from('customers').update(client).eq('id', id);
    if (error) return message(error.code, error.message);
    await this.charger(this._recherche(), 0);
    return null;
  }

  /**
   * Archiver, pas supprimer : un client porte un historique de prestations et
   * de paiements. L'archivage libère son numéro pour une nouvelle fiche.
   */
  async archiver(id: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('customers')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return message(error.code, error.message);
    await this.charger(this._recherche(), 0);
    return null;
  }
}
