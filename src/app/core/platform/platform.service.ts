import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';

/** Une organisation cliente, vue de la plateforme : métadonnées et volumes. */
export interface OrganisationPlateforme {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly country_code: string;
  readonly city: string | null;
  readonly status: Enums<'organization_status'>;
  readonly currency: string;
  readonly created_at: string;
  readonly stations: number;
  readonly membres_actifs: number;
  readonly vehicules: number;
  readonly dossiers: number;
  readonly dossiers_30j: number;
  readonly derniere_activite: string | null;
}

/** Le plan d'une organisation cliente, et ce qu'elle en consomme. */
export interface AbonnementPlateforme {
  readonly organization_id: string;
  readonly organisation: string;
  readonly plan_code: string;
  readonly plan_label: string;
  readonly price_minor: number;
  readonly currency: string;
  readonly max_stations: number | null;
  readonly max_users: number | null;
  readonly status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE';
  readonly started_at: string;
  readonly trial_ends_at: string | null;
  readonly stations_utilisees: number;
  readonly membres_actifs: number;
}

export interface EntreeJournal {
  readonly id: number;
  readonly occurred_at: string;
  readonly actor_label: string | null;
  readonly organization_id: string | null;
  readonly action: string;
  readonly resource_id: string | null;
  readonly reason: string | null;
}

export const LIBELLES_STATUT_ORG: Readonly<Record<Enums<'organization_status'>, string>> = {
  TRIAL: 'Essai',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspendue',
  EXPIRED: 'Expirée',
  DEACTIVATED: 'Désactivée',
};

export const LIBELLES_ACTION: Readonly<Record<string, string>> = {
  'platform.organization.suspend': 'Suspension',
  'platform.organization.reactivate': 'Réactivation',
  'platform.subscription.change': 'Changement de plan',
  'platform.feature.toggle': 'Fonctionnalité',
  'platform.invoices.issue': 'Émission de factures',
  'platform.invoices.dunning': 'Relance des impayés',
  'platform.invoice.paid': 'Facture réglée',
  'platform.invoice.void': 'Facture annulée',
};

/** Une facture, telle que la vue de plateforme la rend. */
export interface FacturePlateforme {
  readonly id: string;
  readonly reference: string;
  readonly organization_id: string | null;
  readonly organization_label: string;
  readonly plan_code: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly status: 'ISSUED' | 'PAID' | 'VOID';
  readonly issued_at: string;
  readonly due_date: string;
  readonly paid_at: string | null;
  readonly payment_reference: string | null;
  readonly void_reason: string | null;
  readonly en_retard: boolean;
  readonly jours_de_retard: number;
}

export const LIBELLES_STATUT_FACTURE: Readonly<Record<FacturePlateforme['status'], string>> = {
  ISSUED: 'À régler',
  PAID: 'Réglée',
  VOID: 'Annulée',
};

function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_PLATEFORME_REFUSEE')) {
    return 'Cette action est réservée à la plateforme.';
  }
  if (brut.includes('VEHORA_MOTIF_REQUIS')) return 'Un motif est obligatoire.';
  if (brut.includes('VEHORA_DROIT_REQUIS')) {
    return 'La facturation est réservée à la plateforme.';
  }
  if (brut.includes('VEHORA_FACTURE_DEJA_PAYEE')) {
    return 'Cette facture est déjà réglée : une facture réglée ne s’annule pas, elle se rembourse.';
  }
  if (brut.includes('VEHORA_FACTURE_ANNULEE')) {
    return 'Cette facture est annulée : elle ne se règle pas.';
  }
  if (brut.includes('VEHORA_FACTURE_INTROUVABLE')) return 'Cette facture n’existe pas.';
  if (brut.includes('VEHORA_FACTURE_IMMUABLE')) {
    return 'Une facture émise ne se modifie pas.';
  }
  if (brut.includes('VEHORA_DELAI_INVALIDE')) {
    return 'Le délai de paiement va de 0 à 180 jours.';
  }
  if (brut.includes('VEHORA_PLAN_TROP_ETROIT')) {
    return 'Ce plan est plus étroit que ce que l’organisation utilise déjà.';
  }
  if (brut.includes('VEHORA_PLAN_INCHANGE')) return 'Cette organisation est déjà sur ce plan.';
  if (brut.includes('VEHORA_PLAN_INTROUVABLE')) return 'Ce plan n’existe pas.';
  if (brut.includes('VEHORA_FONCTIONNALITE_INCONNUE')) {
    return 'Cette fonctionnalité n’existe pas.';
  }
  if (brut.includes('VEHORA_DEJA_SUSPENDUE')) return 'Cette organisation est déjà suspendue.';
  if (brut.includes('VEHORA_NON_SUSPENDUE')) return 'Cette organisation n’est pas suspendue.';
  if (brut.includes('VEHORA_ORGANISATION_INTROUVABLE')) {
    return 'Cette organisation n’existe pas.';
  }
  if (code === '42501') return 'Vous n’avez pas le droit d’effectuer cette action.';
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return 'L’opération a échoué. Réessayez dans un instant.';
}

/**
 * Accès de la plateforme.
 *
 * Aucune méthode ne lit une table métier d'un client : ce service ne connaît
 * que deux vues d'agrégats et deux fonctions privilégiées. C'est volontaire —
 * si un jour quelqu'un ajoute ici un `from('service_orders')`, c'est que la
 * règle a été franchie.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly supabase = inject(SupabaseService);

  private readonly _organisations = signal<OrganisationPlateforme[]>([]);
  private readonly _abonnements = signal<AbonnementPlateforme[]>([]);
  private readonly _plans = signal<Tables<'plans'>[]>([]);
  private readonly _journal = signal<EntreeJournal[]>([]);
  private readonly _factures = signal<FacturePlateforme[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly organisations = this._organisations.asReadonly();
  readonly abonnements = this._abonnements.asReadonly();
  readonly plans = this._plans.asReadonly();
  readonly journal = this._journal.asReadonly();
  readonly factures = this._factures.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  async charger(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const [organisations, journal, abonnements, plans] = await Promise.all([
      this.supabase.client.from('platform_organizations').select('*').order('name').limit(500),
      this.supabase.client
        .from('platform_audit_logs')
        .select('id, occurred_at, actor_label, organization_id, action, resource_id, reason')
        .order('occurred_at', { ascending: false })
        .limit(50),
      this.supabase.client.from('platform_subscriptions').select('*').limit(500),
      this.supabase.client.from('plans').select('*').order('sort_order'),
    ]);

    this._chargement.set(false);

    const echec = organisations.error ?? journal.error ?? abonnements.error ?? plans.error;
    if (echec) {
      this._erreur.set(message(echec.code, echec.message));
      return;
    }

    this._organisations.set(organisations.data ?? []);
    this._journal.set(journal.data ?? []);
    this._abonnements.set(abonnements.data ?? []);
    this._plans.set(plans.data ?? []);
  }

  /**
   * Les factures de la plateforme. Chargées séparément de `charger()` : elles
   * ne concernent qu'un écran, et le tableau des organisations n'a pas à
   * attendre après elles.
   */
  async chargerFactures(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client
      .from('platform_invoices')
      .select('*')
      .order('issued_at', { ascending: false })
      .limit(300);

    this._chargement.set(false);
    if (error) {
      this._erreur.set(message(error.code, error.message));
      this._factures.set([]);
      return;
    }
    this._factures.set((data ?? []) as FacturePlateforme[]);
  }

  /**
   * Émet les factures d'une période. Idempotent : rejoué sur le même mois, il
   * ne produit rien de plus — l'index unique en base le garantit, pas une
   * précaution d'écran.
   */
  async emettreFactures(periode: string, delaiJours = 15): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('emettre_factures', {
      p_periode: periode,
      p_delai_jours: delaiJours,
    });

    if (error) return message(error.code, error.message);
    await this.chargerFactures();
    return null;
  }

  async marquerPayee(factureId: string, reference: string): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('marquer_facture_payee', {
      p_invoice_id: factureId,
      p_reference: reference || undefined,
    });

    if (error) return message(error.code, error.message);
    await this.chargerFactures();
    return null;
  }

  async annulerFacture(factureId: string, motif: string): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('annuler_facture', {
      p_invoice_id: factureId,
      p_motif: motif,
    });

    if (error) return message(error.code, error.message);
    await this.chargerFactures();
    return null;
  }

  /**
   * Passe en impayé les abonnements dont une facture a dépassé son échéance.
   * C'est un état, pas une sanction : la suspension reste une décision prise
   * ailleurs, et auditée.
   */
  async relancerImpayes(): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('relancer_impayes');
    if (error) return message(error.code, error.message);
    await this.chargerFactures();
    return null;
  }

  /**
   * Suspendre coupe l'accès sans jamais supprimer ni altérer les données du
   * client. Le motif est obligatoire et rejoint le journal de plateforme.
   */
  async suspendre(organisationId: string, motif: string): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('suspendre_organisation', {
      p_organization_id: organisationId,
      p_motif: motif,
    });

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  async reactiver(organisationId: string, motif: string): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('reactiver_organisation', {
      p_organization_id: organisationId,
      p_motif: motif,
    });

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /**
   * Change le plan. La base clôt l'abonnement en cours et en ouvre un nouveau
   * dans la même transaction, et refuse un plan plus étroit que l'usage réel :
   * l'écran ne fait que transmettre le motif.
   */
  async changerPlan(
    organisationId: string,
    planCode: string,
    motif: string,
  ): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('changer_plan', {
      p_organization_id: organisationId,
      p_plan_code: planCode,
      p_motif: motif,
    });

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /** `actif = null` retire la dérogation : l'organisation revient à son plan. */
  async basculerFonctionnalite(
    organisationId: string,
    cle: string,
    actif: boolean | null,
    motif: string,
  ): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('basculer_fonctionnalite', {
      p_organization_id: organisationId,
      p_cle: cle,
      p_actif: actif,
      p_motif: motif,
    });

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }
}
