import { InjectionToken, type Signal } from '@angular/core';

/** La section de l'écran courant, telle que le menu la nomme : son icône. */
export interface SectionCourante {
  readonly icone: string;
}

/**
 * Fournie par la coquille, qui connaît le menu ; lue par `vh-entete-page` pour
 * poser l'icône de la section devant le titre. Facultative : l'espace
 * plateforme a sa propre coquille, et un en-tête sans section reste un
 * en-tête — sans pastille.
 */
export const SECTION_COURANTE = new InjectionToken<Signal<SectionCourante | null>>(
  'SECTION_COURANTE',
);
