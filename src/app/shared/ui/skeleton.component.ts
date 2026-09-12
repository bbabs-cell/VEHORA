import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Squelette de chargement : il respecte la forme du contenu final, pour éviter
 * que la page saute une fois les données arrivées.
 */
@Component({
  selector: 'vh-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="squelette"
      [style.width]="largeur()"
      [style.height]="hauteur()"
      role="status"
      aria-label="Chargement"
    ></span>
  `,
  styles: [
    `
      .squelette {
        display: block;
        border-radius: var(--vh-radius-control);
        background: linear-gradient(
          90deg,
          var(--vh-surface-2) 25%,
          var(--vh-surface-3) 37%,
          var(--vh-surface-2) 63%
        );
        background-size: 400% 100%;
        animation: vh-glisse 1.4s ease infinite;
      }
      @keyframes vh-glisse {
        0% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0 50%;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .squelette {
          animation: none;
        }
      }
    `,
  ],
})
export class SkeletonComponent {
  readonly largeur = input('100%');
  readonly hauteur = input('1rem');
}
