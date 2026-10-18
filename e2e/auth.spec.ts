import { expect, test, type Locator } from '@playwright/test';
import { installerRelaisReseau } from './relais-reseau';

test.describe('Authentification', () => {
  test.beforeEach(async ({ page }) => {
    await installerRelaisReseau(page);
  });

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

    // Pas de longueur minimale à la connexion : c'est Supabase qui la fixe à la
    // création du compte, et un compte de 6 caractères doit pouvoir entrer.
    await page.getByLabel('Adresse e-mail').fill('pas-un-email');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible();
    await expect(page.getByText('Saisissez votre mot de passe.')).toBeVisible();
    expect(appelReseau).toBe(false);
  });

  test('des identifiants invalides affichent une erreur sans révéler le compte', async ({
    page,
  }) => {
    await page.goto('/connexion');
    await page.getByLabel('Adresse e-mail').fill('inconnu@vehora.test');
    await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse-invalide');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    const alerte = page.getByRole('alert');
    await expect(alerte).toBeVisible({ timeout: 15_000 });
    // Le serveur a bien répondu : ce n'est pas une erreur réseau déguisée.
    await expect(alerte).toContainText('Identifiants incorrects');
    // Le message ne doit pas distinguer « compte inexistant » de « mot de passe faux ».
    await expect(alerte).not.toContainText(/n'existe pas|inconnu|introuvable/i);
  });

  test('les cibles tactiles respectent le minimum de 44px', async ({ page }) => {
    await page.goto('/connexion');
    // Taille de mise en page, pas `boundingBox()` : la carte entre avec un
    // zoom (scale 0,96), et la boîte mesurée pendant l'animation donnait
    // 42,24 px pour un champ de 44 — rouge depuis la phase 24.
    const taille = (cible: Locator) =>
      cible.evaluate((el: HTMLElement) => ({ l: el.offsetWidth, h: el.offsetHeight }));
    for (const nom of ['Adresse e-mail', 'Mot de passe']) {
      // Exact : « Afficher le mot de passe » contient aussi « Mot de passe ».
      expect((await taille(page.getByLabel(nom, { exact: true }))).h).toBeGreaterThanOrEqual(44);
    }
    for (const nom of ['Se connecter', 'Afficher le mot de passe']) {
      const { l, h } = await taille(page.getByRole('button', { name: nom }));
      expect(h).toBeGreaterThanOrEqual(44);
      expect(l).toBeGreaterThanOrEqual(44);
    }
  });

  // Sur un clavier AZERTY, les chiffres demandent Maj : sans voir ce qu'on
  // tape, la connexion est refusée sans qu'on sache pourquoi.
  test("le mot de passe s'affiche et se masque sans perdre la saisie", async ({ page }) => {
    await page.goto('/connexion');
    const champ = page.getByLabel('Mot de passe', { exact: true });
    await champ.fill('Liberte6-2026!');
    await expect(champ).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Afficher le mot de passe' }).click();
    await expect(champ).toHaveAttribute('type', 'text');
    const masquer = page.getByRole('button', { name: 'Masquer le mot de passe' });
    await expect(masquer).toHaveText('Masquer');

    await masquer.click();
    await expect(champ).toHaveAttribute('type', 'password');
    await expect(champ).toHaveValue('Liberte6-2026!');

    // Le bouton est un « button » : il ne soumet pas le formulaire.
    await expect(page.getByText('Saisissez votre mot de passe.')).toHaveCount(0);
    await expect(page.getByText('Saisissez une adresse e-mail valide.')).toHaveCount(0);
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

    // On cherche une CLÉ, pas un MOT. La première version cherchait la chaîne
    // « service_role » et tombait sur le commentaire d'`environment.ts` qui dit
    // justement que cette clé ne doit jamais s'y trouver : le test trouvait sa
    // propre documentation, en silence tant qu'un hasard de chargement le lui
    // épargnait, puis en rouge dès que l'intégration continue a servi le bundle
    // à froid. Un garde-fou qui crie au loup discrédite les autres.
    //
    // Deuxième occurrence : supabase-js contient lui-même le préfixe
    // (`key.startsWith('sb_secret_')`, pour reconnaître le format). Une clé,
    // c'est le préfixe SUIVI de ses caractères. Et le message ne cite que ce
    // qu'on a trouvé : `expect(tout)` imprimait tout le JavaScript servi
    // (plusieurs Mo) dans le journal de l'intégration continue.
    const secrets = tout.match(/sb_secret_[A-Za-z0-9_-]{20,}/g) ?? [];
    expect(secrets, 'une clé secrète est servie au navigateur').toEqual([]);

    // Une clé `service_role` est un JWT dont la charge utile porte ce rôle.
    // On les décode tous plutôt que de chercher un mot quelque part.
    const jetons = tout.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g) ?? [];
    const privilegies = jetons.filter((jeton) => {
      try {
        const charge = Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8');
        return /"role"\s*:\s*"(service_role|supabase_admin)"/.test(charge);
      } catch {
        return false;
      }
    });
    expect(privilegies, 'un jeton privilégié est servi au navigateur').toEqual([]);
  });
});
