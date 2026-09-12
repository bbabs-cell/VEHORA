import { expect, test } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';

const email = process.env['VEHORA_TEST_EMAIL'];
const motDePasse = process.env['VEHORA_TEST_PASSWORD'];

test.describe('Coquille applicative', () => {
  test.skip(!email || !motDePasse, 'VEHORA_TEST_EMAIL et VEHORA_TEST_PASSWORD non définis');

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/connexion');
    await page.getByLabel('Adresse e-mail').fill(email!);
    await page.getByLabel('Mot de passe').fill(motDePasse!);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/tableau-de-bord/, { timeout: 20_000 });
  });

  test("l'organisation réelle est affichée dans l'en-tête", async ({ page }) => {
    // Preuve que la lecture passe par la RLS jusqu'à l'interface.
    const entete = page.getByRole('banner');
    await expect(entete.getByText('Station Awa')).toBeVisible();
    await expect(entete.getByText('Dakar')).toBeVisible();
  });

  test('le thème bascule et survit au rechargement', async ({ page }) => {
    const racine = page.locator('html');
    await expect(racine).toHaveAttribute('data-theme', /dark|light/);

    const avant = await racine.getAttribute('data-theme');
    await page.getByRole('button', { name: /Passer en thème/ }).click();
    await expect(racine).not.toHaveAttribute('data-theme', avant!);

    const apres = await racine.getAttribute('data-theme');
    await page.reload();
    await expect(racine).toHaveAttribute('data-theme', apres!);
  });

  test('les écrans non construits ne sont pas des liens', async ({ page }) => {
    // Un lien mort coûte plus de confiance qu'il n'en fait gagner.
    const bientot = page.locator('[aria-disabled="true"]').first();
    await expect(bientot).toBeVisible();
    await expect(page.getByRole('link', { name: /Prestations/ })).toHaveCount(0);
  });

  test('un lien d’évitement mène au contenu', async ({ page }) => {
    await page.keyboard.press('Tab');
    const evitement = page.getByRole('link', { name: 'Aller au contenu' });
    await expect(evitement).toBeFocused();
  });

  test('les cibles tactiles de la barre basse respectent 44px', async ({ page }, infos) => {
    test.skip(infos.project.name !== 'mobile', 'barre basse propre au mobile');
    const lien = page.locator('.barre-basse__lien').first();
    const boite = await lien.boundingBox();
    expect(boite?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('la page ne défile pas horizontalement', async ({ page }) => {
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(debordement).toBe(false);
  });
});
