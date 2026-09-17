import { expect, test, type Page } from '@playwright/test';
import { creerDossierEnAttente, stationDuProjet } from './fixtures';
import { installerRelaisReseau } from './relais-reseau';

const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};
const caissier = {
  email: process.env['VEHORA_TEST_EMAIL_CAISSIER'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD_CAISSIER'],
};

async function seConnecter(page: Page, email: string, motDePasse: string): Promise<void> {
  await installerRelaisReseau(page);
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/tableau-de-bord/, { timeout: 20_000 });
}

test.describe('Tableau de bord', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test('il compte les véhicules présents, et ne promet plus rien', async ({ page }, info) => {
    const dossier = await creerDossierEnAttente(
      'Lavage complet',
      stationDuProjet(info.project.name),
    );
    try {
      await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);

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
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);

    const jour = page.getByRole('region', { name: 'Aujourd’hui' });
    await expect(jour).toBeVisible({ timeout: 20_000 });
    await expect(jour).toContainText('Encaissé');
    // Le symbole, jamais le code ISO.
    await expect(jour).not.toContainText('XOF');
  });
});

test.describe('Tableau de bord — caissier', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants caissier absents');

  test('un caissier voit la file, pas le chiffre d’affaires', async ({ page }) => {
    await seConnecter(page, caissier.email!, caissier.motDePasse!);

    await expect(page.getByRole('region', { name: 'En ce moment' })).toBeVisible({
      timeout: 20_000,
    });
    // Encaisser n'est pas savoir combien la station encaisse.
    await expect(page.getByRole('region', { name: 'Aujourd’hui' })).toHaveCount(0);
  });
});
