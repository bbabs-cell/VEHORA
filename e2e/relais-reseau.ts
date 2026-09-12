import type { Page } from '@playwright/test';

/**
 * Relais réseau pour l'environnement cloud.
 *
 * Le proxy sortant du bac à sable ferme le tunnel en cours d'échange lorsque
 * c'est le navigateur qui l'emprunte (`ERR_CONNECTION_RESET`), alors que la
 * même requête aboutit depuis Node. Ce n'est pas un défaut de l'application.
 *
 * On intercepte donc les appels vers Supabase et on les rejoue depuis Node,
 * qui respecte la configuration du proxy. L'application reste inchangée : elle
 * émet les mêmes requêtes vers le vrai backend et reçoit les vraies réponses.
 *
 * En local, où le navigateur sort directement, ce relais n'est pas installé.
 */
export async function installerRelaisReseau(page: Page): Promise<void> {
  if (!process.env['HTTPS_PROXY']) return;

  await page.route('**/*.supabase.co/**', async (route) => {
    const requete = route.request();
    try {
      const reponse = await fetch(requete.url(), {
        method: requete.method(),
        headers: requete.headers(),
        body: requete.postData() ?? undefined,
      });
      await route.fulfill({
        status: reponse.status,
        headers: Object.fromEntries(reponse.headers.entries()),
        body: Buffer.from(await reponse.arrayBuffer()),
      });
    } catch (erreur) {
      await route.abort('failed');
      throw erreur;
    }
  });
}
