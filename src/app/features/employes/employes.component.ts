import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { EmployeeService, type Employe } from '../../core/employees/employee.service';
import { StationService } from '../../core/stations/station.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

@Component({
  selector: 'vh-employes',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employes.component.html',
  styleUrl: './employes.component.css',
})
export class EmployesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly stationsService = inject(StationService);
  readonly employes = inject(EmployeeService);

  readonly peutGerer = computed(() => this.auth.hasPermission('employees.manage'));
  readonly stations = computed(() => this.stationsService.stations());

  readonly formulaireOuvert = signal(false);
  readonly enEdition = signal<Employe | null>(null);
  readonly enregistrement = signal(false);
  readonly erreurFormulaire = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: [''],
    station_id: [''],
  });

  constructor() {
    void this.employes.charger();
    void this.stationsService.charger();
  }

  readonly actifs = computed(() => this.employes.employes().filter((e) => e.status === 'ACTIVE'));
  readonly inactifs = computed(() =>
    this.employes.employes().filter((e) => e.status !== 'ACTIVE'),
  );

  nomStation(employe: Employe): string {
    if (!employe.station_id) return 'Toutes stations';
    return this.stations().find((s) => s.id === employe.station_id)?.name ?? '';
  }

  ouvrirCreation(): void {
    this.enEdition.set(null);
    this.erreurFormulaire.set(null);
    this.form.reset({ full_name: '', phone: '', station_id: '' });
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(employe: Employe): void {
    this.enEdition.set(employe);
    this.erreurFormulaire.set(null);
    this.form.reset({
      full_name: employe.full_name,
      phone: employe.phone ?? '',
      station_id: employe.station_id ?? '',
    });
    this.formulaireOuvert.set(true);
  }

  fermer(): void {
    this.formulaireOuvert.set(false);
  }

  async enregistrer(): Promise<void> {
    if (this.enregistrement()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);

    const v = this.form.getRawValue();
    const saisie = {
      full_name: v.full_name.trim(),
      phone: v.phone.trim() || null,
      station_id: v.station_id || null,
    };

    const enEdition = this.enEdition();
    const erreur = enEdition
      ? await this.employes.modifier(enEdition.id, saisie)
      : await this.employes.creer(saisie);

    this.enregistrement.set(false);
    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.formulaireOuvert.set(false);
  }

  /** Désactiver, pas supprimer : l'historique de travail doit rester intact. */
  async basculer(employe: Employe): Promise<void> {
    this.erreurFormulaire.set(
      await this.employes.changerStatut(
        employe.id,
        employe.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      ),
    );
  }
}
