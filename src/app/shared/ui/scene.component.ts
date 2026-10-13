import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FondVivantComponent } from './fond-vivant.component';

/**
 * Scène des écrans de PRÉSENTATION : connexion, compte sans entreprise,
 * création d'entreprise.
 *
 * Méthode MagyaPro, mouvement : sur un écran de travail, aucune animation qui
 * ne réponde à une action ; « les pages de présentation peuvent faire plus,
 * une fois ». C'est ici que le vocabulaire complet du skill « animations
 * vivantes » s'exprime : fond qui respire, trame, carte qui s'ouvre, champs en
 * cascade, mot clé en dégradé — vus une fois par jour, pas cent.
 */
@Component({
  selector: 'vh-scene',
  standalone: true,
  imports: [FondVivantComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <vh-fond-vivant class="scene__fond" />
    <div class="scene__trame vh-dot-grid-ink" aria-hidden="true"></div>
    <ng-content />
  `,
  styles: [
    `
      :host {
        position: relative;
        isolation: isolate;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100dvh;
        padding: var(--vh-space-4);
        overflow-x: clip;
      }
      .scene__fond,
      .scene__trame {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
      }
    `,
  ],
})
export class SceneComponent {}
