import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { OrganizationService } from '../../core/organization/organization.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

/**
 * Tableau de bord — phase 2 : la structure et le design system sont en place,
 * les indicateurs d'activité arrivent en phase 3, une fois les prestations
 * existantes.
 */
@Component({
  selector: 'vh-dashboard',
  standalone: true,
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  readonly organisations = inject(OrganizationService);

  readonly claims = this.auth.claims;
  readonly session = this.auth.session;
}
