/**
 * Compression d'image avant envoi.
 *
 * Une photo de téléphone pèse 3 à 8 Mo. Sur un forfait payé au volume et un
 * réseau 3G instable, l'envoyer telle quelle est inacceptable : l'envoi échoue
 * une fois sur deux, et coûte cher au client. Une photo de constat reste
 * parfaitement lisible à 1600 px de côté, pour moins de 300 Ko.
 *
 * La compression se fait dans le navigateur, avant le réseau : c'est le seul
 * endroit où l'on peut encore éviter le transfert.
 *
 * Phase 24, alignée sur `downscaleImage` de la méthode MagyaPro
 * (`.claude/skills/methode-magyapro/assets/downscale-image.ts`) :
 * - décodage par `createImageBitmap` quand il existe : moins de mémoire qu'un
 *   <img>, et l'orientation EXIF respectée — une photo prise en portrait ne
 *   part plus couchée ;
 * - une image déjà petite (≤ 1600 px et ≤ 200 Ko) part intacte : la
 *   ré-encoder ne gagnerait rien et pourrait la dégrader ;
 * - un résultat plus lourd que l'original est abandonné au profit de
 *   l'original (cas des images déjà très compressées) ;
 * - l'URL d'objet est révoquée même quand le décodage échoue — elle fuyait.
 */

const COTE_MAX = 1600;
const QUALITE = 0.82;
const INTACTE_SOUS_OCTETS = 200 * 1024;

/** Les seuls formats que le bucket accepte, et que le navigateur sait redessiner. */
const FORMATS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface PhotoCompressee {
  readonly fichier: Blob;
  readonly type: string;
  readonly extension: string;
  readonly octetsAvant: number;
  readonly octetsApres: number;
}

/** WebP quand le navigateur sait l'encoder, JPEG sinon. */
function meilleurFormat(): { type: string; extension: string } {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
      return { type: 'image/webp', extension: 'webp' };
    }
  } catch {
    // Canvas indisponible : JPEG, que tout le monde lit.
  }
  return { type: 'image/jpeg', extension: 'jpg' };
}

/**
 * Le fichier d'origine, avec son vrai type — jamais un type inventé. Un format
 * que le stockage refuse (HEIC d'un iPhone, par exemple) ne part pas sous une
 * étiquette « image/jpeg » mensongère : l'envoi est compté comme un échec, et
 * l'écran le dit.
 */
function original(fichier: File): PhotoCompressee {
  const extension = FORMATS[fichier.type];
  if (!extension) throw new Error('Format de photo non pris en charge');
  return {
    fichier,
    type: fichier.type,
    extension,
    octetsAvant: fichier.size,
    octetsApres: fichier.size,
  };
}

async function decoder(
  fichier: File,
): Promise<{ source: CanvasImageSource; largeur: number; hauteur: number; liberer: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(fichier);
    return {
      source: bitmap,
      largeur: bitmap.width,
      hauteur: bitmap.height,
      liberer: () => bitmap.close(),
    };
  }

  // Repli pour les navigateurs sans `createImageBitmap`.
  const url = URL.createObjectURL(fichier);
  try {
    const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const element = new Image();
      element.onload = () => resoudre(element);
      element.onerror = () => rejeter(new Error('Image illisible'));
      element.src = url;
    });
    return {
      source: image,
      largeur: image.naturalWidth,
      hauteur: image.naturalHeight,
      liberer: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compresserPhoto(fichier: File): Promise<PhotoCompressee> {
  const { source, largeur, hauteur, liberer } = await decoder(fichier);

  try {
    const echelle = Math.min(1, COTE_MAX / Math.max(largeur, hauteur, 1));
    // Déjà aux bonnes dimensions et légère : on n'y touche pas.
    if (echelle === 1 && fichier.size <= INTACTE_SOUS_OCTETS && FORMATS[fichier.type]) {
      return original(fichier);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(largeur * echelle));
    canvas.height = Math.max(1, Math.round(hauteur * echelle));

    const contexte = canvas.getContext('2d');
    // Canvas indisponible : on envoie l'original plutôt que de perdre la photo.
    if (!contexte) return original(fichier);
    contexte.imageSmoothingQuality = 'high';
    contexte.drawImage(source, 0, 0, canvas.width, canvas.height);

    const format = meilleurFormat();
    const blob = await new Promise<Blob | null>((resoudre) =>
      canvas.toBlob(resoudre, format.type, QUALITE),
    );

    if (!blob) return original(fichier);
    // Un résultat plus lourd que l'original n'a aucun intérêt — sauf si
    // l'original est dans un format que le stockage refuserait.
    if (blob.size >= fichier.size && FORMATS[fichier.type]) return original(fichier);

    return {
      fichier: blob,
      type: format.type,
      extension: format.extension,
      octetsAvant: fichier.size,
      octetsApres: blob.size,
    };
  } finally {
    liberer();
  }
}
