import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NombreAnimeComponent } from './nombre-anime.component';
import { SkeletonComponent } from './skeleton.component';

const entier = new Intl.NumberFormat('fr-FR');

/**
 * Tuile d'indicateur. Un chiffre, un libellé, rien de plus.
 *
 * Le prompt maître est explicite : ne pas transformer le tableau de bord en mur
 * de graphiques. Un responsable de station veut un chiffre lisible en une
 * seconde, pas une courbe à interpréter.
 *
 * Une valeur NUMÉRIQUE défile jusqu'à sa cible (skill « animations
 * vivantes », KPI) ; un texte s'affiche tel quel. Un montant se passe en
 * nombre (unité mineure) avec sa mise en forme dans `format`.
 */
@Component({
  selector: 'vh-stat-tile',
  standalone: true,
  imports: [SkeletonComponent, NombreAnimeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tuile" [class.tuile--accent]="accent()">
      <p class="tuile__libelle">{{ libelle() }}</p>
      @if (chargement()) {
        <vh-skeleton largeur="3ch" hauteur="var(--vh-text-2xl)" />
      } @else {
        <p class="tuile__valeur" [class.tuile__valeur--argent]="argent()">
          @if (nombre(); as n) {
            <vh-nombre-anime [valeur]="n.valeur" [format]="format()" />
          } @else {
            {{ valeur() }}
          }
        </p>
      }
      @if (precision(); as texte) {
        <p class="tuile__precision vh-muted">{{ texte }}</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .tuile {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--vh-space-1);
        height: 100%;
        padding: var(--vh-space-4);
        background: var(--vh-surface-1);
        border: 1px solid var(--vh-border);
        border-radius: var(--vh-radius-card);
        box-shadow: var(--vh-shadow-1);
        min-height: 104px;
        overflow: hidden;
      }
      /* Le rail de marque : la tuile qui compte le plus sur la rangée. */
      .tuile--accent {
        box-shadow:
          inset 3px 0 0 var(--vh-primary-bright),
          var(--vh-shadow-1);
      }
      .tuile__libelle {
        margin: 0;
        font-size: var(--vh-text-sm);
        color: var(--vh-text-muted);
      }
      .tuile__valeur {
        margin: 0;
        /* 2 × 2 sur 375 px : une tuile fait 165 px. À 32 px, « 1 250 000 »
           sortait de la sienne ; le corps se resserre avec l'écran. */
        font-size: clamp(var(--vh-text-xl), 6.5vw, var(--vh-text-2xl));
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -0.01em;
        font-variant-numeric: tabular-nums;
        min-width: 0;
      }
      /* Un montant est en laiton, la seule couleur qui parle d'argent. */
      .tuile__valeur--argent {
        color: var(--vh-money);
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
  /** Mise en forme d'une valeur numérique ; par défaut, l'entier groupé (« 1 250 »). */
  readonly format = input<(n: number) => string>((n) => entier.format(n));
  readonly precision = input<string | null>(null);
  readonly chargement = input(false);
  readonly accent = input(false);
  /** La valeur est un montant : elle prend la couleur de l'argent. */
  readonly argent = input(false);

  /** Enveloppe : `0` est une valeur, pas une absence — `@if (0)` serait faux. */
  readonly nombre = computed(() => {
    const v = this.valeur();
    return typeof v === 'number' ? { valeur: v } : null;
  });
}
