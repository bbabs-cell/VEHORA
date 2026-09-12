import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';

export type Employe = Tables<'employees'>;
export type StatutEmploye = Enums<'employee_status'>;

export interface EmployeSaisi {
  readonly full_name: string;
  readonly phone: string | null;
  readonly station_id: string | null;
}

function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_TENANCY_VIOLATION')) {
    return 'Cet élément n’appartient pas à votre organisation.';
  }
  if (code === '23505') return 'Ce compte est déjà rattaché à un employé.';
  if (code === '42501') return 'Vous n’avez pas le droit d’effectuer cette action.';
  if (code === '23514') return 'Le nom doit faire entre 2 et 120 caractères.';
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return 'L’opération a échoué. Réessayez dans un instant.';
}

/**
 * Les employés sont les personnes qui travaillent, pas celles qui se
 * connectent (fondation 2). `profile_id` reste nul dans le cas courant : un
 * laveur n'a pas de compte, et son travail doit quand même être tracé.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly supabase = inject(SupabaseService);

  private readonly _employes = signal<Employe[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly employes = this._employes.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  async charger(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client
      .from('employees')
      .select('*')
      .order('status')
      .order('full_name')
      .limit(200);

    this._chargement.set(false);
    if (error) {
      this._erreur.set(message(error.code, error.message));
      return;
    }
    this._employes.set(data ?? []);
  }

  async creer(employe: EmployeSaisi): Promise<string | null> {
    const { error } = await this.supabase.client.from('employees').insert(employe);
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  async modifier(id: string, employe: EmployeSaisi): Promise<string | null> {
    const { error } = await this.supabase.client.from('employees').update(employe).eq('id', id);
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /**
   * On désactive, on ne supprime pas : l'historique de travail d'un employé
   * doit survivre à son départ. Aucune policy DELETE n'existe d'ailleurs.
   */
  async changerStatut(id: string, statut: StatutEmploye): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('employees')
      .update({ status: statut })
      .eq('id', id);
    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }
}
