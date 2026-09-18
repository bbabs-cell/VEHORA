// Lanceur des tests de parcours.
//
// Il n'existe que pour une raison : Node 24 lit `NODE_USE_ENV_PROXY` au
// démarrage du processus, et sans ce drapeau `fetch` ignore le proxy sortant
// de l'environnement cloud. Toute connexion Supabase depuis Node échoue alors
// avec un « Service Unavailable » 503 émis par le proxy — un message qui
// accuse Supabase alors que Supabase répond parfaitement.
//
// Le poser depuis la configuration Playwright ou depuis un module de test
// arrive trop tard : le processus est déjà démarré. On relance donc Playwright
// dans un processus fils qui naît avec la bonne variable. En local, sans
// proxy, rien ne change.
import { spawn } from 'node:child_process';

const environnement = { ...process.env };
if (environnement.HTTPS_PROXY && !environnement.NODE_USE_ENV_PROXY) {
  environnement.NODE_USE_ENV_PROXY = '1';
}

const fils = spawn(
  'npx',
  ['playwright', 'test', ...process.argv.slice(2)],
  { stdio: 'inherit', env: environnement, shell: process.platform === 'win32' },
);
fils.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
