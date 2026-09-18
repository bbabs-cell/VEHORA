import { expect, test } from '@playwright/test';
import { creerDossierEnAttente, stationDuProjet } from './fixtures';
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

test.describe('Tableau de bord', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test('il compte les véhicules présents, et ne promet plus rien', async ({ page }, info) => {
    const dossier = await creerDossierEnAttente(
      'Lavage complet',
      stationDuProjet(info.project.name),
    );
    try {
      await installerRelaisReseau(page);
      await page.goto('/tableau-de-bord');

      const presents = page.getByRole('region', { name: 'En ce moment' });
      await expect(presents).toBeVisible({ timeout: 20_000 });

      // Ce que l'œil doit voir : un compte, pas une promesse.
      await expect(presents).toContainText('Véhicules présents');
      await expect(presents).toContainText('En attente');
      const valeur = presents.locator('.tuile__valeur').first();
      await expect(valeur).not.toHaveText('0', { timeout: 20_000 });

      // La phrase écrite en phase 3 et devenue fausse ne doit plus être là.
      await expect(page.getByText('dès que la gestion des prestations')).toHaveCount(0);
    } finally {
      await dossier.nettoyer();
    }
  });

  test('le chiffre du jour est là pour un propriétaire', async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/tableau-de-bord');

    const jour = page.getByRole('region', { name: 'Aujourd’hui' });
    await expect(jour).toBeVisible({ timeout: 20_000 });
    await expect(jour).toContainText('Encaissé');
    // Le symbole, jamais le code ISO.
    await expect(jour).not.toContainText('XOF');
  });
});

test.describe('Tableau de bord — caissier', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants caissier absents');
  test.use({ storageState: etat('caissier') });

  test('un caissier voit la file, pas le chiffre d’affaires', async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/tableau-de-bord');

    await expect(page.getByRole('region', { name: 'En ce moment' })).toBeVisible({
      timeout: 20_000,
    });
    // Encaisser n'est pas savoir combien la station encaisse.
    await expect(page.getByRole('region', { name: 'Aujourd’hui' })).toHaveCount(0);
  });
});
