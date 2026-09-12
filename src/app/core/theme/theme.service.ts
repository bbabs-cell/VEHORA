import { Injectable, computed, effect, signal } from '@angular/core';

/** `systeme` suit le réglage de l'appareil ; les deux autres forcent un thème. */
export type PreferenceTheme = 'sombre' | 'clair' | 'systeme';
export type ThemeApplique = 'sombre' | 'clair';

const CLE_STOCKAGE = 'vehora.theme';

/**
 * VEHORA est dark-first, jamais dark-only.
 *
 * Les écrans opérationnels sont utilisés dehors, en plein soleil, sur des
 * téléphones bon marché : le mode clair n'est pas un confort, c'est une
 * exigence terrain (design system, §44 du prompt maître).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _preference = signal<PreferenceTheme>(this.lirePreference());

  /**
   * Vrai thème du système, suivi en direct si — et seulement si — l'utilisateur
   * a explicitement choisi « système ».
   */
  private readonly _themeSysteme = signal<ThemeApplique>(
    this.mediaQuery()?.matches ? 'clair' : 'sombre',
  );

  readonly preference = this._preference.asReadonly();

  readonly themeApplique = computed<ThemeApplique>(() => {
    const p = this._preference();
    return p === 'systeme' ? this._themeSysteme() : p;
  });

  constructor() {
    this.mediaQuery()?.addEventListener('change', (e) => {
      this._themeSysteme.set(e.matches ? 'clair' : 'sombre');
    });

    // Applique le thème au document et le mémorise.
    effect(() => {
      const theme = this.themeApplique();
      document.documentElement.setAttribute('data-theme', theme === 'clair' ? 'light' : 'dark');
      document.documentElement.style.colorScheme = theme === 'clair' ? 'light' : 'dark';
    });
  }

  definir(preference: PreferenceTheme): void {
    this._preference.set(preference);
    try {
      localStorage.setItem(CLE_STOCKAGE, preference);
    } catch {
      // Navigation privée ou stockage bloqué : le thème reste valide pour la
      // session, simplement non mémorisé. Ce n'est pas une erreur à signaler.
    }
  }

  /** Bascule directe sombre ↔ clair, sans passer par « système ». */
  basculer(): void {
    this.definir(this.themeApplique() === 'clair' ? 'sombre' : 'clair');
  }

  private lirePreference(): PreferenceTheme {
    try {
      const valeur = localStorage.getItem(CLE_STOCKAGE);
      if (valeur === 'sombre' || valeur === 'clair' || valeur === 'systeme') return valeur;
    } catch {
      // Stockage inaccessible : on retombe sur le défaut.
    }
    // Défaut : SOMBRE, pas « système ».
    // VEHORA est dark-first ; la plupart des appareils étant réglés en clair,
    // suivre le système ferait démarrer l'application en clair et contredirait
    // l'identité visuelle. « Système » reste disponible comme choix explicite.
    return 'sombre';
  }

  private mediaQuery(): MediaQueryList | null {
    return typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
  }
}
