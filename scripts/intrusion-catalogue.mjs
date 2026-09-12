// Campagne d'intrusion phase 8 — catalogue et tarifs, par l'API réelle.
import { createClient } from '@supabase/supabase-js';

const URL = 'https://entpmxssjxllggsqhnwc.supabase.co';
const KEY = 'sb_publishable_e3seZbuqZkKCNHaW2GeEHA_wa5V8-Y2';

const comptes = {
  awa:     [process.env.VEHORA_TEST_EMAIL, process.env.VEHORA_TEST_PASSWORD],
  caissier:[process.env.VEHORA_TEST_EMAIL_CAISSIER, process.env.VEHORA_TEST_PASSWORD_CAISSIER],
  fatou:   ['fatou@vehora.test', process.env.VEHORA_TEST_PASSWORD_FATOU],
};

let ko = 0;
const ok  = (m) => console.log('  ok —', m);
const ech = (m) => { ko++; console.log('  ÉCHEC —', m); };

async function connecter(email, mdp) {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: mdp });
  if (error) throw new Error(`${email} : ${error.message}`);
  return c;
}

const awa = await connecter(...comptes.awa);
const caissier = await connecter(...comptes.caissier);

// Référence : l'organisation d'Awa et son catalogue.
const { data: services } = await awa.from('services').select('id, name');
const lavage = services.find((s) => s.name === 'Lavage complet');
const { data: prix } = await awa.from('service_prices').select('id, amount_minor, currency');

console.log('1. Un caissier ne fixe pas les prix');
{
  const { error } = await caissier.from('service_prices').insert({
    service_id: lavage.id, amount_minor: 1,
  });
  error?.code === '42501' ? ok('création de tarif refusée (42501)')
                          : ech(`création de tarif acceptée : ${JSON.stringify(error)}`);

  const cible = prix[0];
  const { data } = await caissier.from('service_prices')
    .update({ amount_minor: 1 }).eq('id', cible.id).select();
  (data ?? []).length === 0 ? ok('modification de tarif sans effet')
                            : ech('un caissier a modifié un tarif');

  const { data: apres } = await awa.from('service_prices')
    .select('amount_minor').eq('id', cible.id).single();
  apres.amount_minor === cible.amount_minor ? ok('le montant est inchangé')
                                            : ech('le montant a changé');

  const { data: suppr } = await caissier.from('service_prices')
    .delete().eq('id', cible.id).select();
  (suppr ?? []).length === 0 ? ok('suppression de tarif sans effet')
                             : ech('un caissier a supprimé un tarif');
}

console.log('2. Un caissier ne gère pas le catalogue');
{
  const { error } = await caissier.from('services').insert({ name: 'Service pirate' });
  error?.code === '42501' ? ok('création de service refusée (42501)')
                          : ech(`création de service acceptée : ${JSON.stringify(error)}`);

  const { data } = await caissier.from('services')
    .update({ name: 'Renommé' }).eq('id', lavage.id).select();
  (data ?? []).length === 0 ? ok('renommage sans effet') : ech('un caissier a renommé un service');
}

console.log('3. La devise n’est pas négociable depuis le client');
{
  // Sur une prestation sans tarif ouvert : un tarif en vigueur court jusqu'à
  // l'infini, donc aucune date future n'est libre — c'est justement ce que
  // `remplacer_tarif` résout.
  const aspiration = services.find((s) => s.name === 'Aspiration intérieur');
  const { data, error } = await awa.from('service_prices')
    .insert({ service_id: aspiration.id, amount_minor: 1234, currency: 'EUR' })
    .select('id, currency').single();
  if (error) { ech(`insertion refusée : ${error.message}`); }
  else {
    data.currency === 'XOF' ? ok('devise forcée à XOF malgré « EUR » envoyé')
                            : ech(`devise acceptée : ${data.currency}`);
    await awa.from('service_prices').delete().eq('id', data.id);
  }
}

console.log('4. organization_id n’est pas falsifiable');
{
  const { error } = await awa.from('services').insert({
    name: 'Service hors organisation',
    organization_id: '00000000-0000-0000-0000-000000000000',
  });
  error ? ok(`organization_id imposé refusé (${error.code})`)
        : ech('un service a été créé pour une autre organisation');
}

console.log('5. Deux tarifs concurrents sont impossibles');
{
  const { error } = await awa.from('service_prices')
    .insert({ service_id: lavage.id, amount_minor: 9999 });
  error?.code === '23P01' ? ok('chevauchement de tarifs refusé (23P01)')
                          : ech(`chevauchement accepté : ${JSON.stringify(error)}`);
}

console.log('6. Un montant négatif n’est pas une remise');
{
  const { error } = await awa.from('service_prices')
    .insert({ service_id: lavage.id, amount_minor: -1, valid_from: '2098-01-01' });
  error?.code === '23514' ? ok('montant négatif refusé (23514)')
                          : ech(`montant négatif accepté : ${JSON.stringify(error)}`);
}

console.log('7. Une autre organisation ne voit rien');
if (!comptes.fatou[1]) console.log('  (ignoré — mot de passe de fatou@vehora.test absent)');
else {
  const fatou = await connecter(...comptes.fatou);
  const { data: sf } = await fatou.from('services').select('id');
  (sf ?? []).every((s) => !services.some((x) => x.id === s.id))
    ? ok('aucun service de Station Awa visible') : ech('fuite de catalogue entre organisations');

  const { data: pf } = await fatou.from('service_prices').select('id');
  (pf ?? []).every((p) => !prix.some((x) => x.id === p.id))
    ? ok('aucun tarif de Station Awa visible') : ech('fuite de tarifs entre organisations');

  const { data: r } = await fatou.rpc('resoudre_prix', { p_service_id: lavage.id });
  (r ?? []).length === 0 ? ok('resoudre_prix ne traverse pas les organisations')
                         : ech('resoudre_prix a renvoyé le tarif d’une autre organisation');

  const { error } = await fatou.from('service_prices')
    .insert({ service_id: lavage.id, amount_minor: 1 });
  error ? ok(`tarifer le service d’autrui refusé (${error.code})`)
        : ech('un tarif a été posé sur le service d’une autre organisation');
}

console.log('8. Remplacer un tarif reste réservé à prices.manage');
{
  const ouvert = (await awa.from('service_prices')
    .select('id').is('valid_to', null).limit(1)).data[0];

  const { error } = await caissier.rpc('remplacer_tarif', {
    p_price_id: ouvert.id, p_amount_minor: 1, p_valid_from: '2099-01-01',
  });
  // Le tarif n'est même pas visible en écriture : la fonction refuse en amont.
  error ? ok(`remplacement refusé (${error.code ?? error.message.slice(0, 40)})`)
        : ech('un caissier a remplacé un tarif');

  const { data: apres } = await awa.from('service_prices')
    .select('valid_to').eq('id', ouvert.id).single();
  apres.valid_to === null ? ok('le tarif est resté ouvert')
                          : ech('le tarif a été fermé par un caissier');
}

console.log('9. Le prix est celui du serveur');
{
  const { data } = await awa.rpc('resoudre_prix', { p_service_id: lavage.id });
  data?.[0]?.amount_minor === 5000 && data[0].currency === 'XOF'
    ? ok('tarif général résolu à 5000 XOF')
    : ech(`résolution inattendue : ${JSON.stringify(data)}`);

  const { data: types } = await awa.from('vehicle_types').select('id, code');
  const suv = types.find((t) => t.code === 'SUV');
  const { data: d2 } = await awa.rpc('resoudre_prix', {
    p_service_id: lavage.id, p_vehicle_type_id: suv.id,
  });
  d2?.[0]?.amount_minor === 8000 && d2[0].specificite === 'SERVICE_TYPE'
    ? ok('tarif SUV résolu à 8000 XOF') : ech(`résolution SUV inattendue : ${JSON.stringify(d2)}`);
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.' : `\n❌ ${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
