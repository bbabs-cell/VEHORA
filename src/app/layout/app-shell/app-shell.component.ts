import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { OrganizationService } from '../../core/organization/organization.service';
import { SubscriptionService } from '../../core/subscription/subscription.service';
import { ThemeService } from '../../core/theme/theme.service';
import { BarreProgressionComponent } from '../../shared/ui/barre-progression.component';
import { FondVivantComponent } from '../../shared/ui/fond-vivant.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { SECTION_COURANTE, type SectionCourante, TeinteDirective } from '../../shared/ui/teinte';
import { BarreBasseComponent } from '../barre-basse/barre-basse.component';
import { NavigationLateraleComponent } from '../navigation-laterale/navigation-laterale.component';
import { ENTREES_BARRE_BASSE, NAVIGATION, PRIORITE_MOBILE } from '../navigation';

/**
 * Coquille de l'application cliente.
 *
 * ≥ 1024 px : barre latérale persistante (`vh-navigation-laterale`).
 * < 1024 px : en-tête compact, tiroir ☰ (compte, déconnexion, tout le menu) et
 * barre basse au pouce (`vh-barre-basse`) — quatre écrans selon les droits,
 * puis « Plus ».
 *
 * Le seuil passe de 900 à 1024 px (méthode MagyaPro) : entre les deux, une
 * tablette en portrait avait la barre latérale ET un contenu trop étroit.
 *
 * L'espace Super Admin a sa propre coquille : ce n'est pas un onglet d'ici.
 */
@Component({
  selector: 'vh-app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    IconComponent,
    SkeletonComponent,
    FondVivantComponent,
    BarreProgressionComponent,
    NavigationLateraleComponent,
    BarreBasseComponent,
    TeinteDirective,
  ],
  // Les en-têtes de page lisent la section courante pour poser leur pastille.
  providers: [{ provide: SECTION_COURANTE, useFactory: () => inject(AppShellComponent).section }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  host: { '(document:keydown.escape)': 'fermerMenu()' },
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly organisations = inject(OrganizationService);
  readonly theme = inject(ThemeService);
  private readonly abonnement = inject(SubscriptionService);

  readonly menuOuvert = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * La section de l'écran affiché, d'après le menu COMPLET — pas celui des
   * droits : `/caisse/historique` est dans la caisse même pour qui ne voit pas
   * l'entrée. Un écran hors menu (un reçu) n'a pas de section : azur.
   */
  readonly section = computed<SectionCourante | null>(() => {
    const chemin = this.url().split(/[?#]/)[0];
    const entree = NAVIGATION.find((e) => chemin === e.chemin || chemin.startsWith(`${e.chemin}/`));
    return entree ? { icone: entree.icone, teinte: entree.teinte } : null;
  });

  /**
   * Entrées visibles : la permission de l'utilisateur, et la fonctionnalité
   * ouverte pour son organisation. La résolution vient du serveur ; masquer une
   * entrée n'est qu'un confort, l'API refuse de toute façon.
   */
  readonly entrees = computed(() =>
    NAVIGATION.filter(
      (e) =>
        (!e.permission || this.auth.hasPermission(e.permission)) &&
        (!e.fonctionnalite || this.abonnement.actif(e.fonctionnalite)),
    ),
  );

  /** Les quatre premières entrées permises, dans l'ordre de priorité mobile. */
  readonly entreesMobile = computed(() => {
    const permises = this.entrees();
    return PRIORITE_MOBILE.map((chemin) => permises.find((e) => e.chemin === chemin))
      .filter((e) => e !== undefined)
      .slice(0, ENTREES_BARRE_BASSE);
  });

  /** Tout ce qui n'est pas dans la barre basse : le contenu de « Plus ». */
  readonly entreesPlus = computed(() => {
    const directes = new Set(this.entreesMobile().map((e) => e.chemin));
    return this.entrees().filter((e) => !directes.has(e.chemin));
  });

  constructor() {
    void this.organisations.charger();
    void this.abonnement.charger();

    // Une navigation referme le tiroir : on est arrivé.
    const abonnement = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.fermerMenu());
    inject(DestroyRef).onDestroy(() => abonnement.unsubscribe());
  }

  basculerMenu(): void {
    this.menuOuvert.update((v) => !v);
  }

  fermerMenu(): void {
    this.menuOuvert.set(false);
  }
}
