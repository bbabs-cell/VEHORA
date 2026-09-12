import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * État vide : dit quoi faire, jamais « Aucune donnée ».
 * Un des quatre états obligatoires de tout écran affichant des données.
 */
@Component({
  selector: 'vh-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vide">
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
