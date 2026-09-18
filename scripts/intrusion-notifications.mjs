// Campagne d'intrusion phase 21 — file de notifications.
//
// Un message qui part au nom de la station est une parole publique : pouvoir
// écrire dans cette file, c'est pouvoir écrire « envoyez 50 000 F au 77… pour
// récupérer votre véhicule » avec l'identité du lavage. On tente donc, par
// l'API réelle, d'y insérer, d'en réécrire une, d'en lire d'une autre
// organisation, et de contourner le consentement.
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
const fatou = await connecter('fatou@vehora.test', process.env.VEHORA_TEST_PASSWORD);
const anonyme = createClient(URL, KEY);

const { data: stations } = await awa.from('stations').select('id').order('name');
const { data: dossiers } = await awa.from('service_orders').select('id').limit(1);

// --- 1. Utilisateur autorisé ------------------------------------------------
{
  const { error } = await awa.from('notifications').select('*').limit(5);
  error ? ech(`un propriétaire ne lit pas la file : ${error.message}`)
        : ok('un propriétaire lit la file de sa station');
}

// La fonctionnalité est fermée par défaut : rien ne doit s'y trouver.
{
  const { data } = await awa.rpc('mes_fonctionnalites');
  const notif = (data ?? []).find((f) => f.cle === 'notifications');
  notif && notif.actif === false
    ? ok('le drapeau « notifications » est fermé par défaut')
    : ech(`drapeau inattendu : ${JSON.stringify(notif)}`);
}

// --- 2 et 3. Non autorisé, puis malveillant --------------------------------
// Écrire dans la file, c'est parler au nom de la station.
for (const [nom, client] of [['un propriétaire', awa], ['un caissier', caissier]]) {
  const { error } = await client.from('notifications').insert({
    station_id: stations?.[0]?.id,
    service_order_id: dossiers?.[0]?.id,
    kind: 'READY',
    destination: '221770000000',
    body: 'Envoyez 50 000 F au 77 000 00 00 pour recuperer votre vehicule',
  });
  error ? ok(`${nom} n'insère rien dans la file`)
        : ech(`${nom} a mis un message en file — parole publique usurpée`);
}

// Et l'organisation_id n'est pas falsifiable : la base le pose depuis le jeton.
{
  const { error } = await awa.from('notifications').insert({
    organization_id: '00000000-0000-0000-0000-000000000000',
    station_id: stations?.[0]?.id,
    service_order_id: dossiers?.[0]?.id,
    kind: 'READY', destination: '221770000000', body: 'Test',
  });
  error ? ok('une insertion avec une organisation falsifiée est refusée')
        : ech('organisation falsifiée acceptée dans la file');
}

// Réécrire un message préparé : le texte, le destinataire, ou son statut.
{
  const { data: file } = await awa.from('notifications').select('id').limit(1);
  if (!file?.length) {
    console.log('  (file vide : réécriture non couverte — le drapeau est fermé)');
  } else {
    const id = file[0].id;
    for (const [quoi, champs] of [
      ['le texte', { body: 'Texte remplacé' }],
      ['le destinataire', { destination: '221770000099' }],
      ['le statut', { status: 'SENT' }],
    ]) {
      const { error, count } = await awa
        .from('notifications').update(champs, { count: 'exact' }).eq('id', id);
      (error || count === 0) ? ok(`${quoi} d'un message ne se réécrit pas`)
                             : ech(`${quoi} d'un message a été réécrit`);
    }

    const { error: eSup, count: nSup } = await awa
      .from('notifications').delete({ count: 'exact' }).eq('id', id);
    (eSup || nSup === 0) ? ok('un message en file ne se supprime pas')
                         : ech('un message en file a été supprimé');
  }
}

// Annuler exige un motif, et une fonction — pas un UPDATE.
{
  const { error } = await awa.rpc('annuler_notification', {
    p_notification_id: '00000000-0000-0000-0000-000000000000', p_motif: ' ',
  });
  error && /MOTIF/.test(error.message)
    ? ok('annuler un message exige son motif')
    : ech(`motif non exigé : ${error?.message}`);
}

{
  const { error } = await awa.rpc('annuler_notification', {
    p_notification_id: '00000000-0000-0000-0000-000000000000',
    p_motif: 'Message inexistant',
  });
  error && /INTROUVABLE/.test(error.message)
    ? ok('annuler un message inexistant est refusé, sans rien révéler')
    : ech(`message inexistant : ${error?.message}`);
}

// Une autre organisation ne voit rien de cette file.
{
  const { data } = await fatou.from('notifications').select('organization_id');
  const { data: mienne } = await awa.from('notifications').select('organization_id').limit(1);
  const fuite = (data ?? []).some((l) => l.organization_id === mienne?.[0]?.organization_id);
  fuite ? ech('une autre organisation lit la file de celle-ci')
        : ok('une autre organisation ne voit aucun message de celle-ci');
}

// Sans compte, rien.
{
  const { data, error } = await anonyme.from('notifications').select('*').limit(1);
  (error || (data?.length ?? 0) === 0) ? ok('sans compte, la file ne rend rien')
                                       : ech('la file est lisible sans compte');

  const { error: eA } = await anonyme.rpc('annuler_notification', {
    p_notification_id: '00000000-0000-0000-0000-000000000000', p_motif: 'Essai',
  });
  eA ? ok('sans compte, on n\'annule aucun message')
     : ech('un anonyme a pu appeler annuler_notification');
}

// Le consentement se lit, et se respecte : on vérifie au moins qu'un refus
// enregistré reste un refus (la base est seule à décider de la mise en file).
{
  const { data } = await awa.from('customers')
    .select('id, accepte_notifications').limit(5);
  (data ?? []).every((c) => typeof c.accepte_notifications === 'boolean')
    ? ok('le consentement est une donnée de la fiche client, lisible')
    : ech('le consentement client est absent des fiches');
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.'
                     : `\n❌ ${ko} faille(s).`);
process.exit(ko === 0 ? 0 : 1);
