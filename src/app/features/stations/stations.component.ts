import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { StationService, type Station } from '../../core/stations/station.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmationComponent } from '../../shared/ui/confirmation.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

@Component({
  selector: 'vh-stations',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    EmptyStateComponent,
    IconComponent,
    SkeletonComponent,
    ConfirmationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stations.component.html',
  styleUrl: './stations.component.css',
})
export class StationsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly stations = inject(StationService);

  /** Station en cours d'édition ; `null` = création. */
  readonly enEdition = signal<Station | null>(null);
  readonly formulaireOuvert = signal(false);
  readonly enregistrement = signal(false);
  readonly erreurFormulaire = signal<string | null>(null);

  readonly peutGerer = computed(() => this.auth.hasPermission('stations.manage'));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    city: [''],
    address: [''],
    phone: [''],
    kind: ['FIXED' as 'FIXED' | 'MOBILE'],
  });

  constructor() {
    void this.stations.charger();
  }

  ouvrirCreation(): void {
    this.enEdition.set(null);
    this.erreurFormulaire.set(null);
    this.form.reset({ name: '', city: '', address: '', phone: '', kind: 'FIXED' });
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(station: Station): void {
    this.enEdition.set(station);
    this.erreurFormulaire.set(null);
    this.form.reset({
      name: station.name,
      city: station.city ?? '',
      address: station.address ?? '',
      phone: station.phone ?? '',
      kind: station.kind,
    });
    this.formulaireOuvert.set(true);
  }

  fermer(): void {
    this.formulaireOuvert.set(false);
  }

  async enregistrer(): Promise<void> {
    if (this.form.invalid || this.enregistrement()) {
      this.form.markAllAsTouched();
      return;
    }

    const valeurs = this.form.getRawValue();
    const station = {
      name: valeurs.name.trim(),
      city: valeurs.city.trim() || null,
      address: valeurs.address.trim() || null,
      phone: valeurs.phone.trim() || null,
      kind: valeurs.kind,
    };

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);

    const enCours = this.enEdition();
    const erreur = enCours
      ? await this.stations.modifier(enCours.id, station)
      : await this.stations.creer(station);

    this.enregistrement.set(false);

    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.formulaireOuvert.set(false);
  }

  /**
   * Désactiver plutôt que supprimer : une station porte un historique de
   * prestations et de caisse. La supprimer effacerait ce passé.
   */
  /** Station dont on s'apprête à couper l'activité, le temps de confirmer. */
  readonly aDesactiver = signal<Station | null>(null);

  texteDesactivation(station: Station): string {
    return (
      `« ${station.name} » n’apparaîtra plus dans les écrans opérationnels. ` +
      `Son historique de prestations et de caisse est conservé.`
    );
  }

  async basculerStatut(station: Station): Promise<void> {
    if (station.status === 'ACTIVE') {
      this.aDesactiver.set(station);
      return;
    }
    await this.stations.changerStatut(station.id, 'ACTIVE');
  }

  async confirmerDesactivation(): Promise<void> {
    const station = this.aDesactiver();
    if (!station) return;
    await this.stations.changerStatut(station.id, 'INACTIVE');
    this.aDesactiver.set(null);
  }
}
