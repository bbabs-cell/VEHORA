import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { OrganizationService } from '../../core/organization/organization.service';
import { PaymentService, type MouvementCaisse } from '../../core/payments/payment.service';
import { StationService } from '../../core/stations/station.service';
import { ScrollLockService } from '../../core/ui/scroll-lock.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import {
  formaterMontant,
  symboleDevise,
  versMontantMineur,
} from '../../shared/format/montant';

const LIBELLES_MOUVEMENT: Readonly<Record<string, string>> = {
  PAYMENT_IN: 'Encaissement',
  REFUND_OUT: 'Remboursement',
  CASH_IN: 'Entrée',
  CASH_OUT: 'Sortie',
};

@Component({
  selector: 'vh-caisse',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './caisse.component.html',
  styleUrl: './caisse.component.css',
})
export class CaisseComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly organisation = inject(OrganizationService);
  private readonly stationsService = inject(StationService);
  readonly paiements = inject(PaymentService);

  readonly peutOuvrir = computed(() => this.auth.hasPermission('cash.open'));
  readonly peutCloturer = computed(() => this.auth.hasPermission('cash.close'));
  readonly peutBouger = computed(() => this.auth.hasPermission('cash.move'));

  readonly stations = computed(() => this.stationsService.stations());
  readonly devise = computed(() => this.organisation.organisation()?.currency ?? 'XOF');
  readonly symbole = computed(() => symboleDevise(this.devise()));

  readonly stationChoisie = signal<string>('');
  readonly enregistrement = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly clotureOuverte = signal(false);
  readonly mouvementOuvert = signal<'CASH_IN' | 'CASH_OUT' | null>(null);
  readonly dernierEcart = signal<number | null>(null);

  readonly formOuverture = this.fb.nonNullable.group({
    fonds: ['0', Validators.required],
  });

  readonly formCloture = this.fb.nonNullable.group({
    compte: ['', Validators.required],
    note: [''],
  });

  readonly formMouvement = this.fb.nonNullable.group({
    montant: ['', Validators.required],
    motif: ['', [Validators.required, Validators.minLength(3)]],
  });

  private readonly verrou = inject(ScrollLockService);

  constructor() {
    effect(() =>
      this.verrou.verrouiller(this.clotureOuverte() || this.mouvementOuvert() !== null),
    );

    void this.organisation.charger();
    void this.stationsService.charger();

    // La station est obligatoire et vient du réseau. Tant qu'elle manque, on ne
    // peut rien ouvrir — et l'écran doit le dire plutôt que de laisser un
    // formulaire invalide sans explication.
    effect(() => {
      const stations = this.stations();
      if (stations.length > 0 && this.stationChoisie() === '') {
        this.stationChoisie.set(stations[0].id);
        void this.paiements.chargerMaCaisse(stations[0].id);
      }
    });
  }

  readonly pret = computed(() => this.stations().length > 0);

  surChangementStation(evenement: Event): void {
    const id = (evenement.target as HTMLSelectElement).value;
    this.stationChoisie.set(id);
    this.dernierEcart.set(null);
    void this.paiements.chargerMaCaisse(id);
  }

  formater(montant: number): string {
    return formaterMontant(montant, this.devise());
  }

  libelleMouvement(mouvement: MouvementCaisse): string {
    return LIBELLES_MOUVEMENT[mouvement.kind] ?? mouvement.kind;
  }

  heure(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(new Date(iso));
  }

  async ouvrir(): Promise<void> {
    if (this.enregistrement()) return;
    if (this.formOuverture.invalid) {
      this.formOuverture.markAllAsTouched();
      return;
    }

    const fonds = versMontantMineur(this.formOuverture.getRawValue().fonds, this.devise());
    if (fonds === null) {
      this.erreur.set('Saisissez un fonds de caisse valide, sans signe ni lettre.');
      return;
    }

    this.enregistrement.set(true);
    this.erreur.set(await this.paiements.ouvrirCaisse(this.stationChoisie(), fonds));
    this.enregistrement.set(false);
  }

  ouvrirCloture(): void {
    this.erreur.set(null);
    this.formCloture.reset({ compte: '', note: '' });
    this.clotureOuverte.set(true);
  }

  fermerCloture(): void {
    this.clotureOuverte.set(false);
  }

  async cloturer(): Promise<void> {
    const caisse = this.paiements.caisse();
    if (!caisse || this.enregistrement()) return;
    if (this.formCloture.invalid) {
      this.formCloture.markAllAsTouched();
      return;
    }

    const v = this.formCloture.getRawValue();
    const compte = versMontantMineur(v.compte, this.devise());
    if (compte === null) {
      this.erreur.set('Saisissez le montant compté, sans signe ni lettre.');
      return;
    }

    this.enregistrement.set(true);
    const { ecart, erreur } = await this.paiements.cloturerCaisse(
      caisse.id,
      compte,
      v.note.trim() || null,
    );
    this.enregistrement.set(false);

    if (erreur) {
      this.erreur.set(erreur);
      return;
    }

    this.clotureOuverte.set(false);
    // L'écart est montré, jamais ravalé : c'est la première chose que le
    // responsable regardera.
    this.dernierEcart.set(ecart);
    await this.paiements.chargerMaCaisse(this.stationChoisie());
  }

  ouvrirMouvement(sens: 'CASH_IN' | 'CASH_OUT'): void {
    this.erreur.set(null);
    this.formMouvement.reset({ montant: '', motif: '' });
    this.mouvementOuvert.set(sens);
  }

  fermerMouvement(): void {
    this.mouvementOuvert.set(null);
  }

  async enregistrerMouvement(): Promise<void> {
    const caisse = this.paiements.caisse();
    const sens = this.mouvementOuvert();
    if (!caisse || !sens || this.enregistrement()) return;
    if (this.formMouvement.invalid) {
      this.formMouvement.markAllAsTouched();
      return;
    }

    const v = this.formMouvement.getRawValue();
    const montant = versMontantMineur(v.montant, this.devise());
    if (montant === null || montant <= 0) {
      this.erreur.set('Saisissez un montant valide, sans signe ni lettre.');
      return;
    }

    this.enregistrement.set(true);
    const erreur = await this.paiements.mouvementLibre(
      caisse.id,
      sens,
      montant,
      v.motif.trim(),
    );
    this.enregistrement.set(false);

    if (erreur) {
      this.erreur.set(erreur);
      return;
    }
    this.mouvementOuvert.set(null);
  }
}
