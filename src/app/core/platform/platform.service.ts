import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums } from '../../types/database.types';

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
};

function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_PLATEFORME_REFUSEE')) {
    return 'Cette action est réservée à la plateforme.';
  }
  if (brut.includes('VEHORA_MOTIF_REQUIS')) return 'Un motif est obligatoire.';
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
  private readonly _journal = signal<EntreeJournal[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly organisations = this._organisations.asReadonly();
  readonly journal = this._journal.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  async charger(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const [organisations, journal] = await Promise.all([
      this.supabase.client
        .from('platform_organizations')
        .select('*')
        .order('name')
        .limit(500),
      this.supabase.client
        .from('platform_audit_logs')
        .select('id, occurred_at, actor_label, organization_id, action, resource_id, reason')
        .order('occurred_at', { ascending: false })
        .limit(50),
    ]);

    this._chargement.set(false);

    const echec = organisations.error ?? journal.error;
    if (echec) {
      this._erreur.set(message(echec.code, echec.message));
      return;
    }

    this._organisations.set(organisations.data ?? []);
    this._journal.set(journal.data ?? []);
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
}
