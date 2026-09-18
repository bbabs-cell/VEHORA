import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { installerRelaisReseau } from './relais-reseau';
import { DESTINATION, fichierEtat, identifiants, type Role } from './session-partagee';

const ROLES: readonly Role[] = ['proprietaire', 'caissier', 'admin', 'sans-org'];

/**
 * Une connexion par rôle, avant la suite.
 *
 * Les états enregistrés sont effacés à chaque exécution : un jeton périmé
 * réutilisé silencieusement ferait échouer des tests pour une raison qui n'a
 * rien à voir avec ce qu'ils vérifient.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const dossier = path.join(process.cwd(), 'e2e', '.etats');
  rmSync(dossier, { recursive: true, force: true });
  mkdirSync(dossier, { recursive: true });

  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:4280';
  const proxy = process.env['HTTPS_PROXY'];
  const navigateur = await chromium.launch({
    executablePath: process.env['VEHORA_CHROMIUM'] ?? undefined,
    ...(proxy
      ? { args: [`--proxy-server=${proxy}`, '--proxy-bypass-list=localhost;127.0.0.1;[::1]'] }
      : {}),
  });

  try {
    for (const role of ROLES) {
      const { email, motDePasse } = identifiants(role);
      if (!email || !motDePasse) continue; // Rôle sans identifiants : ses tests s'ignoreront.

      const contexte = await navigateur.newContext({
        baseURL,
        ignoreHTTPSErrors: Boolean(proxy),
      });
      const page = await contexte.newPage();
      await installerRelaisReseau(page);

      await page.goto('/connexion');
      await page.getByLabel('Adresse e-mail').fill(email);
      await page.getByLabel('Mot de passe').fill(motDePasse);
      await page.getByRole('button', { name: 'Se connecter' }).click();

      try {
        await page.waitForURL(DESTINATION[role], { timeout: 45_000 });
      } catch {
        // Sans ce message, l'échec ne dit ni quel rôle a échoué ni pourquoi :
        // on relit l'erreur affichée à l'écran, qui elle le dit (identifiants,
        // limite d'authentification, réseau).
        const alerte = await page
          .getByRole('alert')
          .first()
          .textContent()
          .catch(() => null);
        throw new Error(
          `connexion de préparation impossible pour « ${role} » (${email}) : ` +
            `${alerte?.trim() ?? `page restée sur ${page.url()}`}`,
        );
      }

      await contexte.storageState({ path: fichierEtat(role) });
      await contexte.close();
    }
  } finally {
    await navigateur.close();
  }
}
