// Campagne d'intrusion phase 9 — Service Order, par l'API réelle.
//
// Le cycle de vie ne vaut que si l'API le fait respecter. Un trigger qui
// protège le statut en SQL local ne prouve rien tant qu'un PATCH REST n'a pas
// été tenté pour de vrai.
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

const { data: stations } = await awa.from('stations').select('id, name');
const { data: vehicules } = await awa.from('vehicles').select('id, plate').limit(1);
const { data: services }  = await awa.from('services').select('id, name');
const lavage = services.find((s) => s.name === 'Lavage complet');
const sansTarif = services.find((s) => s.name === 'Aspiration intérieur');

console.log('0. Ouverture d’un dossier de travail');
const { data: dossier, error: err0 } = await awa.from('service_orders')
  .insert({ station_id: stations[0].id, vehicle_id: vehicules[0].id })
  .select('*').single();
if (err0) { console.log('  ÉCHEC —', err0.message); process.exit(1); }
ok(`dossier n° ${dossier.number} ouvert en ${dossier.status}`);

console.log('1. Le montant d’une ligne ne vient jamais du client');
{
  const { data, error } = await awa.from('service_order_items')
    .insert({ service_order_id: dossier.id, service_id: lavage.id,
              service_name: 'Offert', unit_amount_minor: 0, currency: 'EUR' })
    .select('*').single();
  if (error) { ech(`insertion refusée : ${error.message}`); }
  else {
    data.unit_amount_minor > 0 ? ok(`montant imposé par le serveur (${data.unit_amount_minor})`)
                               : ech('montant à zéro accepté depuis le client');
    data.currency === 'XOF' ? ok('devise imposée par le serveur')
                            : ech(`devise acceptée : ${data.currency}`);
    data.service_name === 'Lavage complet' ? ok('nom de prestation copié du catalogue')
                                           : ech(`nom accepté : ${data.service_name}`);
  }
}

console.log('2. Une prestation sans tarif ne se vend pas');
{
  const { error } = await awa.from('service_order_items')
    .insert({ service_order_id: dossier.id, service_id: sansTarif.id });
  error && error.message.includes('VEHORA_SANS_TARIF')
    ? ok('prestation sans tarif refusée')
    : ech(`prestation sans tarif acceptée : ${JSON.stringify(error)}`);
}

console.log('3. Le statut ne se change pas par PATCH');
{
  // Zéro ligne renvoyée ne prouve rien : ce serait aussi le cas si la ligne
  // n'était simplement pas visible. On exige l'exception nommée.
  const { data, error } = await awa.from('service_orders')
    .update({ status: 'DELIVERED' }).eq('id', dossier.id).select();
  error?.message.includes('VEHORA_STATUT_DIRECT')
    ? ok('PATCH du statut rejeté par le trigger')
    : ech(`PATCH non rejeté (données ${JSON.stringify(data)}, erreur ${JSON.stringify(error)})`);

  const { data: apres } = await awa.from('service_orders')
    .select('status').eq('id', dossier.id).single();
  apres.status === 'ARRIVED' ? ok('le dossier est resté en ARRIVED')
                             : ech(`statut devenu ${apres.status}`);
}

console.log('4. Le numéro de dossier n’est pas imposable');
{
  const { data, error } = await awa.from('service_orders')
    .insert({ station_id: stations[0].id, vehicle_id: vehicules[0].id, number: 1 })
    .select('number').single();
  if (error) { ech(`insertion refusée : ${error.message}`); }
  else {
    data.number !== 1 ? ok(`numéro attribué par la base (${data.number})`)
                      : ech('numéro imposé par le client accepté');
    await awa.rpc('transitionner_dossier', {
      p_service_order_id: (await awa.from('service_orders').select('id')
        .eq('number', data.number).single()).data.id,
      p_to_status: 'CANCELLED', p_reason: 'Nettoyage de la campagne d’intrusion',
    });
  }
}

console.log('5. Une transition hors matrice est refusée');
{
  const { error } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'READY',
  });
  error?.message.includes('VEHORA_TRANSITION_INTERDITE')
    ? ok('ARRIVED → READY refusé') : ech(`transition acceptée : ${JSON.stringify(error)}`);
}

console.log('6. La file d’attente exige l’inspection');
{
  await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'INSPECTION' });

  const { error } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'WAITING' });
  error?.message.includes('VEHORA_INSPECTION_ABSENTE')
    ? ok('mise en file sans inspection refusée')
    : ech(`mise en file acceptée sans inspection : ${JSON.stringify(error)}`);

  await awa.from('vehicle_inspections')
    .insert({ vehicle_id: vehicules[0].id, service_order_id: dossier.id });

  const { error: e2 } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'WAITING' });
  !e2 ? ok('mise en file acceptée une fois l’inspection enregistrée')
      : ech(`mise en file refusée malgré l’inspection : ${e2.message}`);
}

console.log('7. Un caissier ne pilote pas le cycle de vie');
{
  const { error } = await caissier.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'CANCELLED', p_reason: 'test' });
  error ? ok(`annulation refusée (${error.code ?? error.message.slice(0, 30)})`)
        : ech('un caissier a annulé un dossier');

  const { error: e2 } = await caissier.from('service_orders')
    .insert({ station_id: stations[0].id, vehicle_id: vehicules[0].id });
  e2?.code === '42501' ? ok('ouverture de dossier refusée (42501)')
                       : ech(`ouverture acceptée : ${JSON.stringify(e2)}`);
}

console.log('8. L’historique n’est pas écrivable par l’API');
{
  const { error } = await awa.from('service_order_status_history')
    .insert({ organization_id: dossier.organization_id, service_order_id: dossier.id,
              to_status: 'DELIVERED' });
  error?.code === '42501' ? ok('écriture d’historique refusée (42501)')
                          : ech(`historique écrit depuis l’API : ${JSON.stringify(error)}`);

  const { data } = await awa.from('service_order_status_history')
    .update({ to_status: 'DELIVERED' }).eq('service_order_id', dossier.id).select();
  (data ?? []).length === 0 ? ok('modification d’historique sans effet')
                            : ech('historique modifié');

  const { data: h } = await awa.from('service_order_status_history')
    .select('from_status, to_status').eq('service_order_id', dossier.id)
    .order('changed_at');
  h?.length === 2 && h[0].to_status === 'INSPECTION' && h[1].to_status === 'WAITING'
    ? ok('l’historique reflète exactement les transitions faites')
    : ech(`historique inattendu : ${JSON.stringify(h)}`);
}

console.log('9. Une annulation exige un motif, et fige le dossier');
{
  const { error } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'CANCELLED' });
  error?.message.includes('VEHORA_MOTIF_REQUIS')
    ? ok('annulation sans motif refusée') : ech(`annulation sans motif acceptée`);

  const { error: e2 } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'CANCELLED',
    p_reason: 'Campagne d’intrusion — dossier de test' });
  !e2 ? ok('annulation enregistrée avec son motif') : ech(`annulation refusée : ${e2.message}`);

  const { data } = await awa.from('service_orders')
    .update({ notes: 'rouvert' }).eq('id', dossier.id).select();
  (data ?? []).length === 0 ? ok('un dossier annulé n’est plus modifiable')
                            : ech('un dossier annulé a été modifié');

  const { error: e3 } = await awa.from('service_order_items')
    .insert({ service_order_id: dossier.id, service_id: lavage.id });
  e3 ? ok('aucune prestation ajoutée à un dossier clos')
     : ech('prestation ajoutée à un dossier annulé');
}

console.log('10. Le total est calculé par la base, pas envoyé');
{
  const { data } = await awa.from('service_order_totals')
    .select('total_amount_minor, lignes').eq('service_order_id', dossier.id).single();
  data?.lignes === 1 && data.total_amount_minor > 0
    ? ok(`total calculé : ${data.total_amount_minor}`)
    : ech(`total inattendu : ${JSON.stringify(data)}`);
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.' : `\n❌ ${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
