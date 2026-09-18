import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  LIBELLES_STATUT_FACTURE,
  PlatformService,
  type FacturePlateforme,
} from '../../../core/platform/platform.service';
import { ConfirmationComponent } from '../../../shared/ui/confirmation.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { formaterDate, formaterMontant, versSaisie } from '../../../shared/format/montant';
import { nomFichierCsv, nombreCsv, telechargerCsv, versCsv } from '../../../shared/export/csv';

/** Le premier jour du mois courant, dans le fuseau de l'appareil. */
function moisCourant(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

type Filtre = 'TOUTES' | 'RETARD' | 'ISSUED' | 'PAID' | 'VOID';

@Component({
  selector: 'vh-platform-facturation',
  standalone: true,
  imports: [ConfirmationComponent, EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './facturation.component.html',
  styleUrl: './facturation.component.css',
})
export class PlatformFacturationComponent {
  readonly plateforme = inject(PlatformService);

  readonly periode = signal(moisCourant());
  readonly filtre = signal<Filtre>('TOUTES');
  readonly enCours = signal(false);
  readonly message = signal<string | null>(null);

  /** Facture dont on demande l'annulation — la confirmation porte son motif. */
  readonly aAnnuler = signal<FacturePlateforme | null>(null);
  readonly motifAnnulation = signal('');

  /** Facture qu'on marque réglée, et la référence du virement. */
  readonly aRegler = signal<FacturePlateforme | null>(null);
  readonly referencePaiement = signal('');

  readonly factures = computed(() => {
    const f = this.filtre();
    const toutes = this.plateforme.factures();
    if (f === 'TOUTES') return toutes;
    if (f === 'RETARD') return toutes.filter((i) => i.en_retard);
    return toutes.filter((i) => i.status === f);
  });

  readonly enRetard = computed(() => this.plateforme.factures().filter((f) => f.en_retard));

  /**
   * Un total dont le détail ne fait pas la somme fait douter du reste : le
   * résumé porte les trois états, et l'en-retard qui les recoupe est nommé
   * comme tel.
   */
  readonly resume = computed(() => {
    const toutes = this.plateforme.factures();
    const somme = (l: readonly FacturePlateforme[]) =>
      l.reduce((s, f) => s + f.amount_minor, 0);
    const aRegler = toutes.filter((f) => f.status === 'ISSUED');
    return {
      total: toutes.length,
      aRegler: aRegler.length,
      montantARegler: somme(aRegler),
      reglees: toutes.filter((f) => f.status === 'PAID').length,
      montantReglees: somme(toutes.filter((f) => f.status === 'PAID')),
      annulees: toutes.filter((f) => f.status === 'VOID').length,
      enRetard: this.enRetard().length,
      montantEnRetard: somme(this.enRetard()),
    };
  });

  /** La devise vient des factures elles-mêmes : VEHORA peut facturer ailleurs. */
  readonly devise = computed(() => this.plateforme.factures()[0]?.currency ?? 'XOF');

  constructor() {
    void this.plateforme.chargerFactures();
  }

  statut(f: FacturePlateforme): string {
    return LIBELLES_STATUT_FACTURE[f.status];
  }

  classeStatut(f: FacturePlateforme): string {
    if (f.status === 'VOID') return 'etat etat--annulee';
    if (f.status === 'PAID') return 'etat etat--reglee';
    return f.en_retard ? 'etat etat--retard' : 'etat etat--attente';
  }

  montant(mineur: number, devise?: string): string {
    return formaterMontant(mineur, devise ?? this.devise());
  }

  jour(iso: string | null): string {
    return iso ? formaterDate(iso) : '—';
  }

  /**
   * Une période d'abonnement est un mois : « septembre 2026 » se lit d'un coup
   * d'œil, là où « 1 septembre 2026 → 30 septembre 2026 » prend trois lignes
   * sur un téléphone et ne dit rien de plus. On garde l'intervalle complet pour
   * les périodes qui n'épousent pas un mois — il y en aura.
   */
  periodeFacture(f: FacturePlateforme): string {
    const debut = new Date(`${f.period_start}T00:00:00`);
    const fin = new Date(`${f.period_end}T00:00:00`);
    const dernierJour = new Date(fin.getFullYear(), fin.getMonth() + 1, 0).getDate();
    const moisEntier =
      debut.getDate() === 1 &&
      fin.getDate() === dernierJour &&
      debut.getMonth() === fin.getMonth() &&
      debut.getFullYear() === fin.getFullYear();

    if (moisEntier) {
      return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(debut);
    }
    return `${this.jour(f.period_start)} → ${this.jour(f.period_end)}`;
  }

  surPeriode(evenement: Event): void {
    this.periode.set((evenement.target as HTMLInputElement).value);
  }

  surFiltre(evenement: Event): void {
    this.filtre.set((evenement.target as HTMLSelectElement).value as Filtre);
  }

  /** Le mois en toutes lettres : un champ date s'affiche dans la locale de l'appareil. */
  readonly periodeLisible = computed(() =>
    new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
      new Date(`${this.periode()}T00:00:00`),
    ),
  );

  async emettre(): Promise<void> {
    this.enCours.set(true);
    this.message.set(null);
    const erreur = await this.plateforme.emettreFactures(this.periode());
    this.enCours.set(false);
    this.message.set(erreur ?? `Échéances de ${this.periodeLisible()} émises.`);
  }

  async relancer(): Promise<void> {
    this.enCours.set(true);
    this.message.set(null);
    const erreur = await this.plateforme.relancerImpayes();
    this.enCours.set(false);
    this.message.set(
      erreur ?? `${this.enRetard().length} facture(s) en retard, abonnements passés en impayé.`,
    );
  }

  demanderReglement(f: FacturePlateforme): void {
    this.referencePaiement.set('');
    this.aRegler.set(f);
  }

  surReference(evenement: Event): void {
    this.referencePaiement.set((evenement.target as HTMLInputElement).value);
  }

  async confirmerReglement(): Promise<void> {
    const f = this.aRegler();
    if (!f) return;
    this.enCours.set(true);
    const erreur = await this.plateforme.marquerPayee(f.id, this.referencePaiement().trim());
    this.enCours.set(false);
    this.aRegler.set(null);
    this.message.set(erreur ?? `${f.reference} est réglée.`);
  }

  demanderAnnulation(f: FacturePlateforme): void {
    this.motifAnnulation.set('');
    this.aAnnuler.set(f);
  }

  surMotif(evenement: Event): void {
    this.motifAnnulation.set((evenement.target as HTMLInputElement).value);
  }

  /** Une action que le serveur refusera ne s'affiche pas comme possible. */
  readonly motifTropCourt = computed(() => this.motifAnnulation().trim().length < 3);

  async confirmerAnnulation(): Promise<void> {
    const f = this.aAnnuler();
    if (!f || this.motifTropCourt()) return;
    this.enCours.set(true);
    const erreur = await this.plateforme.annulerFacture(f.id, this.motifAnnulation().trim());
    this.enCours.set(false);
    this.aAnnuler.set(null);
    this.message.set(erreur ?? `${f.reference} est annulée.`);
  }

  exporter(): void {
    const contenu = versCsv(
      ['Référence', 'Organisation', 'Plan', 'Période du', 'au', 'Montant', 'Devise',
       'Statut', 'Échéance', 'Jours de retard', 'Réglée le', 'Référence de paiement',
       'Motif d’annulation'],
      this.factures().map((f) => [
        f.reference,
        f.organization_label,
        f.plan_code,
        f.period_start,
        f.period_end,
        // Unité principale, avec la devise en colonne : le lecteur d'un fichier
        // n'a pas à savoir par combien diviser.
        versSaisie(f.amount_minor, f.currency),
        f.currency,
        this.statut(f),
        f.due_date,
        nombreCsv(f.jours_de_retard),
        f.paid_at ?? '',
        f.payment_reference ?? '',
        f.void_reason ?? '',
      ]),
    );
    telechargerCsv(nomFichierCsv('factures', this.periode(), this.periode()), contenu);
  }
}
