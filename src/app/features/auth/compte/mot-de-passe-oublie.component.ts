import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SceneComponent } from '../../../shared/ui/scene.component';
import { CompteService } from './compte.service';
import { messageCompte } from './messages-compte';

/**
 * Mot de passe oublié : un lien part par e-mail vers « Nouveau mot de passe ».
 * Le message est le même que l'adresse ait un compte ou non — sans quoi cet
 * écran servirait à savoir qui est client de VEHORA.
 */
@Component({
  selector: 'vh-mot-de-passe-oublie',
  standalone: true,
  imports: [SceneComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './compte.css',
  template: `
    <main class="compte">
      <vh-scene>
        <section class="compte__carte vh-card" aria-labelledby="titre-oubli">
          <header class="compte__entete">
            <p class="vh-marque vh-text-gradient">VEHORA</p>
            <h1 id="titre-oubli" class="vh-page-title vh-titre-scene">Mot de passe oublié</h1>
            <p class="vh-muted compte__texte">
              Saisissez votre adresse : un lien pour choisir un nouveau mot de passe vous sera
              envoyé.
            </p>
          </header>

          @if (envoye(); as adresse) {
            <p class="vh-alert vh-alert--succes" role="status">
              Si un compte existe pour {{ adresse }}, un lien vient de partir. Ouvrez-le depuis ce
              téléphone ou un autre : il est valable une heure.
            </p>
          } @else {
            <form [formGroup]="form" (ngSubmit)="soumettre()" novalidate>
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

              @if (erreur(); as message) {
                <p class="vh-alert" role="alert">{{ message }}</p>
              }

              <button class="vh-button compte__valider" type="submit" [disabled]="enCours()">
                {{ enCours() ? 'Envoi…' : 'Recevoir le lien' }}
              </button>
            </form>
          }

          <p class="compte__liens">
            <a routerLink="/connexion">Revenir à la connexion</a>
          </p>
        </section>
      </vh-scene>
    </main>
  `,
})
export class MotDePasseOublieComponent {
  private readonly fb = inject(FormBuilder);
  private readonly compte = inject(CompteService);

  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly envoye = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async soumettre(): Promise<void> {
    if (this.form.invalid || this.enCours()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    const email = this.form.getRawValue().email.trim();
    const error = await this.compte.demanderReinitialisation(email);
    this.enCours.set(false);

    // Seule une limite de débit ou une panne se dit : « compte inconnu » ne se
    // dit jamais.
    if (error && /rate limit|network|fetch/i.test(error.message)) {
      this.erreur.set(messageCompte(error.message));
      return;
    }
    this.envoye.set(email);
  }
}
