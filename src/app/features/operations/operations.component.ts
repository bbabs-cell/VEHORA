import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { EmployeeService } from '../../core/employees/employee.service';
import {
  LIBELLES_OPERATION,
  ORDRE_OPERATIONS,
  OperationService,
  type OperationListe,
  type StatutOperation,
} from '../../core/operations/operation.service';
import {
  LIBELLES_STATUT,
  ServiceOrderService,
} from '../../core/service-orders/service-order.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

interface GroupeOperations {
  readonly statut: StatutOperation;
  readonly libelle: string;
  readonly operations: readonly OperationListe[];
}

/** L'action suivante sur une opération, et rien d'autre à décider. */
const SUITE: Partial<Record<StatutOperation, { vers: StatutOperation; libelle: string }>> = {
  PENDING: { vers: 'IN_PROGRESS', libelle: 'Démarrer' },
  IN_PROGRESS: { vers: 'DONE', libelle: 'Terminer' },
};

@Component({
  selector: 'vh-operations',
  standalone: true,
  imports: [EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operations.component.html',
  styleUrl: './operations.component.css',
})
export class OperationsComponent {
  private readonly auth = inject(AuthService);
  private readonly employesService = inject(EmployeeService);
  readonly dossiers = inject(ServiceOrderService);
  readonly operations = inject(OperationService);

  readonly peutAssigner = computed(() => this.auth.hasPermission('operations.assign'));
  readonly peutExecuter = computed(() => this.auth.hasPermission('operations.execute'));

  readonly enregistrement = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly assignationOuverte = signal<OperationListe | null>(null);

  constructor() {
    void this.operations.charger();
    void this.employesService.charger();
  }

  /** Seuls les employés actifs reçoivent du travail — la base le refuse aussi. */
  readonly employesAssignables = computed(() =>
    this.employesService.employes().filter((e) => e.status === 'ACTIVE'),
  );

  readonly groupes = computed<GroupeOperations[]>(() =>
    ORDRE_OPERATIONS.map((statut) => ({
      statut,
      libelle: LIBELLES_OPERATION[statut],
      operations: this.operations.operations().filter((o) => o.status === statut),
    })).filter((g) => g.operations.length > 0),
  );

  readonly vide = computed(() => this.operations.operations().length === 0);

  libelleStatutDossier(operation: OperationListe): string {
    return LIBELLES_STATUT[operation.statut_dossier];
  }

  nomEmploye(operation: OperationListe): string | null {
    if (!operation.employee_id) return null;
    return (
      this.employesService.employes().find((e) => e.id === operation.employee_id)?.full_name ?? '—'
    );
  }

  actionSuivante(operation: OperationListe): { vers: StatutOperation; libelle: string } | null {
    return SUITE[operation.status] ?? null;
  }

  /** Durée écoulée depuis le démarrage : ce qu'un chef de station surveille. */
  duree(operation: OperationListe): string | null {
    const depart = operation.started_at;
    if (!depart) return null;
    const fin = operation.completed_at ? new Date(operation.completed_at) : new Date();
    const minutes = Math.max(0, Math.round((fin.getTime() - new Date(depart).getTime()) / 60_000));
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  ouvrirAssignation(operation: OperationListe): void {
    this.erreur.set(null);
    this.assignationOuverte.set(operation);
  }

  fermerAssignation(): void {
    this.assignationOuverte.set(null);
  }

  async assigner(employeId: string | null): Promise<void> {
    const operation = this.assignationOuverte();
    if (!operation || this.enregistrement()) return;

    this.enregistrement.set(true);
    const erreur = await this.operations.assigner(operation.id, employeId);
    this.enregistrement.set(false);

    this.erreur.set(erreur);
    if (!erreur) this.assignationOuverte.set(null);
  }

  /**
   * Une opération démarrée par erreur — le mauvais véhicule, deux boutons
   * proches — doit pouvoir être remise à faire. La base l'autorise déjà
   * (IN_PROGRESS → PENDING) ; sans le bouton, l'opérateur était coincé.
   */
  async reprendre(operation: OperationListe): Promise<void> {
    if (operation.status !== 'IN_PROGRESS' || this.enregistrement()) return;

    this.enregistrement.set(true);
    this.erreur.set(await this.operations.avancer(operation.id, 'PENDING'));
    this.enregistrement.set(false);
  }

  async avancer(operation: OperationListe): Promise<void> {
    const suite = this.actionSuivante(operation);
    if (!suite || this.enregistrement()) return;

    this.enregistrement.set(true);
    this.erreur.set(await this.operations.avancer(operation.id, suite.vers));
    this.enregistrement.set(false);
  }
}
