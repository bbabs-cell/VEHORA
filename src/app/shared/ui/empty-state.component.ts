import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * État vide : dit quoi faire, jamais « Aucune donnée ».
 * Un des quatre états obligatoires de tout écran affichant des données.
 *
 * Méthode MagyaPro : jamais un cadre vide — une phrase qui dit ce qui
 * apparaîtra ici, et le bouton qui permet de commencer (projeté). L'étincelle
 * qui flotte est le seul décor du skill d'animation prévu pour cet état.
 */
@Component({
  selector: 'vh-empty-state',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vide vh-anim-fade-up">
      <span class="vide__icone vh-anim-float" aria-hidden="true">
        <vh-icon nom="etincelle" [taille]="22" />
      </span>
      <p class="vide__titre">{{ titre() }}</p>
      <p class="vide__texte vh-muted">{{ texte() }}</p>
      <ng-content />
    </div>
  `,
  styles: [
    `
      .vide {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--vh-space-2);
        padding: var(--vh-space-12) var(--vh-space-4);
        text-align: center;
      }
      .vide__icone {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        margin-bottom: var(--vh-space-2);
        border-radius: var(--vh-radius-pill);
        background: var(--vh-primary-soft);
        color: var(--vh-primary-bright);
      }
      .vide__titre {
        margin: 0;
        font-weight: 600;
      }
      .vide__texte {
        margin: 0;
        font-size: var(--vh-text-sm);
        max-width: 42ch;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly titre = input.required<string>();
  readonly texte = input.required<string>();
}
