import { expect, test, type Page } from '@playwright/test';
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

/** Une image PNG minuscule, pour éprouver le chemin d'envoi sans gros fichier. */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Inspection — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);
    await page.goto('/vehicules');
    await page.getByRole('link', { name: /^Inspecter / }).first().click();
    await expect(page).toHaveURL(/\/inspection/);
  });

  test('les zones suivent la ronde autour du véhicule', async ({ page }) => {
    const zones = page.getByRole('list', { name: 'Zones à contrôler' });
    await expect(zones).toBeVisible({ timeout: 15_000 });
    // L'ordre compte : on tourne autour du véhicule, on ne saute pas.
    const libelles = await zones.locator('.zone__nom').allInnerTexts();
    expect(libelles.slice(0, 4)).toEqual(['Avant', 'Côté gauche', 'Arrière', 'Côté droit']);
  });

  test('la barre d’actions reste lisible et sur une seule ligne', async ({ page }, infos) => {
    const actions = page.locator('.inspection__actions');
    await expect(actions).toBeVisible();

    // Fond opaque : sinon le contenu transparaît derrière les boutons.
    const fond = await actions.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fond).not.toMatch(/rgba\(.*,\s*0\)/);

    // Les deux boutons sur la même ligne : deux lignes éloigneraient l'action
    // principale du pouce.
    const boutons = actions.getByRole('button');
    const boites = await Promise.all(
      (await boutons.all()).map(async (b) => (await b.boundingBox())!),
    );
    expect(boites.length).toBe(2);
    expect(Math.abs(boites[0].y - boites[1].y)).toBeLessThan(4);

    // Sur mobile, la barre doit être adossée à la navigation basse : aucune
    // bande de contenu ne doit défiler entre les deux.
    if (infos.project.name === 'mobile') {
      const barre = (await actions.boundingBox())!;
      const nav = (await page.locator('.barre-basse').boundingBox())!;
      expect(Math.abs(barre.y + barre.height - nav.y)).toBeLessThan(2);
    }
  });

  test('enregistrer sans aucun constat est refusé', async ({ page }) => {
    await page.getByRole('button', { name: 'Enregistrer le constat' }).click();
    await expect(page.getByRole('alert')).toContainText('au moins une zone', {
      timeout: 15_000,
    });
  });

  test('le commentaire et la photo n’apparaissent que sur une anomalie', async ({ page }) => {
    const premiere = page.locator('.zone').first();
    await expect(premiere.getByLabel(/Description de l’anomalie/)).toHaveCount(0);

    await premiere.getByRole('button', { name: 'RAS' }).click();
    await expect(premiere.getByLabel(/Description de l’anomalie/)).toHaveCount(0);

    await premiere.getByRole('button', { name: 'Anomalie' }).click();
    await expect(premiere.getByLabel(/Description de l’anomalie/)).toBeVisible();
    await expect(premiere.getByText('Ajouter une photo')).toBeVisible();
  });

  test('retaper le même bouton annule le constat', async ({ page }) => {
    const premiere = page.locator('.zone').first();
    const ras = premiere.getByRole('button', { name: 'RAS' });

    await ras.click();
    await expect(ras).toHaveAttribute('aria-pressed', 'true');
    await ras.click();
    await expect(ras).toHaveAttribute('aria-pressed', 'false');
  });

  test('le compteur suit l’avancement', async ({ page }) => {
    const compteur = page.getByRole('status').first();
    await expect(compteur).toContainText('0 /');

    await page.locator('.zone').nth(0).getByRole('button', { name: 'RAS' }).click();
    await page.locator('.zone').nth(1).getByRole('button', { name: 'Anomalie' }).click();

    await expect(compteur).toContainText('2 /');
    await expect(compteur).toContainText('1 anomalie');
  });

  test('constat complet avec photo, enregistré de bout en bout', async ({ page }) => {
    const zoneAvant = page.locator('.zone').first();
    await zoneAvant.getByRole('button', { name: 'Anomalie' }).click();
    await zoneAvant.getByLabel(/Description de l’anomalie/).fill('Rayure sur le pare-chocs');

    await zoneAvant.locator('input[type="file"]').setInputFiles({
      name: 'constat.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });
    await expect(zoneAvant.getByText('constat.png')).toBeVisible();

    await page.locator('.zone').nth(1).getByRole('button', { name: 'RAS' }).click();
    await page.getByLabel('Remarques générales').fill('Véhicule reçu poussiéreux.');

    await page.getByRole('button', { name: 'Enregistrer le constat' }).click();

    // Retour à la liste : le constat est passé, photo comprise.
    await expect(page).toHaveURL(/\/vehicules$/, { timeout: 30_000 });
  });

  test('une photo peut être retirée avant enregistrement', async ({ page }) => {
    const zone = page.locator('.zone').first();
    await zone.getByRole('button', { name: 'Anomalie' }).click();
    await zone.locator('input[type="file"]').setInputFiles({
      name: 'aretirer.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    await expect(zone.getByText('aretirer.png')).toBeVisible();
    await zone.getByRole('button', { name: 'Retirer la photo 1' }).click();
    await expect(zone.getByText('aretirer.png')).toHaveCount(0);
  });
});

test.describe('Inspection — caissier sans inspections.write', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants caissier absents');

  test('ni le bouton, ni l’accès direct par URL', async ({ page }) => {
    await seConnecter(page, caissier.email!, caissier.motDePasse!);
    await page.goto('/vehicules');

    await expect(page.getByRole('link', { name: /^Inspecter / })).toHaveCount(0);

    // Contournement par l'URL : la garde renvoie au tableau de bord.
    await page.goto('/vehicules/00000000-0000-0000-0000-000000000000/inspection');
    await expect(page).toHaveURL(/tableau-de-bord/);
  });
});
