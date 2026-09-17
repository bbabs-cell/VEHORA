import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { ScrollLockService } from '../../core/ui/scroll-lock.service';

/**
 * Demande de confirmation avant un geste qui engage.
 *
 * Elle remplace `window.confirm()`, utilisé sur quatre écrans. Une boîte native
 * pose trois problèmes sur le terrain : elle n'est pas dans la langue ni dans
 * le thème du produit, elle bloque le fil d'exécution du navigateur sur un
 * Android modeste, et surtout elle n'a ni bouton nommé ni texte qu'une
 * assertion puisse lire — quatre confirmations n'étaient donc vérifiées par
 * aucun test.
 *
 * Le libellé du bouton d'action dit ce qui va se passer (« Archiver »,
 * « Suspendre »), jamais « OK » : c'est lui qu'on lit avant de cliquer.
 */
@Component({
  selector: 'vh-confirmation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modale" role="dialog" aria-modal="true" [attr.aria-labelledby]="idTitre">
      <div class="modale__contenu vh-card">
        <header class="modale__entete">
          <h2 [id]="idTitre" class="modale__titre">{{ titre() }}</h2>
          <button
            class="modale__fermer"
            type="button"
            (click)="annuler.emit()"
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>

        <p class="texte">{{ texte() }}</p>

        <div class="modale__actions">
          <button class="vh-button vh-button--ghost" type="button" (click)="annuler.emit()">
            Annuler
          </button>
          <button
            class="vh-button"
            [class.vh-button--danger]="danger()"
            type="button"
            [disabled]="enCours()"
            (click)="confirmer.emit()"
          >
            {{ enCours() ? 'En cours…' : action() }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .texte {
        margin: 0 0 var(--vh-space-4);
      }
    `,
  ],
})
export class ConfirmationComponent {
  readonly titre = input.required<string>();
  readonly texte = input.required<string>();
  /** Ce que fera le bouton : « Archiver », « Suspendre ». Jamais « OK ». */
  readonly action = input.required<string>();
  readonly danger = input(true);
  readonly enCours = input(false);

  readonly confirmer = output<void>();
  readonly annuler = output<void>();

  /** Un identifiant par instance : deux modales ouvertes ne partagent pas le sien. */
  readonly idTitre = `titre-confirmation-${Math.random().toString(36).slice(2, 9)}`;

  private readonly verrou = inject(ScrollLockService);

  constructor() {
    // Le composant n'existe que pendant qu'il est affiché : son cycle de vie
    // suffit à poser et à lever le verrou de défilement. L'appelant n'a donc
    // rien à gérer — c'est ce qui manquait sur les écrans où la page défilait
    // sous la boîte de dialogue.
    this.verrou.verrouiller(true);
    inject(DestroyRef).onDestroy(() => this.verrou.verrouiller(false));
  }
}
