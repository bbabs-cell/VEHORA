import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Squelette de chargement : il respecte la forme du contenu final, pour éviter
 * que la page saute une fois les données arrivées.
 *
 * Le scintillement est la classe globale `vh-squelette` (skill « animations
 * vivantes », `skeleton-shimmer`) : il avait ses propres @keyframes ici, et
 * une seconde définition dans `_base.css`, avec deux vitesses différentes.
 */
@Component({
  selector: 'vh-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="vh-squelette"
      [style.width]="largeur()"
      [style.height]="hauteur()"
      role="status"
      aria-label="Chargement"
    ></span>
  `,
})
export class SkeletonComponent {
  readonly largeur = input('100%');
  readonly hauteur = input('1rem');
}
