import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OrganizationService } from '../../core/organization/organization.service';
import { ThemeService } from '../../core/theme/theme.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { NAVIGATION, NAVIGATION_MOBILE } from '../navigation';

/**
 * Coquille de l'application cliente.
 *
 * Desktop : barre latérale persistante.
 * Mobile  : en-tête compact + barre d'actions en bas, atteignable au pouce.
 *
 * L'espace Super Admin aura sa propre coquille : ce n'est pas un onglet d'ici.
 */
@Component({
  selector: 'vh-app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly organisations = inject(OrganizationService);
  readonly theme = inject(ThemeService);

  readonly menuOuvert = signal(false);
  readonly claims = this.auth.claims;
  readonly session = this.auth.session;

  /** Entrées visibles : celles dont l'utilisateur a la permission. */
  readonly entrees = computed(() =>
    NAVIGATION.filter((e) => !e.permission || this.auth.hasPermission(e.permission)),
  );

  readonly entreesMobile = computed(() =>
    this.entrees().filter((e) => NAVIGATION_MOBILE.includes(e.chemin)),
  );

  constructor() {
    void this.organisations.charger();
  }

  basculerMenu(): void {
    this.menuOuvert.update((v) => !v);
  }

  fermerMenu(): void {
    this.menuOuvert.set(false);
  }

  async deconnecter(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/connexion');
  }
}
