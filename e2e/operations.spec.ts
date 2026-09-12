import { expect, test, type Page } from '@playwright/test';
import { creerDossierEnAttente, type DossierDeTest } from './fixtures';
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

test.describe('Employés — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);
    await page.goto('/employes');
  });

  test('les employés sont listés avec leur rattachement', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Employés actifs' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Modou Ndiaye');
    await expect(liste).toContainText('Toutes stations');
  });

  test('l’écran dit qu’un compte n’est pas nécessaire', async ({ page }) => {
    await expect(page.getByText(/n’a pas besoin d’un compte/)).toBeVisible({ timeout: 15_000 });
  });

  test('le nom est obligatoire, et le refus est visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvel employé' }).click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();

    // Un bouton qui ne fait rien est pire qu'un refus : le message doit sortir.
    await modale.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(modale).toContainText('Le nom est obligatoire');
  });

  test('un employé se crée sans téléphone ni station, puis se désactive', async ({ page }) => {
    const nom = `Test Parcours ${Date.now()}`;
    await page.getByRole('button', { name: 'Nouvel employé' }).click();
    const modale = page.getByRole('dialog');
    await modale.getByLabel('Nom').fill(nom);
    await modale.getByRole('button', { name: 'Enregistrer' }).click();

    const actifs = page.getByRole('list', { name: 'Employés actifs' });
    await expect(actifs).toContainText(nom, { timeout: 15_000 });

    await page.getByRole('button', { name: `Désactiver ${nom}` }).click();
    const inactifs = page.getByRole('list', { name: 'Employés inactifs' });
    await expect(inactifs).toContainText(nom, { timeout: 15_000 });
    // Désactiver n'est pas supprimer : l'historique doit survivre au départ.
    await expect(inactifs).toContainText('son historique est conservé');
  });
});

test.describe('Opérations — propriétaire', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);
    await page.goto('/operations');
  });

  // Même un test en lecture seule monte son propre dossier : il lirait sinon
  // l'état laissé par un test précédent, qui peut l'avoir fait avancer.
  test('une opération non assignée se voit de loin', async ({ page }) => {
    let dossier: DossierDeTest | null = null;
    try {
      dossier = await creerDossierEnAttente();
      await page.reload();

      const liste = page.getByRole('list', { name: 'Opérations — À faire' });
      await expect(liste).toBeVisible({ timeout: 15_000 });
      await expect(liste).toContainText('Lavage complet');
      await expect(liste).toContainText(`N° ${dossier.numero}`);
      await expect(liste).toContainText('Non assignée');
      await expect(liste).toContainText('dossier En attente');

      // « Démarrer » ne peut pas aboutir sans employé : la base le refuse.
      await expect(
        page.getByRole('button', {
          name: new RegExp(`^Démarrer Lavage complet — dossier ${dossier.numero}$`),
        }),
      ).toBeDisabled();
    } finally {
      await dossier?.nettoyer();
    }
  });

  // Ce test fait avancer une opération : il travaille sur son propre dossier,
  // monté par l'API avant l'ouverture de l'écran, et refermé en sortant.
  test('assigner, démarrer, puis remettre à faire', async ({ page }) => {
    let dossier: DossierDeTest | null = null;
    try {
      dossier = await creerDossierEnAttente();
      await page.reload();

      const cible = new RegExp(`Lavage complet — dossier ${dossier.numero}$`);
      await page.getByRole('button', { name: new RegExp(`^Assigner ${cible.source}`) }).click();

      const modale = page.getByRole('dialog');
      await expect(modale).toBeVisible();
      await modale.getByRole('button', { name: /Modou Ndiaye/ }).click();
      await expect(modale).toBeHidden({ timeout: 15_000 });

      const aFaire = page.getByRole('list', { name: 'Opérations — À faire' });
      await expect(aFaire).toContainText('Modou Ndiaye');

      const demarrer = page.getByRole('button', { name: new RegExp(`^Démarrer ${cible.source}`) });
      await expect(demarrer).toBeEnabled();
      await demarrer.click();
      const enCours = page.getByRole('list', { name: 'Opérations — En cours' });
      await expect(enCours).toBeVisible({ timeout: 15_000 });
      // La durée est horodatée par la base : elle apparaît dès le démarrage.
      await expect(enCours).toHaveText(/\d+ min/);
      // Le dossier suit : plus besoin d'aller le dire sur un second écran.
      await expect(enCours).toContainText('dossier En cours');

      // Démarrée par erreur : l'opérateur ne doit pas rester coincé.
      await page
        .getByRole('button', { name: new RegExp(`^Remettre à faire ${cible.source}`) })
        .click();
      await expect(
        page.getByRole('button', { name: new RegExp(`^Démarrer ${cible.source}`) }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await dossier?.nettoyer();
    }
  });
});

test.describe('Opérations — caissier', () => {
  test.skip(!caissier.email || !caissier.motDePasse, 'identifiants absents');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, caissier.email!, caissier.motDePasse!);
    await page.goto('/operations');
  });

  test('le caissier voit le travail mais n’assigne ni n’exécute', async ({ page }) => {
    await expect(page.getByRole('list', { name: /^Opérations/ }).first()).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole('button', { name: /^Assigner / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Réassigner / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Démarrer / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Terminer / })).toHaveCount(0);
  });

  test('l’écran Employés lui est refusé', async ({ page }) => {
    await page.goto('/employes');
    await expect(page).not.toHaveURL(/employes/, { timeout: 15_000 });
  });
});
