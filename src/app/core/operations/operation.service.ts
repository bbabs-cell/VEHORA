import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';

export type Operation = Tables<'service_order_operations'>;
export type StatutOperation = Enums<'operation_status'>;

/** Une opération avec le dossier et le véhicule auxquels elle se rattache. */
export interface OperationListe extends Operation {
  readonly numero: number;
  readonly plaque: string | null;
  readonly statut_dossier: Enums<'service_order_status'>;
  readonly station_id: string;
}

export const LIBELLES_OPERATION: Readonly<Record<StatutOperation, string>> = {
  PENDING: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminée',
};

export const ORDRE_OPERATIONS: readonly StatutOperation[] = ['PENDING', 'IN_PROGRESS', 'DONE'];

function message(code: string | undefined, brut: string): string {
  if (brut.includes('VEHORA_OPERATION_SANS_EMPLOYE')) {
    return 'Assignez un employé avant de démarrer le travail.';
  }
  if (brut.includes('VEHORA_EMPLOYE_INACTIF')) {
    return 'Cet employé n’est plus actif.';
  }
  if (brut.includes('VEHORA_COMPETENCE_MANQUANTE')) {
    return 'Cet employé n’est pas déclaré pour cette prestation.';
  }
  if (brut.includes('VEHORA_OPERATION_TRANSITION')) {
    return 'Ce changement d’état n’est pas prévu depuis l’état actuel.';
  }
  if (brut.includes('VEHORA_DOSSIER_CLOS')) {
    return 'Ce dossier est restitué ou annulé : il n’est plus modifiable.';
  }
  if (brut.includes('VEHORA_PERMISSION') || code === '42501') {
    return 'Vous n’avez pas le droit d’effectuer cette action.';
  }
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return 'L’opération a échoué. Réessayez dans un instant.';
}

const SELECT_OPERATION = `
  *,
  service_orders!service_order_operations_service_order_id_fkey (
    number, status, station_id,
    vehicles!service_orders_vehicle_id_fkey ( plate )
  )
` as const;

@Injectable({ providedIn: 'root' })
export class OperationService {
  private readonly supabase = inject(SupabaseService);

  private readonly _operations = signal<OperationListe[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly operations = this._operations.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  private requeteCourante = 0;

  /**
   * Le travail du jour : les opérations des dossiers encore ouverts. Un
   * dossier restitué ou annulé n'a plus d'opération à faire.
   */
  async charger(): Promise<void> {
    const identifiant = ++this.requeteCourante;
    this._chargement.set(true);
    this._erreur.set(null);

    const { data, error } = await this.supabase.client
      .from('service_order_operations')
      .select(SELECT_OPERATION)
      .order('created_at')
      .limit(200);

    if (identifiant !== this.requeteCourante) return;
    this._chargement.set(false);

    if (error) {
      this._erreur.set(message(error.code, error.message));
      return;
    }

    this._operations.set(
      (data ?? [])
        .filter(
          (o) =>
            o.service_orders !== null &&
            o.service_orders.status !== 'DELIVERED' &&
            o.service_orders.status !== 'CANCELLED',
        )
        .map((o) => ({
          ...o,
          numero: o.service_orders!.number,
          plaque: o.service_orders!.vehicles?.plate ?? null,
          statut_dossier: o.service_orders!.status,
          station_id: o.service_orders!.station_id,
        })),
    );
  }

  /** Assigner exige `operations.assign` — vérifié par un trigger, pas ici. */
  async assigner(id: string, employeId: string | null): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('service_order_operations')
      .update({ employee_id: employeId })
      .eq('id', id);

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /**
   * Faire avancer exige `operations.execute`. Les horodatages de début et de
   * fin sont posés par la base : les envoyer d'ici serait accepter une durée
   * de travail dictée par le navigateur.
   */
  async avancer(id: string, statut: StatutOperation): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('service_order_operations')
      .update({ status: statut })
      .eq('id', id);

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }
}
