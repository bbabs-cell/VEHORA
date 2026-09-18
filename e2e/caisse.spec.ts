import { expect, test, type Page } from '@playwright/test';
import {
  creerDossierPret,
  fermerMesCaisses,
  stationDuProjet,
  type DossierDeTest,
} from './fixtures';
import { installerRelaisReseau } from './relais-reseau';
import { etat } from './session-partagee';

// La caisse est une ressource unique par (station, utilisateur) : deux tests
// qui l'ouvrent en même temps se la ferment mutuellement. La séparation par
// station isole les projets ; ce mode sérialise les tests d'un même projet.
// Sans les deux, l'échec tombe sur un test au hasard.
test.describe.configure({ mode: 'serial' });

const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};

/** Sélectionne la station du projet courant sur l'écran Caisse. */
async function choisirStation(page: Page, projet: string): Promise<void> {
  const selecteur = page.getByLabel('Station');
  await selecteur.waitFor({ timeout: 15_000 });
  const options = await selecteur.locator('option').allTextContents();
  await selecteur.selectOption({ label: options[stationDuProjet(projet)] });
}

test.describe('Caisse', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.beforeEach(async ({ page }, info) => {
    await fermerMesCaisses(stationDuProjet(info.project.name));
    await installerRelaisReseau(page);
    await page.goto('/caisse');
    // Chaque projet travaille sur sa propre station : la caisse est une
    // ressource par (station, utilisateur).
    await choisirStation(page, info.project.name);
  });

  test.afterEach(async ({}, info) => {
    await fermerMesCaisses(stationDuProjet(info.project.name));
  });

  test('sans session, l’écran explique ce que ça empêche', async ({ page }) => {
    await expect(page.getByText('Aucune caisse ouverte')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/aucun paiement en espèces n’est possible/)).toBeVisible();
  });

  test('ouvrir une caisse affiche son fonds et son solde théorique', async ({ page }) => {
    await expect(page.getByLabel(/Fonds de caisse/)).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/Fonds de caisse/).fill('10000');
    await page.getByRole('button', { name: 'Ouvrir la caisse' }).click();

    const session = page.getByRole('region', { name: 'Session de caisse ouverte' });
    await expect(session).toBeVisible({ timeout: 15_000 });
    await expect(session).toHaveText(/Fonds d’ouverture\s*10.000.F.CFA/);
    await expect(session).toHaveText(/Solde théorique\s*10.000.F.CFA/);
  });

  test('un mouvement libre exige un motif, et se voit dans la liste', async ({ page }) => {
    await page.getByLabel(/Fonds de caisse/).fill('10000');
    await page.getByRole('button', { name: 'Ouvrir la caisse' }).click();
    await expect(page.getByRole('region', { name: 'Session de caisse ouverte' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Sortie d’argent' }).click();
    const modale = page.getByRole('dialog');
    await modale.getByLabel(/Montant/).fill('2500');
    await modale.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(modale).toContainText('Le motif est obligatoire');

    await modale.getByLabel('Motif').fill('Achat de savon');
    await modale.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(modale).toBeHidden({ timeout: 15_000 });

    const mouvements = page.getByRole('list', { name: 'Liste des mouvements' });
    await expect(mouvements).toContainText('Achat de savon');
    // Une sortie se lit comme une sortie : montant négatif, pas un signe à décoder.
    await expect(mouvements).toHaveText(/-2.500.F.CFA/);

    const session = page.getByRole('region', { name: 'Session de caisse ouverte' });
    await expect(session).toHaveText(/Solde théorique\s*7.500.F.CFA/);
  });

  test('la clôture calcule l’écart et le montre', async ({ page }) => {
    await page.getByLabel(/Fonds de caisse/).fill('10000');
    await page.getByRole('button', { name: 'Ouvrir la caisse' }).click();
    await expect(page.getByRole('region', { name: 'Session de caisse ouverte' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Clôturer la caisse' }).click();
    const modale = page.getByRole('dialog');
    await expect(modale).toContainText('ne cherchez pas à le faire tomber juste');
    await modale.getByLabel(/Montant compté/).fill('9000');
    await modale.getByRole('button', { name: 'Clôturer' }).click();
    await expect(modale).toBeHidden({ timeout: 15_000 });

    // L'écart est calculé par le serveur et affiché tel quel.
    await expect(page.getByRole('status')).toHaveText(/Écart constaté.*-1.000.F.CFA/);
  });

  // --- Historique (phase 18) ---------------------------------------------
  // Ces tests vivent ici parce que la caisse est une ressource unique par
  // (station, utilisateur) : le fichier qui la possède est celui qui la prend.

  test('une session clôturée se retrouve dans l’historique, avec son écart', async ({
    page,
  }, info) => {
    // Les deux projets tournent en parallèle sur deux stations : « la première
    // carte » désignerait au hasard la session de l'autre. On repère la sienne
    // par sa remarque, unique à cette exécution.
    const remarque = `Billet manquant ${info.project.name} ${Date.now()}`;

    await page.getByLabel(/Fonds de caisse/).fill('10000');
    await page.getByRole('button', { name: 'Ouvrir la caisse' }).click();
    await expect(page.getByRole('region', { name: 'Session de caisse ouverte' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Clôturer la caisse' }).click();
    const modale = page.getByRole('dialog');
    await modale.getByLabel(/Montant compté/).fill('9000');
    await modale.getByLabel(/Remarque/).fill(remarque);
    await modale.getByRole('button', { name: 'Clôturer' }).click();
    await expect(modale).toBeHidden({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Historique des sessions' }).click();
    await expect(page).toHaveURL(/caisse\/historique/);

    const liste = page.getByRole('list', { name: 'Sessions de caisse clôturées' });
    await expect(liste).toBeVisible({ timeout: 20_000 });

    // Ce que l'œil doit voir : un manque, dit en toutes lettres, pas un signe.
    const carte = liste.locator('.carte').filter({ hasText: remarque });
    await expect(carte).toBeVisible({ timeout: 20_000 });
    await expect(carte).toHaveText(/Manque\s*1.000.F.CFA/);
    // Le symbole, jamais le code ISO.
    await expect(carte).not.toContainText('XOF');
    // Théorique et compté sont tous deux affichés : un écart sans ses deux
    // termes n'explique rien.
    await expect(carte).toContainText('Théorique');
    await expect(carte).toContainText('Compté');
  });

  test('une période inversée n’envoie aucune requête', async ({ page }) => {
    let appel = false;
    page.on('request', (r) => {
      if (r.url().includes('cash_register_history')) appel = true;
    });

    await page.goto('/caisse/historique');
    await expect(page.getByRole('heading', { name: 'Historique de caisse' })).toBeVisible({
      timeout: 20_000,
    });

    appel = false;
    await page.getByLabel('Début').fill('2026-12-31');
    await page.getByLabel('Fin').fill('2026-01-01');

    // Une action que le serveur refusera ne s'affiche pas comme possible.
    await expect(page.getByRole('button', { name: 'Actualiser' })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('précède son début');
    expect(appel).toBe(false);
  });
});

test.describe('Encaissement', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.afterEach(async ({}, info) => {
    await fermerMesCaisses(stationDuProjet(info.project.name));
  });

  test('sans caisse ouverte, l’écran refuse les espèces avant le clic', async ({ page }, info) => {
    let dossier: DossierDeTest | null = null;
    const station = stationDuProjet(info.project.name);
    try {
      await fermerMesCaisses(station);
      dossier = await creerDossierPret('Lavage complet', station);
      await installerRelaisReseau(page);
      await page.goto('/file-attente');

      await page.getByRole('button', { name: `Encaisser le dossier ${dossier.numero}` }).click();
      const modale = page.getByRole('dialog');
      await expect(modale).toBeVisible();
      await expect(modale).toContainText('Aucune caisse ouverte à cette station');
      await expect(modale.getByRole('button', { name: 'Enregistrer le paiement' })).toBeDisabled();
    } finally {
      await dossier?.nettoyer();
    }
  });

  test('encaisser en deux fois, et le solde suit', async ({ page }, info) => {
    let dossier: DossierDeTest | null = null;
    const station = stationDuProjet(info.project.name);
    try {
      await fermerMesCaisses(station);
      dossier = await creerDossierPret('Lavage complet', station);
      await installerRelaisReseau(page);

      await page.goto('/caisse');
      await choisirStation(page, info.project.name);
      await page.getByLabel(/Fonds de caisse/).fill('0');
      await page.getByRole('button', { name: 'Ouvrir la caisse' }).click();
      await expect(page.getByRole('region', { name: 'Session de caisse ouverte' })).toBeVisible({
        timeout: 15_000,
      });

      await page.goto('/file-attente');
      await page.getByRole('button', { name: `Encaisser le dossier ${dossier.numero}` }).click();
      const modale = page.getByRole('dialog');
      const etat = modale.getByRole('definition').first();
      await expect(etat).toBeVisible({ timeout: 15_000 });
      await expect(modale).toHaveText(/Reste à payer\s*5.000.F.CFA/);

      await modale.getByLabel(/Montant reçu/).fill('2000');
      await modale.getByRole('button', { name: 'Enregistrer le paiement' }).click();
      await expect(modale).toHaveText(/Reste à payer\s*3.000.F.CFA/, { timeout: 15_000 });

      // Le champ propose le reste : le caissier n'a pas à retaper un montant
      // que l'écran connaît déjà.
      await expect(modale.getByLabel(/Montant reçu/)).toHaveValue('3000');
      // Et la carte derrière la modale n'affiche pas un solde périmé.
      await expect(page.getByRole('list', { name: 'Dossiers — Prêt' })).toContainText('reste 3');

      await modale.getByRole('button', { name: 'Enregistrer le paiement' }).click();
      await expect(modale).toHaveText(/Reste à payer\s*0.F.CFA/, { timeout: 15_000 });

      await modale.getByRole('button', { name: 'Terminer' }).click();
      const liste = page.getByRole('list', { name: 'Dossiers — Prêt' });
      await expect(liste).toContainText('Soldé', { timeout: 15_000 });
    } finally {
      await dossier?.nettoyer();
    }
  });

  test('une modale ouverte fige la page derrière elle', async ({ page }, info) => {
    let dossier: DossierDeTest | null = null;
    try {
      dossier = await creerDossierPret('Lavage complet', stationDuProjet(info.project.name));
      await installerRelaisReseau(page);
      await page.goto('/file-attente');

      await page.getByRole('button', { name: `Encaisser le dossier ${dossier.numero}` }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Sans ce verrou, défiler pendant un encaissement déplace la file
      // derrière, et on la retrouve ailleurs à la fermeture.
      const bloque = await page.evaluate(
        () => getComputedStyle(document.body).overflow === 'hidden',
      );
      expect(bloque).toBe(true);

      await page.getByRole('dialog').getByRole('button', { name: 'Terminer' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();

      const libere = await page.evaluate(
        () => getComputedStyle(document.body).overflow !== 'hidden',
      );
      expect(libere).toBe(true);
    } finally {
      await dossier?.nettoyer();
    }
  });

  test('restituer avec un solde demande un motif avant d’agir', async ({ page }, info) => {
    let dossier: DossierDeTest | null = null;
    try {
      dossier = await creerDossierPret('Lavage complet', stationDuProjet(info.project.name));
      await installerRelaisReseau(page);
      await page.goto('/file-attente');

      const liste = page.getByRole('list', { name: 'Dossiers — Prêt' });
      await expect(liste).toContainText(`reste`, { timeout: 15_000 });

      await page.getByRole('button', { name: `Restituer — dossier ${dossier.numero}` }).click();
      const modale = page.getByRole('dialog');
      await expect(modale).toContainText('part avec une créance, tracée à votre nom');

      await modale.getByRole('button', { name: 'Restituer malgré le solde' }).click();
      await expect(modale).toContainText('Le motif est obligatoire');

      await modale.getByLabel('Motif').fill('Client régulier, règlement vendredi');
      await modale.getByRole('button', { name: 'Restituer malgré le solde' }).click();
      await expect(modale).toBeHidden({ timeout: 15_000 });

      // Restitué : le dossier sort de la file.
      await expect(page.getByText(`N° ${dossier.numero}`)).toHaveCount(0);
    } finally {
      // Le dossier est restitué, donc terminal : rien à nettoyer.
    }
  });

  test('un remboursement demande son motif dans un formulaire, pas dans une boîte du navigateur', async ({
    page,
  }, info) => {
    const station = stationDuProjet(info.project.name);
    let dossier: DossierDeTest | null = null;

    try {
      await fermerMesCaisses(station);
      dossier = await creerDossierPret('Lavage complet', station);
      await installerRelaisReseau(page);

      // Une caisse ouverte, puis un encaissement : il faut un paiement pour
      // pouvoir en rembourser un.
      await page.goto('/caisse');
      await choisirStation(page, info.project.name);
      await page.getByLabel(/Fonds de caisse/).fill('0');
      await page.getByRole('button', { name: 'Ouvrir la caisse' }).click();
      await expect(page.getByRole('region', { name: 'Session de caisse ouverte' })).toBeVisible({
        timeout: 15_000,
      });

      await page.goto('/file-attente');
      await page.getByRole('button', { name: `Encaisser le dossier ${dossier.numero}` }).click();
      const encaissement = page.getByRole('dialog');
      await encaissement.getByLabel(/Montant reçu/).fill('1000');
      await encaissement.getByRole('button', { name: 'Enregistrer le paiement' }).click();
      await expect(encaissement).toContainText(/Reste à payer/, { timeout: 15_000 });

      await encaissement
        .getByRole('button', { name: /^Rembourser/ })
        .first()
        .click();

      const remboursement = page.getByRole('dialog', { name: 'Rembourser un paiement' });
      await expect(remboursement).toBeVisible();

      // Sans motif, rien ne part : le message est attaché au champ.
      await remboursement.getByRole('button', { name: 'Rembourser' }).click();
      await expect(remboursement.getByRole('alert')).toContainText('motif');

      await remboursement.getByLabel('Motif').fill('Test de parcours automatisé');
      await remboursement.getByRole('button', { name: 'Rembourser' }).click();
      await expect(remboursement).toBeHidden({ timeout: 20_000 });
    } finally {
      await fermerMesCaisses(station);
      await dossier?.nettoyer();
    }
  });
});
