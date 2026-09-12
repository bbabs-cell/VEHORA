import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import {
  CatalogueService,
  type PrestationService,
  type TarifService,
} from '../../core/catalogue/catalogue.service';
import { OrganizationService } from '../../core/organization/organization.service';
import { StationService } from '../../core/stations/station.service';
import { VehicleService } from '../../core/vehicles/vehicle.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import {
  formaterDate,
  formaterMontant,
  symboleDevise,
  versMontantMineur,
  versSaisie,
} from '../../shared/format/montant';

/** Une prestation et ses tarifs en vigueur, tels qu'affichés dans la liste. */
interface LignePrestation {
  readonly prestation: PrestationService;
  readonly categorie: string | null;
  readonly tarifs: readonly LigneTarif[];
}

interface LigneTarif {
  readonly tarif: TarifService;
  readonly libelle: string;
  readonly montant: string;
  readonly aVenir: boolean;
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Un changement de prix prend effet demain : la journée en cours a déjà des
 *  dossiers ouverts au prix affiché ce matin. */
function demain(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

@Component({
  selector: 'vh-catalogue',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogue.component.html',
  styleUrl: './catalogue.component.css',
})
export class CatalogueComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly organisation = inject(OrganizationService);
  private readonly stationsService = inject(StationService);
  private readonly vehicules = inject(VehicleService);
  readonly catalogue = inject(CatalogueService);

  readonly peutGererCatalogue = computed(() => this.auth.hasPermission('services.manage'));
  readonly peutGererTarifs = computed(() => this.auth.hasPermission('prices.manage'));

  readonly stations = computed(() => this.stationsService.stations());
  readonly typesVehicule = computed(() => this.vehicules.types());
  readonly devise = computed(() => this.organisation.organisation()?.currency ?? 'XOF');
  /** « F CFA » plutôt que « XOF » : c'est ce que l'utilisateur lit sur son affiche. */
  readonly symbole = computed(() => symboleDevise(this.devise()));

  readonly prestationOuverte = signal(false);
  readonly tarifOuvert = signal<PrestationService | null>(null);
  readonly prestationEnEdition = signal<PrestationService | null>(null);
  readonly enregistrement = signal(false);
  readonly erreurFormulaire = signal<string | null>(null);

  readonly formPrestation = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    description: [''],
    duration_minutes: [''],
    category_id: [''],
    is_active: [true],
  });

  /** Tarif dont on change le montant. Distinct de la création d'un tarif. */
  readonly tarifRemplace = signal<TarifService | null>(null);

  readonly formRemplacement = this.fb.nonNullable.group({
    montant: ['', Validators.required],
    valid_from: [demain(), Validators.required],
  });

  readonly formTarif = this.fb.nonNullable.group({
    montant: ['', Validators.required],
    vehicle_type_id: [''],
    station_id: [''],
    valid_from: [aujourdhui(), Validators.required],
  });

  constructor() {
    void this.catalogue.charger();
    void this.organisation.charger();
    void this.stationsService.charger();
    void this.vehicules.chargerTypes();
  }

  readonly lignes = computed<LignePrestation[]>(() => {
    const categories = new Map(this.catalogue.categories().map((c) => [c.id, c.name]));
    const devise = this.devise();
    const jour = aujourdhui();
    const types = new Map(this.typesVehicule().map((t) => [t.id, t.label]));
    const stations = new Map(this.stations().map((s) => [s.id, s.name]));

    return this.catalogue.prestations().map((prestation) => ({
      prestation,
      categorie: prestation.category_id ? (categories.get(prestation.category_id) ?? null) : null,
      tarifs: this.catalogue
        .tarifs()
        .filter(
          (t) => t.service_id === prestation.id && (t.valid_to === null || t.valid_to >= jour),
        )
        .map((tarif) => ({
          tarif,
          libelle: this.libelleTarif(tarif, types, stations),
          montant: formaterMontant(tarif.amount_minor, tarif.currency || devise),
          aVenir: tarif.valid_from > jour,
        })),
    }));
  });

  /** Dit à qui s'applique un tarif, en français, sans jargon de spécificité. */
  private libelleTarif(
    tarif: TarifService,
    types: Map<string, string>,
    stations: Map<string, string>,
  ): string {
    const vehicule = tarif.vehicle_type_id
      ? (types.get(tarif.vehicle_type_id) ?? 'Type inconnu')
      : 'Tous véhicules';
    const station = tarif.station_id
      ? (stations.get(tarif.station_id) ?? 'Station inconnue')
      : 'Toutes stations';
    return `${vehicule} · ${station}`;
  }

  ouvrirCreationPrestation(): void {
    this.prestationEnEdition.set(null);
    this.erreurFormulaire.set(null);
    this.formPrestation.reset({
      name: '',
      description: '',
      duration_minutes: '',
      category_id: '',
      is_active: true,
    });
    this.prestationOuverte.set(true);
  }

  ouvrirEditionPrestation(prestation: PrestationService): void {
    this.prestationEnEdition.set(prestation);
    this.erreurFormulaire.set(null);
    this.formPrestation.reset({
      name: prestation.name,
      description: prestation.description ?? '',
      duration_minutes: prestation.duration_minutes?.toString() ?? '',
      category_id: prestation.category_id ?? '',
      is_active: prestation.is_active,
    });
    this.prestationOuverte.set(true);
  }

  fermerPrestation(): void {
    this.prestationOuverte.set(false);
  }

  async enregistrerPrestation(): Promise<void> {
    if (this.formPrestation.invalid || this.enregistrement()) return;

    const v = this.formPrestation.getRawValue();
    const duree = v.duration_minutes.trim() === '' ? null : Number(v.duration_minutes);
    if (duree !== null && (!Number.isInteger(duree) || duree < 1 || duree > 1440)) {
      this.erreurFormulaire.set('La durée doit être un nombre de minutes entre 1 et 1440.');
      return;
    }

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);

    const saisie = {
      name: v.name.trim(),
      description: v.description.trim() || null,
      duration_minutes: duree,
      category_id: v.category_id || null,
      is_active: v.is_active,
    };

    const enEdition = this.prestationEnEdition();
    const erreur = enEdition
      ? await this.catalogue.modifierPrestation(enEdition.id, saisie)
      : await this.catalogue.creerPrestation(saisie);

    this.enregistrement.set(false);
    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.prestationOuverte.set(false);
  }

  ouvrirTarif(prestation: PrestationService): void {
    this.erreurFormulaire.set(null);
    this.formTarif.reset({
      montant: '',
      vehicle_type_id: '',
      station_id: '',
      valid_from: aujourdhui(),
    });
    this.tarifOuvert.set(prestation);
  }

  fermerTarif(): void {
    this.tarifOuvert.set(null);
  }

  async enregistrerTarif(): Promise<void> {
    const prestation = this.tarifOuvert();
    if (!prestation || this.formTarif.invalid || this.enregistrement()) return;

    const v = this.formTarif.getRawValue();
    const montant = versMontantMineur(v.montant, this.devise());
    if (montant === null) {
      this.erreurFormulaire.set('Saisissez un montant valide, sans signe ni lettre.');
      return;
    }

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);

    const erreur = await this.catalogue.creerTarif({
      service_id: prestation.id,
      vehicle_type_id: v.vehicle_type_id || null,
      station_id: v.station_id || null,
      amount_minor: montant,
      valid_from: v.valid_from,
      valid_to: null,
    });

    this.enregistrement.set(false);
    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.tarifOuvert.set(null);
  }

  formaterDate = formaterDate;

  formaterMontantTarif(tarif: TarifService): string {
    return formaterMontant(tarif.amount_minor, tarif.currency || this.devise());
  }

  ouvrirRemplacement(tarif: TarifService): void {
    this.erreurFormulaire.set(null);
    this.formRemplacement.reset({
      montant: versSaisie(tarif.amount_minor, tarif.currency || this.devise()),
      valid_from: demain(),
    });
    this.tarifRemplace.set(tarif);
  }

  fermerRemplacement(): void {
    this.tarifRemplace.set(null);
  }

  async enregistrerRemplacement(): Promise<void> {
    const tarif = this.tarifRemplace();
    if (!tarif || this.formRemplacement.invalid || this.enregistrement()) return;

    const v = this.formRemplacement.getRawValue();
    const montant = versMontantMineur(v.montant, tarif.currency || this.devise());
    if (montant === null) {
      this.erreurFormulaire.set('Saisissez un montant valide, sans signe ni lettre.');
      return;
    }

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);
    const erreur = await this.catalogue.remplacerTarif(tarif.id, montant, v.valid_from);
    this.enregistrement.set(false);

    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.tarifRemplace.set(null);
  }

  /**
   * Un tarif déjà appliqué se ferme à hier : il cesse de valoir sans
   * disparaître, parce que des dossiers passés s'y réfèrent. Un tarif qui
   * n'a jamais commencé n'a facturé personne : il se supprime.
   */
  async retirerTarif(tarif: TarifService): Promise<void> {
    const jour = aujourdhui();
    const erreur =
      tarif.valid_from > jour
        ? await this.catalogue.supprimerTarifFutur(tarif.id)
        : await this.catalogue.fermerTarif(
            tarif.id,
            new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
          );
    if (erreur) this.erreurFormulaire.set(erreur);
  }
}
