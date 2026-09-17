import { defineConfig, devices } from '@playwright/test';

/**
 * Identifiants de test : variables d'environnement, ou fichier `.env.local`.
 *
 * Sans elles, la suite connectée est ignorée (« skipped ») — ce qui ressemble à
 * un succès et n'en est pas. Les poser à la main est pénible et diffère selon
 * le terminal (`export` sous Unix, `set` ou `$env:` sous Windows) : un fichier
 * local, ignoré par Git, évite la question.
 *
 * `.env.local` n'est jamais commité (`.env.*` est dans `.gitignore`) et ne doit
 * contenir que des identifiants de démonstration.
 */
try {
  process.loadEnvFile('.env.local');
} catch {
  // Pas de fichier : les variables viennent de l'environnement, ou la suite
  // connectée s'ignorera d'elle-même.
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
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
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
    command: 'npx ng serve --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
