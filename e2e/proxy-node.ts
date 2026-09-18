/**
 * Garde-fou pour l'environnement cloud.
 *
 * Depuis que `fetch` est natif, Node n'achemine plus les requêtes par le proxy
 * de l'environnement sans `NODE_USE_ENV_PROXY`, et il lit cette variable au
 * démarrage du processus. La poser depuis la configuration Playwright ou
 * depuis un module de test arrive trop tard.
 *
 * Quand elle manque, toute connexion Supabase depuis Node échoue avec un
 * « Service Unavailable » 503 émis par le proxy : un message qui accuse
 * Supabase alors que Supabase répond parfaitement. Une demi-journée perdue à
 * chercher une panne qui n'existait pas — d'où cette vérification, qui nomme
 * la cause au lieu de la laisser deviner.
 *
 * `npm run e2e` pose la variable ; `npx playwright test` ne la pose pas.
 */
if (process.env['HTTPS_PROXY'] && !process.env['NODE_USE_ENV_PROXY']) {
  throw new Error(
    'Proxy sortant détecté (HTTPS_PROXY) sans NODE_USE_ENV_PROXY : les appels ' +
      'Supabase depuis Node échoueraient en « Service Unavailable ». ' +
      'Lancez « npm run e2e » plutôt que « npx playwright test ».',
  );
}
