import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { OrganizationService } from '../../core/organization/organization.service';
import { ReceiptService } from '../../core/receipts/receipt.service';
import { StationService } from '../../core/stations/station.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { formaterDate, formaterMontant } from '../../shared/format/montant';

/** `2026-09-17`, dans le fuseau de l'appareil — pas en UTC. */
function jourLocal(decalageJours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

@Component({
  selector: 'vh-rapports',
  standalone: true,
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rapports.component.html',
  styleUrl: './rapports.component.css',
})
export class RapportsComponent {
  private readonly organisation = inject(OrganizationService);
  private readonly stationsService = inject(StationService);
  readonly rapports = inject(ReceiptService);

  readonly stations = computed(() => this.stationsService.stations());
  readonly devise = computed(() => this.organisation.organisation()?.currency ?? 'XOF');

  readonly debut = signal(jourLocal(-6));
  readonly fin = signal(jourLocal());
  readonly station = signal<string>('');

  /**
   * Un `<input type="date">` s'affiche dans la locale de l'appareil : sur un
   * Android en anglais, « 09/13/2026 ». La période est donc aussi écrite en
   * toutes lettres — c'est elle qui engage la lecture des chiffres.
   */
  readonly periodeLisible = computed(
    () => `du ${formaterDate(this.debut())} au ${formaterDate(this.fin())}`,
  );

  readonly totalEncaisse = computed(() =>
    this.rapports.journalier().reduce((s, l) => s + l.encaisse_minor, 0),
  );
  readonly totalDossiers = computed(() =>
    this.rapports.journalier().reduce((s, l) => s + l.dossiers_livres, 0),
  );
  readonly totalEspeces = computed(() =>
    this.rapports.journalier().reduce((s, l) => s + l.especes_minor, 0),
  );
  readonly totalMobile = computed(() =>
    this.rapports.journalier().reduce((s, l) => s + l.mobile_minor, 0),
  );

  /** Période absurde : le bouton reste inerte, et la raison est affichée. */
  readonly raisonInvalide = computed(() => {
    if (!this.debut() || !this.fin()) return 'Choisissez un début et une fin de période.';
    if (this.fin() < this.debut()) return 'La fin de la période précède son début.';
    const jours =
      (Date.parse(`${this.fin()}T00:00:00`) - Date.parse(`${this.debut()}T00:00:00`)) / 86_400_000;
    if (jours > 366) return 'Une période couvre au maximum 366 jours.';
    return null;
  });

  constructor() {
    void this.organisation.charger();
    void this.stationsService.charger();
    void this.actualiser();
  }

  montant(mineur: number): string {
    return formaterMontant(mineur, this.devise());
  }

  jour(iso: string): string {
    return formaterDate(iso);
  }

  surDebut(evenement: Event): void {
    this.debut.set((evenement.target as HTMLInputElement).value);
  }

  surFin(evenement: Event): void {
    this.fin.set((evenement.target as HTMLInputElement).value);
  }

  surStation(evenement: Event): void {
    this.station.set((evenement.target as HTMLSelectElement).value);
  }

  async actualiser(): Promise<void> {
    if (this.raisonInvalide()) return;
    await this.rapports.chargerRapports(this.debut(), this.fin(), this.station() || undefined);
  }
}
