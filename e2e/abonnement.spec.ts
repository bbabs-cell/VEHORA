import { expect, test, type Page } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';

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

async function seConnecter(page: Page, email: string, motDePasse: string): Promise<void> {
  await installerRelaisReseau(page);
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/plateforme|tableau-de-bord/, { timeout: 20_000 });
}

test.describe('Abonnement — côté organisation', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);
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

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, admin.email, admin.motDePasse!);
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
