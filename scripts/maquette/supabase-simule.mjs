// Supabase simulé, côté navigateur, pour le banc de vérification visuelle.
//
// Playwright intercepte chaque appel vers le projet Supabase et y répond avec
// `donnees.mjs` — en appliquant les filtres PostgREST courants (eq, in, not…),
// pour que la file d'attente ne montre pas les dossiers restitués et qu'un
// encaissement lise les paiements de SON dossier. Les écritures répondent
// « fait » sans rien changer : le banc regarde des écrans, il ne teste pas les
// règles — ça, c'est le travail de `validate:sql` et des tests de parcours.
//
// Une session factice est posée dans le stockage local AVANT le démarrage :
// supabase-js la lit comme une session réelle. Le jeton n'est pas signé, et
// c'est sans conséquence : il ne sort jamais du navigateur simulé — aucune
// requête n'atteint le vrai Supabase, qui le refuserait de toute façon.
import { readFileSync } from 'node:fs';
import { FONCTIONS, IDENTITE, PROFILS, TABLES } from './donnees.mjs';

const ENV = readFileSync(new URL('../../src/environments/environment.prod.ts', import.meta.url), 'utf8');
export const URL_SUPABASE = /supabaseUrl:\s*'([^']+)'/.exec(ENV)[1];
const REF = new URL(URL_SUPABASE).hostname.split('.')[0];

const b64url = (objet) => Buffer.from(JSON.stringify(objet)).toString('base64url');

function session(profil) {
  const p = PROFILS[profil];
  const maintenant = Math.floor(Date.now() / 1000);
  const charge = {
    sub: IDENTITE.MOI, aud: 'authenticated', role: 'authenticated', email: p.email,
    iat: maintenant, exp: maintenant + 86_400,
    ...(p.org ? { org_id: p.org } : {}),
    ...(p.role ? { vehora_role: p.role, role_scope: p.scope } : {}),
    station_ids: p.scope === 'STATION' ? [IDENTITE.S1] : [],
    permissions: p.permissions,
    is_platform_admin: Boolean(p.admin),
  };
  const utilisateur = {
    id: IDENTITE.MOI, aud: 'authenticated', role: 'authenticated', email: p.email,
    app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
  };
  return {
    access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(charge)}.simule`,
    token_type: 'bearer', expires_in: 86_400, expires_at: maintenant + 86_400,
    refresh_token: 'simule', user: utilisateur,
  };
}

/** Une valeur de filtre PostgREST (« eq.ACTIVE », « in.(a,b) », « not.in.(…) »). */
function correspond(valeur, expression) {
  let neg = false;
  if (expression.startsWith('not.')) {
    neg = true;
    expression = expression.slice(4);
  }
  const point = expression.indexOf('.');
  const op = expression.slice(0, point);
  const brut = decodeURIComponent(expression.slice(point + 1));
  const texte = valeur === null || valeur === undefined ? null : String(valeur);
  let ok;
  switch (op) {
    case 'eq': ok = texte === brut; break;
    case 'neq': ok = texte !== brut; break;
    case 'in': ok = brut.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, '')).includes(texte); break;
    case 'is': ok = brut === 'null' ? texte === null : texte === brut; break;
    case 'gte': ok = texte !== null && texte >= brut; break;
    case 'lte': ok = texte !== null && texte <= brut; break;
    case 'gt': ok = texte !== null && texte > brut; break;
    case 'lt': ok = texte !== null && texte < brut; break;
    case 'ilike': ok = texte !== null && new RegExp('^' + brut.replace(/[%*]/g, '.*') + '$', 'i').test(texte); break;
    default: ok = true;
  }
  return neg ? !ok : ok;
}

function lire(table, params) {
  let lignes = [...(TABLES[table] ?? [])];
  for (const [cle, valeur] of params) {
    if (['select', 'order', 'limit', 'offset', 'or', 'and', 'columns', 'on_conflict'].includes(cle)) continue;
    lignes = lignes.filter((l) => !(cle in l) || correspond(l[cle], valeur));
  }
  const ordre = params.get('order');
  if (ordre) {
    const [col, sens] = ordre.split(',')[0].split('.');
    lignes.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (sens === 'desc' ? -1 : 1));
  }
  const debut = Number(params.get('offset') ?? 0);
  const limite = params.get('limit');
  return lignes.slice(debut, limite ? debut + Number(limite) : undefined);
}

const json = (route, corps, statut = 200, entetes = {}) =>
  route.fulfill({
    status: statut,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...entetes },
    body: corps === undefined ? '' : JSON.stringify(corps),
  });

/** Installe la session et l'interception sur un contexte Playwright. */
export async function installerSupabaseSimule(contexte, profil) {
  if (profil && PROFILS[profil]) {
    const valeur = JSON.stringify(session(profil));
    await contexte.addInitScript(
      ([cle, v]) => {
        try {
          localStorage.setItem(cle, v);
        } catch {}
      },
      [`sb-${REF}-auth-token`, valeur],
    );
  }

  await contexte.route(`${URL_SUPABASE}/**`, async (route) => {
    const requete = route.request();
    const url = new URL(requete.url());
    const methode = requete.method();
    const objet = (requete.headers()['accept'] ?? '').includes('vnd.pgrst.object');

    if (methode === 'OPTIONS') return json(route, undefined, 204, { 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });

    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/user')) return json(route, profil ? session(profil).user : {}, profil ? 200 : 401);
      if (url.pathname.endsWith('/token')) return json(route, profil ? session(profil) : { error: 'invalid_grant' }, profil ? 200 : 400);
      return json(route, {}, 200);
    }

    if (url.pathname.startsWith('/storage/v1/')) {
      return json(route, [{ signedURL: '/favicon.ico', path: 'simule' }]);
    }

    const rpc = /^\/rest\/v1\/rpc\/(\w+)/.exec(url.pathname);
    if (rpc) {
      const fn = FONCTIONS[rpc[1]];
      const resultat = fn ? fn(requete.postDataJSON?.() ?? {}) : null;
      return json(route, objet && Array.isArray(resultat) ? resultat[0] ?? null : resultat);
    }

    const table = /^\/rest\/v1\/(\w+)/.exec(url.pathname)?.[1];
    if (!table) return json(route, {}, 404);

    if (methode === 'GET' || methode === 'HEAD') {
      const lignes = lire(table, url.searchParams);
      const entetes = { 'content-range': `0-${Math.max(0, lignes.length - 1)}/${lignes.length}` };
      if (methode === 'HEAD') return json(route, undefined, 200, entetes);
      if (objet) {
        return lignes.length
          ? json(route, lignes[0], 200, entetes)
          : json(route, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406);
      }
      return json(route, lignes, 200, entetes);
    }

    // Écritures : acceptées sans effet. Une insertion qui demande son id le reçoit.
    const cree = { id: '00000000-0000-4000-8000-ffffffffffff' };
    return json(route, objet ? cree : [cree], methode === 'POST' ? 201 : 200);
  });
}
