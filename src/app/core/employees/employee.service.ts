import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';
import { MessagesErreur, traduireErreur } from '../erreurs/traduire-erreur';

export type Employe = Tables<'employees'>;
export type StatutEmploye = Enums<'employee_status'>;

export interface EmployeSaisi {
  readonly full_name: string;
  readonly phone: string | null;
  readonly station_id: string | null;
}

/** Messages propres à ce service ; le reste vient de `traduireErreur`. */
const MESSAGES: MessagesErreur = {
  codes: {
    '23505': 'Ce compte est déjà rattaché à un employé.',
    '23514': 'Le nom doit faire entre 2 et 120 caractères.',
  },
};

function message(code: string | undefined, brut: string): string {
  return traduireErreur({ code, message: brut }, MESSAGES);
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
