import { expect, test } from '@playwright/test';
import { creerDossierArrive, type DossierDeTest } from './fixtures';
import { installerRelaisReseau } from './relais-reseau';
import { etat } from './session-partagee';

const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};
const caissier = {
  email: process.env['VEHORA_TEST_EMAIL_CAISSIER'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD_CAISSIER'],
};

test.describe('File d’attente — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/file-attente');
  });

  // Aucun numéro n'est codé en dur : les numéros avancent à chaque dossier
  // ouvert, et un test qui en épingle un finit par décrire l'historique plutôt
  // que le produit.
  test('la file affiche numéro, plaque, attente et montant', async ({ page }) => {
    let dossier: DossierDeTest | null = null;
    try {
      dossier = await creerDossierArrive();
      await page.reload();

      const liste = page.getByRole('list', { name: 'Dossiers — Arrivé' });
      await expect(liste).toBeVisible({ timeout: 15_000 });
      await expect(liste).toContainText(`N° ${dossier.numero}`);
      await expect(liste).toContainText('DK-1234-A');
      // L'attente est ce que l'exploitant regarde en premier.
      await expect(liste).toHaveText(/arrivé il y a \d+ min/);
      // Le montant est formaté en francs, jamais en chiffres bruts.
      await expect(liste).toHaveText(/5.000.F.CFA/);
    } finally {
      await dossier?.nettoyer();
    }
  });

  test('un dossier sans prestation est signalé, pas laissé à deviner', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Dossiers — Arrivé' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Aucune prestation');
  });

  test('une prestation sans tarif est proposée mais inerte, avec sa raison', async ({ page }) => {
    let dossier: DossierDeTest | null = null;
    try {
      dossier = await creerDossierArrive();
      await page.reload();

      await page.getByRole('button', { name: `Prestations du dossier ${dossier.numero}` }).click();
      const modale = page.getByRole('dialog');
      const sansTarif = modale.getByRole('button', { name: /Aspiration intérieur/ });
      await expect(sansTarif).toBeVisible();
      await expect(sansTarif).toBeDisabled();
      await expect(sansTarif).toContainText('sans tarif');

      await expect(modale.getByRole('button', { name: /^Lavage extérieur/ })).toBeEnabled();
    } finally {
      await dossier?.nettoyer();
    }
  });

  test('le contenu d’un dossier montre ses lignes et son total', async ({ page }) => {
    let dossier: DossierDeTest | null = null;
    try {
      dossier = await creerDossierArrive();
      await page.reload();

      await page.getByRole('button', { name: `Prestations du dossier ${dossier.numero}` }).click();
      const modale = page.getByRole('dialog');
      await expect(modale).toBeVisible();
      await expect(modale).toContainText('Lavage complet');
      await expect(modale).toHaveText(/Total\s*5.000.F.CFA/);
    } finally {
      await dossier?.nettoyer();
    }
  });

  test('ouvrir un dossier exige de choisir un véhicule', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau dossier' }).click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();

    // La station est préremplie : un champ obligatoire venu du réseau ne doit
    // jamais rester vide, sinon le formulaire échoue en silence.
    await expect(modale.getByLabel('Station')).not.toHaveValue('');

    await modale.getByRole('button', { name: 'Ouvrir le dossier' }).click();
    await expect(modale).toContainText('Choisissez le véhicule concerné');
  });

  test('la recherche de véhicule propose des résultats cliquables', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau dossier' }).click();
    const modale = page.getByRole('dialog');
    await modale.getByLabel('Véhicule').fill('dk1234');

    const suggestions = modale.getByRole('list', { name: 'Véhicules trouvés' });
    await expect(suggestions).toBeVisible({ timeout: 15_000 });
    await suggestions.getByRole('button').first().click();

    await expect(modale).toContainText('DK-1234-A');
    await expect(modale.getByRole('button', { name: 'Changer' })).toBeVisible();
  });

  test('annuler exige un motif, et le dit avant d’agir', async ({ page }) => {
    await page
      .getByRole('button', { name: /^Annuler le dossier \d/ })
      .last()
      .click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();
    await expect(modale).toContainText('définitive');

    await modale.getByRole('button', { name: 'Annuler le dossier' }).click();
    await expect(modale).toContainText('Le motif est obligatoire');
  });

  // Ce test fait avancer un dossier : il travaille donc sur le sien, créé pour
  // l'occasion. Un test qui déplace un dossier que d'autres tests lisent les
  // fait échouer selon l'ordre d'exécution — et ce sont alors les tests qu'on
  // soupçonne, pas le produit.
  test('le parcours arrivée → inspection → attente est refusé sans inspection', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Nouveau dossier' }).click();
    const ouverture = page.getByRole('dialog');
    await ouverture.getByLabel('Véhicule').fill('dk1234');
    await ouverture
      .getByRole('list', { name: 'Véhicules trouvés' })
      .getByRole('button')
      .first()
      .click();
    await ouverture.getByRole('button', { name: 'Ouvrir le dossier' }).click();

    // L'écran enchaîne sur les prestations : on les ferme pour revenir à la file.
    const prestations = page.getByRole('dialog');
    await expect(prestations).toContainText('Dossier n°', { timeout: 15_000 });
    const titre = (await prestations.getByRole('heading').first().textContent()) ?? '';
    const numero = titre.match(/n°\s*(\d+)/)?.[1];
    expect(numero).toBeTruthy();
    await prestations.getByRole('button', { name: 'Terminé' }).click();

    await page.getByRole('button', { name: `Inspecter — dossier ${numero}` }).click();
    const enInspection = page.getByRole('list', { name: 'Dossiers — Inspection' });
    await expect(enInspection).toBeVisible({ timeout: 15_000 });
    // Le dossier a changé de groupe : c'est le signe visible de la transition.
    await expect(enInspection).toContainText(`N° ${numero}`);

    await page.getByRole('button', { name: `Mettre en attente — dossier ${numero}` }).click();
    await expect(page.getByRole('alert')).toContainText('Enregistrez l’inspection');

    // On laisse la file propre : le dossier de test est annulé.
    await page.getByRole('button', { name: `Annuler le dossier ${numero}` }).click();
    const annulation = page.getByRole('dialog');
    await annulation.getByLabel('Motif').fill('Dossier de test de parcours');
    await annulation.getByRole('button', { name: 'Annuler le dossier' }).click();
    await expect(annulation).toBeHidden({ timeout: 15_000 });
  });

  test('la page ne défile pas horizontalement', async ({ page }) => {
    await expect(page.getByRole('list', { name: /^Dossiers/ }).first()).toBeVisible({
      timeout: 15_000,
    });
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(debordement).toBe(false);
  });
});

test.describe('File d’attente — caissier', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('caissier') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/file-attente');
  });

  test('le caissier voit la file mais n’ouvre ni n’annule de dossier', async ({ page }) => {
    await expect(page.getByRole('list', { name: /^Dossiers/ }).first()).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole('button', { name: 'Nouveau dossier' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Annuler le dossier \d/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Prestations du dossier/ })).toHaveCount(0);
  });
});
