import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OrganizationService } from '../../core/organization/organization.service';
import { StationService } from '../../core/stations/station.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { StatTileComponent } from '../../shared/ui/stat-tile.component';

/**
 * Tableau de bord orienté ACTION.
 *
 * Il n'affiche que des indicateurs réellement calculables aujourd'hui. Les
 * tuiles opérationnelles (véhicules en attente, en cours, prêts, chiffre du
 * jour) arrivent avec les prestations, en phase 7 : afficher « 0 » pour une
 * fonctionnalité qui n'existe pas tromperait l'utilisateur.
 */
@Component({
  selector: 'vh-dashboard',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, IconComponent, StatTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  readonly organisations = inject(OrganizationService);
  readonly stations = inject(StationService);

  readonly claims = this.auth.claims;
  readonly session = this.auth.session;

  readonly peutGererStations = computed(() => this.auth.hasPermission('stations.manage'));
  readonly peutGererUtilisateurs = computed(() => this.auth.hasPermission('users.manage'));
  readonly peutVoirClients = computed(() => this.auth.hasPermission('customers.read'));

  readonly stationsActives = computed(
    () => this.stations.stations().filter((s) => s.status === 'ACTIVE').length,
  );

  constructor() {
    void this.stations.charger();
    if (this.peutGererUtilisateurs()) {
      void this.organisations.compterMembres();
    }
  }
}
