import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables, Views } from '../../types/database.types';

export type Paiement = Tables<'payments'>;
export type Caisse = Tables<'cash_registers'>;
export type MouvementCaisse = Tables<'cash_transactions'>;
export type SessionCaisse = Views<'cash_register_history'>;
export type MethodePaiement = Enums<'payment_method'>;

/** État financier d'un dossier, calculé par la base. Jamais additionné ici. */
export interface EtatFinancier {
  readonly service_order_id: string;
  readonly total_amount_minor: number;
  readonly paid_amount_minor: number;
  readonly balance_minor: number;
  readonly payment_status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
}

export const LIBELLES_METHODE: Readonly<Record<MethodePaiement, string>> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte',
  BANK_TRANSFER: 'Virement',
  OTHER: 'Autre',
};

/** Ordre du terrain : l'espèce d'abord, le Mobile Money ensuite. */
export const ORDRE_METHODES: readonly MethodePaiement[] = [
  'CASH',
  'MOBILE_MONEY',
  'CARD',
  'BANK_TRANSFER',
  'OTHER',
];

export const LIBELLES_ETAT: Readonly<Record<EtatFinancier['payment_status'], string>> = {
  UNPAID: 'Impayé',
  PARTIAL: 'Partiel',
  PAID: 'Soldé',
  OVERPAID: 'Trop-perçu',
};

function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_CAISSE_FERMEE')) {
    return 'Ouvrez votre caisse avant d’encaisser en espèces.';
  }
  if (brut.includes('VEHORA_CAISSE_CLOTUREE')) {
    return 'Cette session de caisse est clôturée.';
  }
  if (brut.includes('VEHORA_CLOTURE_DIRECTE')) {
    return 'La clôture passe par le bouton de clôture, pas autrement.';
  }
  if (brut.includes('VEHORA_COMPTAGE_REQUIS')) {
    return 'Déclarez le montant compté dans le tiroir.';
  }
  if (brut.includes('VEHORA_REMBOURSEMENT_NON_AUTORISE')) {
    return 'Vous n’avez pas le droit de rembourser.';
  }
  if (brut.includes('VEHORA_REMBOURSEMENT_EXCESSIF')) {
    return 'Le remboursement dépasse le paiement d’origine.';
  }
  if (brut.includes('VEHORA_DOSSIER_ANNULE')) {
    return 'Un dossier annulé ne s’encaisse pas.';
  }
  if (brut.includes('VEHORA_SOLDE_RESTANT')) {
    return 'Votre organisation exige un dossier soldé avant restitution.';
  }
  if (brut.includes('VEHORA_CREANCE_NON_AUTORISEE')) {
    return 'Vous n’avez pas le droit de restituer un véhicule avec un solde.';
  }
  if (brut.includes('VEHORA_MOTIF_REQUIS')) return 'Un motif est obligatoire.';
  if (code === '23505') return 'Une caisse est déjà ouverte à cette station pour vous.';
  if (code === '42501') return 'Vous n’avez pas le droit d’effectuer cette action.';
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return 'L’opération a échoué. Réessayez dans un instant.';
}

/** Une page d'historique. Au-delà, l'écran le dit au lieu de faire croire. */
const PAGE_HISTORIQUE = 200;

/** Le lendemain d'un jour `AAAA-MM-JJ`, pour une borne haute exclusive. */
function finExclusive(jour: string): string {
  const d = new Date(`${jour}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly supabase = inject(SupabaseService);

  private readonly _paiements = signal<Paiement[]>([]);
  private readonly _etat = signal<EtatFinancier | null>(null);
  private readonly _caisse = signal<Caisse | null>(null);
  private readonly _theorique = signal<number | null>(null);
  private readonly _mouvements = signal<MouvementCaisse[]>([]);
  private readonly _historique = signal<SessionCaisse[]>([]);
  private readonly _historiqueTronque = signal(false);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly paiements = this._paiements.asReadonly();
  readonly etat = this._etat.asReadonly();
  readonly caisse = this._caisse.asReadonly();
  readonly theorique = this._theorique.asReadonly();
  readonly mouvements = this._mouvements.asReadonly();
  readonly historique = this._historique.asReadonly();
  /** Vrai quand la page est pleine : il y a d'autres sessions derrière. */
  readonly historiqueTronque = this._historiqueTronque.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  /** Les paiements d'un dossier et son état financier, en une fois. */
  async chargerDossier(dossierId: string): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const [paiements, etat] = await Promise.all([
      this.supabase.client
        .from('payments')
        .select('*')
        .eq('service_order_id', dossierId)
        .order('created_at'),
      this.supabase.client
        .from('service_order_payment_state')
        .select('*')
        .eq('service_order_id', dossierId)
        .maybeSingle(),
    ]);

    this._chargement.set(false);

    const echec = paiements.error ?? etat.error;
    if (echec) {
      this._erreur.set(message(echec.code, echec.message));
      return;
    }

    this._paiements.set(paiements.data ?? []);
    this._etat.set(etat.data);
  }

  /**
   * La caisse ouverte de l'utilisateur à cette station, s'il en a une. C'est
   * la seule dans laquelle il peut encaisser — la base le vérifie aussi.
   */
  async chargerMaCaisse(stationId: string): Promise<void> {
    const { data: session } = await this.supabase.client.auth.getSession();
    const profil = session.session?.user.id;
    if (!profil) {
      this._caisse.set(null);
      return;
    }

    const { data, error } = await this.supabase.client
      .from('cash_registers')
      .select('*')
      .eq('station_id', stationId)
      .eq('opened_by', profil)
      .eq('status', 'OPEN')
      .maybeSingle();

    if (error) {
      this._erreur.set(message(error.code, error.message));
      return;
    }

    this._caisse.set(data);
    if (data) await this.chargerCaisse(data.id);
    else {
      this._theorique.set(null);
      this._mouvements.set([]);
    }
  }

  /** Solde théorique et mouvements d'une session. Le solde vient de la base. */
  async chargerCaisse(caisseId: string): Promise<void> {
    const [etat, mouvements] = await Promise.all([
      this.supabase.client
        .from('cash_register_state')
        .select('theoretical_minor')
        .eq('cash_register_id', caisseId)
        .maybeSingle(),
      this.supabase.client
        .from('cash_transactions')
        .select('*')
        .eq('cash_register_id', caisseId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    this._theorique.set(etat.data?.theoretical_minor ?? null);
    this._mouvements.set(mouvements.data ?? []);
  }

  /**
   * Les sessions clôturées, de la plus récente à la plus ancienne.
   *
   * La vue est en SECURITY INVOKER : elle ne rend que ce que la policy de
   * `cash_registers` laisse voir — ses propres sessions, ou toutes avec
   * `cash.reconcile`. Le filtre par station sert la lecture, pas la sécurité.
   *
   * On lit une page complète et on ne filtre rien côté client : deux fois déjà,
   * une requête limitée puis filtrée dans le navigateur a fait disparaître la
   * ligne la plus récente de l'écran.
   */
  async chargerHistorique(debut: string, fin: string, stationId?: string): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    let requete = this.supabase.client
      .from('cash_register_history')
      .select('*')
      .eq('status', 'CLOSED')
      // `fin` est un jour : on veut la journée entière, d'où la borne au jour
      // suivant plutôt qu'un `lte` qui s'arrêterait à minuit pile.
      .gte('closed_at', `${debut}T00:00:00`)
      .lt('closed_at', `${finExclusive(fin)}T00:00:00`)
      .order('closed_at', { ascending: false })
      .limit(PAGE_HISTORIQUE);

    if (stationId) requete = requete.eq('station_id', stationId);

    const { data, error } = await requete;
    this._chargement.set(false);

    if (error) {
      this._erreur.set(message(error.code, error.message));
      this._historique.set([]);
      this._historiqueTronque.set(false);
      return;
    }
    this._historique.set(data ?? []);
    // Un total qui vaut la taille de la page n'est pas un total : on le dit,
    // plutôt que d'annoncer « 200 sessions » quand il y en a mille.
    this._historiqueTronque.set((data?.length ?? 0) >= PAGE_HISTORIQUE);
  }

  async ouvrirCaisse(stationId: string, fondsMineur: number): Promise<string | null> {
    const { data: session } = await this.supabase.client.auth.getSession();
    const profil = session.session?.user.id;
    if (!profil) return 'Votre session a expiré. Reconnectez-vous.';

    const { error } = await this.supabase.client.from('cash_registers').insert({
      station_id: stationId,
      opened_by: profil,
      opening_float_minor: fondsMineur,
    });

    if (error) return message(error.code, error.message);
    await this.chargerMaCaisse(stationId);
    return null;
  }

  /**
   * La clôture calcule l'écart entre le comptage et le solde théorique. Le
   * client envoie ce qu'il a compté, jamais l'écart : sinon une caisse
   * tomberait toujours juste.
   */
  async cloturerCaisse(
    caisseId: string,
    compteMineur: number,
    note: string | null,
  ): Promise<{ ecart: number | null; erreur: string | null }> {
    const { data, error } = await this.supabase.client.rpc('cloturer_caisse', {
      p_cash_register_id: caisseId,
      p_declared_minor: compteMineur,
      p_note: note,
    });

    if (error) return { ecart: null, erreur: message(error.code, error.message) };
    return { ecart: data?.variance_minor ?? null, erreur: null };
  }

  /**
   * Un encaissement. Ni la station, ni la devise, ni la caisse ne sont
   * envoyées : la base les pose à partir du dossier et de la session ouverte.
   */
  async encaisser(
    dossierId: string,
    methode: MethodePaiement,
    montantMineur: number,
    fournisseur: string | null,
    reference: string | null,
  ): Promise<string | null> {
    const { error } = await this.supabase.client.from('payments').insert({
      service_order_id: dossierId,
      method: methode,
      amount_minor: montantMineur,
      provider_name: fournisseur,
      external_ref: reference,
    });

    if (error) return message(error.code, error.message);
    await this.chargerDossier(dossierId);
    return null;
  }

  /** Un paiement erroné ne se supprime pas : il s'annule par un remboursement. */
  async rembourser(
    dossierId: string,
    paiementId: string,
    montantMineur: number,
    motif: string,
  ): Promise<string | null> {
    const { error } = await this.supabase.client.from('payments').insert({
      service_order_id: dossierId,
      kind: 'REFUND',
      method: 'CASH', // écrasée par la base : celle du paiement d'origine.
      amount_minor: montantMineur,
      reverses_payment_id: paiementId,
      reason: motif,
    });

    if (error) return message(error.code, error.message);
    await this.chargerDossier(dossierId);
    return null;
  }

  /** Mouvement libre : achat de savon, appoint. Le motif est obligatoire. */
  async mouvementLibre(
    caisseId: string,
    sens: 'CASH_IN' | 'CASH_OUT',
    montantMineur: number,
    motif: string,
  ): Promise<string | null> {
    const { error } = await this.supabase.client.from('cash_transactions').insert({
      cash_register_id: caisseId,
      kind: sens,
      amount_minor: sens === 'CASH_OUT' ? -montantMineur : montantMineur,
      reason: motif,
    });

    if (error) return message(error.code, error.message);
    await this.chargerCaisse(caisseId);
    return null;
  }
}
