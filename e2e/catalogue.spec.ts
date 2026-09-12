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

test.describe('Catalogue — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);
    await page.goto('/catalogue');
  });

  test('les prestations et leurs tarifs sont lisibles', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Prestations du catalogue' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Lavage complet');
    await expect(liste).toContainText('Lavage');
    await expect(liste).toContainText('45 min');
  });

  test('un montant s’affiche en francs, groupé par milliers', async ({ page }) => {
    const tarifs = page.getByRole('list', { name: 'Tarifs de Lavage complet' });
    await expect(tarifs).toBeVisible({ timeout: 15_000 });

    // Ce que l'œil doit voir : « 5 000 F CFA », jamais « 5000 » ni « 50,00 ».
    await expect(tarifs).toHaveText(/5.000.F.CFA/);
    await expect(tarifs).toHaveText(/8.000.F.CFA/);
    await expect(tarifs).not.toHaveText(/5000/);
  });

  test('la portée de chaque tarif est écrite en toutes lettres', async ({ page }) => {
    const tarifs = page.getByRole('list', { name: 'Tarifs de Lavage complet' });
    await expect(tarifs).toBeVisible({ timeout: 15_000 });
    await expect(tarifs).toContainText('Tous véhicules · Toutes stations');
    await expect(tarifs).toContainText('SUV · Toutes stations');
  });

  test('une prestation sans tarif le dit clairement', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Prestations du catalogue' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Aucun tarif défini');
  });

  test('le propriétaire peut ouvrir la création d’une prestation', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvelle prestation' }).click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();
    await expect(modale.getByLabel('Nom')).toBeVisible();
    // Le formulaire ne doit pas déborder de la modale sur un écran étroit.
    const boite = await modale.boundingBox();
    expect(boite!.x).toBeGreaterThanOrEqual(0);
    expect(boite!.x + boite!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('changer un prix propose demain, pas aujourd’hui', async ({ page }) => {
    await page.getByRole('button', { name: /^Changer le tarif/ }).first().click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();

    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await expect(modale.getByLabel('Applicable à partir du')).toHaveValue(demain);
    // Le prix actuel est rappelé : on ne change pas un prix sans le voir.
    await expect(modale).toHaveText(/Prix actuel\s*:\s*\d/);
    // Le champ date est rendu dans la locale de l'appareil (09/13 ou 13/09) :
    // la date est donc aussi écrite en toutes lettres, sans ambiguïté possible.
    await expect(modale).toHaveText(
      /à partir du\s+\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/,
    );
  });

  test('le formulaire de tarif propose « tous les véhicules » par défaut', async ({ page }) => {
    await page
      .getByRole('button', { name: 'Ajouter un tarif à Lavage complet' })
      .click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();
    await expect(modale.getByLabel('Type de véhicule')).toHaveValue('');
    await expect(modale.getByLabel('Station')).toHaveValue('');
    // L'unité de saisie est annoncée : on tape des francs, pas des centimes.
    await expect(modale.getByText(/Montant \(F.CFA\)/)).toBeVisible();
  });
});

test.describe('Catalogue — caissier', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, caissier.email!, caissier.motDePasse!);
    await page.goto('/catalogue');
  });

  test('le caissier lit les tarifs mais ne peut ni les créer ni les modifier', async ({
    page,
  }) => {
    const liste = page.getByRole('list', { name: 'Prestations du catalogue' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Lavage complet');
    await expect(liste).toHaveText(/5.000.F.CFA/);

    await expect(page.getByRole('button', { name: 'Nouvelle prestation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ajouter un tarif/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Retirer le tarif/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Changer le tarif/ })).toHaveCount(0);
  });
});
