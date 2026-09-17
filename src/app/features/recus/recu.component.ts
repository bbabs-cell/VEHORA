import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReceiptService, type ContenuRecu, type Recu } from '../../core/receipts/receipt.service';
import { formaterMontant } from '../../shared/format/montant';

/** Date et heure d'un horodatage ISO, dans le fuseau de l'appareil. */
function formaterInstant(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(d);
}

const LIBELLES_MOYEN: Readonly<Record<string, string>> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte',
  BANK_TRANSFER: 'Virement',
  OTHER: 'Autre',
};

@Component({
  selector: 'vh-recu',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recu.component.html',
  styleUrl: './recu.component.css',
})
export class RecuComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ReceiptService);

  readonly recu = signal<Recu | null>(null);
  readonly chargement = signal(true);
  readonly erreur = computed(() => this.service.erreur());

  /**
   * Tout ce qui s'affiche vient de `contenu` : la copie figée à l'émission.
   * On ne relit ni la prestation, ni le tarif, ni le client d'aujourd'hui —
   * un reçu doit se relire identique dans dix ans.
   */
  readonly contenu = computed<ContenuRecu>(() => {
    const r = this.recu();
    return r ? this.service.contenu(r) : {};
  });

  readonly devise = computed(() => this.recu()?.currency ?? 'XOF');
  readonly lignes = computed(() => this.contenu().lignes ?? []);
  readonly paiements = computed(() => this.contenu().paiements ?? []);
  readonly solde = computed(() => this.contenu().totaux?.solde_minor ?? 0);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    void this.charger(id);
  }

  private async charger(id: string | null): Promise<void> {
    if (!id) {
      this.chargement.set(false);
      return;
    }
    this.recu.set(await this.service.chargerRecu(id));
    this.chargement.set(false);
  }

  montant(mineur: number | undefined): string {
    return formaterMontant(mineur ?? 0, this.devise());
  }

  instant(iso: string | null | undefined): string {
    return formaterInstant(iso);
  }

  moyen(code: string | undefined): string {
    return code ? (LIBELLES_MOYEN[code] ?? code) : '—';
  }

  imprimer(): void {
    window.print();
  }
}
