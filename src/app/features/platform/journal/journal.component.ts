import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  LIBELLES_ACTION,
  PlatformService,
  type EntreeJournal,
} from '../../../core/platform/platform.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';

@Component({
  selector: 'vh-platform-journal',
  standalone: true,
  imports: [EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journal.component.html',
  styleUrl: './journal.component.css',
})
export class PlatformJournalComponent {
  readonly plateforme = inject(PlatformService);

  constructor() {
    void this.plateforme.charger();
  }

  private readonly nomsOrganisations = computed(
    () => new Map(this.plateforme.organisations().map((o) => [o.id, o.name])),
  );

  nomOrganisation(entree: EntreeJournal): string {
    if (!entree.organization_id) return '—';
    return this.nomsOrganisations().get(entree.organization_id) ?? 'Organisation supprimée';
  }

  libelleAction(entree: EntreeJournal): string {
    return LIBELLES_ACTION[entree.action] ?? entree.action;
  }

  /** Date et heure complètes : un journal se lit en absolu, pas en « il y a ». */
  horodatage(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  }
}
