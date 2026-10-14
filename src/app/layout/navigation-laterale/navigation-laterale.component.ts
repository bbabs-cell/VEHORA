import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { libelleRole } from '../../core/auth/libelles-roles';
import { FondVivantComponent } from '../../shared/ui/fond-vivant.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { TeinteDirective } from '../../shared/ui/teinte';
import { EntreeNavigation } from '../navigation';

/**
 * Barre latérale (≥ 1024 px) et tiroir (mobile).
 *
 * Sombre dans les deux thèmes, comme la navigation de MagyaPro : en thème
 * clair, elle sépare l'outil du contenu d'un seul aplat. Le décor du skill
 * « animations vivantes » — trame de points, halos qui respirent, cascade à
 * l'arrivée, point actif qui pulse — vit ICI, à côté du travail, jamais sous
 * une liste à lire.
 */
@Component({
  selector: 'vh-navigation-laterale',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, FondVivantComponent, TeinteDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navigation-laterale.component.html',
  styleUrl: './navigation-laterale.component.css',
})
export class NavigationLateraleComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly entrees = input.required<readonly EntreeNavigation[]>();
  /** Tiroir ouvert (mobile). Sans effet à partir de 1024 px. */
  readonly ouvert = input(false);
  readonly fermer = output<void>();

  readonly claims = this.auth.claims;
  readonly session = this.auth.session;
  readonly libelleRole = libelleRole;

  async deconnecter(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/connexion');
  }
}
