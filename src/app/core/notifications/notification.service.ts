import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';
import { MessagesErreur, traduireErreur } from '../erreurs/traduire-erreur';

export type Notification = Tables<'notifications'>;
export type StatutNotification = Enums<'notification_status'>;

export const LIBELLES_STATUT_NOTIFICATION: Readonly<Record<StatutNotification, string>> = {
  PENDING: 'En attente',
  SENT: 'Envoyé',
  FAILED: 'Échec',
  CANCELLED: 'Annulé',
};

export const LIBELLES_ETAPE: Readonly<Record<string, string>> = {
  READY: 'Véhicule prêt',
  DELIVERED: 'Après restitution',
};

/** Messages propres à ce service ; le reste vient de `traduireErreur`. */
const MESSAGES: MessagesErreur = {
  marqueurs: {
    VEHORA_NOTIFICATION_PARTIE: 'Ce message n’est plus en attente : il ne s’annule plus.',
    VEHORA_NOTIFICATION_INTROUVABLE: 'Ce message n’existe pas.',
  },
};

function message(code: string | undefined, brut: string): string {
  return traduireErreur({ code, message: brut }, MESSAGES);
}

/** Une page : assez pour remplir un écran, assez peu pour un réseau lent. */
const PAGE = 100;

/**
 * La file des messages destinés aux clients.
 *
 * Ce service lit et annule. **Il n'envoie rien** : l'envoi demande un
 * fournisseur, et se branchera sur cette file par une fonction de bord. Aucune
 * méthode d'écriture n'existe ici, et la base n'a aucune policy d'insertion —
 * pouvoir écrire dans cette file, ce serait pouvoir envoyer un message au nom
 * de la station, avec le texte de son choix.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly supabase = inject(SupabaseService);

  private readonly _messages = signal<Notification[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  /**
   * On filtre sur le serveur, jamais après coup : une requête limitée puis
   * filtrée dans le navigateur a déjà fait disparaître deux fois la ligne la
   * plus récente de l'écran.
   */
  async charger(stationId?: string, statut?: StatutNotification): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    let requete = this.supabase.client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE);

    if (stationId) requete = requete.eq('station_id', stationId);
    if (statut) requete = requete.eq('status', statut);

    const { data, error } = await requete;
    this._chargement.set(false);

    if (error) {
      this._erreur.set(message(error.code, error.message));
      this._messages.set([]);
      return;
    }
    this._messages.set(data ?? []);
  }

  async annuler(id: string, motif: string): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('annuler_notification', {
      p_notification_id: id,
      p_motif: motif,
    });
    if (error) return message(error.code, error.message);
    return null;
  }
}
