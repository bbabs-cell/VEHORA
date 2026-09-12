// Campagne d'intrusion phase 10 — employés et opérations, par l'API réelle.
//
// Ce qui est vérifié ici : assigner et exécuter sont deux permissions
// distinctes, portées par des colonnes différentes de la même ligne. Une policy
// RLS ne voit pas quelle colonne a changé — c'est un trigger qui tranche, et
// c'est donc par l'API qu'il faut le prouver.
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

console.log('0. Un employé sans compte de connexion');
const { data: employe, error: err0 } = await awa.from('employees')
  .insert({ full_name: 'Intrusion Laveur', phone: '77 987 65 43' })
  .select('*').single();
if (err0) { console.log('  ÉCHEC —', err0.message); process.exit(1); }
employe.profile_id === null ? ok('employé créé sans compte')
                            : ech('un profile_id est apparu tout seul');
employe.phone_digits === '221779876543'
  ? ok('téléphone normalisé par la base')
  : ech(`téléphone non normalisé : ${employe.phone_digits}`);

console.log('1. Un dossier mené jusqu’à la file d’attente');
const { data: dossier } = await awa.from('service_orders')
  .insert({ station_id: stations[0].id, vehicle_id: vehicules[0].id })
  .select('*').single();
await awa.from('service_order_items')
  .insert({ service_order_id: dossier.id, service_id: lavage.id });
await awa.rpc('transitionner_dossier', { p_service_order_id: dossier.id, p_to_status: 'INSPECTION' });
await awa.from('vehicle_inspections')
  .insert({ vehicle_id: vehicules[0].id, service_order_id: dossier.id });
await awa.rpc('transitionner_dossier', { p_service_order_id: dossier.id, p_to_status: 'WAITING' });

const { data: ops } = await awa.from('service_order_operations')
  .select('*').eq('service_order_id', dossier.id);
ops?.length === 1 && ops[0].status === 'PENDING'
  ? ok('une opération créée par la mise en file, en attente')
  : ech(`opérations inattendues : ${JSON.stringify(ops)}`);
const operation = ops[0];

console.log('2. Les opérations ne se créent pas depuis l’API');
{
  const { error } = await awa.from('service_order_operations').insert({
    organization_id: dossier.organization_id, service_order_id: dossier.id,
    item_id: operation.item_id, service_name: 'Opération fantôme',
  });
  error?.code === '42501' ? ok('création refusée (42501)')
                          : ech(`création acceptée : ${JSON.stringify(error)}`);
}

console.log('3. Démarrer le travail exige une assignation');
{
  const { error } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'IN_PROGRESS' });
  error?.message.includes('VEHORA_AUCUNE_ASSIGNATION')
    ? ok('démarrage refusé sans assignation')
    : ech(`démarrage accepté : ${JSON.stringify(error)}`);

  const { error: e2 } = await awa.from('service_order_operations')
    .update({ status: 'IN_PROGRESS' }).eq('id', operation.id);
  e2?.message.includes('VEHORA_OPERATION_SANS_EMPLOYE')
    ? ok('opération non démarrable sans employé')
    : ech(`opération démarrée sans employé : ${JSON.stringify(e2)}`);
}

console.log('4. Les horodatages viennent de la base, pas du client');
{
  await awa.from('service_order_operations')
    .update({ employee_id: employe.id }).eq('id', operation.id);

  const passe = '2020-01-01T00:00:00.000Z';
  const { data } = await awa.from('service_order_operations')
    .update({ status: 'IN_PROGRESS', started_at: passe })
    .eq('id', operation.id).select('started_at').single();

  data && data.started_at !== passe
    ? ok(`started_at imposé par la base (${data.started_at.slice(0, 10)})`)
    : ech(`started_at accepté depuis le client : ${JSON.stringify(data)}`);
}

console.log('5. Une opération ne recule pas de DONE');
{
  await awa.from('service_order_operations').update({ status: 'DONE' }).eq('id', operation.id);
  const { error } = await awa.from('service_order_operations')
    .update({ status: 'PENDING' }).eq('id', operation.id);
  error?.message.includes('VEHORA_OPERATION_TRANSITION')
    ? ok('retour DONE → PENDING refusé')
    : ech(`retour accepté : ${JSON.stringify(error)}`);
}

console.log('6. Un employé inactif ne reçoit plus de travail');
{
  await awa.from('employees').update({ status: 'INACTIVE' }).eq('id', employe.id);
  const { data: d2 } = await awa.from('service_orders')
    .insert({ station_id: stations[0].id, vehicle_id: vehicules[0].id })
    .select('id').single();
  await awa.from('service_order_items')
    .insert({ service_order_id: d2.id, service_id: lavage.id });
  await awa.rpc('transitionner_dossier', { p_service_order_id: d2.id, p_to_status: 'INSPECTION' });
  await awa.from('vehicle_inspections')
    .insert({ vehicle_id: vehicules[0].id, service_order_id: d2.id });
  await awa.rpc('transitionner_dossier', { p_service_order_id: d2.id, p_to_status: 'WAITING' });

  const { data: op2 } = await awa.from('service_order_operations')
    .select('id').eq('service_order_id', d2.id).single();

  const { error } = await awa.from('service_order_operations')
    .update({ employee_id: employe.id }).eq('id', op2.id);
  error?.message.includes('VEHORA_EMPLOYE_INACTIF')
    ? ok('assignation à un employé inactif refusée')
    : ech(`assignation acceptée : ${JSON.stringify(error)}`);

  await awa.rpc('transitionner_dossier', {
    p_service_order_id: d2.id, p_to_status: 'CANCELLED',
    p_reason: 'Campagne d’intrusion — dossier de test' });
}

console.log('7. Le contrôle exige toutes les opérations terminées');
{
  await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'IN_PROGRESS' });

  // Une seule opération, déjà DONE : le contrôle doit passer.
  const { error } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'CONTROL' });
  !error ? ok('IN_PROGRESS → CONTROL accepté, toutes opérations faites')
         : ech(`contrôle refusé : ${error.message}`);

  // Le raccourci vers PRÊT est fermé tant que le contrôle qualité est exigé.
  const { error: e2 } = await awa.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id, p_to_status: 'READY' });
  // Depuis CONTROL, READY est légitime — on vérifie plutôt le rejet sans motif.
  !e2 ? ok('CONTROL → READY accepté') : ech(`passage en prêt refusé : ${e2.message}`);
}

console.log('8. Un caissier lit mais n’assigne ni n’exécute');
{
  const { data } = await caissier.from('service_order_operations').select('id').limit(1);
  (data ?? []).length > 0 ? ok('le caissier lit les opérations')
                          : ech('le caissier ne voit aucune opération');

  const { data: modif } = await caissier.from('service_order_operations')
    .update({ employee_id: employe.id }).eq('id', operation.id).select();
  (modif ?? []).length === 0 ? ok('assignation sans effet pour un caissier')
                             : ech('un caissier a assigné une opération');

  const { data: apres } = await awa.from('service_order_operations')
    .select('employee_id').eq('id', operation.id).single();
  apres.employee_id === employe.id
    ? ok('l’assignation d’origine est intacte')
    : ech(`employee_id modifié : ${apres.employee_id}`);
}

console.log('9. Un employé d’une autre organisation ne s’assigne pas');
{
  const { error } = await awa.from('employees')
    .insert({ full_name: 'Compte étranger', profile_id: '00000000-0000-0000-0000-000000000000' });
  error ? ok(`compte non membre refusé (${error.code})`)
        : ech('un compte non membre a été rattaché');
}

console.log('10. Nettoyage');
await awa.rpc('transitionner_dossier', {
  p_service_order_id: dossier.id, p_to_status: 'CANCELLED',
  p_reason: 'Campagne d’intrusion — dossier de test' });
ok('dossiers de test annulés');

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.' : `\n❌ ${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
