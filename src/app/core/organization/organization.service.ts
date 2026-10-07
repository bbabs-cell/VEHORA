import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';

export type Organisation = Pick<
  Tables<'organizations'>,
  'id' | 'name' | 'city' | 'country_code' | 'currency' | 'status'
>;

/** La fiche complète, telle que l'écran « Paramètres » la règle. */
export type FicheOrganisation = Pick<
  Tables<'organizations'>,
  | 'id'
  | 'name'
  | 'city'
  | 'address'
  | 'phone'
  | 'email'
  | 'country_code'
  | 'currency'
  | 'timezone'
  | 'status'
>;

/**
 * Ce qu'un propriétaire a le droit de régler. La devise, le raccourci et l'état
 * n'y sont pas : un trigger les refuse en base, et les proposer à l'écran
 * reviendrait à afficher une action que le serveur refusera.
 */
export interface FicheModifiable {
  readonly name: string;
  readonly city: string | null;
  readonly address: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly country_code: string;
}

export type ReglagesOrganisation = Tables<'organization_settings'>;

/** Ce qui se règle dans les paramètres métier. */
export interface ReglagesModifiables {
  readonly require_inspection: boolean;
  readonly require_quality_control: boolean;
  readonly payment_before_delivery: Enums<'payment_before_delivery_rule'>;
  readonly max_discount_percent: number;
}

function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_ORG_DEVISE')) {
    return 'La devise ne se change pas ici : aucun montant déjà enregistré ne serait converti.';
  }
  if (brut.includes('VEHORA_ORG_IDENTITE')) {
    return 'Cette information identifie votre organisation et ne se modifie pas.';
  }
  if (brut.includes('VEHORA_ORG_STATUT')) {
    return 'L’état de votre organisation est géré par VEHORA.';
  }
  if (code === '23514') return 'Une valeur saisie est hors des limites autorisées.';
  if (code === '42501') return 'Vous n’avez pas le droit de modifier ces paramètres.';
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return 'L’enregistrement a échoué. Réessayez dans un instant.';
}

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

  private readonly _nombreMembres = signal<number | null>(null);
  readonly nombreMembres = this._nombreMembres.asReadonly();

  private readonly _fiche = signal<FicheOrganisation | null>(null);
  private readonly _reglages = signal<ReglagesOrganisation | null>(null);
  readonly fiche = this._fiche.asReadonly();
  readonly reglages = this._reglages.asReadonly();

  /**
   * Compte les membres actifs. `head: true` ne rapatrie aucune ligne : sur un
   * réseau lent, compter ne doit pas coûter le transfert de la table.
   *
   * La RLS n'expose ces lignes qu'aux porteurs de `users.manage` ; pour les
   * autres, le compte vaut 0 et la tuile n'est pas affichée.
   */
  async compterMembres(): Promise<void> {
    const { count, error } = await this.supabase.client
      .from('organization_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    this._nombreMembres.set(error ? null : (count ?? 0));
  }

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

  /**
   * La fiche et les réglages, pour l'écran « Paramètres ». Les deux tables sont
   * lues ensemble : la RLS ne rend que celles de l'organisation du jeton, il
   * n'y a rien à filtrer.
   */
  async chargerParametres(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const [fiche, reglages] = await Promise.all([
      this.supabase.client
        .from('organizations')
        .select('id, name, city, address, phone, email, country_code, currency, timezone, status')
        .limit(1)
        .maybeSingle(),
      this.supabase.client.from('organization_settings').select('*').limit(1).maybeSingle(),
    ]);

    this._chargement.set(false);

    if (fiche.error || reglages.error) {
      this._erreur.set('Impossible de charger vos paramètres.');
      return;
    }
    this._fiche.set(fiche.data);
    this._reglages.set(reglages.data);
  }

  /**
   * Enregistre la fiche. Aucun identifiant n'est envoyé : la RLS restreint déjà
   * la mise à jour à l'organisation du jeton, et ajouter un `eq('id', …)` ici
   * laisserait croire que c'est ce filtre qui protège.
   */
  async enregistrerFiche(fiche: FicheModifiable): Promise<string | null> {
    const organisation = this._fiche();
    if (!organisation) return 'Vos paramètres ne sont pas chargés.';

    const { error } = await this.supabase.client
      .from('organizations')
      .update(fiche)
      .eq('id', organisation.id);

    if (error) return message(error.code, error.message);
    await this.chargerParametres();
    await this.charger();
    return null;
  }

  async enregistrerReglages(reglages: ReglagesModifiables): Promise<string | null> {
    const organisation = this._fiche();
    if (!organisation) return 'Vos paramètres ne sont pas chargés.';

    const { error } = await this.supabase.client
      .from('organization_settings')
      .update(reglages)
      .eq('organization_id', organisation.id);

    if (error) return message(error.code, error.message);
    await this.chargerParametres();
    return null;
  }
}
