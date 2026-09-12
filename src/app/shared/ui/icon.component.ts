import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Icônes en SVG inline : aucune bibliothèque, aucun téléchargement, aucune
 * police d'icônes. Sur un forfait data payé au volume, chaque kilo-octet évité
 * compte (skill vehora-west-africa).
 *
 * `currentColor` partout : l'icône suit la couleur du texte, donc les deux
 * thèmes sans effort.
 */
const TRACES: Record<string, string> = {
  accueil: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  file: 'M4 6h16M4 12h16M4 18h10',
  prestation: 'M5 17h14M6.5 17l1.2-5.2A2 2 0 0 1 9.6 10h4.8a2 2 0 0 1 1.9 1.8L17.5 17M7 20v-3M17 20v-3',
  client: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0',
  vehicule: 'M4 16h16M6 16l1.4-5.6A2 2 0 0 1 9.3 9h5.4a2 2 0 0 1 1.9 1.4L18 16M7.5 19v-3M16.5 19v-3',
  service: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1',
  employe: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20a7 7 0 0 1 14 0M9 20v-3M15 20v-3',
  caisse: 'M3 8h18v11H3zM3 8l2-4h14l2 4M9 13h6',
  parametres: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 13.5a7.6 7.6 0 0 0 0-3l1.7-1.3-2-3.4-2 .8a7.6 7.6 0 0 0-2.6-1.5L14 3h-4l-.5 2.1a7.6 7.6 0 0 0-2.6 1.5l-2-.8-2 3.4 1.7 1.3a7.6 7.6 0 0 0 0 3L2.9 15l2 3.4 2-.8a7.6 7.6 0 0 0 2.6 1.5L10 21h4l.5-2.1a7.6 7.6 0 0 0 2.6-1.5l2 .8 2-3.4Z',
  soleil: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4',
  lune: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  fermer: 'M6 6l12 12M18 6 6 18',
  sortie: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h10',
};

@Component({
  selector: 'vh-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="taille()"
      [attr.height]="taille()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="trace()" />
    </svg>
  `,
  styles: [':host { display: inline-flex; flex: none; }'],
})
export class IconComponent {
  readonly nom = input.required<string>();
  readonly taille = input(20);
  readonly trace = computed(() => TRACES[this.nom()] ?? '');
}
