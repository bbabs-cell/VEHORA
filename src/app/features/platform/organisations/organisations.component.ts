import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  LIBELLES_STATUT_ORG,
  PlatformService,
  type AbonnementPlateforme,
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

  /** Organisation dont on ouvre l'abonnement (plan et fonctionnalités). */
  readonly abonnementOuvert = signal<OrganisationPlateforme | null>(null);

  readonly formPlan = this.fb.nonNullable.group({
    plan: ['', Validators.required],
    motif: ['', [Validators.required, Validators.minLength(3)]],
  });

  constructor() {
    effect(() =>
      this.verrou.verrouiller(this.decision() !== null || this.abonnementOuvert() !== null),
    );

    // La liste des plans arrive du réseau : tant qu'elle n'est pas là, le
    // formulaire s'ouvrirait sur un choix vide et refuserait de valider sans
    // rien expliquer. Le défaut est posé dès qu'elle arrive.
    effect(() => {
      const organisation = this.abonnementOuvert();
      const plans = this.plateforme.plans();
      if (!organisation || plans.length === 0) return;
      const actuel = this.abonnementDe(organisation)?.plan_code ?? plans[0].code;
      // Sans émission, le signal qui suit le champ resterait sur sa valeur
      // initiale — et le garde-fou « c'est déjà le plan en cours » ne verrait
      // jamais rien.
      this.formPlan.patchValue({ plan: actuel });
    });

    void this.plateforme.charger();
  }

  /** Le plan courant d'une organisation, tel que la vue de plateforme le rend. */
  abonnementDe(organisation: OrganisationPlateforme): AbonnementPlateforme | undefined {
    return this.plateforme.abonnements().find((a) => a.organization_id === organisation.id);
  }

  /** « 2 sur 10 », ou « 2 » quand le plan ne pose pas de limite. */
  consommation(utilise: number, maximum: number | null): string {
    return maximum === null ? `${utilise} (sans limite)` : `${utilise} sur ${maximum}`;
  }

  ouvrirAbonnement(organisation: OrganisationPlateforme): void {
    this.erreur.set(null);
    this.formPlan.reset({ plan: '', motif: '' });
    this.abonnementOuvert.set(organisation);
  }

  fermerAbonnement(): void {
    this.abonnementOuvert.set(null);
  }

  /** Tant que les plans ne sont pas chargés, on n'ouvre pas le formulaire. */
  readonly pretAChangerDePlan = computed(() => this.plateforme.plans().length > 0);

  /** Le plan choisi dans le formulaire, suivi comme un signal. */
  private readonly planChoisi = toSignal(this.formPlan.controls.plan.valueChanges, {
    initialValue: this.formPlan.controls.plan.value,
  });

  /**
   * La base refuse de reposer le plan déjà en cours. Le bouton reste donc
   * inerte, avec sa raison affichée, plutôt que de proposer un clic qui
   * échouerait — le formulaire s'ouvre sur le plan actuel, c'est le cas le plus
   * fréquent au moment où on l'ouvre.
   */
  readonly planInchange = computed(() => {
    const organisation = this.abonnementOuvert();
    if (!organisation) return false;
    return this.planChoisi() === this.abonnementDe(organisation)?.plan_code;
  });

  async changerPlan(): Promise<void> {
    const organisation = this.abonnementOuvert();
    if (!organisation || this.enregistrement() || this.planInchange()) return;
    if (this.formPlan.invalid) {
      this.formPlan.markAllAsTouched();
      return;
    }

    this.enregistrement.set(true);
    this.erreur.set(null);
    const v = this.formPlan.getRawValue();
    const erreur = await this.plateforme.changerPlan(organisation.id, v.plan, v.motif.trim());
    this.enregistrement.set(false);

    if (erreur) {
      this.erreur.set(erreur);
      return;
    }
    this.abonnementOuvert.set(null);
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

  ouvrirDecision(organisation: OrganisationPlateforme, sens: 'suspendre' | 'reactiver'): void {
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
