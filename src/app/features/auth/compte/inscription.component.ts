import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MotDePasseComponent, RevelableDirective } from '../../../shared/ui/mot-de-passe.component';
import { SceneComponent } from '../../../shared/ui/scene.component';
import { CompteService } from './compte.service';
import { messageCompte } from './messages-compte';

/**
 * Créer un compte. C'est le chemin d'une personne invitée (elle crée son
 * compte avec l'adresse invitée, puis colle son code) comme d'un propriétaire
 * qui démarre (il crée ensuite son entreprise). Un compte seul n'a aucun
 * droit : sans organisation, aucun claim, aucune donnée.
 */
@Component({
  selector: 'vh-inscription',
  standalone: true,
  imports: [
    SceneComponent,
    ReactiveFormsModule,
    RouterLink,
    MotDePasseComponent,
    RevelableDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './compte.css',
  template: `
    <main class="compte">
      <vh-scene>
        <section class="compte__carte vh-card" aria-labelledby="titre-inscription">
          <header class="compte__entete">
            <p class="vh-marque"><img src="marque.svg" alt="" width="34" height="24" /><span class="vh-text-gradient">VEHORA</span></p>
            <h1 id="titre-inscription" class="vh-page-title vh-titre-scene">Créer un compte</h1>
            <p class="vh-muted compte__texte">
              Invité par votre responsable ? Utilisez l’adresse à laquelle l’invitation a été faite
              : le code ne fonctionne qu’avec elle.
            </p>
          </header>

          @if (confirmation(); as adresse) {
            <p class="vh-alert vh-alert--succes" role="status">
              Un e-mail de confirmation vient de partir vers {{ adresse }}. Ouvrez le lien qu’il
              contient, puis connectez-vous.
            </p>
          } @else {
            <form [formGroup]="form" (ngSubmit)="soumettre()" novalidate>
              <div class="vh-field">
                <label class="vh-label" for="nom">Votre nom</label>
                <input
                  id="nom"
                  class="vh-input"
                  type="text"
                  formControlName="nom"
                  autocomplete="name"
                  [attr.aria-invalid]="form.controls.nom.touched && form.controls.nom.invalid"
                />
                <p class="vh-aide">Celui que verront vos collègues.</p>
                @if (form.controls.nom.touched && form.controls.nom.invalid) {
                  <p class="vh-field__erreur">Saisissez votre nom.</p>
                }
              </div>

              <div class="vh-field">
                <label class="vh-label" for="email">Adresse e-mail</label>
                <input
                  id="email"
                  class="vh-input"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                  inputmode="email"
                  autocapitalize="off"
                  spellcheck="false"
                  [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid"
                />
                @if (form.controls.email.touched && form.controls.email.invalid) {
                  <p class="vh-field__erreur">Saisissez une adresse e-mail valide.</p>
                }
              </div>

              <div class="vh-field">
                <label class="vh-label" for="password">Mot de passe</label>
                <vh-mot-de-passe>
                  <input
                    id="password"
                    vhRevelable
                    class="vh-input"
                    type="password"
                    formControlName="password"
                    autocomplete="new-password"
                    [attr.aria-invalid]="
                      form.controls.password.touched && form.controls.password.invalid
                    "
                  />
                </vh-mot-de-passe>
                <p class="vh-aide">Au moins 8 caractères.</p>
                @if (form.controls.password.touched && form.controls.password.invalid) {
                  <p class="vh-field__erreur">Le mot de passe comporte au moins 8 caractères.</p>
                }
              </div>

              @if (erreur(); as message) {
                <p class="vh-alert" role="alert">{{ message }}</p>
              }

              <button class="vh-button compte__valider" type="submit" [disabled]="enCours()">
                {{ enCours() ? 'Création…' : 'Créer mon compte' }}
              </button>
            </form>
          }

          <p class="compte__liens">
            <a routerLink="/connexion">J’ai déjà un compte</a>
          </p>
        </section>
      </vh-scene>
    </main>
  `,
})
export class InscriptionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly compte = inject(CompteService);
  private readonly router = inject(Router);

  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);
  /** Adresse à laquelle part le lien de confirmation, quand le projet en exige un. */
  readonly confirmation = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async soumettre(): Promise<void> {
    if (this.form.invalid || this.enCours()) {
      this.form.markAllAsTouched();
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);
    const { nom, email, password } = this.form.getRawValue();
    const { error, confirmationRequise } = await this.compte.inscrire(nom, email, password);
    this.enCours.set(false);

    if (error) {
      this.erreur.set(messageCompte(error.message));
      return;
    }
    if (confirmationRequise) {
      this.confirmation.set(email.trim());
      return;
    }
    // Compte ouvert et connecté : créer son entreprise, ou coller son code.
    await this.router.navigateByUrl('/sans-organisation');
  }
}
