// Campagne d'intrusion phase 11 — paiements, caisse, restitution.
//
// C'est la partie du produit où l'argent circule. Un caissier a un intérêt
// direct à faire disparaître une entrée, à corriger un écart, ou à laisser
// partir un véhicule impayé. Tout cela se tente ici, par l'API réelle.
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

const { data: stations } = await awa.from('stations').select('id').order('name');
const { data: vehicules } = await awa.from('vehicles').select('id').limit(1);
const { data: services }  = await awa.from('services').select('id, name');
const lavage = services.find((s) => s.name === 'Lavage complet');

/** Mène un dossier jusqu'à PRÊT : l'état où la restitution se joue. */
async function dossierPret() {
  const { data: employe } = await awa.from('employees')
    .select('id').eq('status', 'ACTIVE').limit(1).single();
  const { data: d } = await awa.from('service_orders')
    .insert({ station_id: stations[0].id, vehicle_id: vehicules[0].id })
    .select('id, number').single();
  await awa.from('service_order_items')
    .insert({ service_order_id: d.id, service_id: lavage.id });
  await awa.rpc('transitionner_dossier', { p_service_order_id: d.id, p_to_status: 'INSPECTION' });
  await awa.from('vehicle_inspections')
    .insert({ vehicle_id: vehicules[0].id, service_order_id: d.id });
  await awa.rpc('transitionner_dossier', { p_service_order_id: d.id, p_to_status: 'WAITING' });
  const { data: op } = await awa.from('service_order_operations')
    .select('id').eq('service_order_id', d.id).single();
  await awa.from('service_order_operations')
    .update({ employee_id: employe.id }).eq('id', op.id);
  await awa.from('service_order_operations').update({ status: 'IN_PROGRESS' }).eq('id', op.id);
  await awa.from('service_order_operations').update({ status: 'DONE' }).eq('id', op.id);
  await awa.rpc('transitionner_dossier', { p_service_order_id: d.id, p_to_status: 'CONTROL' });
  await awa.rpc('transitionner_dossier', { p_service_order_id: d.id, p_to_status: 'READY' });
  return d;
}

const dossier = await dossierPret();
console.log(`0. Dossier n° ${dossier.number} prêt à restituer`);
ok('dossier mené jusqu’à PRÊT');

console.log('1. Les espèces exigent une caisse ouverte');
{
  const { error } = await awa.from('payments')
    .insert({ service_order_id: dossier.id, method: 'CASH', amount_minor: 1000 });
  error?.message.includes('VEHORA_CAISSE_FERMEE')
    ? ok('encaissement en espèces refusé sans caisse')
    : ech(`encaissement accepté : ${JSON.stringify(error)}`);
}

console.log('2. On n’ouvre pas une caisse au nom d’un autre');
{
  const { data: autre } = await awa.from('profiles').select('id').limit(2);
  const moi = (await awa.auth.getUser()).data.user.id;
  const quelquUnDautre = autre.find((p) => p.id !== moi);

  const { error } = await awa.from('cash_registers').insert({
    station_id: stations[0].id, opened_by: quelquUnDautre.id, opening_float_minor: 0,
  });
  error?.code === '42501' ? ok('ouverture au nom d’un autre refusée (42501)')
                          : ech(`ouverture acceptée : ${JSON.stringify(error)}`);
}

const { data: caisse, error: errCaisse } = await awa.from('cash_registers')
  .insert({ station_id: stations[0].id,
            opened_by: (await awa.auth.getUser()).data.user.id,
            opening_float_minor: 10000 })
  .select('*').single();
if (errCaisse) { console.log('  ÉCHEC —', errCaisse.message); process.exit(1); }
ok(`caisse ouverte avec ${caisse.opening_float_minor} de fonds`);

console.log('3. Deux caisses ouvertes sont impossibles');
{
  const { error } = await awa.from('cash_registers').insert({
    station_id: stations[0].id,
    opened_by: (await awa.auth.getUser()).data.user.id, opening_float_minor: 500,
  });
  error?.code === '23505' ? ok('seconde caisse refusée (23505)')
                          : ech(`seconde caisse acceptée : ${JSON.stringify(error)}`);
}

console.log('4. Un paiement en espèces entre dans le tiroir, Mobile Money non');
{
  const { data: p } = await awa.from('payments')
    .insert({ service_order_id: dossier.id, method: 'CASH', amount_minor: 2000,
              currency: 'EUR', cash_register_id: null })
    .select('*').single();
  p?.cash_register_id === caisse.id ? ok('paiement espèces rattaché à la caisse ouverte')
                                    : ech('paiement espèces hors caisse');
  p?.currency === 'XOF' ? ok('devise imposée par la base') : ech(`devise : ${p?.currency}`);

  const { data: m } = await awa.from('cash_transactions')
    .select('kind, amount_minor').eq('payment_id', p.id).single();
  m?.kind === 'PAYMENT_IN' && m.amount_minor === 2000
    ? ok('mouvement de caisse écrit par la base')
    : ech(`mouvement inattendu : ${JSON.stringify(m)}`);

  const { data: mm } = await awa.from('payments')
    .insert({ service_order_id: dossier.id, method: 'MOBILE_MONEY', amount_minor: 1000,
              provider_name: 'Wave', external_ref: 'TX-INTRUSION' })
    .select('cash_register_id').single();
  mm?.cash_register_id === null ? ok('Mobile Money ne touche pas le tiroir')
                                : ech('Mobile Money est entré dans la caisse');
}

console.log('5. Un paiement ne se modifie ni ne se supprime');
{
  const { data: p } = await awa.from('payments')
    .select('id').eq('service_order_id', dossier.id).limit(1).single();

  const { data: modif } = await awa.from('payments')
    .update({ amount_minor: 1 }).eq('id', p.id).select();
  (modif ?? []).length === 0 ? ok('modification sans effet') : ech('un paiement a été modifié');

  const { data: suppr } = await awa.from('payments').delete().eq('id', p.id).select();
  (suppr ?? []).length === 0 ? ok('suppression sans effet') : ech('un paiement a été supprimé');
}

console.log('6. Le mouvement de caisse ne se falsifie pas à la main');
{
  const { data: m } = await awa.from('cash_transactions')
    .select('id').eq('cash_register_id', caisse.id).limit(1).single();

  const { data: modif } = await awa.from('cash_transactions')
    .update({ amount_minor: 999999 }).eq('id', m.id).select();
  (modif ?? []).length === 0 ? ok('mouvement non modifiable') : ech('un mouvement a été modifié');

  const { data: suppr } = await awa.from('cash_transactions')
    .delete().eq('id', m.id).select();
  (suppr ?? []).length === 0 ? ok('mouvement non supprimable') : ech('un mouvement a été supprimé');

  // Un mouvement libre rattaché à un paiement serait une double entrée.
  const { data: p } = await awa.from('payments')
    .select('id').eq('cash_register_id', caisse.id).limit(1).single();
  const { error } = await awa.from('cash_transactions').insert({
    cash_register_id: caisse.id, kind: 'CASH_IN', amount_minor: 5000,
    payment_id: p.id, reason: 'Double entrée',
  });
  error?.code === '42501' ? ok('mouvement libre rattaché à un paiement refusé')
                          : ech(`double entrée acceptée : ${JSON.stringify(error)}`);
}

console.log('7. Restituer avec un solde exige un motif et le droit d’accorder');
{
  const { error } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'DELIVERED' });
  error?.message.includes('VEHORA_MOTIF_REQUIS')
    ? ok('restitution sans motif refusée')
    : ech(`restitution acceptée : ${JSON.stringify(error)}`);

  const { error: e2 } = await caissier.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'DELIVERED',
    p_reason: 'Le client paiera demain' });
  e2 ? ok(`un caissier ne peut pas accorder de créance (${e2.code ?? ''})`)
     : ech('un caissier a laissé partir un véhicule impayé');

  const { error: e3 } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'DELIVERED',
    p_reason: 'Campagne d’intrusion — créance accordée' });
  !e3 ? ok('restitution avec créance motivée acceptée')
      : ech(`restitution refusée : ${e3.message}`);
}

console.log('8. L’écart de caisse est calculé, jamais déclaré');
{
  // Théorique : 10 000 + 2 000 = 12 000. On déclare 9 000.
  const { data: c, error } = await awa.rpc('cloturer_caisse', {
    p_cash_register_id: caisse.id, p_declared_minor: 9000,
    p_note: 'Campagne d’intrusion' });
  if (error) { ech(`clôture refusée : ${error.message}`); }
  else {
    c.theoretical_minor === 12000 ? ok('solde théorique calculé par la base')
                                  : ech(`théorique : ${c.theoretical_minor}`);
    c.variance_minor === -3000 ? ok('écart de −3 000 calculé, pas masqué')
                               : ech(`écart : ${c.variance_minor}`);
  }
}

console.log('9. Une caisse clôturée est immuable');
{
  const { data } = await awa.from('cash_registers')
    .update({ variance_minor: 0 }).eq('id', caisse.id).select();
  (data ?? []).length === 0 ? ok('écart non corrigible après clôture')
                            : ech('un écart a été corrigé après clôture');

  const { error } = await awa.from('cash_transactions').insert({
    cash_register_id: caisse.id, kind: 'CASH_IN', amount_minor: 1000, reason: 'Après coup',
  });
  error ? ok(`aucun mouvement après clôture (${error.code})`)
        : ech('un mouvement a été ajouté après clôture');
}

console.log('10. La clôture ne se fait pas par PATCH');
{
  const { data: c2 } = await awa.from('cash_registers')
    .insert({ station_id: stations[0].id,
              opened_by: (await awa.auth.getUser()).data.user.id, opening_float_minor: 0 })
    .select('id').single();

  const { error } = await awa.from('cash_registers')
    .update({ status: 'CLOSED', variance_minor: 0 }).eq('id', c2.id);
  error?.message.includes('VEHORA_CLOTURE_DIRECTE')
    ? ok('clôture par PATCH rejetée par le trigger')
    : ech(`clôture par PATCH acceptée : ${JSON.stringify(error)}`);

  await awa.rpc('cloturer_caisse', { p_cash_register_id: c2.id, p_declared_minor: 0 });
}

console.log('11. Un caissier encaisse mais ne rembourse pas');
{
  // Le caissier ouvre sa caisse d'abord : sinon le refus viendrait du tiroir
  // fermé, pas de la permission — et le test ne prouverait pas ce qu'il annonce.
  const moiCaissier = (await caissier.auth.getUser()).data.user.id;
  const { data: cc } = await caissier.from('cash_registers')
    .insert({ station_id: stations[0].id, opened_by: moiCaissier, opening_float_minor: 0 })
    .select('id').single();

  const { data: p } = await awa.from('payments')
    .select('id, service_order_id').eq('kind', 'PAYMENT').limit(1).single();

  const { error } = await caissier.from('payments').insert({
    service_order_id: p.service_order_id, kind: 'REFUND', method: 'CASH',
    amount_minor: 100, reverses_payment_id: p.id, reason: 'Tentative',
  });
  error?.message.includes('VEHORA_REMBOURSEMENT_NON_AUTORISE')
    ? ok('remboursement refusé au caissier, et pour la bonne raison')
    : ech(`remboursement accepté ou mal expliqué : ${JSON.stringify(error)}`);

  // Il encaisse en revanche sans difficulté : c'est son métier.
  const { error: e2 } = await caissier.from('payments').insert({
    service_order_id: p.service_order_id, method: 'CASH', amount_minor: 500,
  });
  !e2 ? ok('un caissier encaisse en espèces dans sa propre caisse')
      : ech(`encaissement refusé au caissier : ${e2.message}`);

  if (cc) await caissier.rpc('cloturer_caisse', { p_cash_register_id: cc.id, p_declared_minor: 500 });
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.' : `\n❌ ${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
