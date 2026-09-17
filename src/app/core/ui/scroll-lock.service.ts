import { DOCUMENT, Injectable, inject } from '@angular/core';

/**
 * Bloque le défilement du corps de page tant qu'une boîte de dialogue est
 * ouverte.
 *
 * Sans cela, sur un téléphone, faire défiler pendant qu'une modale est ouverte
 * déplace la liste en dessous : à la fermeture, l'utilisateur a perdu sa place
 * — au milieu d'un encaissement, c'est la file d'attente qu'il doit retrouver.
 *
 * Le compteur permet d'empiler deux modales sans que la fermeture de l'une
 * débloque le défilement pendant que l'autre est encore là.
 */
@Injectable({ providedIn: 'root' })
export class ScrollLockService {
  private readonly document = inject(DOCUMENT);
  private ouvertes = 0;

  /** À appeler depuis un `effect` : `verrouiller(uneModaleEstOuverte())`. */
  verrouiller(actif: boolean): void {
    const avant = this.ouvertes;
    this.ouvertes = Math.max(0, this.ouvertes + (actif ? 1 : -1));

    if (avant === 0 && this.ouvertes > 0) {
      this.document.body.classList.add('vh-defilement-bloque');
    } else if (avant > 0 && this.ouvertes === 0) {
      this.document.body.classList.remove('vh-defilement-bloque');
    }
  }
}
