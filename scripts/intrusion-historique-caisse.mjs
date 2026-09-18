// Campagne d'intrusion phase 18 — historique des sessions de caisse.
//
// Ce qu'on protège ici n'est pas de l'argent, c'est une réputation : l'écart de
// caisse d'une personne dit si elle a manqué de rigueur, ou pire. Il regarde
// celui qui valide les écarts, pas le collègue d'à côté. On tente donc, par
// l'API réelle, de le lire depuis un compte qui n'y a pas droit — par la table,
// par la vue, par les mouvements, et sans compte du tout.
import './proxy-node.mjs';
import { createClient } from '@supabase/supabase-js';

const URL = 'https://entpmxssjxllggsqhnwc.supabase.co';
const KEY = 'sb_publishable_e3seZbuqZkKCNHaW2GeEHA_wa5V8-Y2';

let ko = 0;
const ok  = (m) => console.log('  ok —', m);
const ech = (m) => { ko++; console.log('  ÉCHEC —', m); };

async function connecter(email, mdp) {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: mdp });
  if (error) throw new Error(`${email} : ${error.message}`);
  return c;
}

const awa = await connecter(process.env.VEHORA_TEST_EMAIL, process.env.VEHORA_TEST_PASSWORD);
const caissier = await connecter(
  process.env.VEHORA_TEST_EMAIL_CAISSIER, process.env.VEHORA_TEST_PASSWORD_CAISSIER);
const anonyme = createClient(URL, KEY);

const { data: moi } = await awa.auth.getUser();
const { data: lui } = await caissier.auth.getUser();

// --- 1. Utilisateur autorisé ------------------------------------------------
const { data: sessionsAwa, error: eAwa } = await awa
  .from('cash_register_history').select('*').eq('status', 'CLOSED').limit(5);

if (eAwa) ech(`le propriétaire ne lit pas l'historique : ${eAwa.message}`);
else ok(`le propriétaire lit l'historique (${sessionsAwa.length} session(s))`);

if (sessionsAwa?.length) {
  const s = sessionsAwa[0];
  const complet = s.station_name && s.opened_by_name !== undefined
    && s.theoretical_minor !== undefined && s.variance_minor !== undefined;
  complet ? ok('la vue porte les noms et les chiffres attendus')
          : ech('la vue ne porte pas ce qu\'attend l\'écran');
}

// Une session ouverte par quelqu'un d'autre : c'est elle qu'on va tenter de lire.
const { data: autres } = await awa
  .from('cash_register_history').select('cash_register_id, opened_by, variance_minor')
  .neq('opened_by', lui.user.id).limit(1);
const cible = autres?.[0];
if (!cible) console.log('  (aucune session ouverte par un tiers : cas non couvert)');

// --- 2. Utilisateur non autorisé -------------------------------------------
if (cible) {
  const { data } = await caissier
    .from('cash_register_history').select('*').eq('cash_register_id', cible.cash_register_id);
  (data?.length ?? 0) === 0
    ? ok('un caissier ne lit pas la session d\'un autre dans l\'historique')
    : ech('un caissier a lu la session d\'un autre');

  const { data: table } = await caissier
    .from('cash_registers').select('*').eq('id', cible.cash_register_id);
  (table?.length ?? 0) === 0
    ? ok('ni par la table, la vue n\'était pas le seul chemin')
    : ech('un caissier a lu la session d\'un autre par la table');

  // Et l'information ne repasse pas par les mouvements, qui portent les mêmes
  // montants session par session.
  const { data: mvts } = await caissier
    .from('cash_transactions').select('*').eq('cash_register_id', cible.cash_register_id);
  (mvts?.length ?? 0) === 0
    ? ok('ni par les mouvements de cette session')
    : ech('un caissier a lu les mouvements de la session d\'un autre');
}

// Toutes les sessions qu'il voit sont les siennes. C'est l'assertion qui compte :
// elle tient même si le jeu de données change.
const { data: sesSessions } = await caissier.from('cash_register_history').select('opened_by');
const etrangeres = (sesSessions ?? []).filter((s) => s.opened_by !== lui.user.id);
etrangeres.length === 0
  ? ok(`un caissier ne voit que ses propres sessions (${sesSessions?.length ?? 0})`)
  : ech(`${etrangeres.length} session(s) d'autrui visibles par un caissier`);

// --- 3. Utilisateur malveillant --------------------------------------------
// Sans compte, rien.
const { data: sansCompte, error: eAnon } = await anonyme
  .from('cash_register_history').select('*').limit(1);
(eAnon || (sansCompte?.length ?? 0) === 0)
  ? ok('sans compte, l\'historique ne rend rien')
  : ech('l\'historique est lisible sans compte');

// Une vue n'est pas une porte d'écriture : on ne réécrit pas un écart.
if (cible) {
  const { error } = await awa
    .from('cash_register_history')
    .update({ variance_minor: 0 })
    .eq('cash_register_id', cible.cash_register_id);
  error ? ok(`un écart ne se réécrit pas par la vue (${error.code ?? error.message})`)
        : ech('un écart a été réécrit par la vue');
}

// Ni par la table : la clôture passe par `cloturer_caisse`, et une session
// clôturée est immuable.
{
  const { data: close } = await awa
    .from('cash_register_history').select('cash_register_id')
    .eq('status', 'CLOSED').eq('opened_by', moi.user.id).limit(1);
  if (close?.length) {
    const { error, count } = await awa
      .from('cash_registers')
      .update({ variance_minor: 0, declared_closing_minor: 0 }, { count: 'exact' })
      .eq('id', close[0].cash_register_id);
    (error || count === 0)
      ? ok('une session clôturée reste immuable, même pour son propriétaire')
      : ech('une session clôturée a été réécrite');
  }
}

// Emprunter l'identité d'un autre dans le filtre ne donne rien de plus : c'est
// la policy qui décide, pas le paramètre.
{
  const { data } = await caissier
    .from('cash_register_history').select('*').eq('opened_by', moi.user.id);
  (data?.length ?? 0) === 0
    ? ok('filtrer sur l\'identifiant d\'un autre ne contourne rien')
    : ech('filtrer sur l\'identifiant d\'un autre a rendu des lignes');
}

// Une organisation ne voit pas l'autre — vérifié table par table ailleurs, on
// s'assure ici que la nouvelle vue ne fait pas exception.
{
  const fatou = await connecter('fatou@vehora.test', process.env.VEHORA_TEST_PASSWORD);
  const { data } = await fatou.from('cash_register_history').select('organization_id');
  const { data: monOrg } = await awa.from('cash_register_history')
    .select('organization_id').limit(1);
  const fuite = (data ?? []).some((l) => l.organization_id === monOrg?.[0]?.organization_id);
  fuite ? ech('une autre organisation voit les sessions de celle-ci')
        : ok('une autre organisation ne voit aucune session de celle-ci');
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.'
                     : `\n❌ ${ko} faille(s).`);
process.exit(ko === 0 ? 0 : 1);
