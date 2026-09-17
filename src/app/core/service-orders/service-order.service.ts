import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';

export type StatutDossier = Enums<'service_order_status'>;
export type LigneDossier = Tables<'service_order_items'>;

/** Un dossier tel qu'il s'affiche en file d'attente : tout en une requête. */
export interface DossierListe {
  readonly id: string;
  readonly number: number;
  readonly status: StatutDossier;
  readonly arrived_at: string;
  readonly station_id: string;
  readonly vehicle_id: string;
  readonly notes: string | null;
  readonly plaque: string | null;
  readonly type_vehicule: string;
  readonly client: string | null;
  readonly total_minor: number;
  readonly currency: string | null;
  readonly lignes: number;
  readonly balance_minor: number;
  readonly payment_status: SoldeDossier['payment_status'];
}

/** Libellés français des statuts. Stockés en anglais, affichés en français. */
/** Montant dû, joint à la file : l'exploitant doit voir qui reste à encaisser. */
export interface SoldeDossier {
  readonly service_order_id: string;
  readonly balance_minor: number;
  readonly payment_status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
}

export const LIBELLES_STATUT: Readonly<Record<StatutDossier, string>> = {
  ARRIVED: 'Arrivé',
  INSPECTION: 'Inspection',
  WAITING: 'En attente',
  IN_PROGRESS: 'En cours',
  CONTROL: 'Contrôle',
  READY: 'Prêt',
  DELIVERED: 'Restitué',
  CANCELLED: 'Annulé',
};

/** Ordre de la file : ce que l'exploitant lit de haut en bas, le matin. */
export const ORDRE_FILE: readonly StatutDossier[] = [
  'ARRIVED',
  'INSPECTION',
  'WAITING',
  'IN_PROGRESS',
  'CONTROL',
  'READY',
];

/**
 * Traduit les exceptions nommées de la base en phrases utilisables. Le code
 * d'erreur seul (« 42501 ») ne dit rien au réceptionniste qui a un client
 * devant lui.
 */
function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_INSPECTION_ABSENTE')) {
    return 'Enregistrez l’inspection avant de mettre le véhicule en file d’attente.';
  }
  if (brut.includes('VEHORA_INSPECTION_REQUISE')) {
    return 'Votre organisation exige une inspection avant la file d’attente.';
  }
  if (brut.includes('VEHORA_MOTIF_REQUIS')) return 'Un motif est obligatoire.';
  if (brut.includes('VEHORA_TRANSITION_INTERDITE')) {
    return 'Ce changement d’état n’est pas prévu depuis le statut actuel.';
  }
  if (brut.includes('VEHORA_SANS_TARIF')) {
    return 'Aucun tarif n’est défini pour cette prestation sur ce type de véhicule.';
  }
  if (brut.includes('VEHORA_DOSSIER_ENGAGE')) {
    return 'Le travail a commencé : les prestations du dossier ne changent plus.';
  }
  if (brut.includes('VEHORA_DOSSIER_CLOS')) {
    return 'Ce dossier est restitué ou annulé : il n’est plus modifiable.';
  }
  if (brut.includes('VEHORA_REMISE_EXCESSIVE')) {
    return 'Cette remise dépasse le plafond de votre organisation.';
  }
  if (brut.includes('VEHORA_HORS_PERIMETRE') || brut.includes('VEHORA_PERMISSION')) {
    return 'Vous n’avez pas le droit d’effectuer cette action.';
  }
  if (brut.includes('VEHORA_TENANCY_VIOLATION')) {
    return 'Cet élément n’appartient pas à votre organisation.';
  }
  if (code === '23505') return 'Cette prestation est déjà dans le dossier.';
  if (code === '42501') return 'Vous n’avez pas le droit d’effectuer cette action.';
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return 'L’opération a échoué. Réessayez dans un instant.';
}

// Les jointures PostgREST sont des littéraux : sortis en constante, le typage
// se perd et tout devient `any`.
//
// `service_order_totals` n'est PAS jointe ici : PostgREST n'embarque une vue
// que s'il peut en déduire une clé étrangère, et une vue agrégée n'en a pas.
// Les totaux sont donc lus par une seconde requête, en parallèle — le calcul
// reste côté serveur, ce qui est la règle.
const SELECT_DOSSIER = `
  id, number, status, arrived_at, station_id, vehicle_id, notes,
  vehicles!service_orders_vehicle_id_fkey ( plate, vehicle_types ( label ) ),
  customers!service_orders_customer_id_fkey ( full_name )
` as const;

@Injectable({ providedIn: 'root' })
export class ServiceOrderService {
  private readonly supabase = inject(SupabaseService);

  private readonly _dossiers = signal<DossierListe[]>([]);
  private readonly _lignes = signal<LigneDossier[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly dossiers = this._dossiers.asReadonly();
  readonly lignes = this._lignes.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  /** Réponses hors séquence sur réseau instable. */
  private requeteCourante = 0;

  /**
   * La file du jour : les dossiers non terminés. Les dossiers restitués et
   * annulés n'ont rien à faire sur un écran d'exploitation — ils relèvent de
   * l'historique.
   */
  async chargerFile(): Promise<void> {
    const identifiant = ++this.requeteCourante;
    this._chargement.set(true);
    this._erreur.set(null);

    const dossiers = await this.supabase.client
      .from('service_orders')
      .select(SELECT_DOSSIER)
      .not('status', 'in', '("DELIVERED","CANCELLED")')
      .order('arrived_at')
      .limit(100);

    if (identifiant !== this.requeteCourante) return;

    const { data, error } = dossiers;
    if (error) {
      this._chargement.set(false);
      this._erreur.set(message(error.code, error.message));
      return;
    }

    /**
     * Les deux vues agrégées se lisent POUR LES DOSSIERS CHARGÉS, pas en bloc.
     * Les lire en bloc avec une limite était une bombe à retardement : passé
     * ce nombre de dossiers dans l'organisation, la ligne du dossier le plus
     * récent tombait hors de la réponse, et sa carte affichait « Impayé » sur
     * un dossier réglé. Silencieux, et faux au pire endroit — c'est le montant
     * que lit le caissier avant de laisser partir une voiture.
     */
    const identifiants = (data ?? []).map((d) => d.id);
    const [totaux, soldes] = await Promise.all([
      identifiants.length === 0
        ? { data: [], error: null }
        : this.supabase.client
            .from('service_order_totals')
            .select('service_order_id, total_amount_minor, currency, lignes')
            .in('service_order_id', identifiants),
      identifiants.length === 0
        ? { data: [], error: null }
        : this.supabase.client
            .from('service_order_payment_state')
            .select('service_order_id, balance_minor, payment_status')
            .in('service_order_id', identifiants),
    ]);

    if (identifiant !== this.requeteCourante) return;
    this._chargement.set(false);

    if (totaux.error || soldes.error) {
      this._erreur.set(
        message((totaux.error ?? soldes.error!).code, (totaux.error ?? soldes.error!).message),
      );
      return;
    }

    const parDossier = new Map((totaux.data ?? []).map((t) => [t.service_order_id, t]));
    // `service_order_payment_state` est une vue agrégée : PostgREST ne peut pas
    // la joindre, elle se lit à part. Le calcul reste côté serveur.
    const parSolde = new Map((soldes.data ?? []).map((s) => [s.service_order_id, s]));

    this._dossiers.set(
      (data ?? []).map((d) => ({
        id: d.id,
        number: d.number,
        status: d.status,
        arrived_at: d.arrived_at,
        station_id: d.station_id,
        vehicle_id: d.vehicle_id,
        notes: d.notes,
        plaque: d.vehicles?.plate ?? null,
        type_vehicule: d.vehicles?.vehicle_types?.label ?? '',
        client: d.customers?.full_name ?? null,
        total_minor: parDossier.get(d.id)?.total_amount_minor ?? 0,
        currency: parDossier.get(d.id)?.currency ?? null,
        lignes: parDossier.get(d.id)?.lignes ?? 0,
        balance_minor: parSolde.get(d.id)?.balance_minor ?? 0,
        payment_status: parSolde.get(d.id)?.payment_status ?? 'UNPAID',
      })),
    );
  }

  /**
   * Ouvre un dossier. Le numéro, l'organisation et le statut initial viennent
   * de la base : on n'envoie que ce qui relève du choix de l'utilisateur.
   */
  async ouvrir(dossier: {
    station_id: string;
    vehicle_id: string;
    customer_id: string | null;
    notes: string | null;
  }): Promise<{ id: string | null; erreur: string | null }> {
    const { data, error } = await this.supabase.client
      .from('service_orders')
      .insert(dossier)
      .select('id')
      .single();

    if (error) return { id: null, erreur: message(error.code, error.message) };
    await this.chargerFile();
    return { id: data.id, erreur: null };
  }

  async chargerLignes(dossierId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('service_order_items')
      .select('*')
      .eq('service_order_id', dossierId)
      .order('created_at');

    if (error) {
      this._erreur.set(message(error.code, error.message));
      return;
    }
    this._lignes.set(data ?? []);
  }

  /**
   * Ajoute une prestation. Aucun montant n'est envoyé : c'est la base qui
   * résout le tarif et le copie dans la ligne. Un montant venu du navigateur
   * serait un montant négociable.
   */
  async ajouterPrestation(dossierId: string, serviceId: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('service_order_items')
      .insert({ service_order_id: dossierId, service_id: serviceId });

    if (error) return message(error.code, error.message);
    await Promise.all([this.chargerLignes(dossierId), this.chargerFile()]);
    return null;
  }

  async retirerPrestation(dossierId: string, ligneId: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('service_order_items')
      .delete()
      .eq('id', ligneId);

    if (error) return message(error.code, error.message);
    await Promise.all([this.chargerLignes(dossierId), this.chargerFile()]);
    return null;
  }

  /**
   * Le seul chemin pour changer un statut. Un `UPDATE` direct est rejeté par
   * un trigger — la règle est en base, pas dans ce service.
   */
  async transitionner(
    dossierId: string,
    versStatut: StatutDossier,
    motif: string | null = null,
  ): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('transitionner_dossier', {
      p_service_order_id: dossierId,
      p_to_status: versStatut,
      p_reason: motif,
    });

    if (error) return message(error.code, error.message);
    await this.chargerFile();
    return null;
  }

  /** Les transitions praticables depuis un statut, telles que la base les définit. */
  async transitionsDisponibles(): Promise<Tables<'service_order_transitions'>[]> {
    const { data } = await this.supabase.client.from('service_order_transitions').select('*');
    return data ?? [];
  }
}
