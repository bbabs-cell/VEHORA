import { ChangeDetectionStrategy, Component, Directive, inject, signal } from '@angular/core';

/**
 * « Afficher » / « Masquer » à côté d'un mot de passe. Sur un clavier AZERTY,
 * les chiffres demandent la touche Maj : sans voir ce qu'on tape, « 1234 »
 * devient « &é"' » et la connexion est refusée sans qu'on comprenne pourquoi
 * — un compte a été bloqué ainsi sur PC pendant qu'il marchait sur téléphone.
 *
 * Usage : `<vh-mot-de-passe><input vhRevelable … /></vh-mot-de-passe>`.
 * C'est le champ qui demande l'état à la boîte (injection), et non la boîte
 * qui cherche son champ : une requête de contenu (`contentChild`) faisait
 * entrer son moteur dans le bundle initial, déjà au bord de son seuil.
 */
@Component({
  selector: 'vh-mot-de-passe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
    <button
      class="bascule"
      type="button"
      (click)="basculer()"
      [attr.aria-label]="(visible() ? 'Masquer' : 'Afficher') + ' le mot de passe'"
    >
      {{ visible() ? 'Masquer' : 'Afficher' }}
    </button>
  `,
  styles: [
    `
      /* Colonne flex, comme le .vh-field qu'elle remplace : c'est elle qui
         étire le champ. En bloc, il reprenait sa largeur naturelle et sortait
         de la carte à 320 px. */
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
      }

      .bascule {
        position: absolute;
        inset-block: 0;
        inset-inline-end: 0;
        min-width: 44px;
        padding: 0 var(--vh-space-4);
        border: 0;
        background: none;
        color: var(--vh-primary-bright);
        font: inherit;
        font-size: var(--vh-text-sm);
        font-weight: 600;
        cursor: pointer;
      }
    `,
  ],
})
export class MotDePasseComponent {
  readonly visible = signal(false);

  basculer(): void {
    this.visible.update((v) => !v);
  }
}

/**
 * Posée sur le champ, dans un `vh-mot-de-passe` : son type suit la boîte. Elle
 * réserve à droite la place du bouton, pour que le texte ne passe pas dessous.
 */
@Directive({
  selector: 'input[vhRevelable]',
  standalone: true,
  host: {
    '[type]': "boite.visible() ? 'text' : 'password'",
    '[style.padding-inline-end]': "'6rem'",
  },
})
export class RevelableDirective {
  protected readonly boite = inject(MotDePasseComponent);
}
