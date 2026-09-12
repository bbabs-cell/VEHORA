import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'vh-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
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

    const { email, password } = this.form.getRawValue();
    const { error } = await this.auth.signIn(email, password);

    this.enCours.set(false);

    if (error) {
      this.erreur.set(this.messageErreur(error.message));
      return;
    }

    const redirection = this.route.snapshot.queryParamMap.get('redirection');
    await this.router.navigateByUrl(redirection ?? '/tableau-de-bord');
  }

  /**
   * Traduit les erreurs Supabase en français, sans révéler si le compte existe
   * (l'énumération de comptes est une fuite d'information).
   */
  private messageErreur(message: string): string {
    if (message.includes('Invalid login credentials')) {
      return 'Identifiants incorrects. Vérifiez votre adresse et votre mot de passe.';
    }
    if (message.includes('Email not confirmed')) {
      return 'Votre adresse e-mail n’a pas encore été confirmée.';
    }
    if (message.toLowerCase().includes('failed to fetch')) {
      return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
    }
    return 'La connexion a échoué. Réessayez dans un instant.';
  }
}
