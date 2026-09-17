import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Identifiants de test : variables d'environnement, ou fichier `.env.local`.
 *
 * Sans elles, la suite connectée est ignorée (« skipped ») — ce qui ressemble à
 * un succès et n'en est pas. Les poser à la main est pénible et diffère selon
 * le terminal (`export`, `set`, `$env:`) : un fichier local, ignoré par Git,
 * évite la question.
 *
 * On lit le fichier soi-même plutôt qu'avec `process.loadEnvFile()` pour une
 * raison précise : Windows PowerShell 5 écrit un BOM en tête de fichier avec
 * `Set-Content -Encoding utf8`. `loadEnvFile` le prend alors pour le début du
 * premier nom de variable, qui devient `\uFEFFVEHORA_TEST_EMAIL` — invisible à
 * l'œil, et la moitié de la suite s'ignore sans rien expliquer. C'est arrivé.
 *
 * Une variable déjà posée dans l'environnement l'emporte : le fichier sert au
 * poste de travail, pas à écraser une configuration d'intégration continue.
 */
function chargerEnvLocal(fichier: string): void {
  let contenu: string;
  try {
    contenu = readFileSync(fichier, 'utf8');
  } catch {
    return; // Pas de fichier : les variables viennent de l'environnement.
  }

  for (const ligne of contenu.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const texte = ligne.trim();
    if (texte === '' || texte.startsWith('#')) continue;

    const separateur = texte.indexOf('=');
    if (separateur <= 0) continue;

    const cle = texte.slice(0, separateur).trim();
    let valeur = texte.slice(separateur + 1).trim();
    if (
      (valeur.startsWith('"') && valeur.endsWith('"')) ||
      (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }

    if (process.env[cle] === undefined) process.env[cle] = valeur;
  }
}

chargerEnvLocal('.env.local');

// Un « skipped » massif ressemble à un succès : on le dit tout de suite.
if (!process.env['VEHORA_TEST_EMAIL'] || !process.env['VEHORA_TEST_PASSWORD']) {
  console.warn(
    '\n⚠️  VEHORA_TEST_EMAIL / VEHORA_TEST_PASSWORD absents : la suite connectée ' +
      'sera IGNORÉE.\n   Copiez `.env.example` en `.env.local` et renseignez-le ' +
      '(voir README).\n',
  );
}

/**
 * L'environnement cloud fournit un Chromium préinstallé dont la révision peut
 * différer de celle attendue par @playwright/test. On pointe explicitement le
 * binaire plutôt que d'en télécharger un second (interdit ici).
 * En local, laisser la variable vide : Playwright utilise son propre navigateur.
 */
const chromiumPreinstalle = process.env['VEHORA_CHROMIUM'] ?? undefined;

/**
 * En environnement cloud, le trafic sortant passe par un proxy que le
 * navigateur n'hérite pas des variables d'environnement. Sans cela, l'appel à
 * Supabase échoue et le test se termine sur « Connexion au serveur
 * impossible ». En local, laisser la variable vide.
 */
const proxySortant = process.env['HTTPS_PROXY'];
const optionsLancement = {
  executablePath: chromiumPreinstalle,
  ...(proxySortant
    ? {
        args: [
          `--proxy-server=${proxySortant}`,
          // Le serveur de développement est local : il ne doit jamais passer
          // par le proxy, qui répondrait 405.
          '--proxy-bypass-list=localhost;127.0.0.1;[::1]',
        ],
      }
    : {}),
};

/**
 * Les parcours critiques sont testés au format téléphone d'abord : c'est
 * l'appareil réel des utilisateurs (skill vehora-west-africa).
 */
/**
 * Les tests servent l'application sur LEUR port, pas sur 4200.
 *
 * `reuseExistingServer` réutilise ce qui écoute déjà : si un autre serveur de
 * développement traîne sur 4200 — une version antérieure du produit, lancée
 * dans une autre fenêtre ou un autre dossier — Playwright teste cette
 * application-là sans rien dire. C'est arrivé : trente-sept minutes de tests
 * rouges sur une application qui n'était pas la nôtre, avec des routes et des
 * messages d'une version d'il y a plusieurs phases.
 *
 * Un port dédié rend la confusion impossible, et laisse `npm start` tranquille
 * sur 4200 pendant que les tests tournent.
 */
const port = Number(process.env['VEHORA_PORT'] ?? 4280);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
        launchOptions: optionsLancement,
        ignoreHTTPSErrors: Boolean(proxySortant),
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: optionsLancement,
        ignoreHTTPSErrors: Boolean(proxySortant),
      },
    },
  ],
  webServer: {
    command: `npx ng serve --port ${port}`,
    url: baseURL,
    // La réutilisation reste utile entre deux exécutions de la suite, mais
    // seulement sur ce port-ci, où rien d'autre n'a de raison d'écouter.
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
