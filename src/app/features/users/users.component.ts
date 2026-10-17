import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { MemberService, type Invitation, type Membre } from '../../core/members/member.service';
import { StationService } from '../../core/stations/station.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmationComponent } from '../../shared/ui/confirmation.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EntetePageComponent } from '../../shared/ui/entete-page.component';

@Component({
  selector: 'vh-users',
  standalone: true,
  imports: [
    EntetePageComponent,
    ReactiveFormsModule,
    EmptyStateComponent,
    SkeletonComponent,
    ConfirmationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly membres = inject(MemberService);
  private readonly stationsService = inject(StationService);

  /** Les stations actives : ce qu'on peut affecter. */
  readonly stations = computed(() =>
    this.stationsService.stations().filter((s) => s.status === 'ACTIVE'),
  );
  private readonly nomsStations = computed(
    () => new Map(this.stationsService.stations().map((s) => [s.id, s.name])),
  );

  /** Le rôle choisi dans l'invitation est-il limité à des stations ? */
  readonly roleInviteStation = signal(false);

  /** Membre dont on choisit les stations, et la sélection en cours. */
  readonly affectation = signal<Membre | null>(null);
  readonly choixStations = signal<ReadonlySet<string>>(new Set());

  readonly formulaireOuvert = signal(false);
  readonly enCours = signal(false);
  readonly erreurAction = signal<string | null>(null);
  readonly codeCopie = signal<string | null>(null);

  /** Son propre identifiant : on ne se dégrade pas soi-même par accident. */
  readonly moi = computed(() => this.auth.claims().sub);

  /**
   * Tant que les rôles ne sont pas chargés, aucun rôle ne peut être choisi et
   * le formulaire serait invalide sans que rien ne l'explique. On désactive
   * l'action plutôt que de laisser l'utilisateur cliquer dans le vide.
   */
  readonly pretAInviter = computed(() => this.membres.roles().length > 0);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    roleId: ['', Validators.required],
  });

  constructor() {
    void this.membres.charger();
    void this.stationsService.charger();
    this.form.controls.roleId.valueChanges.subscribe((id) =>
      this.roleInviteStation.set(
        this.membres.roles().find((r) => r.id === id)?.scope === 'STATION',
      ),
    );
  }

  /** « Liberté 6, Ouakam » — ou rien. */
  stationsDe(membre: Membre): string {
    return membre.stations
      .map((id) => this.nomsStations().get(id) ?? '')
      .filter(Boolean)
      .join(', ');
  }

  /** « awa@ » et « exemple.sn » : la ligne se coupe entre les deux. */
  arobase(email: string): [string, string] {
    const i = email.lastIndexOf('@');
    return i < 0 ? [email, ''] : [email.slice(0, i + 1), email.slice(i + 1)];
  }

  ouvrirStations(membre: Membre): void {
    this.erreurAction.set(null);
    this.choixStations.set(new Set(membre.stations));
    this.affectation.set(membre);
  }

  basculerStation(id: string): void {
    const choix = new Set(this.choixStations());
    if (choix.has(id)) choix.delete(id);
    else choix.add(id);
    this.choixStations.set(choix);
  }

  async enregistrerStations(): Promise<void> {
    const membre = this.affectation();
    if (!membre || this.enCours()) return;
    this.enCours.set(true);
    const erreur = await this.membres.affecterStations(membre, [...this.choixStations()]);
    this.enCours.set(false);
    if (erreur) {
      this.erreurAction.set(erreur);
      return;
    }
    this.affectation.set(null);
  }

  ouvrirInvitation(): void {
    if (!this.pretAInviter()) return;
    this.erreurAction.set(null);
    // Par défaut, le rôle le moins privilégié parmi ceux proposés : mieux vaut
    // élargir un accès trop étroit que retirer un accès trop large.
    const defaut =
      this.membres.roles().find((r) => r.code === 'OPERATOR') ?? this.membres.roles()[0];
    this.form.reset({ email: '', roleId: defaut?.id ?? '' });
    this.formulaireOuvert.set(true);
  }

  async inviter(): Promise<void> {
    if (this.form.invalid || this.enCours()) {
      this.form.markAllAsTouched();
      if (!this.form.controls.roleId.value) {
        this.erreurAction.set('Sélectionnez un rôle avant d’envoyer l’invitation.');
      }
      return;
    }
    this.enCours.set(true);
    const v = this.form.getRawValue();
    const erreur = await this.membres.inviter(v.email, v.roleId);
    this.enCours.set(false);

    if (erreur) {
      this.erreurAction.set(erreur);
      return;
    }
    this.formulaireOuvert.set(false);
  }

  async changerRole(membre: Membre, evenement: Event): Promise<void> {
    const roleId = (evenement.target as HTMLSelectElement).value;
    if (roleId === membre.roleId) return;
    const erreur = await this.membres.changerRole(membre.id, roleId);
    this.erreurAction.set(erreur);
  }

  /** Membre dont on s'apprête à suspendre le compte, le temps de confirmer. */
  readonly aSuspendre = signal<Membre | null>(null);

  texteSuspension(membre: Membre): string {
    return (
      `L’accès de ${membre.nom} sera coupé dans les minutes qui suivent. Son ` +
      `historique de travail est conservé, et son compte peut être réactivé.`
    );
  }

  async basculerStatut(membre: Membre): Promise<void> {
    if (membre.statut === 'ACTIVE') {
      this.aSuspendre.set(membre);
      return;
    }
    const erreur = await this.membres.changerStatut(membre.id, 'ACTIVE');
    this.erreurAction.set(erreur);
  }

  async confirmerSuspension(): Promise<void> {
    const membre = this.aSuspendre();
    if (!membre) return;
    const erreur = await this.membres.changerStatut(membre.id, 'SUSPENDED');
    this.aSuspendre.set(null);
    this.erreurAction.set(erreur);
  }

  async revoquer(invitation: Invitation): Promise<void> {
    const erreur = await this.membres.revoquerInvitation(invitation.id);
    this.erreurAction.set(erreur);
  }

  async copier(invitation: Invitation): Promise<void> {
    try {
      await navigator.clipboard.writeText(invitation.token);
      this.codeCopie.set(invitation.id);
      setTimeout(() => this.codeCopie.set(null), 2500);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le code
      // reste visible et sélectionnable à l'écran.
      this.erreurAction.set('Copie impossible. Sélectionnez le code affiché.');
    }
  }
}
