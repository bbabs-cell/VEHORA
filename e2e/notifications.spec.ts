import { expect, test } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';
import { etat } from './session-partagee';

const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};

test.describe('Messages aux clients', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/messages');
    await expect(page.getByRole('heading', { name: 'Messages aux clients' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('l’écran dit qu’aucun message ne part', async ({ page }) => {
    // Sans cette phrase, on chercherait pendant des jours pourquoi les clients
    // ne reçoivent rien.
    await expect(page.getByText(/Aucun message n’est envoyé pour l’instant/)).toBeVisible();
    await expect(page.getByText(/l’envoi demande un fournisseur de SMS/)).toBeVisible();
  });

  test('une fonctionnalité fermée s’explique au lieu de montrer une liste vide', async ({
    page,
  }) => {
    // Le drapeau `notifications` est fermé par défaut. Un écran vide sans
    // explication fait douter du reste de l'application.
    await expect(
      page.getByText('Les notifications ne sont pas activées'),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/cette liste reste donc vide/)).toBeVisible();
  });
});

test.describe('Consentement du client', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test('le consentement est une case visible du formulaire, cochée par défaut', async ({
    page,
  }) => {
    await installerRelaisReseau(page);
    await page.goto('/clients');

    await page.getByRole('button', { name: 'Nouveau client' }).click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();

    const case_ = modale.getByLabel('Accepte d’être prévenu par message');
    await expect(case_).toBeVisible();
    await expect(case_).toBeChecked();

    // La règle est dite à l'écran : sans numéro, rien ne part de toute façon.
    await expect(modale.getByText(/Sans numéro de téléphone/)).toBeVisible();
  });

  test('un refus est conservé, et se relit à la réouverture', async ({ page }, infos) => {
    await installerRelaisReseau(page);
    await page.goto('/clients');

    const nom = `Refus ${infos.project.name} ${Date.now()}`;

    await page.getByRole('button', { name: 'Nouveau client' }).click();
    const modale = page.getByRole('dialog');
    await modale.getByLabel('Nom du client').fill(nom);
    await modale.getByLabel('Accepte d’être prévenu par message').uncheck();
    await modale.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(modale).toBeHidden({ timeout: 15_000 });

    const carte = page.locator('.carte').filter({ hasText: nom });
    await expect(carte).toBeVisible({ timeout: 15_000 });

    await carte.getByRole('button', { name: `Modifier ${nom}` }).click();
    const edition = page.getByRole('dialog');
    await expect(edition.getByLabel('Accepte d’être prévenu par message')).not.toBeChecked();
    await edition.getByRole('button', { name: 'Annuler' }).click();

    // Un test ne laisse pas derrière lui ce qu'il a créé.
    await carte.getByRole('button', { name: `Archiver ${nom}` }).click();
    const confirmation = page.getByRole('dialog');
    await confirmation.getByRole('button', { name: 'Archiver' }).click();
    await expect(carte).toHaveCount(0, { timeout: 15_000 });
  });
});
