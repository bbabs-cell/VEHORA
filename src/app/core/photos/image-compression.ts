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
 */

const COTE_MAX = 1600;
const QUALITE = 0.82;

export interface PhotoCompressee {
  readonly fichier: Blob;
  readonly type: string;
  readonly extension: string;
  readonly octetsAvant: number;
  readonly octetsApres: number;
}

/** WebP quand le navigateur sait l'encoder, JPEG sinon. */
function meilleurFormat(): { type: string; extension: string } {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const webp = canvas.toDataURL('image/webp');
  return webp.startsWith('data:image/webp')
    ? { type: 'image/webp', extension: 'webp' }
    : { type: 'image/jpeg', extension: 'jpg' };
}

export async function compresserPhoto(fichier: File): Promise<PhotoCompressee> {
  const format = meilleurFormat();
  const image = await chargerImage(fichier);

  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * echelle);
  const hauteur = Math.round(image.height * echelle);

  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;

  const contexte = canvas.getContext('2d');
  if (!contexte) {
    // Canvas indisponible : on envoie l'original plutôt que de perdre la photo.
    return {
      fichier,
      type: fichier.type || 'image/jpeg',
      extension: 'jpg',
      octetsAvant: fichier.size,
      octetsApres: fichier.size,
    };
  }

  contexte.drawImage(image, 0, 0, largeur, hauteur);
  URL.revokeObjectURL(image.src);

  const blob = await new Promise<Blob | null>((resoudre) =>
    canvas.toBlob(resoudre, format.type, QUALITE),
  );

  if (!blob) {
    return {
      fichier,
      type: fichier.type || 'image/jpeg',
      extension: 'jpg',
      octetsAvant: fichier.size,
      octetsApres: fichier.size,
    };
  }

  return {
    fichier: blob,
    type: format.type,
    extension: format.extension,
    octetsAvant: fichier.size,
    octetsApres: blob.size,
  };
}

function chargerImage(fichier: File): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    image.onload = () => resoudre(image);
    image.onerror = () => rejeter(new Error('Image illisible'));
    image.src = URL.createObjectURL(fichier);
  });
}
