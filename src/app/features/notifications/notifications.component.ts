import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  LIBELLES_ETAPE,
  LIBELLES_STATUT_NOTIFICATION,
  NotificationService,
  type Notification,
  type StatutNotification,
} from '../../core/notifications/notification.service';
import { StationService } from '../../core/stations/station.service';
import { SubscriptionService } from '../../core/subscription/subscription.service';
import { ConfirmationComponent } from '../../shared/ui/confirmation.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { formaterDate } from '../../shared/format/montant';

@Component({
  selector: 'vh-notifications',
  standalone: true,
  imports: [ConfirmationComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent {
  readonly service = inject(NotificationService);
  private readonly stationsService = inject(StationService);
  private readonly abonnement = inject(SubscriptionService);

  readonly stations = computed(() => this.stationsService.stations());
  readonly station = signal('');
  readonly statut = signal<StatutNotification | ''>('');

  readonly aAnnuler = signal<Notification | null>(null);
  readonly motif = signal('');
  readonly enCours = signal(false);
  readonly message = signal<string | null>(null);

  /**
   * La fonctionnalité est fermée par défaut, et l'écran le dit au lieu de
   * laisser croire à une file vide : un écran qui ne s'explique pas fait
   * douter du reste.
   */
  readonly active = computed(() => this.abonnement.actif('notifications'));

  readonly enAttente = computed(
    () => this.service.messages().filter((m) => m.status === 'PENDING').length,
  );

  constructor() {
    void this.stationsService.charger();
    void this.abonnement.charger();
    void this.service.charger();
  }

  statutLisible(m: Notification): string {
    return LIBELLES_STATUT_NOTIFICATION[m.status];
  }

  classeStatut(m: Notification): string {
    switch (m.status) {
      case 'SENT':
        return 'etat etat--envoye';
      case 'FAILED':
        return 'etat etat--echec';
      case 'CANCELLED':
        return 'etat etat--annule';
      default:
        return 'etat etat--attente';
    }
  }

  etape(m: Notification): string {
    return LIBELLES_ETAPE[m.kind] ?? m.kind;
  }

  quand(iso: string): string {
    return `${formaterDate(iso)} à ${new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  /**
   * Un numéro complet dans une liste consultable par toute la station n'apporte
   * rien : on montre de quoi reconnaître le destinataire, pas de quoi le
   * recopier.
   */
  destinataire(m: Notification): string {
    const n = m.destination;
    return n.length <= 4 ? n : `…${n.slice(-4)}`;
  }

  async surStation(evenement: Event): Promise<void> {
    this.station.set((evenement.target as HTMLSelectElement).value);
    await this.actualiser();
  }

  async surStatut(evenement: Event): Promise<void> {
    this.statut.set((evenement.target as HTMLSelectElement).value as StatutNotification | '');
    await this.actualiser();
  }

  async actualiser(): Promise<void> {
    await this.service.charger(this.station() || undefined, this.statut() || undefined);
  }

  demanderAnnulation(m: Notification): void {
    this.motif.set('');
    this.aAnnuler.set(m);
  }

  surMotif(evenement: Event): void {
    this.motif.set((evenement.target as HTMLInputElement).value);
  }

  /** Une action que le serveur refusera ne s'affiche pas comme possible. */
  readonly motifTropCourt = computed(() => this.motif().trim().length < 3);

  async confirmerAnnulation(): Promise<void> {
    const m = this.aAnnuler();
    if (!m || this.motifTropCourt()) return;
    this.enCours.set(true);
    const erreur = await this.service.annuler(m.id, this.motif().trim());
    this.enCours.set(false);
    this.aAnnuler.set(null);
    this.message.set(erreur ?? 'Ce message ne partira pas.');
    if (!erreur) await this.actualiser();
  }
}
