import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { MotDePasseComponent, RevelableDirective } from '../../../shared/ui/mot-de-passe.component';
import { SceneComponent } from '../../../shared/ui/scene.component';
import { CompteService } from './compte.service';
import { messageCompte } from './messages-compte';

/** Les deux saisies du mot de passe doivent être identiques. */
function identiques(groupe: AbstractControl): ValidationErrors | null {
  const { password, confirmation } = groupe.value as { password: string; confirmation: string };
  return password === confirmation ? null : { differents: true };
}

/**
 * Nouveau mot de passe. On y arrive par le lien de « Mot de passe oublié » :
 * le client Supabase lit le jeton de l'adresse et ouvre une session. Une
 * personne déjà connectée y change aussi le sien.
 *
 * Sans garde de route, volontairement : un lien expiré doit l'expliquer ici,
 * pas renvoyer sur la connexion sans un mot.
 */
@Component({
  selector: 'vh-nouveau-mot-de-passe',
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
        <section class="compte__carte vh-card" aria-labelledby="titre-nouveau">
          <header class="compte__entete">
            <p class="vh-marque"><img src="marque.svg" alt="" width="34" height="24" /><span class="vh-text-gradient">VEHORA</span></p>
            <h1 id="titre-nouveau" class="vh-page-title vh-titre-scene">Nouveau mot de passe</h1>
          </header>

          @if (auth.status() === 'chargement') {
            <p class="vh-muted" role="status">Vérification du lien…</p>
          } @else if (!auth.isAuthenticated()) {
            <p class="vh-alert vh-alert--info" role="status">
              Ce lien a expiré ou a déjà servi. Demandez-en un nouveau : il arrive en une minute.
            </p>
            <a class="vh-button compte__valider" routerLink="/mot-de-passe-oublie">
              Recevoir un nouveau lien
            </a>
          } @else {
            <form [formGroup]="form" (ngSubmit)="soumettre()" novalidate>
              <div class="vh-field">
                <label class="vh-label" for="password">Nouveau mot de passe</label>
                <vh-mot-de-passe>
                  <input
                    id="password"
                    vhRevelable
                    class="vh-input"
                    type="password"
                    formControlName="password"
                    autocomplete="new-password"
                  />
                </vh-mot-de-passe>
                <p class="vh-aide">Au moins 8 caractères.</p>
              </div>
              <div class="vh-field">
                <label class="vh-label" for="confirmation">Le même, une seconde fois</label>
                <vh-mot-de-passe>
                  <input
                    id="confirmation"
                    vhRevelable
                    class="vh-input"
                    type="password"
                    formControlName="confirmation"
                    autocomplete="new-password"
                  />
                </vh-mot-de-passe>
                @if (form.touched && form.invalid) {
                  <p class="vh-field__erreur">
                    {{
                      form.hasError('differents')
                        ? 'Les deux saisies ne sont pas identiques.'
                        : 'Le mot de passe comporte au moins 8 caractères.'
                    }}
                  </p>
                }
              </div>

              @if (erreur(); as message) {
                <p class="vh-alert" role="alert">{{ message }}</p>
              }

              <button class="vh-button compte__valider" type="submit" [disabled]="enCours()">
                {{ enCours() ? 'Enregistrement…' : 'Enregistrer le mot de passe' }}
              </button>
            </form>
          }
        </section>
      </vh-scene>
    </main>
  `,
})
export class NouveauMotDePasseComponent {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  private readonly compte = inject(CompteService);
  private readonly router = inject(Router);

  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmation: ['', Validators.required],
    },
    { validators: identiques },
  );

  async soumettre(): Promise<void> {
    if (this.form.invalid || this.enCours()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    const error = await this.compte.changerMotDePasse(this.form.getRawValue().password);
    this.enCours.set(false);

    if (error) {
      this.erreur.set(messageCompte(error.message));
      return;
    }
    // Le tableau de bord renvoie lui-même vers « Sans organisation » si besoin.
    await this.router.navigateByUrl('/tableau-de-bord');
  }
}
