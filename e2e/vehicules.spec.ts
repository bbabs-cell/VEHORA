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

test.describe('Véhicules — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/vehicules');
  });

  test('la liste affiche plaque, type et propriétaire', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Liste des véhicules' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('DK-1234-A');
    await expect(liste).toContainText('Berline');
    await expect(liste).toContainText('Moussa Diallo');
  });

  test('la recherche fonctionne par plaque, modèle et propriétaire', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Liste des véhicules' });
    const champ = page.getByLabel('Rechercher un véhicule');

    // Plaque saisie sans séparateur.
    await champ.fill('dk1234');
    await expect(liste).toContainText('DK-1234-A', { timeout: 15_000 });

    await champ.fill('Corolla');
    await expect(liste).toContainText('DK-1234-A', { timeout: 15_000 });

    // Nom du propriétaire, orthographe approximative.
    await champ.fill('Mousa');
    await expect(liste).toContainText('DK-1234-A', { timeout: 15_000 });
  });

  test('une plaque déjà prise est refusée, quelle que soit l’écriture', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau véhicule' }).click();
    await page.getByLabel('Plaque d’immatriculation').fill('dk 1234 a');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByRole('alert')).toContainText('porte déjà cette plaque', {
      timeout: 15_000,
    });
  });

  test('le formulaire ne déborde pas de la modale', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau véhicule' }).click();
    const modale = page.locator('.modale__contenu');
    await expect(modale).toBeVisible();

    const boiteModale = await modale.boundingBox();
    for (const champ of await modale.locator('input, select').all()) {
      const boite = await champ.boundingBox();
      if (!boite || !boiteModale) continue;
      // Tolérance d'un pixel pour les arrondis de rendu.
      expect(boite.x + boite.width).toBeLessThanOrEqual(boiteModale.x + boiteModale.width + 1);
    }

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(debordement).toBe(false);
  });

  test('le champ obligatoire venu du réseau est toujours renseigné', async ({ page }) => {
    // Invariant qui empêche l'échec silencieux : à l'ouverture du formulaire,
    // le type — qui vient d'un chargement asynchrone — a déjà une valeur.
    // Sans lui, le formulaire serait invalide sans que rien ne l'explique.
    await page.getByRole('button', { name: 'Nouveau véhicule' }).click();

    const type = page.getByLabel('Type');
    await expect(type).toBeVisible();
    await expect(type).not.toHaveValue('');
    await expect(type.locator('option:checked')).toHaveText(/Berline/);
  });

  test('la plaque est obligatoire, sans appel réseau inutile', async ({ page }) => {
    let appel = false;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/rest/v1/vehicles')) appel = true;
    });

    await page.getByRole('button', { name: 'Nouveau véhicule' }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('La plaque est obligatoire.')).toBeVisible();
    expect(appel).toBe(false);
  });

  test('création avec propriétaire, puis archivage', async ({ page }, infos) => {
    const plaque = `TS-${(Date.now() % 9000) + 1000}-${infos.project.name === 'mobile' ? 'M' : 'D'}`;

    await page.getByRole('button', { name: 'Nouveau véhicule' }).click();
    await page.getByLabel('Plaque d’immatriculation').fill(plaque);
    await page.getByLabel('Marque').fill('Hyundai');

    // Sélecteur de propriétaire : recherche puis choix.
    await page.getByLabel('Propriétaire (facultatif)').fill('Cheikh');
    const suggestion = page.getByRole('button', { name: /Cheikh Sy/ });
    await expect(suggestion).toBeVisible({ timeout: 15_000 });
    await suggestion.click();

    await page.getByRole('button', { name: 'Enregistrer' }).click();

    const carte = page.locator('.carte').filter({ hasText: plaque });
    await expect(carte).toBeVisible({ timeout: 15_000 });
    await expect(carte).toContainText('Cheikh Sy');

    await carte.getByRole('button', { name: `Archiver ${plaque}` }).click();
    const confirmation = page.getByRole('dialog', { name: 'Archiver ce véhicule ?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Archiver' }).click();
    await expect(carte).toHaveCount(0, { timeout: 15_000 });
  });

  test('un véhicule sans propriétaire l’indique clairement', async ({ page }, infos) => {
    const plaque = `SP-${(Date.now() % 9000) + 1000}-${infos.project.name === 'mobile' ? 'M' : 'D'}`;

    await page.getByRole('button', { name: 'Nouveau véhicule' }).click();
    await page.getByLabel('Plaque d’immatriculation').fill(plaque);
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    const carte = page.locator('.carte').filter({ hasText: plaque });
    await expect(carte).toContainText('Propriétaire non renseigné', { timeout: 15_000 });

    await carte.getByRole('button', { name: `Archiver ${plaque}` }).click();
    const confirmation = page.getByRole('dialog', { name: 'Archiver ce véhicule ?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Archiver' }).click();
    await expect(carte).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe('Véhicules — caissier en lecture seule', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants caissier absents');
  test.use({ storageState: etat('caissier') });

  test('il voit les véhicules mais aucune action d’écriture', async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/vehicules');

    const liste = page.getByRole('list', { name: 'Liste des véhicules' });
    await expect(liste).toContainText('DK-1234-A', { timeout: 15_000 });

    await expect(page.getByRole('button', { name: 'Nouveau véhicule' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Modifier / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Archiver / })).toHaveCount(0);
  });
});
