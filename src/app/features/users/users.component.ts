import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { MemberService, type Invitation, type Membre } from '../../core/members/member.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmationComponent } from '../../shared/ui/confirmation.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

@Component({
  selector: 'vh-users',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, SkeletonComponent, ConfirmationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly membres = inject(MemberService);

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
