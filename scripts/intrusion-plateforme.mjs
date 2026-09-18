// Campagne d'intrusion phase 12 — espace Super Admin.
//
// Ce qui est vérifié ici est la propriété la plus importante de la fondation 3 :
// un compte de plateforme, malgré ses droits, n'atteint AUCUNE donnée métier
// d'un client. Pas une ligne. Si une policy `or is_platform_admin()` apparaît
// un jour quelque part, c'est ce script qui doit le dire.
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

const admin = await connecter('admin@vehora.test', process.env.VEHORA_TEST_PASSWORD_ADMIN);
const awa   = await connecter(process.env.VEHORA_TEST_EMAIL, process.env.VEHORA_TEST_PASSWORD);

console.log('0. Le compte de plateforme est bien reconnu comme tel');
{
  const { data } = await admin.auth.getSession();
  const claims = JSON.parse(
    Buffer.from(data.session.access_token.split('.')[1], 'base64').toString(),
  );
  claims.is_platform_admin === true
    ? ok(`is_platform_admin = true, rôle ${claims.vehora_role}`)
    : ech(`claims inattendus : ${JSON.stringify(claims.vehora_role)}`);
}

console.log('1. Aucune donnée métier d’un client, sur aucune table');
{
  const tables = [
    'customers', 'vehicles', 'service_orders', 'service_order_items',
    'service_order_operations', 'vehicle_inspections', 'inspection_items',
    'inspection_photos', 'payments', 'cash_registers', 'cash_transactions',
    'employees', 'services', 'service_prices', 'service_categories', 'stations',
  ];
  let fuite = 0;
  for (const table of tables) {
    const { data, error } = await admin.from(table).select('id').limit(1);
    if (error) { ech(`${table} : ${error.message}`); continue; }
    if ((data ?? []).length > 0) { ech(`${table} : ${data.length} ligne(s) visible(s)`); fuite++; }
  }
  if (fuite === 0) ok(`${tables.length} tables métier vérifiées, aucune ligne visible`);
}

console.log('2. Ni par les vues dérivées');
{
  for (const vue of ['service_order_totals', 'service_order_payment_state', 'cash_register_state']) {
    const { data, error } = await admin.from(vue).select('*').limit(1);
    if (error) { ech(`${vue} : ${error.message}`); continue; }
    (data ?? []).length === 0 ? ok(`${vue} ne renvoie rien à la plateforme`)
                              : ech(`${vue} expose ${data.length} ligne(s)`);
  }
}

console.log('3. Ni par un identifiant deviné');
{
  const { data: dossiers } = await awa.from('service_orders').select('id').limit(1);
  const { data: clients }  = await awa.from('customers').select('id').limit(1);

  const { data: d } = await admin.from('service_orders')
    .select('*').eq('id', dossiers[0].id);
  (d ?? []).length === 0 ? ok('un identifiant de dossier connu ne donne rien')
                         : ech('un dossier a été lu par identifiant');

  const { data: c } = await admin.from('customers').select('*').eq('id', clients[0].id);
  (c ?? []).length === 0 ? ok('un identifiant de client connu ne donne rien')
                         : ech('un client a été lu par identifiant');

  const { error } = await admin.rpc('transitionner_dossier', {
    p_service_order_id: dossiers[0].id, p_to_status: 'CANCELLED', p_reason: 'Tentative',
  });
  error ? ok(`transitionner un dossier client refusé (${error.code ?? ''})`)
        : ech('la plateforme a transitionné un dossier client');
}

console.log('4. Ce qu’il voit : des agrégats');
{
  const { data, error } = await admin.from('platform_organizations').select('*');
  if (error) { ech(`vue refusée : ${error.message}`); }
  else {
    (data ?? []).length > 0 ? ok(`${data.length} organisation(s) cliente(s) listée(s)`)
                            : ech('aucune organisation listée');
    data.every((o) => o.slug !== 'vehora-platform')
      ? ok('l’organisation de plateforme n’est pas comptée comme cliente')
      : ech('l’organisation de plateforme apparaît dans la liste');

    const colonnes = Object.keys(data[0] ?? {});
    colonnes.some((c) => /amount|ca_|revenu|total/.test(c))
      ? ech(`la vue expose un montant : ${colonnes.join(', ')}`)
      : ok('aucun chiffre d’affaires exposé, seulement des volumes');
  }
}

console.log('5. Un client ne voit pas la plateforme');
{
  const { data } = await awa.from('platform_organizations').select('*');
  (data ?? []).length === 0 ? ok('la vue est vide pour un client')
                            : ech(`un client voit ${data.length} ligne(s) de plateforme`);

  const { data: j } = await awa.from('platform_audit_logs').select('*');
  (j ?? []).length === 0 ? ok('le journal de plateforme est vide pour un client')
                         : ech('un client lit le journal de plateforme');

  const { data: orgs } = await admin.from('platform_organizations').select('id').limit(1);
  const { error } = await awa.rpc('suspendre_organisation', {
    p_organization_id: orgs[0].id, p_motif: 'Tentative',
  });
  error ? ok(`suspendre refusé à un client (${error.code ?? ''})`)
        : ech('un client a suspendu une organisation');
}

console.log('6. Suspension : motif obligatoire, effet immédiat, audit');
{
  // Jamais l'organisation de démonstration : la suspendre couperait les autres
  // campagnes et les tests de parcours qui tournent sur le même compte.
  const { data: candidates } = await admin.from('platform_organizations')
    .select('id, name, status').neq('name', 'Station Awa').order('created_at');
  const cible = (candidates ?? []).find((o) => o.status !== 'SUSPENDED');
  if (!cible) {
    ech(`aucune organisation suspendable : ${JSON.stringify(candidates)}`);
    console.log(`\n❌ ${ko} échec(s).`);
    process.exit(1);
  }

  const { error: e1 } = await admin.rpc('suspendre_organisation', {
    p_organization_id: cible.id, p_motif: '   ',
  });
  e1?.message.includes('VEHORA_MOTIF_REQUIS') ? ok('suspension sans motif refusée')
                                              : ech(`suspension acceptée : ${JSON.stringify(e1)}`);

  const { data: o, error: e2 } = await admin.rpc('suspendre_organisation', {
    p_organization_id: cible.id, p_motif: 'Campagne d’intrusion — suspension de test',
  });
  if (e2) { ech(`suspension refusée : ${e2.message}`); }
  else {
    o.status === 'SUSPENDED' ? ok(`${cible.name} suspendue`) : ech(`statut : ${o.status}`);

    const { data: j } = await admin.from('platform_audit_logs')
      .select('action, reason').eq('resource_id', cible.id)
      .order('occurred_at', { ascending: false }).limit(1);
    j?.[0]?.action === 'platform.organization.suspend'
      ? ok('suspension auditée dans le journal de plateforme')
      : ech(`journal inattendu : ${JSON.stringify(j)}`);

    const { error: e3 } = await admin.rpc('suspendre_organisation', {
      p_organization_id: cible.id, p_motif: 'Encore',
    });
    e3?.message.includes('VEHORA_DEJA_SUSPENDUE') ? ok('double suspension refusée')
                                                  : ech('double suspension acceptée');

    const { error: e4 } = await admin.rpc('reactiver_organisation', {
      p_organization_id: cible.id, p_motif: 'Campagne d’intrusion — réactivation',
    });
    !e4 ? ok('réactivation enregistrée') : ech(`réactivation refusée : ${e4.message}`);
  }
}

console.log('7. Le journal de plateforme ne contient que des actions de plateforme');
{
  const { data } = await admin.from('platform_audit_logs').select('action').limit(200);
  (data ?? []).every((l) => l.action.startsWith('platform.'))
    ? ok(`${data.length} entrées, toutes de plateforme`)
    : ech('le journal expose des actions métier de clients');
}

console.log(ko === 0 ? '\n✅ Campagne d’intrusion : tout est bloqué.' : `\n❌ ${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
