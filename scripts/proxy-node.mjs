// Node 24 n'achemine `fetch` par le proxy de l'environnement que si on le lui
// demande explicitement : `HTTPS_PROXY` seul ne suffit plus depuis que `fetch`
// est natif (undici ignore les variables d'environnement par défaut).
//
// Sans ce drapeau, en environnement cloud, toute connexion Supabase depuis Node
// échoue avec un « Service Unavailable » 503 émis par le proxy — un message qui
// désigne Supabase alors que Supabase va très bien. Une demi-journée perdue.
//
// À importer en tout premier dans chaque script Node qui parle au réseau.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  process.env.NODE_USE_ENV_PROXY = '1';
}
