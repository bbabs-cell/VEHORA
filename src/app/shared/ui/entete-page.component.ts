import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * En-tête de page : un titre et UNE phrase qui dit à quoi sert l'écran
 * (méthode MagyaPro, `PageHeader`). L'action principale de l'écran, s'il en a
 * une, se projette à droite — c'est le seul bouton à fond de marque de la page.
 *
 * Il remplace dix-neuf en-têtes recopiés, chacun avec sa classe de titre et sa
 * taille de sous-titre. Le titre porte le style « page-title » du skill
 * d'animation : entrée douce et point final en dégradé.
 *
 * Usage :
 *   <vh-entete-page titre="File d’attente" description="Les dossiers en cours…">
 *     <button class="vh-button" …>Nouveau dossier</button>
 *   </vh-entete-page>
 */
@Component({
  selector: 'vh-entete-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="entete">
      <div class="entete__texte">
        <h1 class="vh-page-title entete__titre">{{ titre() }}</h1>
        @if (description(); as texte) {
          <p class="entete__description">{{ texte }}</p>
        }
        <ng-content select="[vhSousTitre]" />
      </div>
      <div class="entete__actions vh-actions vh-actions--etirees">
        <ng-content />
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .entete {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--vh-space-3) var(--vh-space-4);
      }
      .entete__texte {
        flex: 1 1 18rem;
        min-width: 0;
      }
      .entete__titre {
        overflow-wrap: anywhere;
      }
      .entete__description {
        margin: var(--vh-space-1) 0 0;
        max-width: 62ch;
        color: var(--vh-text-muted);
        font-size: var(--vh-text-sm);
        animation: var(--vh-anime-fade-up);
        animation-delay: 0.06s;
      }
      .entete__actions:empty {
        display: none;
      }
      .entete__actions {
        animation: var(--vh-anime-fade-up);
        animation-delay: 0.1s;
      }
      /* Sur un téléphone, l'action de l'écran passe sous le titre, sur toute
         la largeur : une cible pour le pouce, pas un bouton coincé à droite. */
      @media (max-width: 639px) {
        .entete__actions {
          flex: 1 1 100%;
        }
      }
    `,
  ],
})
export class EntetePageComponent {
  readonly titre = input.required<string>();
  readonly description = input<string | null>(null);
}
