// Campagne d'intrusion phase 14 — abonnements, quotas et feature flags.
//
// Un abonnement est ce qui décide de ce qu'une organisation peut faire. Les
// tentations sont donc : s'ouvrir une fonctionnalité qu'on ne paie pas, se
// donner une station de plus, lire la grille tarifaire ou l'abonnement du
// voisin. Tout cela se tente ici par l'API réelle.
import './proxy-node.mjs';
import { createClient } from '@supabase/supabase-js';

const URL = 'https://entpmxssjxllggsqhnwc.supabase.co';
const KEY = 'sb_publishable_e3seZbuqZkKCNHaW2GeEHA_wa5V8-Y2';

let ko = 0;
const ok = (m) => console.log('  ok —', m);
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

const { data: moi } = await awa.from('organizations').select('id, name').limit(1).single();
console.log(`0. Organisation de test : ${moi.name}`);

console.log('1. Un client ne lit ni la grille tarifaire ni les abonnements');
{
  const { data: plans } = await awa.from('plans').select('*');
  (plans ?? []).length === 0 ? ok('la grille tarifaire est hors de portée du client')
                             : ech(`${plans.length} plan(s) lisibles par un client`);

  const { data: abos } = await awa.from('subscriptions').select('*');
  (abos ?? []).length === 0 ? ok('les abonnements sont hors de portée du client')
                            : ech(`${abos.length} abonnement(s) lisibles`);

  const { data: derog } = await awa.from('organization_feature_overrides').select('*');
  (derog ?? []).length === 0 ? ok('les dérogations sont hors de portée du client')
                             : ech('les dérogations accordées ailleurs sont lisibles');
}

console.log('2. Mais il sait où il en est, et seulement pour lui');
{
  const { data, error } = await awa.rpc('mon_abonnement');
  const ligne = data?.[0];
  !error && data?.length === 1 && ligne.plan_code
    ? ok(`son plan lui est rendu (${ligne.plan_code}), une seule ligne`)
    : ech(`mon_abonnement : ${JSON.stringify(error ?? data)}`);

  const { data: f } = await awa.rpc('mes_fonctionnalites');
  (f ?? []).length > 0 && f.every((x) => typeof x.actif === 'boolean')
    ? ok('les fonctionnalités sont résolues par le serveur')
    : ech(`mes_fonctionnalites : ${JSON.stringify(f)}`);
}

console.log('3. Il ne change pas son plan, ni celui d’un autre');
{
  const { error } = await awa.rpc('changer_plan', {
    p_organization_id: moi.id, p_plan_code: 'SUR_MESURE', p_motif: 'Tentative',
  });
  error?.message.includes('VEHORA_PLATEFORME_REFUSEE')
    ? ok('changer de plan est réservé à la plateforme')
    : ech(`changement accepté : ${JSON.stringify(error)}`);
}

console.log('4. Il ne s’ouvre pas une fonctionnalité');
{
  const { error } = await awa.rpc('basculer_fonctionnalite', {
    p_organization_id: moi.id, p_cle: 'rapports', p_actif: true, p_motif: 'Tentative',
  });
  error?.message.includes('VEHORA_PLATEFORME_REFUSEE')
    ? ok('ouvrir une fonctionnalité est réservé à la plateforme')
    : ech(`bascule acceptée : ${JSON.stringify(error)}`);
}

console.log('5. Il n’écrit pas dans les tables d’abonnement');
{
  const { error } = await awa.from('organization_feature_overrides').insert({
    organization_id: moi.id, flag_key: 'rapports', enabled: true,
  });
  error ? ok(`insertion d’une dérogation refusée (${error.code})`)
        : ech('une dérogation a été écrite depuis un compte client');

  const { data: plans } = await admin.from('plans').select('id').limit(1);
  const { error: e2 } = await awa.from('subscriptions').insert({
    organization_id: moi.id, plan_id: plans[0].id, status: 'ACTIVE',
  });
  e2 ? ok(`insertion d’un abonnement refusée (${e2.code})`)
     : ech('un abonnement a été écrit depuis un compte client');
}

console.log('6. Un caissier non plus, évidemment');
{
  const { error } = await caissier.rpc('changer_plan', {
    p_organization_id: moi.id, p_plan_code: 'SUR_MESURE', p_motif: 'Tentative',
  });
  error ? ok('un caissier ne change aucun plan')
        : ech('un caissier a changé le plan de son organisation');
}

console.log('7. Anonyme : rien du tout');
{
  const { data } = await anonyme.from('plans').select('*');
  (data ?? []).length === 0 ? ok('la grille tarifaire n’est pas publique')
                            : ech('les plans sont lisibles sans être connecté');

  const { error } = await anonyme.rpc('mon_abonnement');
  error ? ok(`mon_abonnement refusé à l’anonyme (${error.code})`)
        : ech('un anonyme a lu un abonnement');
}

console.log('8. La plateforme voit les plans, et seulement des métadonnées');
{
  const { data, error } = await admin.from('platform_subscriptions').select('*');
  !error && (data ?? []).length > 0
    ? ok(`la plateforme voit ${data.length} abonnement(s)`)
    : ech(`vue de plateforme vide ou refusée : ${JSON.stringify(error)}`);

  // Le prix affiché est celui du PLAN (un revenu VEHORA), jamais le chiffre
  // d'affaires du client : la vue n'a aucune colonne de CA.
  const colonnes = Object.keys(data?.[0] ?? {});
  !colonnes.some((c) => /encaiss|chiffre|revenu_client/i.test(c))
    ? ok('aucune colonne de chiffre d’affaires client dans la vue')
    : ech(`colonne suspecte : ${colonnes.join(', ')}`);
}

console.log('9. Changer un plan : motif obligatoire, et pas sous l’usage réel');
{
  const { error: e1 } = await admin.rpc('changer_plan', {
    p_organization_id: moi.id, p_plan_code: 'PRO', p_motif: '   ',
  });
  e1?.message.includes('VEHORA_MOTIF_REQUIS')
    ? ok('un changement de plan sans motif est refusé')
    : ech(`motif non exigé : ${JSON.stringify(e1)}`);

  const { error: e2 } = await admin.rpc('changer_plan', {
    p_organization_id: moi.id, p_plan_code: 'DECOUVERTE', p_motif: 'Rétrogradation',
  });
  e2?.message.includes('VEHORA_PLAN_TROP_ETROIT')
    ? ok('un plan plus étroit que l’usage réel est refusé')
    : ech(`rétrogradation acceptée : ${JSON.stringify(e2)}`);

  const { error: e3 } = await admin.rpc('changer_plan', {
    p_organization_id: moi.id, p_plan_code: 'PRO', p_motif: 'Déjà sur ce plan',
  });
  e3?.message.includes('VEHORA_PLAN_INCHANGE')
    ? ok('reposer le plan déjà en cours est refusé')
    : ech(`replacement accepté : ${JSON.stringify(e3)}`);
}

console.log('10. Une dérogation s’applique, s’audite, et se retire');
{
  const { data: avant } = await awa.rpc('mes_fonctionnalites');
  const etatAvant = avant.find((f) => f.cle === 'rapports')?.actif;

  const { data: apres, error } = await admin.rpc('basculer_fonctionnalite', {
    p_organization_id: moi.id, p_cle: 'rapports', p_actif: !etatAvant,
    p_motif: 'Campagne d’intrusion',
  });
  !error && apres === !etatAvant
    ? ok(`la dérogation inverse l’état (${etatAvant} → ${apres})`)
    : ech(`bascule sans effet : ${JSON.stringify(error ?? apres)}`);

  const { data: journal } = await admin.from('platform_audit_logs')
    .select('action, reason').eq('action', 'platform.feature.toggle')
    .order('occurred_at', { ascending: false }).limit(1);
  journal?.[0]?.reason === 'Campagne d’intrusion'
    ? ok('la dérogation est auditée avec son motif')
    : ech('dérogation non auditée');

  // Un flag qui n'empêche rien n'est pas un flag : l'API doit suivre.
  const { error: eRapport } = await awa.rpc('rapport_journalier', {
    p_debut: '2026-09-01', p_fin: '2026-09-30',
  });
  if (etatAvant) {
    eRapport?.message.includes('VEHORA_FONCTIONNALITE_FERMEE')
      ? ok('fermer la fonctionnalité ferme l’API, pas seulement l’écran')
      : ech(`rapport rendu malgré la fermeture : ${JSON.stringify(eRapport)}`);
  } else {
    !eRapport ? ok('ouvrir la fonctionnalité ouvre l’API')
              : ech(`rapport refusé malgré l’ouverture : ${JSON.stringify(eRapport)}`);
  }

  const { data: retire } = await admin.rpc('basculer_fonctionnalite', {
    p_organization_id: moi.id, p_cle: 'rapports', p_actif: null,
    p_motif: 'Retour au plan',
  });
  retire === etatAvant
    ? ok('retirer la dérogation rend la main au plan')
    : ech(`retrait sans effet : ${retire}`);
}

console.log('11. Une fonctionnalité qui n’existe pas ne s’ouvre pas');
{
  const { error } = await admin.rpc('basculer_fonctionnalite', {
    p_organization_id: moi.id, p_cle: 'cle_inventee', p_actif: true, p_motif: 'Test',
  });
  error?.message.includes('VEHORA_FONCTIONNALITE_INCONNUE')
    ? ok('une clé inconnue est refusée')
    : ech(`clé inconnue acceptée : ${JSON.stringify(error)}`);
}

console.log('12. Le quota de stations est appliqué par la base');
{
  // L'organisation de test est sur un plan large : on vérifie que la limite
  // existe bien en tentant de dépasser celle de son plan.
  const { data: abo } = await awa.rpc('mon_abonnement');
  const { max_stations, stations_utilisees } = abo[0];

  if (max_stations === null) {
    ok('plan sans limite de stations : rien à dépasser');
  } else {
    const reste = max_stations - stations_utilisees;
    const creees = [];
    let refus = null;
    for (let i = 0; i <= reste; i++) {
      const { data, error } = await awa.from('stations')
        .insert({ name: `Quota ${Date.now()}-${i}` }).select('id').single();
      if (error) { refus = error; break; }
      creees.push(data.id);
    }
    refus?.message.includes('VEHORA_QUOTA_STATIONS')
      ? ok(`quota atteint à ${max_stations} stations, la suivante est refusée`)
      : ech(`quota non appliqué : ${JSON.stringify(refus)}`);

    for (const id of creees) await awa.from('stations').delete().eq('id', id);
  }
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.' : `\n❌ ${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
