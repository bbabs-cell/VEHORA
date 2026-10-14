import { Directive, InjectionToken, type Signal, computed, input } from '@angular/core';

/**
 * Les teintes de repère (phase 25). Une section de l'application a la sienne :
 * l'icône de son entrée de menu, la pastille de son en-tête et ses raccourcis
 * la portent, et on reconnaît l'écran avant de lire son titre.
 *
 * Elles sont choisies LOIN des états — vert, ambre, rouge disent « ça va » ou
 * « attention », jamais « où je suis » — et le laiton ne repère que l'argent
 * (la caisse, l'abonnement), comme partout ailleurs.
 */
export type Teinte = 'azur' | 'indigo' | 'violet' | 'rose' | 'laiton';

/**
 * `trait` suit le thème (icône ou texte sur le fond, ≥ 4,5:1 dans les deux) ;
 * `vif` est fixe, pour les aplats toujours sombres (navigation, bandeau
 * d'accueil). Les deux sont des jetons de `_tokens.css`, vérifiés par
 * `npm run test:contraste` — jamais une valeur écrite ici.
 */
const TEINTES: Readonly<Record<Teinte, { readonly trait: string; readonly vif: string }>> = {
  azur: { trait: 'var(--vh-primary-bright)', vif: 'var(--vh-nav-accent)' },
  indigo: { trait: 'var(--vh-indigo)', vif: 'var(--vh-indigo-vif)' },
  violet: { trait: 'var(--vh-violet)', vif: 'var(--vh-violet-vif)' },
  rose: { trait: 'var(--vh-rose)', vif: 'var(--vh-rose-vif)' },
  laiton: { trait: 'var(--vh-money)', vif: 'var(--vh-money-vif)' },
};

/**
 * Pose `--vh-teinte` et `--vh-teinte-vif` sur l'élément : ses descendants
 * écrivent `var(--vh-teinte)` et prennent la couleur de la section, sans
 * connaître son nom.
 *
 * Usage : `<a [vhTeinte]="entree.teinte">…</a>`
 */
@Directive({
  selector: '[vhTeinte]',
  standalone: true,
  host: {
    '[style.--vh-teinte]': 'valeurs().trait',
    '[style.--vh-teinte-vif]': 'valeurs().vif',
  },
})
export class TeinteDirective {
  readonly vhTeinte = input.required<Teinte>();
  protected readonly valeurs = computed(() => TEINTES[this.vhTeinte()]);
}

/** La section de l'écran courant : son icône et sa teinte. */
export interface SectionCourante {
  readonly icone: string;
  readonly teinte: Teinte;
}

/**
 * Fournie par la coquille qui connaît le menu ; lue par `vh-entete-page`.
 * Facultative : l'espace plateforme a sa propre coquille, et un en-tête sans
 * section reste un en-tête — sans pastille.
 */
export const SECTION_COURANTE = new InjectionToken<Signal<SectionCourante | null>>(
  'SECTION_COURANTE',
);
