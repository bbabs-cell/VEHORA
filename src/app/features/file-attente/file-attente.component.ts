import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogueService } from '../../core/catalogue/catalogue.service';
import { OrganizationService } from '../../core/organization/organization.service';
import {
  LIBELLES_STATUT,
  ORDRE_FILE,
  ServiceOrderService,
  type DossierListe,
  type StatutDossier,
} from '../../core/service-orders/service-order.service';
import { StationService } from '../../core/stations/station.service';
import { VehicleService, type VehiculeListe } from '../../core/vehicles/vehicle.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { formaterMontant } from '../../shared/format/montant';

/** Un groupe de la file : un statut et ses dossiers. */
interface GroupeFile {
  readonly statut: StatutDossier;
  readonly libelle: string;
  readonly dossiers: readonly DossierListe[];
}

/** L'action suivante proposée sur un dossier, selon son statut. */
interface ActionSuivante {
  readonly vers: StatutDossier;
  readonly libelle: string;
}

const SUITE: Partial<Record<StatutDossier, ActionSuivante>> = {
  ARRIVED: { vers: 'INSPECTION', libelle: 'Inspecter' },
  INSPECTION: { vers: 'WAITING', libelle: 'Mettre en attente' },
};

const DELAI_RECHERCHE = 300;

@Component({
  selector: 'vh-file-attente',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-attente.component.html',
  styleUrl: './file-attente.component.css',
})
export class FileAttenteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly organisation = inject(OrganizationService);
  private readonly stationsService = inject(StationService);
  private readonly vehiculesService = inject(VehicleService);
  readonly catalogue = inject(CatalogueService);
  readonly dossiers = inject(ServiceOrderService);

  readonly peutOuvrir = computed(() => this.auth.hasPermission('service_orders.write'));
  readonly peutAnnuler = computed(() => this.auth.hasPermission('service_orders.cancel'));
  readonly peutInspecter = computed(() => this.auth.hasPermission('inspections.write'));

  readonly stations = computed(() => this.stationsService.stations());
  readonly devise = computed(() => this.organisation.organisation()?.currency ?? 'XOF');

  readonly ouvertureOuverte = signal(false);
  readonly dossierOuvert = signal<DossierListe | null>(null);
  readonly annulation = signal<DossierListe | null>(null);
  readonly enregistrement = signal(false);
  readonly erreurFormulaire = signal<string | null>(null);

  /** Véhicule choisi pour le nouveau dossier, et résultats de la recherche. */
  readonly vehiculeChoisi = signal<VehiculeListe | null>(null);
  readonly resultatsVehicules = signal<VehiculeListe[]>([]);

  readonly formOuverture = this.fb.nonNullable.group({
    station_id: ['', Validators.required],
    notes: [''],
  });

  readonly formAnnulation = this.fb.nonNullable.group({
    motif: ['', [Validators.required, Validators.minLength(3)]],
  });

  private minuterie?: ReturnType<typeof setTimeout>;

  constructor() {
    void this.dossiers.chargerFile();
    void this.organisation.charger();
    void this.stationsService.charger();
    void this.catalogue.charger();
  }

  readonly groupes = computed<GroupeFile[]>(() =>
    ORDRE_FILE.map((statut) => ({
      statut,
      libelle: LIBELLES_STATUT[statut],
      dossiers: this.dossiers.dossiers().filter((d) => d.status === statut),
    })).filter((g) => g.dossiers.length > 0),
  );

  readonly fileVide = computed(() => this.dossiers.dossiers().length === 0);

  /**
   * Le nom de la station n'a d'intérêt que si l'organisation en a plusieurs :
   * sur un site unique, ce serait la même mention répétée sur chaque carte.
   * Mais à deux stations, ne pas l'afficher rend la file illisible — deux
   * véhicules identiques, deux sites différents, rien pour les distinguer.
   */
  readonly afficherStation = computed(() => this.stations().length > 1);

  private readonly nomsStations = computed(
    () => new Map(this.stations().map((s) => [s.id, s.name])),
  );

  nomStation(dossier: DossierListe): string {
    return this.nomsStations().get(dossier.station_id) ?? '';
  }

  /**
   * La station est obligatoire et vient d'un chargement asynchrone. Ouvrir le
   * formulaire sans elle donnerait un formulaire invalide que rien n'explique.
   */
  readonly pretAOuvrir = computed(() => this.stations().length > 0);

  libelleStatut(statut: StatutDossier): string {
    return LIBELLES_STATUT[statut];
  }

  actionSuivante(dossier: DossierListe): ActionSuivante | null {
    return SUITE[dossier.status] ?? null;
  }

  total(dossier: DossierListe): string {
    return formaterMontant(dossier.total_minor, dossier.currency ?? this.devise());
  }

  /** « arrivé il y a 25 min » — la donnée que l'exploitant regarde en premier. */
  attente(dossier: DossierListe): string {
    const minutes = Math.max(
      0,
      Math.round((Date.now() - new Date(dossier.arrived_at).getTime()) / 60_000),
    );
    if (minutes < 60) return `${minutes} min`;
    const heures = Math.floor(minutes / 60);
    return `${heures} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------
  // Ouverture d'un dossier
  // ---------------------------------------------------------------------

  ouvrirFormulaire(): void {
    this.erreurFormulaire.set(null);
    this.vehiculeChoisi.set(null);
    this.resultatsVehicules.set([]);
    this.formOuverture.reset({
      station_id: this.stations()[0]?.id ?? '',
      notes: '',
    });
    this.ouvertureOuverte.set(true);
  }

  fermerFormulaire(): void {
    this.ouvertureOuverte.set(false);
  }

  surRechercheVehicule(evenement: Event): void {
    const terme = (evenement.target as HTMLInputElement).value;
    clearTimeout(this.minuterie);
    this.minuterie = setTimeout(async () => {
      if (terme.trim().length < 2) {
        this.resultatsVehicules.set([]);
        return;
      }
      await this.vehiculesService.rechercher(terme);
      this.resultatsVehicules.set(this.vehiculesService.vehicules().slice(0, 6));
    }, DELAI_RECHERCHE);
  }

  choisirVehicule(vehicule: VehiculeListe): void {
    this.vehiculeChoisi.set(vehicule);
    this.resultatsVehicules.set([]);
  }

  retirerVehicule(): void {
    this.vehiculeChoisi.set(null);
  }

  async ouvrirDossier(): Promise<void> {
    const vehicule = this.vehiculeChoisi();
    if (!vehicule) {
      this.erreurFormulaire.set('Choisissez le véhicule concerné.');
      return;
    }
    if (this.enregistrement()) return;
    if (this.formOuverture.invalid) {
      this.formOuverture.markAllAsTouched();
      return;
    }

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);

    const v = this.formOuverture.getRawValue();
    const { id, erreur } = await this.dossiers.ouvrir({
      station_id: v.station_id,
      vehicle_id: vehicule.id,
      customer_id: vehicule.customer_id,
      notes: v.notes.trim() || null,
    });

    this.enregistrement.set(false);
    if (erreur || !id) {
      this.erreurFormulaire.set(erreur ?? 'Le dossier n’a pas pu être ouvert.');
      return;
    }

    this.ouvertureOuverte.set(false);
    // On enchaîne sur les prestations : un dossier sans ligne n'a pas de prix,
    // et le client attend qu'on lui annonce un montant.
    const cree = this.dossiers.dossiers().find((d) => d.id === id);
    if (cree) await this.ouvrirPrestations(cree);
  }

  // ---------------------------------------------------------------------
  // Prestations d'un dossier
  // ---------------------------------------------------------------------

  async ouvrirPrestations(dossier: DossierListe): Promise<void> {
    this.erreurFormulaire.set(null);
    this.dossierOuvert.set(dossier);
    await this.dossiers.chargerLignes(dossier.id);
  }

  fermerPrestations(): void {
    this.dossierOuvert.set(null);
  }

  /**
   * Prestations encore ajoutables : actives, et pas déjà dans le dossier.
   *
   * Celles qui n'ont aucun tarif en vigueur sont proposées mais désactivées,
   * avec la raison. Les masquer laisserait l'utilisateur chercher une
   * prestation qu'il sait vendre ; les proposer cliquables serait un bouton
   * qui ne peut pas aboutir — la base refuse une ligne sans tarif.
   *
   * On ne rejoue pas ici la règle de résolution du prix : on constate
   * seulement l'absence totale de tarif. Le cas plus fin (un tarif existe,
   * mais pas pour ce type de véhicule) reste tranché par le serveur, et son
   * message est affiché tel quel.
   */
  readonly prestationsDisponibles = computed(() => {
    const deja = new Set(this.dossiers.lignes().map((l) => l.service_id));
    const jour = new Date().toISOString().slice(0, 10);
    const tarifes = new Set(
      this.catalogue
        .tarifs()
        .filter((t) => t.valid_from <= jour && (t.valid_to === null || t.valid_to >= jour))
        .map((t) => t.service_id),
    );

    return this.catalogue
      .prestations()
      .filter((p) => p.is_active && !deja.has(p.id))
      .map((prestation) => ({ prestation, tarifee: tarifes.has(prestation.id) }));
  });

  readonly totalDossier = computed(() =>
    this.dossiers.lignes().reduce((somme, l) => somme + l.line_total_minor, 0),
  );

  formaterMontantLigne(montant: number, devise: string): string {
    return formaterMontant(montant, devise || this.devise());
  }

  async ajouter(serviceId: string): Promise<void> {
    const dossier = this.dossierOuvert();
    if (!dossier || this.enregistrement()) return;

    this.enregistrement.set(true);
    const erreur = await this.dossiers.ajouterPrestation(dossier.id, serviceId);
    this.enregistrement.set(false);
    this.erreurFormulaire.set(erreur);
  }

  async retirer(ligneId: string): Promise<void> {
    const dossier = this.dossierOuvert();
    if (!dossier) return;
    this.erreurFormulaire.set(await this.dossiers.retirerPrestation(dossier.id, ligneId));
  }

  // ---------------------------------------------------------------------
  // Transitions
  // ---------------------------------------------------------------------

  async avancer(dossier: DossierListe): Promise<void> {
    const suite = this.actionSuivante(dossier);
    if (!suite || this.enregistrement()) return;

    this.enregistrement.set(true);
    const erreur = await this.dossiers.transitionner(dossier.id, suite.vers);
    this.enregistrement.set(false);
    this.erreurFormulaire.set(erreur);
  }

  ouvrirAnnulation(dossier: DossierListe): void {
    this.erreurFormulaire.set(null);
    this.formAnnulation.reset({ motif: '' });
    this.annulation.set(dossier);
  }

  fermerAnnulation(): void {
    this.annulation.set(null);
  }

  async annuler(): Promise<void> {
    const dossier = this.annulation();
    if (!dossier || this.enregistrement()) return;

    // Sans ceci, cliquer sur « Annuler le dossier » avec un motif vide ne
    // produisait rien du tout : le contrôle n'étant pas `touched`, le message
    // d'erreur restait masqué. Un bouton qui ne fait rien est pire qu'un refus.
    if (this.formAnnulation.invalid) {
      this.formAnnulation.markAllAsTouched();
      return;
    }

    this.enregistrement.set(true);
    const erreur = await this.dossiers.transitionner(
      dossier.id,
      'CANCELLED',
      this.formAnnulation.getRawValue().motif.trim(),
    );
    this.enregistrement.set(false);

    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.annulation.set(null);
  }
}
