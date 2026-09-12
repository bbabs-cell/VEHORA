import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Un compte valide peut n'être rattaché à aucune organisation active :
 * invitation non finalisée, adhésion suspendue, ou organisation désactivée.
 * Sans cet écran, l'utilisateur tournerait en boucle sur des redirections.
 */
@Component({
  selector: 'vh-no-organization',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="sans-org">
      <section class="vh-card sans-org__carte">
        <h1 class="sans-org__titre">Aucune organisation active</h1>
        <p class="vh-muted">
          Votre compte n’est rattaché à aucune organisation, ou votre accès a été
          suspendu. Contactez le responsable de votre entreprise pour être invité.
        </p>
        <div class="sans-org__actions">
          <button class="vh-button vh-button--ghost" type="button" (click)="reessayer()">
            Réessayer
          </button>
          <button class="vh-button" type="button" (click)="deconnecter()">
            Se déconnecter
          </button>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      .sans-org {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100dvh;
        padding: var(--vh-space-4);
      }
      .sans-org__carte {
        width: 100%;
        max-width: 460px;
      }
      .sans-org__titre {
        margin-bottom: var(--vh-space-4);
        font-size: var(--vh-text-lg);
      }
      .sans-org__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--vh-space-3);
        margin-top: var(--vh-space-6);
      }
    `,
  ],
})
export class NoOrganizationComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** L'invitation vient peut-être d'être acceptée : les claims se rafraîchissent. */
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
