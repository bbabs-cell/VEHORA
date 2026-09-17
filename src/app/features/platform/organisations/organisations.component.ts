import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LIBELLES_STATUT_ORG,
  PlatformService,
  type OrganisationPlateforme,
} from '../../../core/platform/platform.service';
import { ScrollLockService } from '../../../core/ui/scroll-lock.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';

@Component({
  selector: 'vh-platform-organisations',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organisations.component.html',
  styleUrl: './organisations.component.css',
})
export class PlatformOrganisationsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly verrou = inject(ScrollLockService);
  readonly plateforme = inject(PlatformService);

  readonly recherche = signal('');
  readonly enregistrement = signal(false);
  readonly erreur = signal<string | null>(null);

  /** Organisation dont on s'apprête à changer le statut, et dans quel sens. */
  readonly decision = signal<{
    organisation: OrganisationPlateforme;
    sens: 'suspendre' | 'reactiver';
  } | null>(null);

  readonly formMotif = this.fb.nonNullable.group({
    motif: ['', [Validators.required, Validators.minLength(3)]],
  });

  constructor() {
    effect(() => this.verrou.verrouiller(this.decision() !== null));
    void this.plateforme.charger();
  }

  readonly listees = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    const toutes = this.plateforme.organisations();
    if (terme === '') return toutes;
    return toutes.filter(
      (o) =>
        o.name.toLowerCase().includes(terme) ||
        o.slug.toLowerCase().includes(terme) ||
        (o.city ?? '').toLowerCase().includes(terme),
    );
  });

  readonly suspendues = computed(
    () => this.plateforme.organisations().filter((o) => o.status === 'SUSPENDED').length,
  );

  libelleStatut(organisation: OrganisationPlateforme): string {
    return LIBELLES_STATUT_ORG[organisation.status];
  }

  /**
   * Phrase complète et accordée. Composée dans le gabarit, elle donnait
   * « 0 personne perdront l'accès » — un chiffre faux d'accord, et un message
   * absurde quand l'organisation n'a encore aucun membre.
   */
  consequenceSuspension(organisation: OrganisationPlateforme): string {
    const membres = organisation.membres_actifs;
    if (membres === 0) return 'Aucun membre actif ne perdra l’accès.';
    if (membres === 1) return '1 personne perdra l’accès immédiatement.';
    return `${membres} personnes perdront l’accès immédiatement.`;
  }

  surRecherche(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }

  /**
   * Phrase complète, pas un fragment : composer « dernière activité » dans le
   * gabarit et « aucune activité » ici donnait « dernière activité aucune
   * activité ». Une organisation sans activité récente doit se repérer, pas
   * faire hésiter.
   */
  activite(organisation: OrganisationPlateforme): string {
    if (!organisation.derniere_activite) return 'aucune activité';

    const jours = Math.floor(
      (Date.now() - new Date(organisation.derniere_activite).getTime()) / 86_400_000,
    );
    if (jours === 0) return 'active aujourd’hui';
    if (jours === 1) return 'active hier';
    return `active il y a ${jours} jours`;
  }

  ouvrirDecision(
    organisation: OrganisationPlateforme,
    sens: 'suspendre' | 'reactiver',
  ): void {
    this.erreur.set(null);
    this.formMotif.reset({ motif: '' });
    this.decision.set({ organisation, sens });
  }

  fermerDecision(): void {
    this.decision.set(null);
  }

  async confirmer(): Promise<void> {
    const decision = this.decision();
    if (!decision || this.enregistrement()) return;
    if (this.formMotif.invalid) {
      this.formMotif.markAllAsTouched();
      return;
    }

    this.enregistrement.set(true);
    this.erreur.set(null);

    const motif = this.formMotif.getRawValue().motif.trim();
    const erreur =
      decision.sens === 'suspendre'
        ? await this.plateforme.suspendre(decision.organisation.id, motif)
        : await this.plateforme.reactiver(decision.organisation.id, motif);

    this.enregistrement.set(false);
    if (erreur) {
      this.erreur.set(erreur);
      return;
    }
    this.decision.set(null);
  }
}
