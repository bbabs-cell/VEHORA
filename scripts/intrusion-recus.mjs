// Campagne d'intrusion phase 13 — reçus et rapports.
//
// Un reçu est un document remis à quelqu'un : ce qui est imprimé doit rester
// ce qui sera relu. Les tentations sont donc d'en réécrire un après coup, d'en
// faire disparaître un, d'en fabriquer un numéro, ou — côté rapports — de lire
// le chiffre d'affaires d'une station qu'on n'a pas le droit de connaître.
// Tout cela se tente ici par l'API réelle.
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

const { data: stations } = await awa.from('stations').select('id').order('name');
const { data: vehicules } = await awa.from('vehicles').select('id').limit(1);
const { data: services }  = await awa.from('services').select('id, name');
const lavage = services.find((s) => s.name === 'Lavage complet');

/** Un dossier avec une prestation : le minimum pour avoir quelque chose à imprimer. */
async function dossierFacturable() {
  const { data: d } = await awa.from('service_orders')
    .insert({ station_id: stations[0].id, vehicle_id: vehicules[0].id })
    .select('id, number').single();
  await awa.from('service_order_items')
    .insert({ service_order_id: d.id, service_id: lavage.id });
  return d;
}

const dossier = await dossierFacturable();
const { data: recu, error: eRecu } = await awa.rpc('emettre_recu', {
  p_service_order_id: dossier.id,
});
console.log(`0. Dossier n° ${dossier.number}, reçu n° ${recu?.number}`);
!eRecu && recu?.number > 0
  ? ok('un propriétaire émet un reçu sur son dossier')
  : ech(`émission refusée : ${JSON.stringify(eRecu)}`);

console.log('1. Le contenu du reçu est une copie, pas une référence');
{
  const lignes = recu?.contenu?.lignes ?? [];
  lignes.length > 0 && typeof lignes[0].prestation === 'string'
    ? ok('les prestations sont recopiées dans le reçu, nom compris')
    : ech(`contenu incomplet : ${JSON.stringify(recu?.contenu)}`);

  recu?.contenu?.totaux?.devise === recu?.currency
    ? ok('la devise du reçu est celle figée dans son contenu')
    : ech(`devise incohérente : ${recu?.currency}`);
}

console.log('2. On ne réécrit pas un reçu');
{
  const { error } = await awa.from('receipts')
    .update({ total_minor: 1 }).eq('id', recu.id);
  const { data: relu } = await awa.from('receipts')
    .select('total_minor').eq('id', recu.id).single();

  // Sans policy UPDATE, la RLS ne fait correspondre aucune ligne : pas
  // d'erreur, pas de modification. C'est la valeur relue qui fait foi.
  relu?.total_minor === recu.total_minor
    ? ok('le total du reçu est inchangé après tentative de PATCH')
    : ech(`reçu modifié : ${relu?.total_minor} (erreur : ${JSON.stringify(error)})`);
}

console.log('3. On ne supprime pas un reçu');
{
  await awa.from('receipts').delete().eq('id', recu.id);
  const { count } = await awa.from('receipts')
    .select('id', { count: 'exact', head: true }).eq('id', recu.id);
  count === 1 ? ok('le reçu survit à la tentative de suppression')
              : ech('reçu supprimé');
}

console.log('4. On ne fabrique pas un reçu à la main, ni son numéro');
{
  const { error } = await awa.from('receipts').insert({
    station_id: stations[0].id, service_order_id: dossier.id,
    number: 999999, contenu: {}, currency: 'XOF', total_minor: 0, paid_minor: 0,
  });
  error ? ok(`insertion directe refusée (${error.code})`)
        : ech('un reçu a été inséré sans passer par emettre_recu');
}

console.log('5. La numérotation avance d’un en un');
{
  const d2 = await dossierFacturable();
  const { data: r2 } = await awa.rpc('emettre_recu', { p_service_order_id: d2.id });
  r2?.number === recu.number + 1
    ? ok(`numéros consécutifs (${recu.number} → ${r2.number})`)
    : ech(`trou dans la numérotation : ${recu.number} → ${r2?.number}`);
}

console.log('6. Une correction référence l’ancien reçu, et une seule fois');
{
  const { data: c1, error: e1 } = await awa.rpc('emettre_recu', {
    p_service_order_id: dossier.id, p_replaces_receipt_id: recu.id,
  });
  !e1 && c1?.replaces_receipt_id === recu.id
    ? ok('le reçu correctif référence celui qu’il remplace')
    : ech(`correction refusée ou sans référence : ${JSON.stringify(e1)}`);

  const { error: e2 } = await awa.rpc('emettre_recu', {
    p_service_order_id: dossier.id, p_replaces_receipt_id: recu.id,
  });
  e2?.message.includes('VEHORA_RECU_DEJA_CORRIGE')
    ? ok('un même reçu ne se corrige pas deux fois')
    : ech(`double correction acceptée : ${JSON.stringify(e2)}`);

  const { count } = await awa.from('receipts')
    .select('id', { count: 'exact', head: true }).eq('id', recu.id);
  count === 1 ? ok('le reçu corrigé reste consultable')
              : ech('le reçu d’origine a disparu');
}

console.log('7. On ne corrige pas un reçu avec le reçu d’un autre dossier');
{
  const d3 = await dossierFacturable();
  const { error } = await awa.rpc('emettre_recu', {
    p_service_order_id: d3.id, p_replaces_receipt_id: recu.id,
  });
  error?.message.includes('VEHORA_RECU_INTROUVABLE')
    ? ok('le reçu corrigé doit appartenir au dossier')
    : ech(`correction croisée acceptée : ${JSON.stringify(error)}`);
}

console.log('8. Un dossier annulé n’a pas de reçu');
{
  const d4 = await dossierFacturable();
  await awa.rpc('transitionner_dossier', {
    p_service_order_id: d4.id, p_to_status: 'CANCELLED', p_reason: 'Campagne d’intrusion',
  });
  const { error } = await awa.rpc('emettre_recu', { p_service_order_id: d4.id });
  error?.message.includes('VEHORA_DOSSIER_ANNULE')
    ? ok('aucun reçu pour un dossier annulé')
    : ech(`reçu émis sur un dossier annulé : ${JSON.stringify(error)}`);
}

console.log('9. Un dossier sans prestation n’a rien à imprimer');
{
  const { data: d5 } = await awa.from('service_orders')
    .insert({ station_id: stations[0].id, vehicle_id: vehicules[0].id })
    .select('id').single();
  const { error } = await awa.rpc('emettre_recu', { p_service_order_id: d5.id });
  error?.message.includes('VEHORA_DOSSIER_SANS_LIGNE')
    ? ok('aucun reçu pour un dossier sans ligne')
    : ech(`reçu vide émis : ${JSON.stringify(error)}`);
}

console.log('10. Un dossier inexistant ne révèle rien et ne brûle aucun numéro');
{
  const { error } = await awa.rpc('emettre_recu', {
    p_service_order_id: '00000000-0000-0000-0000-000000000000',
  });
  error?.message.includes('VEHORA_DOSSIER_INTROUVABLE')
    ? ok('dossier hors périmètre : même message qu’un dossier absent')
    : ech(`émission acceptée : ${JSON.stringify(error)}`);

  const d6 = await dossierFacturable();
  const { data: avant } = await awa.from('receipts')
    .select('number').order('number', { ascending: false }).limit(1).single();
  const { data: r6 } = await awa.rpc('emettre_recu', { p_service_order_id: d6.id });
  r6?.number === avant.number + 1
    ? ok('aucun numéro brûlé par l’échec précédent')
    : ech(`numéro brûlé : ${avant.number} → ${r6?.number}`);
}

console.log('11. Encaisser n’est pas savoir combien la station encaisse');
{
  const { error } = await caissier.rpc('rapport_journalier', {
    p_debut: '2026-09-01', p_fin: '2026-09-30',
  });
  error?.message.includes('reports.read')
    ? ok('le rapport est refusé au caissier, et pour la bonne raison')
    : ech(`un caissier a lu le chiffre d’affaires : ${JSON.stringify(error)}`);

  const { data: recus } = await caissier.from('receipts').select('id').limit(1);
  recus?.length > 0 ? ok('un caissier lit en revanche les reçus de sa station')
                    : ech('un caissier ne voit aucun reçu');
}

console.log('12. Une période absurde est refusée avant d’être exécutée');
{
  const { error: e1 } = await awa.rpc('rapport_journalier', {
    p_debut: '2026-09-30', p_fin: '2026-09-01',
  });
  e1 ? ok('période inversée refusée') : ech('période inversée acceptée');

  const { error: e2 } = await awa.rpc('rapport_journalier', {
    p_debut: '2020-01-01', p_fin: '2026-12-31',
  });
  e2 ? ok('période de plusieurs années refusée')
     : ech('période sans borne acceptée');
}

console.log('13. Le rapport ne franchit pas la frontière de l’organisation');
{
  const { data: lignes } = await awa.rpc('rapport_journalier', {
    p_debut: '2026-09-01', p_fin: '2026-09-30',
  });
  const { data: miennes } = await awa.from('stations').select('id');
  const mes = new Set(miennes.map((s) => s.id));
  (lignes ?? []).every((l) => mes.has(l.station_id))
    ? ok('toutes les lignes du rapport sont des stations de l’organisation')
    : ech('le rapport contient une station étrangère');

  // Une station qui n'est pas la sienne ne rend rien, plutôt qu'une erreur qui
  // confirmerait son existence.
  const { data: vide } = await awa.rpc('rapport_journalier', {
    p_debut: '2026-09-01', p_fin: '2026-09-30',
    p_station: '00000000-0000-0000-0000-000000000000',
  });
  (vide ?? []).length === 0 ? ok('une station inconnue ne rend aucune ligne')
                            : ech('une station étrangère a rendu des lignes');
}

console.log('14. Anonyme : ni reçu, ni chiffre');
{
  const { data: r } = await anonyme.from('receipts').select('id');
  (r ?? []).length === 0 ? ok('un anonyme ne lit aucun reçu')
                         : ech('reçus lisibles sans être connecté');

  const { error: e1 } = await anonyme.rpc('emettre_recu', {
    p_service_order_id: dossier.id,
  });
  e1 ? ok(`émission refusée à l’anonyme (${e1.code})`)
     : ech('un anonyme a émis un reçu');

  const { error: e2 } = await anonyme.rpc('rapport_journalier', {
    p_debut: '2026-09-01', p_fin: '2026-09-30',
  });
  e2 ? ok(`rapport refusé à l’anonyme (${e2.code})`)
     : ech('un anonyme a lu le chiffre d’affaires');
}

console.log('15. La séquence des numéros n’est pas exposée');
{
  const { error } = await awa.schema('vehora').from('receipt_sequences').select('*');
  error ? ok('la table des compteurs est hors de portée de l’API')
        : ech('les compteurs de numérotation sont lisibles depuis le client');
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.' : `\n❌ ${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
