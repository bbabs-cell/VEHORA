import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ProvisioningService } from '../../../core/organization/provisioning.service';

/**
 * Deux chemins possibles pour un compte sans organisation :
 * créer son entreprise, ou rejoindre celle de quelqu'un avec un code
 * d'invitation. Sans cet écran, l'utilisateur tournerait en boucle sur des
 * redirections.
 */
@Component({
  selector: 'vh-no-organization',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './no-organization.component.html',
  styleUrl: './no-organization.component.css',
})
export class NoOrganizationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly provisioning = inject(ProvisioningService);
  private readonly router = inject(Router);

  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(16)]],
  });

  async rejoindre(): Promise<void> {
    if (this.form.invalid || this.enCours()) {
      this.form.markAllAsTouched();
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);

    const erreur = await this.provisioning.accepterInvitation(this.form.getRawValue().code);

    this.enCours.set(false);

    if (erreur) {
      this.erreur.set(erreur);
      return;
    }
    await this.router.navigateByUrl('/tableau-de-bord');
  }

  /** L'invitation vient peut-être d'être acceptée ailleurs. */
  async reessayer(): Promise<void> {
    await this.auth.refreshClaims();
    if (this.auth.hasOrganization()) {
      await this.router.navigateByUrl('/tableau-de-bord');
    }
  }

  async deconnecter(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/connexion');
  }
}
