import { expect, test } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';
import { etat } from './session-partagee';

// Changer un plan modifie l'état d'une organisation : chaque projet travaille
// sur la sienne, et les tests d'un même projet s'enchaînent — la règle établie
// pour la caisse et pour la suspension.
test.describe.configure({ mode: 'serial' });

function organisationDuProjet(projet: string): string {
  return `Test plateforme ${projet}`;
}

const admin = {
  email: 'admin@vehora.test',
  motDePasse: process.env['VEHORA_TEST_PASSWORD_ADMIN'],
};
const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};

test.describe('Abonnement — côté organisation', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/abonnement');
  });

  test('le plan, sa consommation et les fonctionnalités sont lisibles', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible({
      timeout: 20_000,
    });

    // « Stations » figure aussi dans la navigation : on regarde le contenu, pas
    // la page entière.
    const contenu = page.getByRole('main');

    // Ce que l'œil doit voir : un nom de plan, et deux consommations chiffrées
    // qui disent leur borne — « 2 sur 10 », pas « 2 ».
    await expect(contenu.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await expect(contenu.getByText('Stations', { exact: true })).toBeVisible();
    await expect(contenu.getByText(/sur \d+|sans limite/).first()).toBeVisible();

    // Les fonctionnalités disent leur état par un mot, jamais par la couleur seule.
    await expect(contenu.getByText(/Incluse|Non incluse/).first()).toBeVisible();
  });

  test('l’écran est en lecture seule : aucun bouton n’y change le plan', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Votre abonnement' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Changer le plan/ })).toHaveCount(0);
  });
});

test.describe('Abonnement — côté plateforme', () => {
  test.skip(!admin.motDePasse, 'mot de passe de plateforme absent');
  test.use({ storageState: etat('admin') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/plateforme/organisations');
  });

  test('le plan de chaque organisation est affiché dans la liste', async ({ page }, info) => {
    const carte = page
      .locator('.organisation', { hasText: organisationDuProjet(info.project.name) })
      .first();
    await expect(carte).toBeVisible({ timeout: 20_000 });
    await expect(carte).toContainText('Plan');
  });

  test('changer de plan exige un motif, et le changement est appliqué', async ({ page }, info) => {
    const nom = organisationDuProjet(info.project.name);
    const carte = page.locator('.organisation', { hasText: nom }).first();
    await expect(carte).toBeVisible({ timeout: 20_000 });

    await carte.getByRole('button', { name: `Abonnement de ${nom}` }).click();
    const modale = page.getByRole('dialog');
    await expect(modale).toContainText('Plan en cours');

    // Le formulaire s'ouvre sur le plan en cours : la base refuserait de le
    // reposer, donc le bouton reste inerte et dit pourquoi.
    await expect(modale.getByRole('button', { name: 'Changer le plan' })).toBeDisabled();
    await expect(modale).toContainText('déjà le plan en cours');

    await modale.getByLabel('Nouveau plan').selectOption({ label: 'Essentiel' });

    // Sans motif, la base refuserait : l'écran le dit avant d'appeler.
    await modale.getByRole('button', { name: 'Changer le plan' }).click();
    await expect(modale.getByRole('alert')).toContainText('motif');

    await modale.getByLabel('Motif').fill('Test de parcours automatisé');
    await modale.getByRole('button', { name: 'Changer le plan' }).click();
    await expect(modale).toBeHidden({ timeout: 20_000 });

    const apres = page.locator('.organisation', { hasText: nom }).first();
    await expect(apres).toContainText('Essentiel', { timeout: 20_000 });

    // Le journal de plateforme le montre, avec son motif.
    await page.goto('/plateforme/journal');
    await expect(page.getByText('Test de parcours automatisé').first()).toBeVisible({
      timeout: 20_000,
    });

    // On repose le plan d'origine : un test ne laisse pas l'état qu'il a changé.
    await page.goto('/plateforme/organisations');
    const retour = page.locator('.organisation', { hasText: nom }).first();
    await retour.getByRole('button', { name: `Abonnement de ${nom}` }).click();
    const modale2 = page.getByRole('dialog');
    await modale2.getByLabel('Nouveau plan').selectOption({ label: 'Pro' });
    await modale2.getByLabel('Motif').fill('Retour au plan initial');
    await modale2.getByRole('button', { name: 'Changer le plan' }).click();
    await expect(modale2).toBeHidden({ timeout: 20_000 });
  });
});

// ---------------------------------------------------------------------------
// Facturation (phase 20)
//
// L'écran de facturation agit sur des données partagées : émettre et relancer
// touchent toutes les organisations. Ces tests vivent donc dans le fichier qui
// possède déjà l'espace plateforme, et s'enchaînent avec les précédents.
// ---------------------------------------------------------------------------
test.describe('Facturation — plateforme', () => {
  test.skip(!admin.motDePasse, 'mot de passe de plateforme absent');
  test.use({ storageState: etat('admin') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/plateforme/facturation');
    await expect(page.getByRole('heading', { name: 'Facturation' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('la période est écrite en toutes lettres, pas seulement dans le champ', async ({
    page,
  }) => {
    // Un `<input type="date">` s'affiche dans la locale de l'appareil : sur un
    // Android en anglais, « 09/01/2026 ».
    await expect(page.getByText(/Mois retenu : \w+ \d{4}\./)).toBeVisible();
  });

  test('l’écran dit ce qu’il facture, et ce qu’il ne facture pas', async ({ page }) => {
    // Le revenu de VEHORA n'est pas le chiffre d'affaires des stations : la
    // règle est dans le texte de l'écran, là où quelqu'un la lira.
    await expect(page.getByText(/jamais le chiffre d’affaires des stations/)).toBeVisible();
  });

  test('émettre deux fois la même période ne refacture pas', async ({ page }) => {
    await page.getByRole('button', { name: 'Émettre les échéances' }).click();
    await expect(page.getByRole('status')).toContainText('émises', { timeout: 20_000 });

    const avant = await page.locator('.carte').count();

    await page.getByRole('button', { name: 'Émettre les échéances' }).click();
    await expect(page.getByRole('status')).toContainText('émises', { timeout: 20_000 });

    // L'idempotence est garantie par l'index unique en base, pas par l'écran :
    // ce test vérifie que la garantie tient de bout en bout.
    await expect(page.locator('.carte')).toHaveCount(avant, { timeout: 20_000 });
  });

  test('une facture annulée demande son motif, et le bouton reste inerte sans lui', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Émettre les échéances' }).click();
    await expect(page.getByRole('status')).toContainText('émises', { timeout: 20_000 });

    const carte = page.locator('.carte').filter({ hasText: 'À régler' }).first();
    await expect(carte).toBeVisible({ timeout: 20_000 });

    await carte.getByRole('button', { name: 'Annuler la facture' }).click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();

    // Une action que le serveur refusera ne s'affiche pas comme possible.
    await expect(modale.getByRole('button', { name: 'Marquer annulée' })).toBeDisabled();
    await expect(modale.getByText('Le motif est obligatoire.')).toBeVisible();

    await modale.getByLabel('Motif').fill('Test de parcours automatisé');
    await expect(modale.getByRole('button', { name: 'Marquer annulée' })).toBeEnabled();

    await modale.getByRole('button', { name: 'Marquer annulée' }).click();
    await expect(modale).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole('status')).toContainText('annulée', { timeout: 20_000 });
  });

  test('une facture annulée n’offre plus d’action, et dit pourquoi', async ({ page }) => {
    const annulee = page.locator('.carte').filter({ hasText: 'Annulée' }).first();
    await expect(annulee).toBeVisible({ timeout: 20_000 });
    await expect(annulee).toContainText('plus rien à faire sur cette facture');
    await expect(annulee.getByRole('button', { name: 'Marquer réglée' })).toHaveCount(0);
  });
});

test.describe('Factures — côté organisation', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test('une organisation voit ses factures, et le symbole de sa devise', async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/abonnement');

    const section = page.getByRole('heading', { name: 'Vos factures' });
    await expect(section).toBeVisible({ timeout: 20_000 });

    // Le symbole à l'écran, jamais le code ISO — même pour une facture.
    await expect(page.locator('.facturation, .abonnement')).not.toContainText('XOF');
  });
});
