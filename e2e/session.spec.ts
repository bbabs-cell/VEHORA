import { expect, test } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';

/**
 * Parcours connecté de bout en bout.
 *
 * Les identifiants viennent de l'environnement : aucun mot de passe n'est
 * stocké dans le dépôt. Sans eux, la suite est ignorée plutôt qu'en échec,
 * pour que le dépôt reste clonable et testable par n'importe qui.
 */
const email = process.env['VEHORA_TEST_EMAIL'];
const motDePasse = process.env['VEHORA_TEST_PASSWORD'];

test.describe('Session connectée', () => {
  test.skip(
    !email || !motDePasse,
    'VEHORA_TEST_EMAIL et VEHORA_TEST_PASSWORD non définis',
  );

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
  });

  test('connexion, claims et déconnexion', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Adresse e-mail').fill(email!);
    await page.getByLabel('Mot de passe').fill(motDePasse!);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Accès au tableau de bord : la garde de session et celle d'organisation
    // ont toutes deux été franchies.
    await expect(page).toHaveURL(/\/tableau-de-bord/, { timeout: 20_000 });

    // Les claims produits par le hook sont bien lus par l'application.
    await expect(page.getByText('OWNER')).toBeVisible();
    await expect(page.getByText('ORGANIZATION')).toBeVisible();
    await expect(page.getByText('30', { exact: true })).toBeVisible();

    // La déconnexion ramène à la connexion et ferme l'accès.
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/connexion/);

    await page.goto('/tableau-de-bord');
    await expect(page).toHaveURL(/\/connexion/);
  });

  test('la session survit à un rechargement', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Adresse e-mail').fill(email!);
    await page.getByLabel('Mot de passe').fill(motDePasse!);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord/, { timeout: 20_000 });

    await page.reload();
    await expect(page).toHaveURL(/\/tableau-de-bord/);
    await expect(page.getByText('OWNER')).toBeVisible();
  });
});
