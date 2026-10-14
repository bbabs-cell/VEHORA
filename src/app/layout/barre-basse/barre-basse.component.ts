import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { ScrollLockService } from '../../core/ui/scroll-lock.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { TeinteDirective } from '../../shared/ui/teinte';
import { EntreeNavigation } from '../navigation';

/**
 * Barre basse mobile et feuille « Plus » (méthode MagyaPro, `BottomNav`).
 *
 * Quatre écrans, choisis selon les droits de la personne, puis « Plus » qui
 * ouvre tout le reste dans une feuille posée au-dessus de la barre. Avant,
 * tout ce qui n'était pas dans les quatre passait par ☰ : deux gestes par
 * changement d'écran, des dizaines de fois par jour.
 */
@Component({
  selector: 'vh-barre-basse',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, TeinteDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './barre-basse.component.html',
  styleUrl: './barre-basse.component.css',
  host: { '(document:keydown.escape)': 'fermerPlus()' },
})
export class BarreBasseComponent {
  private readonly router = inject(Router);
  private readonly verrou = inject(ScrollLockService);

  /** Les quatre entrées directes. */
  readonly entrees = input.required<readonly EntreeNavigation[]>();
  /** Tout le reste : le contenu de « Plus ». */
  readonly entreesPlus = input.required<readonly EntreeNavigation[]>();

  readonly plusOuvert = signal(false);

  /** Chemin courant, sans paramètres : sert à allumer « Plus ». */
  private readonly chemin = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  /** « Plus » s'allume quand l'écran courant est l'un des siens. */
  readonly plusActif = computed(() => {
    const courant = this.chemin();
    return this.entreesPlus().some(
      (e) => courant === e.chemin || courant.startsWith(e.chemin + '/'),
    );
  });

  constructor() {
    // Une navigation referme la feuille : on est arrivé.
    const abonnement = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.fermerPlus());
    inject(DestroyRef).onDestroy(() => {
      abonnement.unsubscribe();
      this.fermerPlus();
    });
  }

  basculerPlus(): void {
    if (this.plusOuvert()) {
      this.fermerPlus();
      return;
    }
    this.plusOuvert.set(true);
    // La page derrière la feuille ne défile pas : on retrouve sa place en la
    // refermant (même règle que les modales).
    this.verrou.verrouiller(true);
  }

  fermerPlus(): void {
    if (!this.plusOuvert()) return;
    this.plusOuvert.set(false);
    this.verrou.verrouiller(false);
  }
}
