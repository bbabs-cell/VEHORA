import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  LIBELLES_STATUT_ABONNEMENT,
  LIBELLES_STATUT_FACTURE_CLIENT,
  SubscriptionService,
  type MaFacture,
  type MonAbonnement,
} from '../../core/subscription/subscription.service';
import { formaterDate, formaterMontant } from '../../shared/format/montant';

@Component({
  selector: 'vh-abonnement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './abonnement.component.html',
  styleUrl: './abonnement.component.css',
})
export class AbonnementComponent {
  readonly service = inject(SubscriptionService);

  readonly abonnement = computed(() => this.service.abonnement());
  readonly fonctionnalites = computed(() => this.service.fonctionnalites());
  readonly factures = computed(() => this.service.factures());

  /** Ce qui reste à payer, tous mois confondus. */
  readonly resteADevoir = computed(() =>
    this.factures()
      .filter((f) => f.statut === 'ISSUED')
      .reduce((s, f) => s + f.montant_minor, 0),
  );

  readonly devise = computed(() => this.factures()[0]?.devise ?? 'XOF');

  constructor() {
    void this.service.charger(true);
    void this.service.chargerFactures();
  }

  statutFacture(f: MaFacture): string {
    return LIBELLES_STATUT_FACTURE_CLIENT[f.statut];
  }

  classeFacture(f: MaFacture): string {
    if (f.statut === 'VOID') return 'etiquette';
    if (f.statut === 'PAID') return 'etiquette etiquette--ouverte';
    return f.en_retard ? 'etiquette etiquette--retard' : 'etiquette etiquette--fermee';
  }

  montant(mineur: number, devise?: string): string {
    return formaterMontant(mineur, devise ?? this.devise());
  }

  statut(a: MonAbonnement): string {
    return LIBELLES_STATUT_ABONNEMENT[a.statut];
  }

  /** « 2 sur 10 », ou « 2 » quand le plan n'a pas de limite. */
  consommation(utilise: number, maximum: number | null): string {
    return maximum === null ? `${utilise} (sans limite)` : `${utilise} sur ${maximum}`;
  }

  /** Une jauge n'a de sens que s'il y a une borne. */
  part(utilise: number, maximum: number | null): number | null {
    if (maximum === null || maximum === 0) return null;
    return Math.min(100, Math.round((utilise / maximum) * 100));
  }

  finEssai(iso: string | null): string {
    return iso ? formaterDate(iso.slice(0, 10)) : '';
  }

  jour(iso: string): string {
    return formaterDate(iso);
  }
}
