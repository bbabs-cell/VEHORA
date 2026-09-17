import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerService, type Client } from '../../core/customers/customer.service';
import { VehicleService, type VehiculeListe } from '../../core/vehicles/vehicle.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmationComponent } from '../../shared/ui/confirmation.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

const DELAI_RECHERCHE = 300;

@Component({
  selector: 'vh-vehicles',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    IconComponent,
    SkeletonComponent,
    ConfirmationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.css',
})
export class VehiclesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly clients = inject(CustomerService);
  readonly vehicules = inject(VehicleService);

  readonly enEdition = signal<VehiculeListe | null>(null);
  readonly formulaireOuvert = signal(false);
  readonly enregistrement = signal(false);
  readonly erreurFormulaire = signal<string | null>(null);

  /** Propriétaire choisi dans le formulaire, et résultats du sélecteur. */
  readonly proprietaire = signal<{ id: string; nom: string } | null>(null);
  readonly resultatsClients = signal<Client[]>([]);
  readonly rechercheClientOuverte = signal(false);

  readonly peutEcrire = computed(() => this.auth.hasPermission('vehicles.write'));

  /**
   * Le type est obligatoire et vient d'un chargement asynchrone. Tant qu'il
   * n'est pas là, ouvrir le formulaire produirait un formulaire invalide que
   * rien n'expliquerait : l'utilisateur cliquerait « Enregistrer » sans effet.
   */
  readonly pretAEnregistrer = computed(() => this.vehicules.types().length > 0);
  readonly peutVoirClients = computed(() => this.auth.hasPermission('customers.read'));
  readonly peutInspecter = computed(() => this.auth.hasPermission('inspections.write'));

  private minuteurListe: ReturnType<typeof setTimeout> | null = null;
  private minuteurClient: ReturnType<typeof setTimeout> | null = null;

  readonly form = this.fb.nonNullable.group({
    vehicle_type_id: ['', Validators.required],
    plate: ['', [Validators.required, Validators.maxLength(20)]],
    make: [''],
    model: [''],
    color: [''],
    notes: [''],
  });

  constructor() {
    void this.vehicules.chargerTypes();
    void this.vehicules.rechercher('');

    // Les types peuvent arriver après l'ouverture du formulaire : on renseigne
    // alors le défaut, plutôt que de laisser un champ obligatoire vide.
    effect(() => {
      const premier = this.vehicules.types()[0];
      if (premier && !this.form.controls.vehicle_type_id.value) {
        this.form.controls.vehicle_type_id.setValue(premier.id);
      }
    });
  }

  surRecherche(evenement: Event): void {
    const terme = (evenement.target as HTMLInputElement).value;
    if (this.minuteurListe) clearTimeout(this.minuteurListe);
    this.minuteurListe = setTimeout(() => void this.vehicules.rechercher(terme), DELAI_RECHERCHE);
  }

  /** Sélecteur de propriétaire : recherche différée dans les clients. */
  surRechercheClient(evenement: Event): void {
    const terme = (evenement.target as HTMLInputElement).value;
    if (this.minuteurClient) clearTimeout(this.minuteurClient);

    if (terme.trim().length < 2) {
      this.resultatsClients.set([]);
      return;
    }

    this.minuteurClient = setTimeout(async () => {
      await this.clients.rechercher(terme);
      this.resultatsClients.set(this.clients.clients().slice(0, 6));
      this.rechercheClientOuverte.set(true);
    }, DELAI_RECHERCHE);
  }

  choisirProprietaire(client: Client): void {
    this.proprietaire.set({ id: client.id, nom: client.full_name });
    this.resultatsClients.set([]);
    this.rechercheClientOuverte.set(false);
  }

  retirerProprietaire(): void {
    this.proprietaire.set(null);
  }

  private typeParDefaut(): string {
    // « Berline » est le premier de la liste, et le cas le plus courant.
    return this.vehicules.types()[0]?.id ?? '';
  }

  ouvrirCreation(): void {
    if (!this.pretAEnregistrer()) return;
    this.enEdition.set(null);
    this.erreurFormulaire.set(null);
    this.proprietaire.set(null);
    this.resultatsClients.set([]);
    this.form.reset({
      vehicle_type_id: this.typeParDefaut(),
      plate: '',
      make: '',
      model: '',
      color: '',
      notes: '',
    });
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(vehicule: VehiculeListe): void {
    this.enEdition.set(vehicule);
    this.erreurFormulaire.set(null);
    this.resultatsClients.set([]);
    this.proprietaire.set(
      vehicule.customer_id && vehicule.customer_name
        ? { id: vehicule.customer_id, nom: vehicule.customer_name }
        : null,
    );
    this.form.reset({
      vehicle_type_id: vehicule.vehicle_type_id,
      plate: vehicule.plate ?? '',
      make: vehicule.make ?? '',
      model: vehicule.model ?? '',
      color: vehicule.color ?? '',
      notes: vehicule.notes ?? '',
    });
    this.formulaireOuvert.set(true);
  }

  fermer(): void {
    this.formulaireOuvert.set(false);
  }

  async enregistrer(): Promise<void> {
    if (this.form.invalid || this.enregistrement()) {
      this.form.markAllAsTouched();
      // Un formulaire qui refuse de s'envoyer sans rien dire est pire qu'une
      // erreur : l'utilisateur clique et croit à une panne.
      if (!this.form.controls.vehicle_type_id.value) {
        this.erreurFormulaire.set('Sélectionnez un type de véhicule.');
      }
      return;
    }

    const v = this.form.getRawValue();
    const vehicule = {
      vehicle_type_id: v.vehicle_type_id,
      customer_id: this.proprietaire()?.id ?? null,
      plate: v.plate.trim().toUpperCase() || null,
      make: v.make.trim() || null,
      model: v.model.trim() || null,
      color: v.color.trim() || null,
      notes: v.notes.trim() || null,
    };

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);

    const enCours = this.enEdition();
    const erreur = enCours
      ? await this.vehicules.modifier(enCours.id, vehicule)
      : await this.vehicules.creer(vehicule);

    this.enregistrement.set(false);

    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.formulaireOuvert.set(false);
  }

  /** Véhicule dont on s'apprête à archiver la fiche, le temps de confirmer. */
  readonly aArchiver = signal<VehiculeListe | null>(null);

  texteArchivage(vehicule: VehiculeListe): string {
    return (
      `${vehicule.plate ?? 'Ce véhicule'} disparaît des listes. Son historique de ` +
      `prestations est conservé, et sa plaque redevient disponible.`
    );
  }

  archiver(vehicule: VehiculeListe): void {
    this.aArchiver.set(vehicule);
  }

  async confirmerArchivage(): Promise<void> {
    const vehicule = this.aArchiver();
    if (!vehicule) return;
    const erreur = await this.vehicules.archiver(vehicule.id);
    this.aArchiver.set(null);
    this.erreurFormulaire.set(erreur);
  }

  /** « Toyota Corolla — Gris », sans tirets orphelins si une info manque. */
  descriptionVehicule(v: VehiculeListe): string {
    const identite = [v.make, v.model].filter(Boolean).join(' ');
    return [identite || v.type_label, v.color].filter(Boolean).join(' — ');
  }
}
