import { expect, test, type Page } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';

// Suspendre change l'état d'une organisation : chaque projet travaille sur la
// sienne, et les tests d'un même projet s'enchaînent. Les deux sont
// nécessaires — la leçon de la caisse, appliquée d'emblée.
test.describe.configure({ mode: 'serial' });

/** L'organisation de test dédiée au projet courant. */
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
  // Sans cette attente, le `goto` suivant part pendant la connexion et tombe
  // sur une redirection en cours.
  await page.waitForURL(/plateforme|tableau-de-bord/, { timeout: 20_000 });
}

test.describe('Espace plateforme — Super Admin', () => {
  test.skip(!admin.motDePasse, 'mot de passe de plateforme absent');

  test.beforeEach(async ({ page }) => {
    await seConnecter(page, admin.email, admin.motDePasse!);
    await page.goto('/plateforme/organisations');
  });

  test('la coquille dit en permanence qu’on est côté plateforme', async ({ page }) => {
    const bandeau = page.getByRole('banner');
    await expect(bandeau).toBeVisible({ timeout: 15_000 });
    await expect(bandeau).toContainText('Espace plateforme');
    await expect(bandeau).toContainText(admin.email);

    // La mention qui dit où l'on se trouve ne doit pas être recouverte par la
    // navigation : sur mobile, elles se chevauchaient.
    const espace = bandeau.getByText('Espace plateforme');
    const lien = bandeau.getByRole('link', { name: 'Organisations' });
    const [a, b] = [await espace.boundingBox(), await lien.boundingBox()];
    const chevauche =
      a!.x < b!.x + b!.width && b!.x < a!.x + a!.width &&
      a!.y < b!.y + b!.height && b!.y < a!.y + a!.height;
    expect(chevauche).toBe(false);

    // Rien de la navigation cliente ne doit apparaître ici.
    await expect(page.getByRole('link', { name: 'File d’attente' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Caisse' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Clients' })).toHaveCount(0);
  });

  test('la liste montre des volumes, jamais un montant', async ({ page }) => {
    const liste = page.getByRole('list', { name: 'Organisations clientes' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Station Awa');
    await expect(liste).toContainText('Stations');
    await expect(liste).toContainText('Dossiers 30 j');

    // Un intitulé tronqué fait douter de ce qu'on lit : on vérifie qu'il tient
    // dans sa colonne, pas seulement qu'il est présent dans le DOM.
    const intitule = liste.getByText('Dossiers 30 j').first();
    const tronque = await intitule.evaluate((e) => e.scrollWidth > e.clientWidth + 1);
    expect(tronque).toBe(false);

    // Et aucune organisation ne doit afficher « dernière activité aucune activité ».
    await expect(liste).not.toContainText('dernière activité aucune');

    // Aucun chiffre d'affaires : la plateforme sait si un client est vivant,
    // pas combien il gagne.
    await expect(liste).not.toContainText('F CFA');
    await expect(liste).not.toContainText('Total');
  });

  test('la recherche filtre la liste', async ({ page }, info) => {
    const liste = page.getByRole('list', { name: 'Organisations clientes' });
    await expect(liste).toBeVisible({ timeout: 15_000 });

    const cible = organisationDuProjet(info.project.name);
    await page.getByLabel('Rechercher une organisation').fill(cible);
    await expect(liste).not.toContainText('Station Awa');
    await expect(liste).toContainText(cible);
  });

  test('suspendre annonce la conséquence et exige un motif', async ({ page }, info) => {
    const liste = page.getByRole('list', { name: 'Organisations clientes' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Rechercher une organisation').fill(organisationDuProjet(info.project.name));

    await page.getByRole('button', { name: /^Suspendre / }).click();
    const modale = page.getByRole('dialog');
    await expect(modale).toBeVisible();
    // La phrase est accordée et sensée, même à zéro membre : « 0 personne
    // perdront l'accès » est un message qu'on ne doit jamais lire.
    await expect(modale).toHaveText(
      /(Aucun membre actif ne perdra|1 personne perdra|\d+ personnes perdront) l’accès/,
    );
    await expect(modale).not.toContainText('0 personne');
    await expect(modale).toContainText('Aucune donnée n’est supprimée');

    await modale.getByRole('button', { name: 'Suspendre', exact: true }).click();
    await expect(modale).toContainText('Le motif est obligatoire');

    await modale.getByLabel('Motif').fill(`Test de parcours ${info.project.name} — suspension`);
    await modale.getByRole('button', { name: 'Suspendre', exact: true }).click();
    await expect(modale).toBeHidden({ timeout: 15_000 });

    await expect(liste).toContainText('Suspendue');
    // Le compteur est global à la plateforme : l'autre projet peut en avoir
    // suspendu une aussi. On vérifie qu'il compte, pas qu'il compte « 1 ».
    await expect(page.getByText(/\d+ suspendue/)).toBeVisible();
  });

  test('le journal montre l’action, son auteur et son motif', async ({ page }, info) => {
    await page.goto('/plateforme/journal');
    const liste = page.getByRole('list', { name: 'Actions de plateforme' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText('Suspension');
    await expect(liste).toContainText(`Test de parcours ${info.project.name} — suspension`);
    await expect(liste).toContainText('Équipe VEHORA');
  });

  test('réactiver rend l’accès, et laisse sa trace', async ({ page }, info) => {
    const liste = page.getByRole('list', { name: 'Organisations clientes' });
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Rechercher une organisation').fill(organisationDuProjet(info.project.name));

    await page.getByRole('button', { name: /^Réactiver / }).click();
    const modale = page.getByRole('dialog');
    await modale.getByLabel('Motif').fill(`Test de parcours ${info.project.name} — réactivation`);
    await modale.getByRole('button', { name: 'Réactiver', exact: true }).click();
    await expect(modale).toBeHidden({ timeout: 15_000 });

    await expect(liste).not.toContainText('Suspendue');

    await page.goto('/plateforme/journal');
    await expect(page.getByRole('list', { name: 'Actions de plateforme' })).toContainText(
      'Réactivation',
    );
  });

  test('le Super Admin est renvoyé s’il tente l’espace client', async ({ page }) => {
    await page.goto('/file-attente');
    await expect(page).toHaveURL(/plateforme/, { timeout: 15_000 });
  });
});

test.describe('Espace plateforme — compte client', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');

  test('un client ne peut pas entrer dans l’espace plateforme', async ({ page }) => {
    await seConnecter(page, proprietaire.email!, proprietaire.motDePasse!);
    await expect(page).toHaveURL(/tableau-de-bord/, { timeout: 20_000 });

    await page.goto('/plateforme/organisations');
    await expect(page).not.toHaveURL(/plateforme/, { timeout: 15_000 });
    await expect(page.getByText('Espace plateforme')).toHaveCount(0);
  });
});
