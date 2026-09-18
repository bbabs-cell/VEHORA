import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { OrganizationService } from '../../core/organization/organization.service';
import { PaymentService, type SessionCaisse } from '../../core/payments/payment.service';
import { StationService } from '../../core/stations/station.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { formaterDate, formaterMontant, versSaisie } from '../../shared/format/montant';
import { nomFichierCsv, nombreCsv, telechargerCsv, versCsv } from '../../shared/export/csv';

/** `2026-09-18`, dans le fuseau de l'appareil — pas en UTC. */
function jourLocal(decalageJours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

@Component({
  selector: 'vh-caisse-historique',
  standalone: true,
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './caisse-historique.component.html',
  styleUrl: './caisse-historique.component.css',
})
export class CaisseHistoriqueComponent {
  private readonly organisation = inject(OrganizationService);
  private readonly stationsService = inject(StationService);
  readonly paiements = inject(PaymentService);

  readonly stations = computed(() => this.stationsService.stations());
  readonly devise = computed(() => this.organisation.organisation()?.currency ?? 'XOF');

  readonly debut = signal(jourLocal(-29));
  readonly fin = signal(jourLocal());
  readonly station = signal<string>('');

  /**
   * Un `<input type="date">` s'affiche dans la locale de l'appareil : sur un
   * Android en anglais, « 09/13/2026 ». La période est donc aussi écrite en
   * toutes lettres.
   */
  readonly periodeLisible = computed(
    () => `du ${formaterDate(this.debut())} au ${formaterDate(this.fin())}`,
  );

  readonly sessions = computed(() => this.paiements.historique());

  /** Un total dont le détail ne fait pas la somme fait douter du reste. */
  readonly totalEcart = computed(() =>
    this.sessions().reduce((s, c) => s + (c.variance_minor ?? 0), 0),
  );
  readonly sessionsAvecEcart = computed(
    () => this.sessions().filter((c) => (c.variance_minor ?? 0) !== 0).length,
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

  montant(mineur: number | null): string {
    return formaterMontant(mineur ?? 0, this.devise());
  }

  /** Le cumul se lit avec les mêmes mots que chaque ligne. */
  readonly ecartCumuleLisible = computed(() => {
    const ecart = this.totalEcart();
    if (ecart === 0) return 'aucun';
    const absolu = this.montant(Math.abs(ecart));
    return ecart < 0 ? `${absolu} manquants` : `${absolu} en trop`;
  });

  /** L'écart porte son signe : « manque » et « en trop » ne se lisent pas pareil. */
  ecartLisible(session: SessionCaisse): string {
    const ecart = session.variance_minor ?? 0;
    if (ecart === 0) return 'Compte juste';
    const absolu = this.montant(Math.abs(ecart));
    return ecart < 0 ? `Manque ${absolu}` : `${absolu} en trop`;
  }

  classeEcart(session: SessionCaisse): string {
    const ecart = session.variance_minor ?? 0;
    if (ecart === 0) return 'ecart ecart--juste';
    return ecart < 0 ? 'ecart ecart--manque' : 'ecart ecart--excedent';
  }

  quand(iso: string | null): string {
    return iso ? formaterDate(iso) : '—';
  }

  heure(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * L'export porte l'écart en clair, dans sa colonne, avec son signe : c'est la
   * colonne qu'on trie en premier quand on cherche d'où vient un manque.
   */
  exporter(): void {
    const contenu = versCsv(
      ['Clôturée le', 'Station', 'Ouverte par', 'Clôturée par', 'Fonds d’ouverture',
       'Entrées', 'Sorties', 'Théorique', 'Compté', 'Écart', 'Mouvements', 'Remarque',
       'Devise'],
      this.sessions().map((s) => [
        s.closed_at ?? '',
        s.station_name ?? '',
        s.opened_by_name ?? '',
        s.closed_by_name ?? '',
        versSaisie(s.opening_float_minor ?? 0, this.devise()),
        versSaisie(s.entrees_minor ?? 0, this.devise()),
        versSaisie(s.sorties_minor ?? 0, this.devise()),
        versSaisie(s.theoretical_minor ?? 0, this.devise()),
        versSaisie(s.declared_closing_minor ?? 0, this.devise()),
        versSaisie(s.variance_minor ?? 0, this.devise()),
        nombreCsv(s.mouvements ?? 0),
        s.closing_note ?? '',
        s.currency ?? this.devise(),
      ]),
    );
    telechargerCsv(nomFichierCsv('sessions-caisse', this.debut(), this.fin()), contenu);
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
    await this.paiements.chargerHistorique(this.debut(), this.fin(), this.station() || undefined);
  }
}
