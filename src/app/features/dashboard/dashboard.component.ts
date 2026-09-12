import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Écran authentifié minimal de la phase 1 : il prouve que la session, les
 * claims et la RLS fonctionnent de bout en bout. Le vrai tableau de bord
 * orienté action arrive en phase 3.
 */
@Component({
  selector: 'vh-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly claims = this.auth.claims;
  readonly session = this.auth.session;

  async deconnecter(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/connexion');
  }
}
