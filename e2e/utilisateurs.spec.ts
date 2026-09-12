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
const sansOrg = {
  email: process.env['VEHORA_TEST_EMAIL_SANS_ORG'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD_SANS_ORG'],
};

async function seConnecter(page: Page, email: string, motDePasse: string): Promise<void> {
  await installerRelaisReseau(page);
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

// ---------------------------------------------------------------------------
// 1. Utilisateur autorisé
// ---------------------------------------------------------------------------
test.describe('Utilisateurs — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);
    await expect(page).toHaveURL(/tableau-de-bord/, { timeout: 20_000 });
    await page.goto('/utilisateurs');
  });

  test('les membres de l’organisation sont listés', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Liste des membres' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Awa Diop');
    await expect(liste.getByText('Vous')).toBeVisible();
  });

  test('le sélecteur affiche le rôle réel de chaque membre', async ({ page }) => {
    // Un sélecteur qui affiche le mauvais rôle ferait promouvoir quelqu'un par
    // erreur : le libellé et la valeur doivent concorder.
    const caissier = page.locator('.carte').filter({ hasText: 'Ousmane Fall' });
    await expect(caissier).toBeVisible({ timeout: 15_000 });
    const choisi = caissier.locator('select option:checked');
    await expect(choisi).toHaveText(/Caissier/);
  });

  test('on ne peut pas modifier son propre rôle', async ({ page }) => {
    // Sinon on pourrait se retirer ses droits par accident, ou contourner la
    // règle du dernier propriétaire.
    const monSelect = page.getByLabel('Rôle de Awa Diop');
    await expect(monSelect).toBeDisabled();
  });

  test('les rôles de plateforme ne sont jamais proposés', async ({ page }) => {
    await page.getByRole('button', { name: 'Inviter quelqu’un' }).click();
    const options = page.locator('#role-invite option');
    await expect(options.filter({ hasText: 'Super Admin' })).toHaveCount(0);
    await expect(options.filter({ hasText: 'Support plateforme' })).toHaveCount(0);
    await expect(options.filter({ hasText: 'Caissier' })).toHaveCount(1);
  });

  test('une adresse invalide bloque avant tout appel réseau', async ({ page }) => {
    let appel = false;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('organization_invitations')) appel = true;
    });

    await page.getByRole('button', { name: 'Inviter quelqu’un' }).click();
    await page.getByLabel('Adresse e-mail').fill('pas-une-adresse');
    await page.getByRole('button', { name: 'Créer l’invitation' }).click();

    await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible();
    expect(appel).toBe(false);
  });

  test('création puis révocation d’une invitation', async ({ page }, infos) => {
    const email = `invite-${infos.project.name}-${Date.now()}@vehora.test`;

    await page.getByRole('button', { name: 'Inviter quelqu’un' }).click();
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByRole('button', { name: 'Créer l’invitation' }).click();

    const carte = page.locator('.carte').filter({ hasText: email });
    await expect(carte).toBeVisible({ timeout: 15_000 });
    // Le code doit être lisible et sélectionnable, même si la copie échoue.
    await expect(carte.locator('code')).toHaveText(/^[0-9a-f]{64}$/);

    await carte.getByRole('button', { name: 'Révoquer' }).click();
    await expect(carte).toHaveCount(0, { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Utilisateur non autorisé
// ---------------------------------------------------------------------------
test.describe('Utilisateurs — caissier sans users.manage', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants caissier absents');

  test('l’accès direct à l’URL est refusé', async ({ page }) => {
    await seConnecter(page, caissier.email!, caissier.motDePasse!);
    await expect(page).toHaveURL(/tableau-de-bord/, { timeout: 20_000 });

    await page.goto('/utilisateurs');
    await expect(page).toHaveURL(/tableau-de-bord/);
    await expect(page.getByRole('link', { name: 'Utilisateurs' })).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Compte sans organisation
// ---------------------------------------------------------------------------
test.describe('Compte sans organisation', () => {
  test.skip(!sansOrg.email || !sansOrg.motDePasse, 'identifiants sans-org absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, sansOrg.email!, sansOrg.motDePasse!);
    await expect(page).toHaveURL(/sans-organisation/, { timeout: 20_000 });
  });

  test('les deux chemins sont proposés', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Créer mon entreprise' })).toBeVisible();
    await expect(page.getByLabel('Code d’invitation')).toBeVisible();
  });

  test('un code inventé est refusé sans révéler d’information', async ({ page }) => {
    await page.getByLabel('Code d’invitation').fill('0'.repeat(64));
    await page.getByRole('button', { name: 'Rejoindre l’entreprise' }).click();

    const alerte = page.getByRole('alert');
    await expect(alerte).toBeVisible({ timeout: 15_000 });
    await expect(alerte).toContainText('inconnu');
    // Ne doit rien dire de l'organisation visée ni de l'existence du code.
    await expect(alerte).not.toContainText(/organisation .+ existe|appartient à/i);
  });

  test('le formulaire de création valide le nom', async ({ page }) => {
    await page.getByRole('link', { name: 'Créer mon entreprise' }).click();
    await expect(page).toHaveURL(/creer-organisation/);

    await page.getByRole('button', { name: 'Créer mon entreprise' }).click();
    await expect(page.getByText('Indiquez le nom de votre entreprise.')).toBeVisible();
  });

  test('le tableau de bord reste inaccessible', async ({ page }) => {
    await page.goto('/tableau-de-bord');
    await expect(page).toHaveURL(/sans-organisation/);
  });
});
