import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerService, type Client } from '../../core/customers/customer.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmationComponent } from '../../shared/ui/confirmation.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

/**
 * Découpe la partie nationale d'un numéro selon son usage local.
 *
 * 9 chiffres (Sénégal, Côte d'Ivoire…) : 77 123 45 67.
 * 8 chiffres (Mali, Burkina, Bénin…)   : 76 12 34 56.
 * Longueur inattendue : groupes de deux, le dernier absorbe le reste — jamais
 * de chiffre isolé en fin de ligne, qui se lit comme une faute de frappe.
 */
function grouper(national: string): string {
  const decoupe = (tailles: readonly number[]): string => {
    const morceaux: string[] = [];
    let position = 0;
    for (const taille of tailles) {
      morceaux.push(national.slice(position, position + taille));
      position += taille;
    }
    if (position < national.length) morceaux.push(national.slice(position));
    return morceaux.filter(Boolean).join(' ');
  };

  if (national.length === 9) return decoupe([2, 3, 2, 2]);
  if (national.length === 8) return decoupe([2, 2, 2, 2]);

  const morceaux: string[] = national.match(/\d{2}/g) ?? [];
  const reste = national.slice(morceaux.length * 2);
  if (reste && morceaux.length > 0) {
    morceaux[morceaux.length - 1] += reste;
  } else if (reste) {
    morceaux.push(reste);
  }
  return morceaux.join(' ');
}

/** Attente avant de lancer la recherche : assez pour ne pas requêter à chaque
 *  frappe, assez peu pour rester réactif au comptoir. */
const DELAI_RECHERCHE = 300;

@Component({
  selector: 'vh-customers',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    EmptyStateComponent,
    IconComponent,
    SkeletonComponent,
    ConfirmationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css',
})
export class CustomersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly clients = inject(CustomerService);

  readonly enEdition = signal<Client | null>(null);
  readonly formulaireOuvert = signal(false);
  readonly enregistrement = signal(false);
  readonly erreurFormulaire = signal<string | null>(null);

  readonly peutEcrire = computed(() => this.auth.hasPermission('customers.write'));

  private minuteur: ReturnType<typeof setTimeout> | null = null;

  readonly form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: [''],
    email: ['', Validators.email],
    notes: [''],
  });

  constructor() {
    void this.clients.rechercher('');
  }

  /** Recherche différée : une requête par pause de frappe, pas par caractère. */
  surRecherche(evenement: Event): void {
    const terme = (evenement.target as HTMLInputElement).value;
    if (this.minuteur) clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => void this.clients.rechercher(terme), DELAI_RECHERCHE);
  }

  ouvrirCreation(): void {
    this.enEdition.set(null);
    this.erreurFormulaire.set(null);
    this.form.reset({ full_name: '', phone: '', email: '', notes: '' });
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(client: Client): void {
    this.enEdition.set(client);
    this.erreurFormulaire.set(null);
    this.form.reset({
      full_name: client.full_name,
      phone: client.phone ?? '',
      email: client.email ?? '',
      notes: client.notes ?? '',
    });
    this.formulaireOuvert.set(true);
  }

  fermer(): void {
    this.formulaireOuvert.set(false);
  }

  async enregistrer(): Promise<void> {
    if (this.form.invalid || this.enregistrement()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const client = {
      full_name: v.full_name.trim(),
      phone: v.phone.trim() || null,
      email: v.email.trim() || null,
      notes: v.notes.trim() || null,
    };

    this.enregistrement.set(true);
    this.erreurFormulaire.set(null);

    const enCours = this.enEdition();
    const erreur = enCours
      ? await this.clients.modifier(enCours.id, client)
      : await this.clients.creer(client);

    this.enregistrement.set(false);

    if (erreur) {
      this.erreurFormulaire.set(erreur);
      return;
    }
    this.formulaireOuvert.set(false);
  }

  /** Client dont on s'apprête à archiver la fiche, le temps de confirmer. */
  readonly aArchiver = signal<Client | null>(null);

  texteArchivage(client: Client): string {
    return (
      `La fiche de ${client.full_name} disparaît des listes. Son historique est ` +
      `conservé, et son numéro redevient disponible pour une nouvelle fiche.`
    );
  }

  archiver(client: Client): void {
    this.aArchiver.set(client);
  }

  async confirmerArchivage(): Promise<void> {
    const client = this.aArchiver();
    if (!client) return;
    const erreur = await this.clients.archiver(client.id);
    this.aArchiver.set(null);
    this.erreurFormulaire.set(erreur);
  }

  /**
   * Affiche une forme unique quelle que soit la saisie.
   *
   * Sans cela, deux clients saisis différemment s'affichent différemment
   * (« 781112233 » à côté de « +221 70 999 88 77 ») : l'œil ne peut plus
   * parcourir la colonne, alors que c'est justement le geste le plus fréquent.
   * On part du numéro normalisé par la base, jamais de la saisie brute.
   */
  telephoneLisible(client: Client): string {
    const chiffres = client.phone_digits;
    if (!chiffres) return client.phone?.trim() || 'Numéro non renseigné';

    // Indicatif ouest-africain : trois chiffres.
    const indicatif = chiffres.slice(0, 3);
    const national = chiffres.slice(3);
    return `+${indicatif} ${grouper(national)}`.trim();
  }
}
