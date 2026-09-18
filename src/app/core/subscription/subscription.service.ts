import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';

/** Ce qu'une organisation a le droit de savoir d'elle-même. */
export interface MonAbonnement {
  readonly plan_code: string;
  readonly plan_label: string;
  readonly statut: 'TRIAL' | 'ACTIVE' | 'PAST_DUE';
  readonly essai_jusqu_au: string | null;
  /** `null` veut dire « sans limite », jamais zéro. */
  readonly max_stations: number | null;
  readonly max_users: number | null;
  readonly stations_utilisees: number;
  readonly membres_actifs: number;
}

export interface Fonctionnalite {
  readonly cle: string;
  readonly libelle: string;
  readonly actif: boolean;
}

/** Une facture, telle que l'organisation a le droit de la voir : la sienne. */
export interface MaFacture {
  readonly reference: string;
  readonly periode_debut: string;
  readonly periode_fin: string;
  readonly montant_minor: number;
  readonly devise: string;
  readonly statut: 'ISSUED' | 'PAID' | 'VOID';
  readonly echeance: string;
  readonly payee_le: string | null;
  readonly en_retard: boolean;
}

export const LIBELLES_STATUT_FACTURE_CLIENT: Readonly<Record<MaFacture['statut'], string>> = {
  ISSUED: 'À régler',
  PAID: 'Réglée',
  VOID: 'Annulée',
};

export const LIBELLES_STATUT_ABONNEMENT: Readonly<Record<MonAbonnement['statut'], string>> = {
  TRIAL: 'Essai',
  ACTIVE: 'Actif',
  PAST_DUE: 'Paiement en retard',
};

/**
 * Les fonctionnalités sont résolues par la base (organisation → plan → défaut).
 * Ce service ne fait que lire le résultat : masquer un écran est un confort,
 * jamais une autorisation — l'API refuse de son côté.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly supabase = inject(SupabaseService);

  private readonly _abonnement = signal<MonAbonnement | null>(null);
  private readonly _fonctionnalites = signal<Fonctionnalite[]>([]);
  private readonly _factures = signal<MaFacture[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);
  private charge = false;

  readonly abonnement = this._abonnement.asReadonly();
  readonly fonctionnalites = this._fonctionnalites.asReadonly();
  readonly factures = this._factures.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  /** Vrai seulement si la base l'a dit. Une clé inconnue est fermée. */
  actif(cle: string): boolean {
    return this._fonctionnalites().find((f) => f.cle === cle)?.actif ?? false;
  }

  /**
   * Ses propres factures. La fonction serveur ne prend aucun paramètre : il n'y
   * a donc rien à falsifier, et elle ne parle que de l'organisation du jeton.
   */
  async chargerFactures(): Promise<void> {
    const { data, error } = await this.supabase.client.rpc('mes_factures');
    if (error) {
      this._erreur.set(
        error.message.toLowerCase().includes('failed to fetch')
          ? 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.'
          : 'Vos factures n’ont pas pu être chargées.',
      );
      this._factures.set([]);
      return;
    }
    this._factures.set((data ?? []) as unknown as MaFacture[]);
  }

  async charger(forcer = false): Promise<void> {
    if (this.charge && !forcer) return;
    this._chargement.set(true);
    this._erreur.set(null);

    const [abonnement, fonctionnalites] = await Promise.all([
      this.supabase.client.rpc('mon_abonnement'),
      this.supabase.client.rpc('mes_fonctionnalites'),
    ]);

    this._chargement.set(false);

    if (abonnement.error || fonctionnalites.error) {
      const echec = abonnement.error ?? fonctionnalites.error!;
      this._erreur.set(
        echec.message.toLowerCase().includes('failed to fetch')
          ? 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.'
          : 'Impossible de lire votre abonnement pour le moment.',
      );
      return;
    }

    this.charge = true;
    this._abonnement.set(abonnement.data?.[0] ?? null);
    this._fonctionnalites.set(fonctionnalites.data ?? []);
  }
}
