import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IconComponent } from './icon.component';
import { SECTION_COURANTE } from './section-courante';

/**
 * En-tête de page : un titre et UNE phrase qui dit à quoi sert l'écran
 * (méthode MagyaPro, `PageHeader`). L'action principale de l'écran, s'il en a
 * une, se projette à droite — c'est le seul bouton à fond de marque de la page.
 *
 * Il remplace dix-neuf en-têtes recopiés, chacun avec sa classe de titre et sa
 * taille de sous-titre. Le titre porte le style « page-title » du skill
 * d'animation : entrée douce et point final en dégradé.
 *
 * Phase 25 : une pastille à l'icône de la section précède le titre — la même
 * icône que l'entrée du menu, dans la marque. La section vient de la coquille
 * (`SECTION_COURANTE`) : aucune page n'a à la déclarer, et hors coquille
 * (plateforme), l'en-tête reste sans pastille.
 *
 * Usage :
 *   <vh-entete-page titre="File d’attente" description="Les dossiers en cours…">
 *     <button class="vh-button" …>Nouveau dossier</button>
 *   </vh-entete-page>
 */
@Component({
  selector: 'vh-entete-page',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="entete">
      <div class="entete__texte">
        <div class="entete__ligne">
          @if (section(); as s) {
            <span class="entete__pastille" aria-hidden="true">
              <vh-icon [nom]="s.icone" [taille]="22" />
            </span>
          }
          <h1 class="vh-page-title entete__titre">{{ titre() }}</h1>
        </div>
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
      .entete__ligne {
        display: flex;
        align-items: center;
        gap: var(--vh-space-3);
      }
      /* Décor : l'icône répète le titre écrit juste à côté (aria-hidden). */
      .entete__pastille {
        display: grid;
        place-items: center;
        flex: none;
        width: 44px;
        height: 44px;
        border-radius: var(--vh-radius-card);
        background: var(--vh-primary-soft);
        color: var(--vh-primary-bright);
        animation: var(--vh-anime-pop);
      }
      .entete__titre {
        min-width: 0;
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

  private readonly sectionCourante = inject(SECTION_COURANTE, { optional: true });
  readonly section = computed(() => this.sectionCourante?.() ?? null);
}
