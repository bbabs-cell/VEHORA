import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

/** Courbe de sortie cubique : rapide au départ, posée à l'arrivée. */
const adoucir = (t: number) => 1 - Math.pow(1 - t, 3);

function mouvementReduit(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Un entier qui défile de sa valeur précédente vers la nouvelle (skill
 * « animations vivantes », `useCountUp` / `AnimatedNumber`).
 *
 * Exactitude d'abord : la dernière image vaut EXACTEMENT la cible, et chaque
 * image intermédiaire est un entier — en unité mineure, donc jamais un franc
 * à virgule. Avec « Réduire les animations », la valeur finale s'affiche
 * directement.
 *
 * Réservé aux écrans de pilotage (tableau de bord). JAMAIS dans un document —
 * reçu, export, impression : un montant qui bouge sur un papier qu'on remet
 * au client serait un montant faux pendant une seconde.
 *
 * L'unité (« F CFA ») peut passer à la ligne dans une tuile étroite ; le
 * nombre, jamais : couper « 125 | 000 » ferait lire deux montants.
 */
@Component({
  selector: 'vh-nombre-anime',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (parties(); as p) {
      <!-- &ngsp; : Angular supprime un espace seul entre deux balises ; c'est
           pourtant lui qui laisse l'unité passer à la ligne. Sans lui,
           « 976 500 FCFA » sortait de sa tuile. -->
      <span class="insecable">{{ p.nombre }}</span
      >&ngsp;<span class="insecable">{{ p.unite }}</span>
    } @else {
      {{ texte() }}
    }
  `,
  styles: [
    `
      :host {
        font-variant-numeric: tabular-nums;
      }
      .insecable {
        white-space: nowrap;
      }
    `,
  ],
})
export class NombreAnimeComponent {
  readonly valeur = input.required<number>();
  /** Mise en forme d'une image (« 125 000 F CFA »). Par défaut, l'entier nu. */
  readonly format = input<(n: number) => string>((n) => String(n));
  readonly duree = input(1100);

  private readonly affiche = signal(0);
  readonly texte = computed(() => this.format()(this.affiche()));

  /** « 125 000 F CFA » → nombre et unité, pour que seule l'unité puisse passer à la ligne. */
  readonly parties = computed(() => {
    const correspondance = /^(.*\d)[\s  ]+(\D+)$/.exec(this.texte());
    return correspondance ? { nombre: correspondance[1], unite: correspondance[2] } : null;
  });

  constructor() {
    let depuis = 0;
    let image = 0;
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(image));

    effect(() => {
      const cible = Math.round(this.valeur());
      const duree = untracked(this.duree);
      cancelAnimationFrame(image);

      if (mouvementReduit() || depuis === cible) {
        depuis = cible;
        this.affiche.set(cible);
        return;
      }

      const depart = depuis;
      const debut = performance.now();
      const pas = (maintenant: number) => {
        const t = Math.min(1, (maintenant - debut) / duree);
        // La dernière image est la cible elle-même, pas une approximation.
        const valeur = t === 1 ? cible : Math.round(depart + (cible - depart) * adoucir(t));
        this.affiche.set(valeur);
        depuis = valeur;
        if (t < 1) image = requestAnimationFrame(pas);
      };
      image = requestAnimationFrame(pas);
    });
  }
}
