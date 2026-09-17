import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OrganizationService } from '../../core/organization/organization.service';
import {
  LIBELLES_STATUT,
  ORDRE_FILE,
  ServiceOrderService,
  type StatutDossier,
} from '../../core/service-orders/service-order.service';
import { ReceiptService } from '../../core/receipts/receipt.service';
import { StationService } from '../../core/stations/station.service';
import { SubscriptionService } from '../../core/subscription/subscription.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { StatTileComponent } from '../../shared/ui/stat-tile.component';
import { formaterMontant } from '../../shared/format/montant';

/** `2026-09-17` dans le fuseau de l'appareil — pas en UTC. */
function aujourdHui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Une ligne de la file : un statut, son libellé, son nombre. */
interface CompteStatut {
  readonly statut: StatutDossier;
  readonly libelle: string;
  readonly nombre: number;
}

/**
 * Tableau de bord orienté ACTION.
 *
 * Il ne montre que ce qui est vrai maintenant. Jusqu'ici il annonçait
 * « les véhicules s'afficheront ici dès que la gestion des prestations sera
 * disponible » — une phrase écrite en phase 3 et devenue fausse en phase 9 : le
 * cycle complet tourne depuis. Un écran d'accueil qui décrit un produit qui
 * n'est plus le sien coûte plus qu'un écran vide.
 *
 * Aucune nouvelle requête serveur : la file d'attente et le rapport du jour
 * existent déjà, avec leurs permissions et leur RLS. Le chiffre d'affaires
 * n'apparaît donc que pour qui a le droit de le savoir — encaisser n'est pas
 * savoir combien la station encaisse.
 */
@Component({
  selector: 'vh-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent, StatTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  readonly organisations = inject(OrganizationService);
  readonly stations = inject(StationService);
  readonly dossiers = inject(ServiceOrderService);
  readonly rapports = inject(ReceiptService);
  private readonly abonnement = inject(SubscriptionService);

  readonly claims = this.auth.claims;
  readonly session = this.auth.session;

  readonly peutGererStations = computed(() => this.auth.hasPermission('stations.manage'));
  readonly peutGererUtilisateurs = computed(() => this.auth.hasPermission('users.manage'));
  readonly peutVoirClients = computed(() => this.auth.hasPermission('customers.read'));
  readonly peutVoirFile = computed(() => this.auth.hasPermission('service_orders.read'));

  /**
   * Le chiffre du jour demande la permission ET la fonctionnalité : la même
   * double condition que l'écran Rapports, parce que c'est la même donnée.
   * Afficher la tuile sans l'une des deux produirait un refus serveur visible
   * comme une panne.
   */
  readonly peutVoirChiffre = computed(
    () => this.auth.hasPermission('reports.read') && this.abonnement.actif('rapports'),
  );

  readonly devise = computed(() => this.organisations.organisation()?.currency ?? 'XOF');

  readonly stationsActives = computed(
    () => this.stations.stations().filter((s) => s.status === 'ACTIVE').length,
  );

  /**
   * Ce qui est ouvert en ce moment, par statut. Tous les statuts de la file,
   * dans son ordre : un total dont le détail ne fait pas la somme est un total
   * qu'on relit trois fois avant de s'en méfier.
   */
  readonly parStatut = computed<CompteStatut[]>(() => {
    const dossiers = this.dossiers.dossiers();
    return ORDRE_FILE.map((statut) => ({
      statut,
      libelle: LIBELLES_STATUT[statut],
      nombre: dossiers.filter((d) => d.status === statut).length,
    }));
  });

  readonly vehiculesPresents = computed(() => this.dossiers.dossiers().length);

  /** Ce qui reste à encaisser sur les dossiers ouverts, prêts en premier. */
  readonly impayesPrets = computed(() =>
    this.dossiers
      .dossiers()
      .filter((d) => d.status === 'READY' && d.balance_minor > 0)
      .reduce((somme, d) => somme + d.balance_minor, 0),
  );

  /** La ligne du jour, toutes stations du périmètre confondues. */
  private readonly jour = computed(() => {
    const lignes = this.rapports.journalier();
    return {
      encaisse: lignes.reduce((s, l) => s + l.encaisse_minor, 0),
      livres: lignes.reduce((s, l) => s + l.dossiers_livres, 0),
    };
  });

  readonly encaisseDuJour = computed(() => this.jour().encaisse);
  readonly restitutionsDuJour = computed(() => this.jour().livres);

  constructor() {
    void this.stations.charger();
    void this.organisations.charger();
    void this.abonnement.charger();

    if (this.peutVoirFile()) void this.dossiers.chargerFile();
    if (this.peutGererUtilisateurs()) void this.organisations.compterMembres();

    // Le rapport du jour est demandé seulement si le serveur l'accordera : une
    // requête qu'on sait refusée coûte un aller-retour et un message d'erreur
    // sur l'écran d'accueil. La fonctionnalité arrive du réseau — d'où
    // l'`effect` plutôt qu'un test à la construction, qui serait toujours faux.
    let demande = false;
    effect(() => {
      if (demande || !this.peutVoirChiffre()) return;
      demande = true;
      const j = aujourdHui();
      void this.rapports.chargerRapports(j, j);
    });
  }

  montant(mineur: number): string {
    return formaterMontant(mineur, this.devise());
  }
}
