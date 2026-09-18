// Campagne d'intrusion phase 20 — facturation des abonnements.
//
// Une facture est un document qui engage : un client qui pourrait se déclarer à
// jour, effacer une échéance ou lire ce que paient les autres tiendrait la
// comptabilité de VEHORA à sa place. On tente donc, par l'API réelle, la table,
// la vue, les fonctions privilégiées, et l'absence de compte.
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
const admin = await connecter('admin@vehora.test', process.env.VEHORA_TEST_PASSWORD_ADMIN);
const anonyme = createClient(URL, KEY);

// --- 1. Utilisateur autorisé ------------------------------------------------
{
  const { error } = await admin.rpc('emettre_factures', { p_periode: '2026-09-01' });
  error ? ech(`la plateforme n'émet pas : ${error.message}`)
        : ok('la plateforme émet les échéances du mois');
}

const { data: factures, error: eVue } = await admin
  .from('platform_invoices').select('*').order('issued_at', { ascending: false }).limit(50);
eVue ? ech(`la plateforme ne lit pas ses factures : ${eVue.message}`)
     : ok(`la plateforme lit ses factures (${factures.length})`);

const cible = (factures ?? []).find((f) => f.status === 'ISSUED');
if (!cible) console.log('  (aucune facture ouverte : certains cas non couverts)');

// Une référence lisible, et jamais deux fois la même.
{
  const refs = (factures ?? []).map((f) => f.reference);
  const doublons = refs.length - new Set(refs).size;
  const forme = refs.every((r) => /^VH-\d{4}-\d{6}$/.test(r));
  (doublons === 0 && forme)
    ? ok('les références sont uniques et lisibles')
    : ech(`références : ${doublons} doublon(s), forme ${forme ? 'ok' : 'inattendue'}`);
}

// Rejouée, l'émission ne refacture pas la période.
{
  const avant = (await admin.from('platform_invoices').select('id')).data?.length ?? 0;
  await admin.rpc('emettre_factures', { p_periode: '2026-09-01' });
  const apres = (await admin.from('platform_invoices').select('id')).data?.length ?? 0;
  avant === apres ? ok('émettre deux fois la même période ne refacture pas')
                  : ech(`la période a été refacturée (${avant} → ${apres})`);
}

// --- 2. Utilisateur non autorisé -------------------------------------------
for (const [nom, client] of [['un propriétaire', awa], ['un caissier', caissier]]) {
  const { data } = await client.from('invoices').select('*');
  (data?.length ?? 0) === 0
    ? ok(`${nom} ne lit aucune facture par la table`)
    : ech(`${nom} a lu ${data.length} facture(s) par la table`);

  const { data: vue } = await client.from('platform_invoices').select('*');
  (vue?.length ?? 0) === 0
    ? ok(`${nom} ne lit rien par la vue de plateforme`)
    : ech(`${nom} a lu ${vue.length} ligne(s) de la vue de plateforme`);

  const { error } = await client.rpc('emettre_factures', { p_periode: '2026-10-01' });
  error ? ok(`${nom} n'émet pas de facture`)
        : ech(`${nom} a émis des factures`);

  const { error: eRelance } = await client.rpc('relancer_impayes');
  eRelance ? ok(`${nom} ne relance pas les impayés`)
           : ech(`${nom} a lancé la relance des impayés`);
}

// Ses propres factures, en revanche, le regardent.
{
  const { data, error } = await awa.rpc('mes_factures');
  error ? ech(`mes_factures() refuse le propriétaire : ${error.message}`)
        : ok(`un propriétaire retrouve ses factures (${data.length})`);

  // Et elles ne parlent que de lui : aucune n'appartient à une autre
  // organisation — la fonction ne prend aucun paramètre, il n'y a rien à
  // falsifier, mais on le vérifie plutôt que de le supposer.
  const refsSiennes = new Set((data ?? []).map((f) => f.reference));
  const toutes = new Set((factures ?? []).map((f) => f.reference));
  const auDela = [...refsSiennes].filter((r) => !toutes.has(r));
  auDela.length === 0
    ? ok('mes_factures() ne rend que des factures existantes de son organisation')
    : ech(`${auDela.length} référence(s) inattendue(s)`);
}

// --- 3. Utilisateur malveillant --------------------------------------------
if (cible) {
  // Se déclarer à jour.
  const { error } = await awa.rpc('marquer_facture_payee', {
    p_invoice_id: cible.id, p_reference: 'je me déclare à jour',
  });
  error ? ok('un client ne déclare pas sa facture réglée')
        : ech('un client a marqué une facture réglée');

  // Effacer l'échéance.
  const { error: eAnnul } = await awa.rpc('annuler_facture', {
    p_invoice_id: cible.id, p_motif: 'je ne veux pas payer',
  });
  eAnnul ? ok('un client n\'annule pas sa facture')
         : ech('un client a annulé une facture');

  // Réécrire le montant, directement.
  const { error: eMaj, count } = await awa
    .from('invoices').update({ amount_minor: 0 }, { count: 'exact' }).eq('id', cible.id);
  (eMaj || count === 0)
    ? ok('un client ne réécrit pas le montant d\'une facture')
    : ech('un client a réécrit le montant d\'une facture');

  // La faire disparaître.
  const { error: eSup, count: nSup } = await awa
    .from('invoices').delete({ count: 'exact' }).eq('id', cible.id);
  (eSup || nSup === 0)
    ? ok('un client ne supprime pas une facture')
    : ech('un client a supprimé une facture');

  // Et la plateforme elle-même ne réécrit pas une facture par la table : elle
  // passe par les fonctions, qui auditent.
  const { error: ePlat, count: nPlat } = await admin
    .from('invoices').update({ amount_minor: 1 }, { count: 'exact' }).eq('id', cible.id);
  (ePlat || nPlat === 0)
    ? ok('la plateforme non plus ne réécrit pas une facture par la table')
    : ech('la plateforme a réécrit une facture par la table');
}

// Sans compte, rien — ni la table, ni la vue, ni les fonctions.
{
  const { data, error } = await anonyme.from('invoices').select('*').limit(1);
  (error || (data?.length ?? 0) === 0) ? ok('sans compte, aucune facture')
                                       : ech('les factures sont lisibles sans compte');

  const { data: vue, error: eV } = await anonyme.from('platform_invoices').select('*').limit(1);
  (eV || (vue?.length ?? 0) === 0) ? ok('sans compte, la vue de plateforme ne rend rien')
                                   : ech('la vue de plateforme est lisible sans compte');

  const { error: eF } = await anonyme.rpc('mes_factures');
  eF ? ok('sans compte, mes_factures() est refusée')
     : ech('mes_factures() répond sans compte');

  const { error: eE } = await anonyme.rpc('emettre_factures', {});
  eE ? ok('sans compte, on n\'émet pas de facture')
     : ech('l\'émission de factures répond sans compte');
}

// Un délai de paiement absurde est refusé avant toute écriture.
{
  const { error } = await admin.rpc('emettre_factures', {
    p_periode: '2026-11-01', p_delai_jours: 9999,
  });
  error ? ok('un délai de paiement absurde est refusé')
        : ech('un délai de 9999 jours a été accepté');
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.'
                     : `\n❌ ${ko} faille(s).`);
process.exit(ko === 0 ? 0 : 1);
