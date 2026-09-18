import { expect, test } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';
import { etat } from './session-partagee';

const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};
const caissier = {
  email: process.env['VEHORA_TEST_EMAIL_CAISSIER'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD_CAISSIER'],
};

// ---------------------------------------------------------------------------
// 1. Utilisateur autorisé
// ---------------------------------------------------------------------------
test.describe('Stations — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/tableau-de-bord');
  });

  test('création, modification et désactivation', async ({ page }, infos) => {
    const nom = `Station test ${infos.project.name} ${Date.now()}`;

    // Sur mobile, la navigation vit dans le tiroir : il faut l'ouvrir. On
    // attend que la coquille soit posée : interroger la visibilité d'un bouton
    // pas encore rendu répond « non » sans erreur, et le clic suivant échoue
    // pour une raison qui n'a rien à voir avec les stations.
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 20_000 });
    const ouvrirMenu = page.getByRole('button', { name: 'Ouvrir le menu' });
    if (await ouvrirMenu.isVisible()) {
      await ouvrirMenu.click();
    }
    await page.getByRole('link', { name: 'Stations', exact: true }).first().click();
    await expect(page).toHaveURL(/\/stations/);

    await page.getByRole('button', { name: 'Ajouter une station' }).click();
    await page.getByLabel('Nom de la station').fill(nom);
    await page.getByLabel('Ville').fill('Thiès');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    const carte = page.locator('.carte').filter({ hasText: nom });
    await expect(carte).toBeVisible({ timeout: 15_000 });
    await expect(carte).toContainText('Thiès');

    // Modification
    await carte.getByRole('button', { name: `Modifier ${nom}` }).click();
    await page.getByLabel('Ville').fill('Saint-Louis');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(carte).toContainText('Saint-Louis', { timeout: 15_000 });

    // Désactivation : on désactive, on ne supprime pas — l'historique compte.
    await carte.getByRole('button', { name: `Désactiver ${nom}` }).click();
    const confirmation = page.getByRole('dialog', { name: 'Désactiver cette station ?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Désactiver' }).click();
    await expect(carte).toContainText('Inactive', { timeout: 15_000 });

    // Nettoyage : la suppression n'existe pas dans l'interface, on passe par
    // l'API avec la même permission.
    await page.evaluate(async (nomStation) => {
      const cle = Object.keys(localStorage).find((k) => k.includes('auth-token'));
      const jeton = JSON.parse(localStorage.getItem(cle!)!).access_token as string;
      const base = 'https://entpmxssjxllggsqhnwc.supabase.co/rest/v1';
      const apikey = 'sb_publishable_e3seZbuqZkKCNHaW2GeEHA_wa5V8-Y2';
      await fetch(`${base}/stations?name=eq.${encodeURIComponent(nomStation)}`, {
        method: 'DELETE',
        headers: { apikey, Authorization: `Bearer ${jeton}` },
      });
    }, nom);
  });

  test('un nom déjà pris affiche une erreur claire', async ({ page }) => {
    await page.goto('/stations');
    await page.getByRole('button', { name: 'Ajouter une station' }).click();
    await page.getByLabel('Nom de la station').fill('Liberté 6');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByRole('alert')).toContainText('porte déjà ce nom', {
      timeout: 15_000,
    });
  });

  test('le nom est obligatoire, sans appel réseau inutile', async ({ page }) => {
    let appel = false;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/rest/v1/stations')) appel = true;
    });

    await page.goto('/stations');
    await page.getByRole('button', { name: 'Ajouter une station' }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
    expect(appel).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Utilisateur non autorisé
// ---------------------------------------------------------------------------
test.describe('Stations — caissier sans stations.manage', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants caissier absents');
  test.use({ storageState: etat('caissier') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/tableau-de-bord');
  });

  test("l'entrée Stations n'apparaît pas dans la navigation", async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Stations', exact: true })).toHaveCount(0);
  });

  test("l'accès direct à l'URL est refusé", async ({ page }) => {
    // 3. Utilisateur malveillant : contournement par l'URL.
    await page.goto('/stations');
    await expect(page).toHaveURL(/tableau-de-bord/);
  });

  test("l'action rapide de gestion des stations n'est pas proposée", async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Gérer les stations' })).toHaveCount(0);
  });
});
