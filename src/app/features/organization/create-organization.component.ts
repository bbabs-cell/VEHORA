import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProvisioningService } from '../../core/organization/provisioning.service';

/** Pays du marché initial. La liste s'étend sans toucher au code métier. */
const PAYS = [
  { code: 'SN', nom: 'Sénégal' },
  { code: 'ML', nom: 'Mali' },
  { code: 'CI', nom: "Côte d'Ivoire" },
  { code: 'BF', nom: 'Burkina Faso' },
  { code: 'GN', nom: 'Guinée' },
  { code: 'BJ', nom: 'Bénin' },
  { code: 'TG', nom: 'Togo' },
  { code: 'NE', nom: 'Niger' },
  { code: 'MR', nom: 'Mauritanie' },
] as const;

@Component({
  selector: 'vh-create-organization',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-organization.component.html',
  styleUrl: './create-organization.component.css',
})
export class CreateOrganizationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly provisioning = inject(ProvisioningService);
  private readonly router = inject(Router);

  readonly pays = PAYS;
  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    pays: ['SN', Validators.required],
    ville: [''],
    nomStation: [''],
  });

  async soumettre(): Promise<void> {
    if (this.form.invalid || this.enCours()) {
      this.form.markAllAsTouched();
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);

    const v = this.form.getRawValue();
    const erreur = await this.provisioning.creerOrganisation({
      nom: v.nom.trim(),
      pays: v.pays,
      ville: v.ville.trim() || undefined,
      nomStation: v.nomStation.trim() || undefined,
    });

    this.enCours.set(false);

    if (erreur) {
      this.erreur.set(erreur);
      return;
    }
    await this.router.navigateByUrl('/tableau-de-bord');
  }
}
