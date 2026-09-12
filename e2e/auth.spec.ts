import { expect, test } from '@playwright/test';

test.describe('Authentification', () => {
  test('un visiteur non connecté est redirigé vers la connexion', async ({ page }) => {
    await page.goto('/tableau-de-bord');
    await expect(page).toHaveURL(/\/connexion/);
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('la redirection demandée est conservée', async ({ page }) => {
    await page.goto('/tableau-de-bord');
    // La garde est asynchrone (restauration de session) : la redirection
    // survient après la navigation initiale.
    await expect(page).toHaveURL(/redirection=%2Ftableau-de-bord/);
  });

  test('le formulaire valide la saisie avant tout appel réseau', async ({ page }) => {
    await page.goto('/connexion');

    let appelReseau = false;
    page.on('request', (r) => {
      if (r.url().includes('/auth/v1/token')) appelReseau = true;
    });

    await page.getByLabel('Adresse e-mail').fill('pas-un-email');
    await page.getByLabel('Mot de passe').fill('court');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible();
    await expect(page.getByText('Le mot de passe comporte au moins 8 caractères.')).toBeVisible();
    expect(appelReseau).toBe(false);
  });

  test('des identifiants invalides affichent une erreur sans révéler le compte', async ({
    page,
  }) => {
    await page.goto('/connexion');
    await page.getByLabel('Adresse e-mail').fill('inconnu@vehora.test');
    await page.getByLabel('Mot de passe').fill('motdepasse-invalide');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    const alerte = page.getByRole('alert');
    await expect(alerte).toBeVisible({ timeout: 15_000 });
    // Le message ne doit pas distinguer « compte inexistant » de « mot de passe faux ».
    await expect(alerte).not.toContainText(/n'existe pas|inconnu|introuvable/i);
  });

  test('les cibles tactiles respectent le minimum de 44px', async ({ page }) => {
    await page.goto('/connexion');
    for (const nom of ['Adresse e-mail', 'Mot de passe']) {
      const boite = await page.getByLabel(nom).boundingBox();
      expect(boite?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const bouton = await page.getByRole('button', { name: 'Se connecter' }).boundingBox();
    expect(bouton?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('aucun secret ni clé service_role dans le bundle servi', async ({ page }) => {
    const reponses: string[] = [];
    page.on('response', async (r) => {
      if (r.url().endsWith('.js')) {
        reponses.push(await r.text().catch(() => ''));
      }
    });
    await page.goto('/connexion');
    await page.waitForLoadState('networkidle');

    const tout = reponses.join('\n');
    expect(tout).not.toContain('service_role');
    expect(tout).not.toContain('sb_secret');
  });
});
