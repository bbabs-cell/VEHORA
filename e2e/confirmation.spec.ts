import { expect, test } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';
import { etat } from './session-partagee';

const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};

test.describe('Confirmations', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test('une confirmation dit ce qui va se passer, et son bouton ce qu’il fait', async ({
    page,
  }) => {
    await installerRelaisReseau(page);
    await page.goto('/clients');

    const carte = page.locator('.carte').first();
    await expect(carte).toBeVisible({ timeout: 20_000 });
    const nom = (await carte.locator('.carte__nom, h2, p').first().textContent())?.trim();

    await carte.getByRole('button', { name: /^Archiver / }).click();

    const confirmation = page.getByRole('dialog', { name: 'Archiver cette fiche client ?' });
    await expect(confirmation).toBeVisible();
    // Ce que l'œil doit lire : la conséquence, pas seulement « Êtes-vous sûr ».
    await expect(confirmation).toContainText('historique est conservé');
    if (nom) await expect(confirmation).toContainText(nom.split('·')[0].trim().slice(0, 12));

    // Le bouton porte l'action, jamais « OK ».
    await expect(confirmation.getByRole('button', { name: 'Archiver' })).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'OK' })).toHaveCount(0);

    // Deux contrôles ne portent jamais le même nom : la croix s'appelle
    // « Fermer », le retrait s'appelle « Annuler ».
    await expect(confirmation.getByRole('button', { name: 'Fermer' })).toHaveCount(1);
    await expect(confirmation.getByRole('button', { name: 'Annuler' })).toHaveCount(1);

    // Annuler ne fait rien : la fiche est toujours là.
    await confirmation.getByRole('button', { name: 'Annuler' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(carte).toBeVisible();
  });

  test('la page ne défile pas derrière une confirmation', async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/vehicules');

    const carte = page.locator('.carte').first();
    await expect(carte).toBeVisible({ timeout: 20_000 });
    await carte.getByRole('button', { name: /^Archiver / }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // On observe la classe posée par `ScrollLockService`, pas le style calculé :
    // la coquille applique elle aussi `overflow` au corps selon la mise en
    // page, et le style calculé ne dirait donc pas qui l'a posé.
    await expect(page.locator('body')).toHaveClass(/vh-defilement-bloque/);

    // Sur mobile, le tiroir de navigation porte « Fermer le menu » : on vise la
    // croix de la boîte de dialogue, pas la sienne.
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/vh-defilement-bloque/);
  });
});
