import { expect, test } from '@playwright/test';
import { connecterApi, creerDossierArrive, stationDuProjet } from './fixtures';
import { installerRelaisReseau } from './relais-reseau';
import { etat } from './session-partagee';

// Chaque test crée son dossier et le referme : aucun ne dépend de l'état laissé
// par un autre, et aucun n'épingle un numéro de reçu — la numérotation avance.
const proprietaire = {
  email: process.env['VEHORA_TEST_EMAIL'],
  motDePasse: process.env['VEHORA_TEST_PASSWORD'],
};

test.describe('Reçus', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test('un dossier facturable donne un reçu numéroté et imprimable', async ({ page }, info) => {
    const dossier = await creerDossierArrive('Lavage complet', stationDuProjet(info.project.name));
    try {
      await installerRelaisReseau(page);
      await page.goto('/file-attente');

      const carte = page.locator('.dossier', { hasText: `N° ${dossier.numero}` });
      await expect(carte).toBeVisible({ timeout: 20_000 });
      await carte
        .getByRole('button', { name: `Émettre le reçu du dossier ${dossier.numero}` })
        .click();

      await expect(page).toHaveURL(/\/recus\//, { timeout: 20_000 });
      // Ce que l'œil doit voir : un numéro, le dossier, un total, et le fait
      // que le document ne se modifie pas.
      await expect(page.getByText(/Reçu n° \d+/)).toBeVisible();
      await expect(page.getByText(`n° ${dossier.numero}`)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Imprimer' })).toBeVisible();
      await expect(
        page.getByText('Toute correction donne lieu à un nouveau reçu', { exact: false }),
      ).toBeVisible();
      // Le symbole, jamais le code ISO.
      await expect(page.locator('.total')).not.toContainText('XOF');
    } finally {
      await dossier.nettoyer();
    }
  });

  test('un dossier sans prestation ne propose pas de reçu', async ({ page }, info) => {
    const api = await connecterApi();
    const { data: stations } = await api.from('stations').select('id').order('name');
    const station = stations![stationDuProjet(info.project.name)] ?? stations![0];
    const { data: vehicule } = await api
      .from('vehicles')
      .select('id')
      .is('archived_at', null)
      .limit(1)
      .single();
    const { data: dossier } = await api
      .from('service_orders')
      .insert({ station_id: station!.id, vehicle_id: vehicule!.id })
      .select('id, number')
      .single();

    try {
      await installerRelaisReseau(page);
      await page.goto('/file-attente');

      const carte = page.locator('.dossier', { hasText: `N° ${dossier!.number}` });
      await expect(carte).toBeVisible({ timeout: 20_000 });
      // Une action que le serveur refusera ne s'affiche pas comme possible.
      await expect(
        carte.getByRole('button', { name: `Émettre le reçu du dossier ${dossier!.number}` }),
      ).toHaveCount(0);
    } finally {
      await api.rpc('transitionner_dossier', {
        p_service_order_id: dossier!.id,
        p_to_status: 'CANCELLED',
        p_reason: 'Dossier de test automatisé',
      });
    }
  });
});

test.describe('Rapports', () => {
  test.skip(!proprietaire.email || !proprietaire.motDePasse, 'identifiants absents');
  test.use({ storageState: etat('proprietaire') });

  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
    await page.goto('/rapports');
  });

  test('la période est lisible en toutes lettres, pas seulement dans le champ', async ({
    page,
  }) => {
    // Un `<input type="date">` s'affiche dans la locale de l'appareil : la
    // période retenue est donc aussi écrite à côté.
    await expect(page.getByText(/Période retenue : du .* au .*/)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('une période inversée désactive le bouton et dit pourquoi', async ({ page }) => {
    await page.getByLabel('Début').fill('2026-09-30');
    await page.getByLabel('Fin').fill('2026-09-01');

    await expect(page.getByRole('button', { name: 'Actualiser' })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('précède son début');
  });

  test('les totaux de la période sont affichés', async ({ page }) => {
    await expect(page.getByRole('region', { name: 'Totaux de la période' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Encaissé', { exact: true }).first()).toBeVisible();
  });
});
