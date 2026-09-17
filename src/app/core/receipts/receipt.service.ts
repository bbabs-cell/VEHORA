import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Tables } from '../../types/database.types';

export type Recu = Tables<'receipts'>;

/**
 * Le contenu d'un reçu est une copie figée, écrite par la base au moment de
 * l'émission. On le relit tel quel : ces types décrivent ce que la base y a mis,
 * ils ne servent pas à le construire. Tout y est optionnel côté lecture, parce
 * qu'un reçu émis il y a deux ans n'a pas forcément la forme d'aujourd'hui — et
 * un écran d'impression ne doit jamais tomber en panne sur un champ manquant.
 */
export interface LigneRecu {
  readonly prestation?: string;
  readonly quantite?: number;
  readonly unitaire_minor?: number;
  readonly remise_minor?: number;
  readonly total_minor?: number;
}

export interface PaiementRecu {
  readonly sens?: string;
  readonly moyen?: string;
  readonly fournisseur?: string | null;
  readonly reference?: string | null;
  readonly montant_minor?: number;
  readonly le?: string;
}

export interface ContenuRecu {
  readonly organisation?: { nom?: string; ville?: string | null; telephone?: string | null };
  readonly station?: { nom?: string; ville?: string | null; telephone?: string | null };
  readonly dossier?: { numero?: number; arrive_le?: string; restitue_le?: string | null };
  readonly client?: { nom?: string; telephone?: string | null } | null;
  readonly vehicule?: {
    plaque?: string | null;
    marque?: string | null;
    modele?: string | null;
    type?: string | null;
  };
  readonly lignes?: readonly LigneRecu[];
  readonly paiements?: readonly PaiementRecu[];
  readonly totaux?: {
    total_minor?: number;
    encaisse_minor?: number;
    solde_minor?: number;
    devise?: string;
  };
}

export interface LigneRapportJournalier {
  readonly jour: string;
  readonly station_id: string;
  readonly station_nom: string;
  readonly dossiers_livres: number;
  readonly encaisse_minor: number;
  readonly especes_minor: number;
  readonly mobile_minor: number;
  readonly autres_minor: number;
  readonly panier_moyen_minor: number;
}

export interface LigneRapportPrestations {
  readonly prestation: string;
  readonly quantite: number;
  readonly montant_minor: number;
}

function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_DOSSIER_SANS_LIGNE')) {
    return 'Ce dossier n’a aucune prestation : il n’y a rien à imprimer.';
  }
  if (brut.includes('VEHORA_DOSSIER_ANNULE')) {
    return 'Un dossier annulé ne donne pas lieu à un reçu.';
  }
  if (brut.includes('VEHORA_RECU_DEJA_CORRIGE')) {
    return 'Ce reçu a déjà été corrigé. Le reçu correctif fait foi.';
  }
  if (brut.includes('VEHORA_RECU_INTROUVABLE')) {
    return 'Le reçu à corriger n’appartient pas à ce dossier.';
  }
  if (brut.includes('VEHORA_DOSSIER_INTROUVABLE')) {
    return 'Ce dossier n’est pas dans votre périmètre.';
  }
  if (brut.includes('reports.read')) {
    return 'Vous n’avez pas le droit de consulter les rapports.';
  }
  if (brut.includes('VEHORA_PERIODE')) {
    return 'La période demandée est invalide : au maximum 366 jours, dans l’ordre.';
  }
  if (code === '42501') return 'Vous n’avez pas le droit d’effectuer cette action.';
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return 'L’opération a échoué. Réessayez dans un instant.';
}

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly supabase = inject(SupabaseService);

  private readonly _recus = signal<Recu[]>([]);
  private readonly _journalier = signal<LigneRapportJournalier[]>([]);
  private readonly _prestations = signal<LigneRapportPrestations[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly recus = this._recus.asReadonly();
  readonly journalier = this._journalier.asReadonly();
  readonly prestations = this._prestations.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  /** Les reçus d'un dossier, du plus récent au plus ancien. */
  async chargerDossier(dossierId: string): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client
      .from('receipts')
      .select('*')
      .eq('service_order_id', dossierId)
      .order('issued_at', { ascending: false });

    this._chargement.set(false);
    if (error) {
      this._erreur.set(message(error.code, error.message));
      return;
    }
    this._recus.set(data ?? []);
  }

  async chargerRecu(recuId: string): Promise<Recu | null> {
    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client
      .from('receipts')
      .select('*')
      .eq('id', recuId)
      .maybeSingle();

    this._chargement.set(false);
    if (error) {
      this._erreur.set(message(error.code, error.message));
      return null;
    }
    return data;
  }

  /**
   * Émet un reçu. Le client n'envoie ni numéro, ni montant, ni contenu : tout
   * est établi par la base. Un reçu correctif référence celui qu'il remplace.
   */
  async emettre(dossierId: string, remplace?: string): Promise<Recu | string> {
    this._erreur.set(null);
    const { data, error } = await this.supabase.client.rpc('emettre_recu', {
      p_service_order_id: dossierId,
      ...(remplace ? { p_replaces_receipt_id: remplace } : {}),
    });

    if (error) {
      const m = message(error.code, error.message);
      this._erreur.set(m);
      return m;
    }
    await this.chargerDossier(dossierId);
    return data;
  }

  async chargerRapports(debut: string, fin: string, station?: string): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const args = { p_debut: debut, p_fin: fin, ...(station ? { p_station: station } : {}) };
    const [journalier, prestations] = await Promise.all([
      this.supabase.client.rpc('rapport_journalier', args),
      this.supabase.client.rpc('rapport_prestations', args),
    ]);

    this._chargement.set(false);

    const echec = journalier.error ?? prestations.error;
    if (echec) {
      this._erreur.set(message(echec.code, echec.message));
      this._journalier.set([]);
      this._prestations.set([]);
      return;
    }

    this._journalier.set(journalier.data ?? []);
    this._prestations.set(prestations.data ?? []);
  }

  /** Lecture défensive du contenu figé : il vient de la base, pas du client. */
  contenu(recu: Recu): ContenuRecu {
    return (recu.contenu ?? {}) as ContenuRecu;
  }
}
