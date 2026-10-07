import { expect, test } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';
import { etat } from './session-partagee';

// L'écran règle l'organisation que d'autres tests lisent : ses tests
// s'enchaînent, et chacun repose ce qu'il a changé.
test.describe.configure({ mode: 'serial' });

const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};
const caissier = {
  email: process.env['VEHORA_TEST_EMAIL_CAISSIER'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD_CAISSIER'],
};

test.describe('Paramètres — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/parametres');
    await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('la fiche arrive remplie, jamais vide', async ({ page }) => {
    // Un formulaire affiché vide sur une donnée asynchrone fait enregistrer
    // l'effacement de sa propre fiche sans le comprendre.
    await expect(page.getByLabel('Nom')).not.toHaveValue('', { timeout: 20_000 });
    await expect(page.getByLabel('Pays (code ISO)')).not.toHaveValue('');
  });

  test('la devise se lit et ne se règle pas', async ({ page }) => {
    // Une action que le serveur refusera ne s'affiche pas comme possible : il
    // n'y a pas de champ, il y a une ligne de lecture et sa raison.
    // `Intl` sépare le symbole par une espace insécable étroite, pas par une
    // espace ordinaire : une assertion littérale échouerait sur un caractère
    // invisible.
    await expect(page.getByText(/F.CFA.*\(XOF\)/)).toBeVisible({ timeout: 20_000 });
    // Aucun contrôle saisissable pour la devise : ni champ, ni liste.
    await expect(page.getByRole('textbox', { name: /devise/i })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /devise/i })).toHaveCount(0);
    await expect(page.getByText(/aucun montant déjà enregistré ne serait converti/)).toBeVisible();
  });

  test('un nom vide est refusé avant tout appel réseau', async ({ page }) => {
    let appel = false;
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && r.url().includes('/rest/v1/organizations')) appel = true;
    });

    await page.getByLabel('Nom').fill('');
    await page.getByRole('button', { name: 'Enregistrer la fiche' }).click();

    await expect(page.getByText('Le nom comporte entre 2 et 120 caractères.')).toBeVisible();
    expect(appel).toBe(false);
  });

  test('la règle de paiement avant restitution se change depuis l’écran', async ({ page }) => {
    const regle = page.getByLabel('Paiement avant restitution');
    await expect(regle).toBeVisible({ timeout: 20_000 });

    await regle.selectOption('STRICT');
    await page.getByRole('button', { name: 'Enregistrer les règles' }).click();
    await expect(page.getByText('Réglages enregistrés.')).toBeVisible({ timeout: 20_000 });

    // Elle tient au rechargement : c'est la base qui la porte, pas l'écran.
    await page.reload();
    await expect(page.getByLabel('Paiement avant restitution')).toHaveValue('STRICT', {
      timeout: 20_000,
    });

    // Un test ne laisse pas l'état qu'il a changé : d'autres tests encaissent.
    await page.getByLabel('Paiement avant restitution').selectOption('ALLOW_DEBT');
    await page.getByRole('button', { name: 'Enregistrer les règles' }).click();
    await expect(page.getByText('Réglages enregistrés.')).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Paramètres — caissier', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants caissier absents');
  test.use({ storageState: etat('caissier') });

  test('l’accès direct à l’URL est refusé, et l’entrée n’est pas proposée', async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/parametres');

    await expect(page).toHaveURL(/tableau-de-bord/, { timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Paramètres' })).toHaveCount(0);
  });
});
