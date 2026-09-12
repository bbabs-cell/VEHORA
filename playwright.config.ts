import { defineConfig, devices } from '@playwright/test';

/**
 * L'environnement cloud fournit un Chromium préinstallé dont la révision peut
 * différer de celle attendue par @playwright/test. On pointe explicitement le
 * binaire plutôt que d'en télécharger un second (interdit ici).
 * En local, laisser la variable vide : Playwright utilise son propre navigateur.
 */
const chromiumPreinstalle = process.env['VEHORA_CHROMIUM'] ?? undefined;

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
        launchOptions: { executablePath: chromiumPreinstalle },
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: chromiumPreinstalle },
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
