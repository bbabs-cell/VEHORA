import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

/** En dessous, la navigation est perçue comme instantanée : rien à montrer. */
const SEUIL_MS = 150;

/**
 * Barre de progression fine en haut de l'écran pendant un changement de page
 * (méthode MagyaPro, « une barre de progression fine pendant la navigation »).
 *
 * Chaque écran est chargé à la demande : sur un réseau 3G, toucher « Caisse »
 * télécharge d'abord son code, et pendant ce temps rien ne bougeait — l'appui
 * semblait perdu, et l'on touchait une seconde fois. La barre dit « c'est
 * parti » dès 150 ms d'attente, et ne s'affiche jamais pour une navigation
 * plus rapide (un clignotement à chaque clic serait un bruit).
 *
 * Elle avance seule jusqu'à 80 % (la durée réelle est inconnue), puis se
 * termine à l'arrivée. Uniquement `transform` et `opacity`.
 */
@Component({
  selector: 'vh-barre-progression',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.active]': 'etat() === "en-cours"',
    '[class.fin]': 'etat() === "fin"',
  },
  template: `<span class="barre"></span>`,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0 0 auto;
        z-index: 60;
        height: 3px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease 0.15s;
      }
      .barre {
        display: block;
        height: 100%;
        background: var(--vh-degrade-aurore);
        background-size: 300% 100%;
        transform-origin: left;
        transform: scaleX(0);
      }
      :host(.active) {
        opacity: 1;
        transition-delay: 0s;
      }
      :host(.active) .barre {
        transform: scaleX(0.8);
        transition: transform 6s cubic-bezier(0.1, 0.6, 0.2, 1);
        animation: vh-gradient-pan 2s ease infinite;
      }
      /* L'arrivée : la barre se complète, PUIS s'efface. */
      :host(.fin) {
        opacity: 0;
        transition: opacity 0.3s ease 0.2s;
      }
      :host(.fin) .barre {
        transform: scaleX(1);
        transition: transform 0.2s ease-out;
      }
      @media print {
        :host {
          display: none;
        }
      }
    `,
  ],
})
export class BarreProgressionComponent {
  readonly etat = signal<'repos' | 'en-cours' | 'fin'>('repos');

  constructor() {
    const router = inject(Router);
    let attente: ReturnType<typeof setTimeout> | undefined;
    let effacement: ReturnType<typeof setTimeout> | undefined;

    const abonnement = router.events.subscribe((evenement) => {
      if (evenement instanceof NavigationStart) {
        clearTimeout(attente);
        clearTimeout(effacement);
        attente = setTimeout(() => this.etat.set('en-cours'), SEUIL_MS);
      } else if (
        evenement instanceof NavigationEnd ||
        evenement instanceof NavigationCancel ||
        evenement instanceof NavigationError
      ) {
        clearTimeout(attente);
        if (this.etat() === 'en-cours') {
          this.etat.set('fin');
          effacement = setTimeout(() => this.etat.set('repos'), 600);
        }
      }
    });

    inject(DestroyRef).onDestroy(() => {
      abonnement.unsubscribe();
      clearTimeout(attente);
      clearTimeout(effacement);
    });
  }
}
