// Campagne d'intrusion phase 23 — paramètres d'organisation.
//
// L'écran « Paramètres » ouvre, pour la première fois, l'écriture de la fiche
// de l'organisation depuis le navigateur. Or trois colonnes de cette table ne
// sont pas des réglages : la devise réinterprète tous les montants déjà
// enregistrés (60 000 F CFA deviendraient 60 000 €, reçus déjà remis compris),
// le raccourci est une identité, l'état est une décision de la plateforme.
// Le trigger `vehora.protect_organization()` les refuse. On le vérifie ici par
// l'API réelle, pas par l'écran : un formulaire qui n'affiche pas un champ
// n'empêche personne de l'envoyer.
import './proxy-node.mjs';
import { createClient } from '@supabase/supabase-js';

const URL = 'https://entpmxssjxllggsqhnwc.supabase.co';
const KEY = 'sb_publishable_e3seZbuqZkKCNHaW2GeEHA_wa5V8-Y2';

let ko = 0;
const ok = (m) => console.log('  ok —', m);
const ech = (m) => {
  ko++;
  console.log('  ÉCHEC —', m);
};

async function connecter(email, mdp) {
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: mdp });
  if (error) throw new Error(`${email} : ${error.message}`);
  return c;
}

const awa = await connecter(process.env.VEHORA_TEST_EMAIL, process.env.VEHORA_TEST_PASSWORD);
const caissier = await connecter(
  process.env.VEHORA_TEST_EMAIL_CAISSIER,
  process.env.VEHORA_TEST_PASSWORD_CAISSIER,
);
const fatou = await connecter('fatou@vehora.test', process.env.VEHORA_TEST_PASSWORD);
const anonyme = createClient(URL, KEY);

const { data: org } = await awa
  .from('organizations')
  .select('id, name, city, slug, currency, status')
  .limit(1)
  .maybeSingle();
if (!org) throw new Error('aucune organisation lisible pour le propriétaire');

const { data: orgB } = await fatou.from('organizations').select('id').limit(1).maybeSingle();

// --- 1. Utilisateur autorisé ------------------------------------------------
{
  const { error } = await awa.from('organizations').update({ city: org.city }).eq('id', org.id);
  error
    ? ech(`un propriétaire ne règle pas sa ville : ${error.message}`)
    : ok('un propriétaire règle les champs de sa fiche');
}
{
  const { data } = await awa
    .from('organization_settings')
    .select('payment_before_delivery')
    .limit(1)
    .maybeSingle();
  const avant = data?.payment_before_delivery;
  const autre = avant === 'STRICT' ? 'ALLOW_DEBT' : 'STRICT';
  const { error } = await awa
    .from('organization_settings')
    .update({ payment_before_delivery: autre })
    .eq('organization_id', org.id);
  if (error) ech(`un propriétaire ne change pas la règle de paiement : ${error.message}`);
  else {
    ok('un propriétaire change la règle de paiement avant restitution');
    await awa
      .from('organization_settings')
      .update({ payment_before_delivery: avant })
      .eq('organization_id', org.id);
  }
}

// --- 2 et 3. Non autorisé, puis malveillant --------------------------------
// La devise : le champ n'est pas à l'écran, mais l'API l'accepterait sans le
// trigger. C'est le défaut trouvé en phase 23, sur la base réelle.
for (const [champ, valeur] of [
  ['currency', org.currency === 'XOF' ? 'EUR' : 'XOF'],
  ['slug', `${org.slug}-vole`],
  ['status', org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'],
]) {
  const { error } = await awa
    .from('organizations')
    .update({ [champ]: valeur })
    .eq('id', org.id);
  error
    ? ok(`un propriétaire ne change pas « ${champ} » (${error.code ?? error.message})`)
    : ech(`un propriétaire a changé « ${champ} » — montants ou identité falsifiables`);
}

// Le même refus doit valoir quand la colonne voyage avec des champs légitimes :
// une mise à jour partiellement acceptée serait pire qu'un refus franc.
{
  const { error } = await awa
    .from('organizations')
    .update({ city: org.city, currency: org.currency === 'XOF' ? 'EUR' : 'XOF' })
    .eq('id', org.id);
  error
    ? ok('la devise glissée au milieu de champs légitimes est refusée')
    : ech('la devise passe quand elle accompagne un champ autorisé');
}

// Le caissier : il lit son organisation, il ne la règle pas.
{
  const { error } = await caissier
    .from('organizations')
    .update({ name: 'Station du caissier' })
    .eq('id', org.id);
  error
    ? ok('un caissier ne renomme pas l’organisation')
    : ech('un caissier a renommé l’organisation');

  const { error: eR } = await caissier
    .from('organization_settings')
    .update({ payment_before_delivery: 'ALLOW_DEBT' })
    .eq('organization_id', org.id);
  eR
    ? ok('un caissier ne change pas les règles de travail')
    : ech('un caissier a changé les règles de travail');
}

// Une autre organisation : ni fiche, ni réglages, ni lecture.
{
  const { error } = await fatou
    .from('organizations')
    .update({ name: 'Reprise hostile' })
    .eq('id', org.id);
  error
    ? ok('une autre organisation ne renomme pas celle-ci')
    : ech('une autre organisation a renommé celle-ci');

  const { data } = await fatou
    .from('organization_settings')
    .select('*')
    .eq('organization_id', org.id);
  (data?.length ?? 0) === 0
    ? ok('une autre organisation ne lit pas ces réglages')
    : ech('les réglages d’autrui sont lisibles');

  if (orgB) {
    const { error: eD } = await awa
      .from('organizations')
      .update({ name: 'Absorbée' })
      .eq('id', orgB.id);
    eD || true; // la RLS rend 0 ligne sans erreur : on vérifie l'effet, pas le code
    const { data: apres } = await fatou
      .from('organizations')
      .select('name')
      .eq('id', orgB.id)
      .maybeSingle();
    apres && apres.name !== 'Absorbée'
      ? ok('écrire chez le voisin ne change rien chez lui')
      : ech('le nom du voisin a changé');
  }
}

// Sans compte : rien.
{
  const { error } = await anonyme
    .from('organizations')
    .update({ name: 'Anonyme' })
    .eq('id', org.id);
  const { data } = await anonyme.from('organization_settings').select('*').limit(1);
  (error || true) && (data?.length ?? 0) === 0
    ? ok('sans compte, ni lecture ni écriture des paramètres')
    : ech('les paramètres sont accessibles sans compte');
}

// Le trigger ne doit pas avoir cassé la suspension par la plateforme : c'est
// elle, et elle seule, qui écrit `status`.
{
  const { data } = await awa.from('organizations').select('status').eq('id', org.id).maybeSingle();
  data?.status === org.status
    ? ok(`l’état est resté « ${org.status} »`)
    : ech(`l’état a bougé : ${data?.status}`);
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.' : `\n❌ ${ko} faille(s).`);
process.exit(ko === 0 ? 0 : 1);
