import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

/**
 * Coquille de l'espace de plateforme.
 *
 * Volontairement distincte de celle de l'application cliente : pas la même
 * navigation, pas la même identité visuelle, pas les mêmes écrans. On ne doit
 * jamais pouvoir se demander « suis-je chez un client ou chez VEHORA ? ».
 */
@Component({
  selector: 'vh-platform-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-shell.component.html',
  styleUrl: './platform-shell.component.css',
})
export class PlatformShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  readonly claims = this.auth.claims;
  readonly session = this.auth.session;

  async seDeconnecter(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/connexion']);
  }
}
