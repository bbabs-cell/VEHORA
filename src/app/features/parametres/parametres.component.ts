import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  OrganizationService,
  type FicheOrganisation,
} from '../../core/organization/organization.service';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { symboleDevise } from '../../shared/format/montant';

/**
 * Deux formulaires, deux enregistrements. La fiche (qui vous êtes) et les
 * réglages (comment la station travaille) ne changent pas au même rythme, et
 * un bouton unique obligerait à relire les deux pour corriger une virgule.
 */
@Component({
  selector: 'vh-parametres',
  standalone: true,
  imports: [ReactiveFormsModule, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parametres.component.html',
  styleUrl: './parametres.component.css',
})
export class ParametresComponent {
  readonly organisation = inject(OrganizationService);
  private readonly fb = inject(FormBuilder);

  readonly enregistrementFiche = signal(false);
  readonly enregistrementReglages = signal(false);
  readonly messageFiche = signal<string | null>(null);
  readonly messageReglages = signal<string | null>(null);

  readonly fiche = computed(() => this.organisation.fiche());
  readonly reglages = computed(() => this.organisation.reglages());

  readonly formFiche = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    city: [''],
    address: [''],
    phone: [''],
    email: ['', Validators.email],
    country_code: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
  });

  readonly formReglages = this.fb.nonNullable.group({
    require_inspection: [true],
    require_quality_control: [true],
    payment_before_delivery: ['ALLOW_DEBT' as 'STRICT' | 'ALLOW_DEBT'],
    max_discount_percent: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  constructor() {
    void this.organisation.chargerParametres();

    // Le défaut vient de la donnée asynchrone, par `effect` : sans cela, le
    // formulaire s'affiche vide, l'utilisateur enregistre, et il efface sa
    // propre fiche sans comprendre.
    effect(() => {
      const f = this.fiche();
      if (!f) return;
      this.formFiche.setValue({
        name: f.name,
        city: f.city ?? '',
        address: f.address ?? '',
        phone: f.phone ?? '',
        email: f.email ?? '',
        country_code: f.country_code,
      });
    });

    effect(() => {
      const r = this.reglages();
      if (!r) return;
      this.formReglages.setValue({
        require_inspection: r.require_inspection,
        require_quality_control: r.require_quality_control,
        payment_before_delivery: r.payment_before_delivery,
        max_discount_percent: Number(r.max_discount_percent),
      });
    });
  }

  /**
   * La devise s'affiche, ne se règle pas. Un trigger la refuse en base : la
   * proposer à l'écran serait afficher une action que le serveur refusera.
   */
  readonly devise = computed(() => {
    const f = this.fiche();
    return f ? `${symboleDevise(f.currency)} (${f.currency})` : '';
  });

  etat(f: FicheOrganisation): string {
    const libelles: Record<string, string> = {
      TRIAL: 'Essai',
      ACTIVE: 'Active',
      SUSPENDED: 'Suspendue',
      EXPIRED: 'Expirée',
      DEACTIVATED: 'Désactivée',
    };
    return libelles[f.status] ?? f.status;
  }

  async enregistrerFiche(): Promise<void> {
    if (this.formFiche.invalid || this.enregistrementFiche()) {
      this.formFiche.markAllAsTouched();
      return;
    }

    this.enregistrementFiche.set(true);
    this.messageFiche.set(null);
    const v = this.formFiche.getRawValue();
    const erreur = await this.organisation.enregistrerFiche({
      name: v.name.trim(),
      city: v.city.trim() || null,
      address: v.address.trim() || null,
      phone: v.phone.trim() || null,
      email: v.email.trim() || null,
      country_code: v.country_code.trim().toUpperCase(),
    });
    this.enregistrementFiche.set(false);
    this.messageFiche.set(erreur ?? 'Fiche enregistrée.');
  }

  async enregistrerReglages(): Promise<void> {
    if (this.formReglages.invalid || this.enregistrementReglages()) {
      this.formReglages.markAllAsTouched();
      return;
    }

    this.enregistrementReglages.set(true);
    this.messageReglages.set(null);
    const erreur = await this.organisation.enregistrerReglages(this.formReglages.getRawValue());
    this.enregistrementReglages.set(false);
    this.messageReglages.set(erreur ?? 'Réglages enregistrés.');
  }
}
