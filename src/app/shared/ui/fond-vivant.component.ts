import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Fond vivant : des halos d'azur qui dérivent lentement derrière le contenu
 * (skill « animations vivantes », `AmbientBlobs`).
 *
 * Décor pur : `aria-hidden`, `pointer-events: none`, posé SOUS le contenu.
 * Les cartes sont opaques — les halos ne se voient que dans les marges et
 * derrière la barre latérale, ils ne passent jamais sous un texte à lire.
 *
 * Coût sur un Android d'entrée de gamme : chaque halo est un DÉGRADÉ radial,
 * peint une fois puis seulement déplacé (`transform`) par le compositeur.
 * Jusqu'en phase 24, c'était un disque plein passé dans `filter: blur(64px)` :
 * un flou de cette taille sur des surfaces de 400 px de côté est l'effet le
 * plus cher qu'un navigateur mobile ait à composer, et le premier suspect quand
 * un téléphone montre des zones blanches pendant un défilement. Le dégradé
 * donne le même halo sans filtre. « Réduire les animations » les fige.
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
        /* Plein au centre, nul au bord : le profil d'un disque flouté. */
        background: radial-gradient(closest-side, var(--halo) 30%, transparent);
        opacity: var(--vh-halo-opacite);
        animation: vh-blob 14s ease-in-out infinite;
      }
      :host(.vh-fond-vivant--sombre) .halo {
        /* Sur la navigation, toujours sombre : assez pour être vu, pas assez
           pour faire baisser le contraste des libellés posés au-dessus. */
        opacity: 0.22;
      }
      .halo--1 {
        --halo: var(--vh-vivant);
        left: -5rem;
        top: -6rem;
        width: 22rem;
        height: 22rem;
      }
      .halo--2 {
        --halo: var(--vh-vivant-profond);
        right: -6rem;
        top: 33%;
        width: 26rem;
        height: 26rem;
        animation-delay: -5s;
      }
      .halo--3 {
        --halo: var(--vh-vivant-clair);
        left: 33%;
        bottom: -6rem;
        width: 22rem;
        height: 22rem;
        animation-delay: -9s;
      }
      .halo--4 {
        --halo: var(--vh-vivant);
        right: 25%;
        top: -5rem;
        width: 18rem;
        height: 18rem;
        animation-delay: -3s;
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
