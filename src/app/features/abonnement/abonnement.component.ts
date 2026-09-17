import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  LIBELLES_STATUT_ABONNEMENT,
  SubscriptionService,
  type MonAbonnement,
} from '../../core/subscription/subscription.service';
import { formaterDate } from '../../shared/format/montant';

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

  constructor() {
    void this.service.charger(true);
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
}
