import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogueService } from '../../core/catalogue/catalogue.service';
import { OrganizationService } from '../../core/organization/organization.service';
import {
  LIBELLES_STATUT,
  ORDRE_FILE,
  ServiceOrderService,
  TEINTE_STATUT,
  type DossierListe,
  type StatutDossier,
  type Transition,
} from '../../core/service-orders/service-order.service';
import { StationService } from '../../core/stations/station.service';
import { ScrollLockService } from '../../core/ui/scroll-lock.service';
import { VehicleService, type VehiculeListe } from '../../core/vehicles/vehicle.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { EntetePageComponent } from '../../shared/ui/entete-page.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import {
  LIBELLES_ETAT,
  LIBELLES_METHODE,
  ORDRE_METHODES,
  PaymentService,
  type CaisseOuverte,
  type MethodePaiement,
  type Paiement,
} from '../../core/payments/payment.service';
import { ReceiptService } from '../../core/receipts/receipt.service';
import {
  formaterMontant,
  symboleDevise,
  versMontantMineur,
  versSaisie,
} from '../../shared/format/montant';

/** Un groupe de la file : un statut et ses dossiers. */
interface GroupeFile {
  readonly statut: StatutDossier;
  readonly libelle: string;
  readonly dossiers: readonly DossierListe[];
}

/** Une étape proposée sur un dossier. */
interface ActionSuivante {
  readonly vers: StatutDossier;
  readonly libelle: string;
  /**
   * Pourquoi l'étape n'est pas possible maintenant — le bouton est alors inerte
   * et la raison écrite dessous. `null` : l'étape est possible.
   */
  readonly raison: string | null;
}

/**
 * Le libellé de chaque passage que la file propose. Les étapes elles-mêmes
 * viennent de la matrice de la base (`service_order_transitions`), filtrées
 * par les droits de la personne et les réglages de l'organisation : jusqu'en
 * phase 25, une table figée ici proposait « Valider le contrôle » à un
 * caissier, et jamais le chemin court qu'ouvre « Inspection obligatoire :
 * non ». Le retour du contrôle vers le travail et l'annulation ont leur
 * propre geste.
 */
const LIBELLES_ETAPE: Readonly<Partial<Record<string, string>>> = {
  'ARRIVED>INSPECTION': 'Inspecter',
  'ARRIVED>WAITING': 'Mettre en attente',
  'INSPECTION>WAITING': 'Mettre en attente',
  'IN_PROGRESS>CONTROL': 'Envoyer au contrôle',
  'IN_PROGRESS>READY': 'Marquer prêt',
  'CONTROL>READY': 'Valider le contrôle',
  'READY>DELIVERED': 'Restituer',
};

const ORDRE_ETAPES: readonly StatutDossier[] = [
  'INSPECTION',
  'WAITING',
  'CONTROL',
  'READY',
  'DELIVERED',
];

/** Les prestations se figent au démarrage du travail ; la base le tient aussi. */
const STATUTS_MODIFIABLES: readonly StatutDossier[] = ['ARRIVED', 'INSPECTION', 'WAITING'];

const DELAI_RECHERCHE = 300;

@Component({
  selector: 'vh-file-attente',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmptyStateComponent, EntetePageComponent, SkeletonComponent],
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
  /** « F CFA » plutôt que « XOF » : c'est ce que l'utilisateur lit sur son affiche. */
  readonly symbole = computed(() => symboleDevise(this.devise()));

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

  // ---------------------------------------------------------------------
  // Encaissement
  // ---------------------------------------------------------------------
  readonly paiements = inject(PaymentService);
  readonly encaissementOuvert = signal<DossierListe | null>(null);
  readonly restitutionOuverte = signal<DossierListe | null>(null);

  readonly recus = inject(ReceiptService);
  private readonly routeur = inject(Router);

  readonly peutEncaisser = computed(() => this.auth.hasPermission('payments.record'));
  readonly peutRembourser = computed(() => this.auth.hasPermission('payments.refund'));
  readonly peutVoirPaiements = computed(() => this.auth.hasPermission('payments.read'));

  readonly methodes = ORDRE_METHODES;
  readonly teinteStatut = TEINTE_STATUT;
  readonly libelleMethode = (m: MethodePaiement): string => LIBELLES_METHODE[m];

  readonly formPaiement = this.fb.nonNullable.group({
    methode: ['CASH' as MethodePaiement, Validators.required],
    montant: ['', Validators.required],
    fournisseur: [''],
    reference: [''],
  });

  readonly formRestitution = this.fb.nonNullable.group({
    motif: ['', [Validators.required, Validators.minLength(3)]],
  });

  /**
   * Le moyen de paiement choisi, en signal. `caisseRequiseManquante` lisait
   * `controls.methode.value`, un champ ordinaire qu'un `computed` ne suit
   * pas : passer d'Espèces à Mobile Money ne recalculait rien, et sans caisse
   * ouverte AUCUN paiement n'était possible — Mobile Money compris.
   */
  readonly methodeChoisie = toSignal(this.formPaiement.controls.methode.valueChanges, {
    initialValue: this.formPaiement.controls.methode.value,
  });
  private readonly montantSaisi = toSignal(this.formPaiement.controls.montant.valueChanges, {
    initialValue: this.formPaiement.controls.montant.value,
  });

  private minuterie?: ReturnType<typeof setTimeout>;

  private readonly verrou = inject(ScrollLockService);

  /** Vrai dès qu'une boîte de dialogue de cet écran est ouverte. */
  private readonly modaleOuverte = computed(
    () =>
      this.ouvertureOuverte() ||
      this.dossierOuvert() !== null ||
      this.annulation() !== null ||
      this.encaissementOuvert() !== null ||
      this.restitutionOuverte() !== null ||
      this.remboursementOuvert() !== null,
  );

  constructor() {
    effect(() => this.verrou.verrouiller(this.modaleOuverte()));

    void this.dossiers.chargerFile();
    void this.dossiers.chargerTransitions();
    void this.dossiers.chargerARecouvrer();
    void this.organisation.charger();
    void this.organisation.chargerReglages();
    void this.stationsService.charger();
    void this.catalogue.charger();
  }

  readonly groupes = computed<GroupeFile[]>(() => {
    const ouverts = ORDRE_FILE.map((statut) => ({
      statut,
      libelle: LIBELLES_STATUT[statut],
      dossiers: this.dossiers.dossiers().filter((d) => d.status === statut),
    })).filter((g) => g.dossiers.length > 0);

    // Le véhicule est parti, l'argent n'est pas rentré : ces dossiers restent
    // visibles ici, seul écran qui encaisse. Ils en sortaient à la
    // restitution, et la créance ne se recouvrait plus.
    const aRecouvrer = this.dossiers.aRecouvrer();
    return aRecouvrer.length === 0
      ? ouverts
      : [
          ...ouverts,
          {
            statut: 'DELIVERED' as const,
            libelle: 'Restitués — reste à encaisser',
            dossiers: aRecouvrer,
          },
        ];
  });

  readonly fileVide = computed(
    () => this.dossiers.dossiers().length === 0 && this.dossiers.aRecouvrer().length === 0,
  );

  /**
   * Stations chargées, et aucune : la personne n'est affectée à aucune station.
   * « Nouveau dossier » est alors inerte — il faut dire pourquoi, sinon c'est
   * un bouton grisé que rien n'explique.
   */
  readonly sansStation = computed(
    () => !this.stationsService.chargement() && this.stations().length === 0,
  );

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

  /**
   * Les étapes proposées sur un dossier : celles de la matrice de la base,
   * que la personne a le droit de faire, que les réglages ouvrent, et que
   * l'état du dossier rend sensées. Une étape possible plus tard (travail en
   * cours, solde dû) est montrée inerte avec sa raison ; une étape qui n'est
   * pas la sienne (droit manquant) n'est pas montrée du tout.
   */
  actionsSuivantes(dossier: DossierListe): ActionSuivante[] {
    const reglages = this.organisation.reglages();
    return this.dossiers
      .transitions()
      .filter((t) => t.from_status === dossier.status)
      .filter((t) => LIBELLES_ETAPE[`${t.from_status}>${t.to_status}`] !== undefined)
      .filter((t) => this.auth.hasPermission(t.required_permission))
      .filter((t) => this.conditionOuverte(t, dossier, reglages))
      .sort((a, b) => ORDRE_ETAPES.indexOf(a.to_status) - ORDRE_ETAPES.indexOf(b.to_status))
      .map((t) => ({
        vers: t.to_status,
        libelle: LIBELLES_ETAPE[`${t.from_status}>${t.to_status}`] ?? '',
        raison: this.raisonInerte(dossier, t.to_status),
      }));
  }

  private conditionOuverte(
    t: Transition,
    dossier: DossierListe,
    reglages: { require_inspection: boolean; require_quality_control: boolean } | null,
  ): boolean {
    switch (t.condition_code) {
      // Les deux chemins courts n'existent que si l'organisation les a ouverts.
      case 'INSPECTION_OPTIONAL':
        return reglages !== null && !reglages.require_inspection;
      case 'QUALITY_OPTIONAL':
        return reglages !== null && !reglages.require_quality_control;
      // Sans inspection rattachée, l'action du dossier est « Faire
      // l'inspection » : la base refuserait la file d'attente.
      case 'INSPECTION_DONE':
        return dossier.inspecte;
      default:
        return true;
    }
  }

  private raisonInerte(dossier: DossierListe, vers: StatutDossier): string | null {
    if (vers === 'WAITING' && dossier.lignes === 0) {
      return 'Ajoutez une prestation d’abord.';
    }
    if ((vers === 'CONTROL' || vers === 'READY') && dossier.status === 'IN_PROGRESS') {
      const n = dossier.operationsRestantes;
      if (n > 0) {
        return n > 1 ? `${n} opérations ne sont pas terminées.` : 'Une opération n’est pas terminée.';
      }
    }
    if (vers === 'DELIVERED' && this.peutVoirPaiements() && dossier.balance_minor > 0) {
      if (this.organisation.reglages()?.payment_before_delivery === 'STRICT') {
        return `Reste ${this.solde(dossier)} à encaisser avant de restituer.`;
      }
      if (!this.peutRembourser()) {
        return `Reste ${this.solde(dossier)} à encaisser : restituer avec un solde demande un responsable.`;
      }
    }
    return null;
  }

  /** Le dossier peut-il être annulé depuis son statut, par cette personne ? */
  annulable(dossier: DossierListe): boolean {
    return (
      this.peutAnnuler() &&
      this.dossiers
        .transitions()
        .some((t) => t.from_status === dossier.status && t.to_status === 'CANCELLED')
    );
  }

  /** Argent reçu et non rendu : tant qu'il y en a, la base refuse l'annulation. */
  encaisseNet(dossier: DossierListe): number {
    return this.peutVoirPaiements() ? Math.max(0, dossier.total_minor - dossier.balance_minor) : 0;
  }

  /** Les prestations se figent au démarrage du travail. */
  modifiable(dossier: DossierListe): boolean {
    return STATUTS_MODIFIABLES.includes(dossier.status);
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
    else
      this.erreurFormulaire.set(
        'Dossier ouvert, mais la file est pleine : il n’apparaît pas encore à l’écran.',
      );
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
    // `line_total_minor` est une colonne calculée : NOT NULL en base, mais le
    // générateur la rend nullable faute de le savoir.
    this.dossiers.lignes().reduce((somme, l) => somme + (l.line_total_minor ?? 0), 0),
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

  /**
   * Émet le reçu du dossier et l'ouvre. Le bouton n'apparaît que lorsque la
   * base acceptera : un dossier annulé ou sans prestation n'a rien à imprimer,
   * et l'afficher quand même serait un clic qui échoue.
   */
  async emettreRecu(dossier: DossierListe): Promise<void> {
    if (this.enregistrement()) return;
    this.enregistrement.set(true);

    // Un reçu est un constat : chaque clic en émettait un NOUVEL original,
    // numéroté — deux originaux pour un même dossier. On rouvre le reçu en
    // vigueur ; s'il ne correspond plus au dossier (paiement reçu depuis,
    // véhicule restitué), on émet la correction qui le remplace.
    await this.recus.chargerDossier(dossier.id);
    const recus = this.recus.recus();
    const remplaces = new Set(recus.map((r) => r.replaces_receipt_id).filter((id) => id !== null));
    const enVigueur = recus.find((r) => !remplaces.has(r.id)) ?? null;

    let resultat: Awaited<ReturnType<ReceiptService['emettre']>> | null = enVigueur;
    if (!enVigueur) {
      resultat = await this.recus.emettre(dossier.id);
    } else if (!this.recuAJour(enVigueur.contenu, dossier)) {
      resultat = await this.recus.emettre(dossier.id, enVigueur.id);
    }
    this.enregistrement.set(false);

    if (typeof resultat === 'string') {
      this.erreurFormulaire.set(resultat);
      return;
    }
    if (resultat) await this.routeur.navigate(['/recus', resultat.id]);
  }

  /** Le reçu dit-il encore vrai : même montant encaissé, même restitution ? */
  private recuAJour(contenu: unknown, dossier: DossierListe): boolean {
    const c = (contenu ?? {}) as {
      totaux?: { total_minor?: number; solde_minor?: number };
      dossier?: { restitue_le?: string | null };
    };
    return (
      c.totaux?.total_minor === dossier.total_minor &&
      c.totaux?.solde_minor === dossier.balance_minor &&
      (dossier.status === 'DELIVERED') === Boolean(c.dossier?.restitue_le)
    );
  }

  async avancer(dossier: DossierListe, action: ActionSuivante): Promise<void> {
    if (action.raison || this.enregistrement()) return;

    // Restituer avec un solde est une décision, pas un clic : on demande le
    // motif d'abord, plutôt que de laisser la base refuser après coup.
    if (action.vers === 'DELIVERED' && this.peutVoirPaiements() && dossier.balance_minor > 0) {
      this.ouvrirRestitution(dossier);
      return;
    }

    this.enregistrement.set(true);
    const erreur = await this.dossiers.transitionner(dossier.id, action.vers);
    this.enregistrement.set(false);
    this.erreurFormulaire.set(erreur);
    if (!erreur && action.vers === 'DELIVERED') void this.dossiers.chargerARecouvrer();
  }

  // ---------------------------------------------------------------------
  // Paiement
  // ---------------------------------------------------------------------

  solde(dossier: DossierListe): string {
    return formaterMontant(dossier.balance_minor, dossier.currency ?? this.devise());
  }

  /** Trop-perçu, en positif : ce que la station doit rendre au client. */
  aRendre(dossier: DossierListe): string {
    return formaterMontant(-dossier.balance_minor, dossier.currency ?? this.devise());
  }

  libelleEtat(dossier: DossierListe): string {
    return LIBELLES_ETAT[dossier.payment_status];
  }

  formaterMinor(montant: number): string {
    return formaterMontant(montant, this.devise());
  }

  async ouvrirEncaissement(dossier: DossierListe): Promise<void> {
    this.erreurFormulaire.set(null);
    this.formPaiement.reset({
      methode: 'CASH',
      // Le solde restant est le montant le plus probable : on le propose, on
      // ne l'impose pas — un client peut payer une partie. En unité PRINCIPALE :
      // le champ se relit avec `versMontantMineur`, et l'unité mineure brute
      // aurait été multipliée par cent dans une devise à deux décimales.
      montant: dossier.balance_minor > 0 ? this.saisie(dossier.balance_minor, dossier) : '',
      fournisseur: '',
      reference: '',
    });
    this.encaissementOuvert.set(dossier);
    await Promise.all([
      this.paiements.chargerDossier(dossier.id),
      this.paiements.chargerMaCaisse(dossier.station_id),
    ]);
  }

  fermerEncaissement(): void {
    this.encaissementOuvert.set(null);
    void this.dossiers.chargerFile();
    void this.dossiers.chargerARecouvrer();
  }

  private saisie(montantMineur: number, dossier: DossierListe): string {
    return versSaisie(montantMineur, dossier.currency ?? this.devise());
  }

  /** Espèces sans caisse ouverte : la base refusera, l'écran le dit avant. */
  readonly caisseRequiseManquante = computed(
    () => this.methodeChoisie() === 'CASH' && this.paiements.caisse() === null,
  );

  /** Ouvrir une caisse est-il seulement possible pour cette personne ? */
  readonly peutOuvrirCaisse = computed(() => this.auth.hasPermission('cash.open'));

  /**
   * Le montant saisi dépasse ce qui reste dû : la différence sera un
   * trop-perçu à rendre. La base l'accepte ; l'écran le dit avant, plutôt
   * que de le découvrir à la restitution.
   */
  readonly tropPercu = computed(() => {
    const dossier = this.encaissementOuvert();
    if (!dossier) return null;
    const montant = versMontantMineur(this.montantSaisi(), dossier.currency ?? this.devise());
    const reste = this.paiements.etat()?.balance_minor ?? dossier.balance_minor;
    return montant !== null && montant > reste && reste >= 0 ? montant - reste : null;
  });

  /** Ce qui reste remboursable d'un paiement : son montant, moins ses remboursements. */
  remboursable(paiementId: string, montant: number): number {
    const deja = this.paiements
      .paiements()
      .filter((p) => p.kind === 'REFUND' && p.reverses_payment_id === paiementId)
      .reduce((somme, p) => somme + p.amount_minor, 0);
    return Math.max(0, montant - deja);
  }

  async encaisser(): Promise<void> {
    const dossier = this.encaissementOuvert();
    if (!dossier || this.enregistrement()) return;
    if (this.formPaiement.invalid) {
      this.formPaiement.markAllAsTouched();
      return;
    }

    const v = this.formPaiement.getRawValue();
    const montant = versMontantMineur(v.montant, dossier.currency ?? this.devise());
    if (montant === null || montant <= 0) {
      this.erreurFormulaire.set('Saisissez un montant valide, sans signe ni lettre.');
      return;
    }

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);
    const erreur = await this.paiements.encaisser(
      dossier.id,
      v.methode,
      montant,
      v.fournisseur.trim() || null,
      v.reference.trim() || null,
    );
    this.enregistrement.set(false);

    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }

    await this.dossiers.chargerFile();

    // Le dossier reste ouvert : un client règle souvent en deux fois, et le
    // montant le plus probable est ce qu'il reste. Le champ le propose plutôt
    // que de se vider et d'obliger à retaper.
    const reste = this.paiements.etat()?.balance_minor ?? 0;
    this.formPaiement.patchValue({
      montant: reste > 0 ? this.saisie(reste, dossier) : '',
      reference: '',
    });

    // La carte de la file, derrière la modale, doit suivre : afficher un solde
    // périmé pendant qu'on encaisse est pire que ne rien afficher.
    const frais = this.dossiers.dossiers().find((d) => d.id === dossier.id);
    if (frais) this.encaissementOuvert.set(frais);
  }

  /**
   * Remboursement en cours de saisie. Le motif passait par `window.prompt()` :
   * une boîte native, hors thème, hors langue du produit, qui bloque le fil
   * d'exécution et qu'aucune assertion ne peut lire — sur le geste qui fait
   * ressortir de l'argent du tiroir. Il a maintenant son formulaire, comme le
   * reste.
   *
   * `maxMineur` : ce qui reste remboursable. Le montant se saisit (50 000
   * tapés au lieu de 5 000 : on en rend 45 000), proposé au maximum.
   */
  readonly remboursementOuvert = signal<{
    paiementId: string;
    maxMineur: number;
    especes: boolean;
    caisseOrigine: string | null;
  } | null>(null);

  readonly formRemboursement = this.fb.nonNullable.group({
    montant: ['', Validators.required],
    motif: ['', [Validators.required, Validators.minLength(3)]],
    caisse: [''],
  });

  /**
   * Les caisses ouvertes de la station du dossier, pour un remboursement en
   * espèces : l'argent sort d'un tiroir, et c'est celui-là qui doit le dire
   * (ADR-006). `null` tant qu'elles se chargent.
   */
  readonly caissesOuvertes = signal<readonly CaisseOuverte[] | null>(null);

  /** Espèces à rendre, et aucun tiroir ouvert dans la station : rien ne peut sortir. */
  readonly sansTiroir = computed(() => {
    const demande = this.remboursementOuvert();
    const caisses = this.caissesOuvertes();
    return demande !== null && demande.especes && caisses !== null && caisses.length === 0;
  });

  /** « Ma caisse », « Caisse d'Ousmane » — et laquelle a reçu le billet. */
  libelleCaisse(caisse: CaisseOuverte): string {
    // « Caisse d'Ousmane », pas « Caisse de Ousmane ».
    const de = /^[aeiouyàâäéèêëîïôöùûü]/i.test(caisse.titulaire) ? 'd’' : 'de ';
    const nom =
      caisse.titulaireId === this.auth.claims().sub
        ? 'Ma caisse'
        : `Caisse ${de}${caisse.titulaire}`;
    return caisse.id === this.remboursementOuvert()?.caisseOrigine
      ? `${nom} — a reçu ce paiement`
      : nom;
  }

  async ouvrirRemboursement(paiement: Paiement): Promise<void> {
    const dossier = this.encaissementOuvert();
    if (!dossier) return;
    const maxMineur = this.remboursable(paiement.id, paiement.amount_minor);
    const especes = paiement.method === 'CASH';

    this.erreurFormulaire.set(null);
    this.formRemboursement.reset({
      montant: this.saisie(maxMineur, dossier),
      motif: '',
      caisse: '',
    });
    this.caissesOuvertes.set(especes ? null : []);
    this.remboursementOuvert.set({
      paiementId: paiement.id,
      maxMineur,
      especes,
      caisseOrigine: paiement.cash_register_id,
    });
    if (!especes) return;

    const { caisses, erreur } = await this.paiements.caissesOuvertes(dossier.station_id);
    // La fenêtre a pu être refermée, ou rouverte sur un autre paiement.
    if (this.remboursementOuvert()?.paiementId !== paiement.id) return;
    this.caissesOuvertes.set(caisses);
    this.erreurFormulaire.set(erreur);

    // Par défaut, le tiroir qui a reçu le billet ; sinon le sien ; sinon le seul.
    const moi = this.auth.claims().sub;
    const defaut =
      caisses.find((c) => c.id === paiement.cash_register_id) ??
      caisses.find((c) => c.titulaireId === moi) ??
      (caisses.length === 1 ? caisses[0] : undefined);
    this.formRemboursement.controls.caisse.setValue(defaut?.id ?? '');
  }

  fermerRemboursement(): void {
    this.remboursementOuvert.set(null);
  }

  async rembourser(): Promise<void> {
    const dossier = this.encaissementOuvert();
    const demande = this.remboursementOuvert();
    if (!dossier || !demande || this.enregistrement()) return;

    if (this.formRemboursement.invalid) {
      this.formRemboursement.markAllAsTouched();
      return;
    }

    const v = this.formRemboursement.getRawValue();
    const montant = versMontantMineur(v.montant, dossier.currency ?? this.devise());
    if (montant === null || montant <= 0) {
      this.erreurFormulaire.set('Saisissez un montant valide, sans signe ni lettre.');
      return;
    }
    if (montant > demande.maxMineur) {
      this.erreurFormulaire.set(
        `On ne rend pas plus que ce qui reste remboursable : ${this.formaterMinor(demande.maxMineur)}.`,
      );
      return;
    }
    if (demande.especes && !v.caisse) {
      this.erreurFormulaire.set('Choisissez la caisse d’où sortent les billets.');
      return;
    }

    this.enregistrement.set(true);
    const erreur = await this.paiements.rembourser(
      dossier.id,
      demande.paiementId,
      montant,
      v.motif.trim(),
      demande.especes ? v.caisse : null,
    );
    this.enregistrement.set(false);
    this.erreurFormulaire.set(erreur);

    if (!erreur) this.remboursementOuvert.set(null);
    await this.dossiers.chargerFile();
  }

  // ---------------------------------------------------------------------
  // Restitution avec créance
  // ---------------------------------------------------------------------

  ouvrirRestitution(dossier: DossierListe): void {
    this.erreurFormulaire.set(null);
    this.formRestitution.reset({ motif: '' });
    this.restitutionOuverte.set(dossier);
  }

  fermerRestitution(): void {
    this.restitutionOuverte.set(null);
  }

  async restituer(): Promise<void> {
    const dossier = this.restitutionOuverte();
    if (!dossier || this.enregistrement()) return;
    if (this.formRestitution.invalid) {
      this.formRestitution.markAllAsTouched();
      return;
    }

    this.enregistrement.set(true);
    const erreur = await this.dossiers.transitionner(
      dossier.id,
      'DELIVERED',
      this.formRestitution.getRawValue().motif.trim(),
    );
    this.enregistrement.set(false);

    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.restitutionOuverte.set(null);
    void this.dossiers.chargerARecouvrer();
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
