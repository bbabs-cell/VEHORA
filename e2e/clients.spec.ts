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

// ---------------------------------------------------------------------------
// 1. Utilisateur autorisé
// ---------------------------------------------------------------------------
test.describe('Clients — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);
    await page.goto('/clients');
  });

  test('la liste affiche les clients existants', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Liste des clients' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Moussa Diallo');
  });

  test('les numéros s’affichent tous sous la même forme', async ({ page }) => {
    // Saisis différemment, ils doivent se lire pareil : sinon l'œil ne peut
    // plus parcourir la colonne.
    const liste = page.getByRole('list', { name: 'Liste des clients' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    const numeros = await liste.locator('.carte__detail').allInnerTexts();
    for (const numero of numeros) {
      const affiche = numero.split('·')[0].trim();
      expect(affiche).toMatch(/^\+\d{3} \d{2}( \d{2,3})+$/);
      // Aucun chiffre isolé en fin de ligne : cela se lit comme une faute.
      expect(affiche).not.toMatch(/ \d$/);
    }
  });

  test('la recherche tolère l’orthographe approximative', async ({ page }) => {
    // « Mousa » doit retrouver « Moussa » : l'orthographe des noms varie.
    await page.getByLabel('Rechercher un client').fill('Mousa');
    const liste = page.getByRole('list', { name: 'Liste des clients' });
    await expect(liste).toContainText('Moussa Diallo', { timeout: 15_000 });
    await expect(liste).not.toContainText('Cheikh Sy');
  });

  test('la recherche par numéro fonctionne', async ({ page }) => {
    await page.getByLabel('Rechercher un client').fill('771234');
    const liste = page.getByRole('list', { name: 'Liste des clients' });
    await expect(liste).toContainText('Moussa Diallo', { timeout: 15_000 });
  });

  test('une recherche sans résultat propose de créer la fiche', async ({ page }) => {
    await page.getByLabel('Rechercher un client').fill('zzzzintrouvable');
    await expect(page.getByText('Aucun résultat')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Créer ce client' })).toBeVisible();
  });

  test('un numéro déjà utilisé est refusé, quelle que soit l’écriture', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau client' }).click();
    await page.getByLabel('Nom du client').fill('Doublon involontaire');
    // Même numéro que Moussa Diallo, écrit sans indicatif.
    await page.getByLabel('Téléphone').fill('77 123 45 67');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByRole('alert')).toContainText('existe déjà avec ce numéro', {
      timeout: 15_000,
    });
  });

  test('création puis archivage d’un client', async ({ page }, infos) => {
    const suffixe = `${infos.project.name}${Date.now() % 100000}`;
    const nom = `Client test ${suffixe}`;

    await page.getByRole('button', { name: 'Nouveau client' }).click();
    await page.getByLabel('Nom du client').fill(nom);
    await page.getByLabel('Téléphone').fill(`76${suffixe.replace(/\D/g, '').padStart(7, '0')}`);
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    const carte = page.locator('.carte').filter({ hasText: nom });
    await expect(carte).toBeVisible({ timeout: 15_000 });

    page.once('dialog', (d) => void d.accept());
    await carte.getByRole('button', { name: `Archiver ${nom}` }).click();
    await expect(carte).toHaveCount(0, { timeout: 15_000 });
  });

  test('le nom est obligatoire, sans appel réseau inutile', async ({ page }) => {
    let appel = false;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/rest/v1/customers')) appel = true;
    });

    await page.getByRole('button', { name: 'Nouveau client' }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Le nom comporte entre 2 et 120 caractères.')).toBeVisible();
    expect(appel).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Lecture seule
// ---------------------------------------------------------------------------
test.describe('Clients — caissier en lecture seule', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants caissier absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, caissier.email!, caissier.motDePasse!);
    await page.goto('/clients');
  });

  test('il voit les clients mais aucune action d’écriture', async ({ page }) => {
    // `customers.read` sans `customers.write` : la lecture est un besoin réel
    // au comptoir, l'écriture ne l'est pas.
    const liste = page.getByRole('list', { name: 'Liste des clients' });
    await expect(liste).toContainText('Moussa Diallo', { timeout: 15_000 });

    await expect(page.getByRole('button', { name: 'Nouveau client' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Modifier / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Archiver / })).toHaveCount(0);
  });

  test('il peut quand même rechercher', async ({ page }) => {
    await page.getByLabel('Rechercher un client').fill('Cheikh');
    const liste = page.getByRole('list', { name: 'Liste des clients' });
    await expect(liste).toContainText('Cheikh Sy', { timeout: 15_000 });
  });
});
