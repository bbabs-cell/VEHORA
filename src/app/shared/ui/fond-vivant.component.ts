import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Fond vivant : des halos d'azur flous qui dérivent lentement derrière le
 * contenu (skill « animations vivantes », `AmbientBlobs`).
 *
 * Décor pur : `aria-hidden`, `pointer-events: none`, posé SOUS le contenu.
 * Les cartes sont opaques — les halos ne se voient que dans les marges et
 * derrière la barre latérale, ils ne passent jamais sous un texte à lire.
 *
 * Coût sur un Android d'entrée de gamme : chaque halo est une couche peinte
 * une fois, puis seulement déplacée (`transform`) par le compositeur — aucune
 * mise en page, aucun repeint par image. Sous 768 px le flou est réduit, parce
 * que c'est la taille du flou qui coûte au premier dessin. « Réduire les
 * animations » les fige.
 *
 * Les délais négatifs désynchronisent les halos dès la première image : sans
 * eux, les quatre partiraient ensemble et le fond « pulserait ».
 */
@Component({
  selector: 'vh-fond-vivant',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'vh-fond-vivant',
    'aria-hidden': 'true',
    '[class.vh-fond-vivant--sombre]': 'sombre()',
  },
  template: `
    <span class="halo halo--1"></span>
    <span class="halo halo--2"></span>
    <span class="halo halo--3"></span>
    @if (!sombre()) {
      <span class="halo halo--4"></span>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
      }
      .halo {
        position: absolute;
        border-radius: var(--vh-radius-pill);
        background: rgb(var(--vh-vivant-rgb));
        opacity: var(--vh-halo-opacite);
        filter: blur(64px);
        will-change: transform;
        animation: vh-blob 14s ease-in-out infinite;
      }
      :host(.vh-fond-vivant--sombre) .halo {
        /* Sur la navigation, toujours sombre : assez pour être vu, pas assez
           pour faire baisser le contraste des libellés posés au-dessus. */
        opacity: 0.22;
      }
      .halo--1 {
        left: -5rem;
        top: -6rem;
        width: 20rem;
        height: 20rem;
      }
      .halo--2 {
        right: -6rem;
        top: 33%;
        width: 24rem;
        height: 24rem;
        background: var(--vh-vivant-profond);
        animation-delay: -5s;
      }
      .halo--3 {
        left: 33%;
        bottom: -6rem;
        width: 20rem;
        height: 20rem;
        background: var(--vh-vivant-clair);
        animation-delay: -9s;
      }
      .halo--4 {
        right: 25%;
        top: -5rem;
        width: 16rem;
        height: 16rem;
        animation-delay: -3s;
      }
      @media (max-width: 767px) {
        .halo {
          filter: blur(40px);
        }
      }
      @media print {
        :host {
          display: none;
        }
      }
    `,
  ],
})
export class FondVivantComponent {
  /** Variante posée sur un bandeau sombre (barre latérale) : trois halos, plus présents. */
  readonly sombre = input(false);
}
