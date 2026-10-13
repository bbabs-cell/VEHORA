import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { InspectionService, type ConstatSaisi } from '../../core/inspections/inspection.service';
import { VehicleService } from '../../core/vehicles/vehicle.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EntetePageComponent } from '../../shared/ui/entete-page.component';
import {
  cleBrouillon,
  effacerBrouillon,
  ecrireBrouillon,
  lireBrouillon,
} from '../../shared/brouillon/brouillon';

/** Au-delà, un brouillon décrit un autre passage du véhicule : on l'ignore. */
const BROUILLON_AGE_MAX_MS = 12 * 60 * 60 * 1000;

/** Ce qui survit à un rechargement : les constats et les remarques, pas les photos. */
interface BrouillonInspection {
  readonly etats: Record<string, { condition: 'OK' | 'ANOMALY' | null; commentaire: string }>;
  readonly notes: string;
}

/** État local d'une zone pendant la saisie. */
interface EtatZone {
  condition: 'OK' | 'ANOMALY' | null;
  commentaire: string;
  photos: File[];
}

@Component({
  selector: 'vh-inspection',
  standalone: true,
  imports: [EntetePageComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspection.component.html',
  styleUrl: './inspection.component.css',
})
export class InspectionComponent {
  /** Identifiant du véhicule, lié depuis la route. */
  readonly id = input.required<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly inspections = inject(InspectionService);
  readonly vehicules = inject(VehicleService);

  readonly etats = signal<Record<string, EtatZone>>({});
  readonly notes = signal('');
  readonly erreur = signal<string | null>(null);
  readonly avertissement = signal<string | null>(null);
  /** Heure d'un brouillon retrouvé à l'ouverture, pour le dire à l'écran. */
  readonly brouillonRetrouve = signal<Date | null>(null);

  /** Clé du brouillon : l'organisation ET le véhicule. */
  private readonly cle = computed(() =>
    cleBrouillon(this.auth.claims().orgId, 'inspection', this.id()),
  );

  readonly peutInspecter = computed(() => this.auth.hasPermission('inspections.write'));

  /** Zones renseignées : c'est ce que le responsable veut voir avancer. */
  readonly renseignees = computed(
    () => Object.values(this.etats()).filter((e) => e.condition !== null).length,
  );

  readonly anomalies = computed(
    () => Object.values(this.etats()).filter((e) => e.condition === 'ANOMALY').length,
  );

  readonly photosPrises = computed(() =>
    Object.values(this.etats()).reduce((total, e) => total + e.photos.length, 0),
  );

  /** Le véhicule concerné, retrouvé dans la liste déjà chargée. */
  readonly vehicule = computed(() => this.vehicules.vehicules().find((v) => v.id === this.id()));

  constructor() {
    void this.inspections.chargerZones();
    void this.vehicules.rechercher('');

    // Restauration, une fois la clé connue (l'identifiant vient de la route).
    let restaure = false;
    effect(() => {
      const cle = this.cle();
      if (restaure || !cle) return;
      restaure = true;
      const trouve = lireBrouillon<BrouillonInspection>(cle, BROUILLON_AGE_MAX_MS);
      if (!trouve) return;
      untracked(() => {
        const etats: Record<string, EtatZone> = {};
        for (const [zone, e] of Object.entries(trouve.valeur.etats ?? {})) {
          etats[zone] = { condition: e.condition, commentaire: e.commentaire ?? '', photos: [] };
        }
        this.etats.set(etats);
        this.notes.set(trouve.valeur.notes ?? '');
        this.brouillonRetrouve.set(trouve.le);
      });
    });

    // Sauvegarde à chaque changement. Les photos ne se mettent pas dans le
    // stockage local (plusieurs mégaoctets) : elles sont à reprendre.
    effect(() => {
      const etats = this.etats();
      const notes = this.notes();
      const cle = untracked(this.cle);
      if (!restaure) return;
      const constats = Object.entries(etats).filter(
        ([, e]) => e.condition !== null || e.commentaire,
      );
      if (constats.length === 0 && !notes) {
        effacerBrouillon(cle);
        return;
      }
      ecrireBrouillon<BrouillonInspection>(cle, {
        etats: Object.fromEntries(
          constats.map(([zone, e]) => [
            zone,
            { condition: e.condition, commentaire: e.commentaire },
          ]),
        ),
        notes,
      });
    });
  }

  /** « Repartir de zéro » : le brouillon retrouvé n'était pas le bon. */
  oublierBrouillon(): void {
    effacerBrouillon(this.cle());
    this.etats.set({});
    this.notes.set('');
    this.brouillonRetrouve.set(null);
  }

  heureBrouillon(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(date);
  }

  etat(zoneId: string): EtatZone {
    return this.etats()[zoneId] ?? { condition: null, commentaire: '', photos: [] };
  }

  private majZone(zoneId: string, modification: Partial<EtatZone>): void {
    this.etats.update((tout) => ({
      ...tout,
      [zoneId]: { ...this.etat(zoneId), ...modification },
    }));
  }

  marquer(zoneId: string, condition: 'OK' | 'ANOMALY'): void {
    // Retaper le même bouton annule le constat : c'est le geste attendu quand
    // on s'est trompé, et il évite d'avoir à chercher un bouton « effacer ».
    const actuel = this.etat(zoneId).condition;
    this.majZone(zoneId, { condition: actuel === condition ? null : condition });
  }

  surCommentaire(zoneId: string, evenement: Event): void {
    this.majZone(zoneId, { commentaire: (evenement.target as HTMLInputElement).value });
  }

  surNotes(evenement: Event): void {
    this.notes.set((evenement.target as HTMLTextAreaElement).value);
  }

  surPhotos(zoneId: string, evenement: Event): void {
    const input = evenement.target as HTMLInputElement;
    const fichiers = Array.from(input.files ?? []);
    if (fichiers.length === 0) return;

    this.majZone(zoneId, { photos: [...this.etat(zoneId).photos, ...fichiers] });
    // Permet de reprendre la même photo deux fois de suite si nécessaire.
    input.value = '';
  }

  retirerPhoto(zoneId: string, index: number): void {
    const photos = [...this.etat(zoneId).photos];
    photos.splice(index, 1);
    this.majZone(zoneId, { photos });
  }

  async enregistrer(): Promise<void> {
    if (this.inspections.chargement()) return;

    const constats: ConstatSaisi[] = Object.entries(this.etats())
      .filter(([, e]) => e.condition !== null)
      .map(([zoneId, e]) => ({
        zoneId,
        condition: e.condition as 'OK' | 'ANOMALY',
        commentaire: e.commentaire,
        photos: e.photos,
      }));

    if (constats.length === 0) {
      this.erreur.set('Constatez au moins une zone avant d’enregistrer.');
      return;
    }

    this.erreur.set(null);
    this.avertissement.set(null);

    const { erreur, photosEchouees } = await this.inspections.enregistrer(
      this.id(),
      constats,
      this.notes(),
    );

    if (erreur) {
      this.erreur.set(erreur);
      return;
    }

    // Le constat est en base : le brouillon n'a plus de raison d'être.
    effacerBrouillon(this.cle());

    if (photosEchouees > 0) {
      // Le constat est enregistré : on ne le perd pas pour des photos. On le
      // dit franchement plutôt que de laisser croire que tout est passé.
      this.avertissement.set(
        `Constat enregistré, mais ${photosEchouees} photo(s) n’ont pas pu être envoyées. ` +
          `Refaites une inspection avec les photos manquantes si nécessaire.`,
      );
      return;
    }

    await this.router.navigateByUrl('/vehicules');
  }

  annuler(): void {
    void this.router.navigateByUrl('/vehicules');
  }
}
