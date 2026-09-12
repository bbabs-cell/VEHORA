import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

/**
 * Tuile d'indicateur. Un chiffre, un libellé, rien de plus.
 *
 * Le prompt maître est explicite : ne pas transformer le tableau de bord en mur
 * de graphiques. Un responsable de station veut un chiffre lisible en une
 * seconde, pas une courbe à interpréter.
 */
@Component({
  selector: 'vh-stat-tile',
  standalone: true,
  imports: [SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tuile" [class.tuile--accent]="accent()">
      <p class="tuile__libelle">{{ libelle() }}</p>
      @if (chargement()) {
        <vh-skeleton largeur="3ch" hauteur="var(--vh-text-2xl)" />
      } @else {
        <p class="tuile__valeur">{{ valeur() }}</p>
      }
      @if (precision(); as texte) {
        <p class="tuile__precision vh-muted">{{ texte }}</p>
      }
    </div>
  `,
  styles: [
    `
      .tuile {
        display: flex;
        flex-direction: column;
        gap: var(--vh-space-1);
        padding: var(--vh-space-4);
        background: var(--vh-surface-1);
        border: 1px solid var(--vh-border);
        border-radius: var(--vh-radius-card);
        min-height: 104px;
      }
      .tuile--accent {
        box-shadow: inset 3px 0 0 var(--vh-primary);
      }
      .tuile__libelle {
        margin: 0;
        font-size: var(--vh-text-sm);
        color: var(--vh-text-muted);
      }
      .tuile__valeur {
        margin: 0;
        font-size: var(--vh-text-2xl);
        font-weight: 600;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .tuile__precision {
        margin: 0;
        font-size: var(--vh-text-xs);
      }
    `,
  ],
})
export class StatTileComponent {
  readonly libelle = input.required<string>();
  readonly valeur = input.required<string | number>();
  readonly precision = input<string | null>(null);
  readonly chargement = input(false);
  readonly accent = input(false);
}
