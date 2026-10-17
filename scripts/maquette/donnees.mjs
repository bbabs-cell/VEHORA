// Jeu de données SIMULÉ pour le banc de vérification visuelle.
//
// Il ne quitte jamais la machine : le banc intercepte les appels Supabase du
// navigateur et répond avec ces lignes. Aucune base, aucun compte, aucun mot
// de passe — c'est ce qui permet de capturer TOUS les écrans à 375 px même
// quand les secrets des tests ne sont pas là (méthode MagyaPro : « capture à
// 375 × 812 de chaque écran touché, regardée »).
//
// Les formes suivent `database.types.ts` ; les valeurs, une station de lavage
// plausible à Dakar. Les noms sont volontairement longs par endroits : c'est
// le texte long qui fait déborder un écran, pas « Test 1 ».

const ORG = '00000000-0000-4000-8000-000000000001';
const S1 = '00000000-0000-4000-8000-0000000000a1';
const S2 = '00000000-0000-4000-8000-0000000000a2';
const MOI = '00000000-0000-4000-8000-0000000000f1';

const id = (prefixe, n) => `00000000-0000-4000-8000-${prefixe}${String(n).padStart(12 - prefixe.length, '0')}`;
const ilYa = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const jour = (decalage) => new Date(Date.now() - decalage * 86_400_000).toISOString().slice(0, 10);

export const PERMISSIONS_PROPRIETAIRE = [
  'audit.read', 'cash.close', 'cash.move', 'cash.open', 'cash.reconcile', 'customers.delete',
  'customers.read', 'customers.write', 'employees.manage', 'inspections.write',
  'notification.cancel', 'operations.assign', 'operations.execute', 'organization.manage',
  'payments.read', 'payments.record', 'payments.refund', 'prices.manage',
  'quality_controls.execute', 'receipt.correct', 'receipt.issue', 'reports.read',
  'restitutions.execute', 'roles.manage', 'service_order_item.discount', 'service_orders.cancel',
  'service_orders.read', 'service_orders.transition', 'service_orders.write', 'services.manage',
  'stations.manage', 'users.manage', 'vehicles.read', 'vehicles.write',
];

export const PERMISSIONS_CAISSIER = [
  'cash.close', 'cash.move', 'cash.open', 'customers.read', 'customers.write', 'payments.read',
  'payments.record', 'receipt.issue', 'restitutions.execute', 'service_orders.read',
  'service_orders.transition', 'service_orders.write', 'vehicles.read', 'vehicles.write',
];

export const PROFILS = {
  proprietaire: { email: 'awa@vehora.test', role: 'OWNER', scope: 'ORGANIZATION', permissions: PERMISSIONS_PROPRIETAIRE, org: ORG },
  caissier: { email: 'ousmane@vehora.test', role: 'CASHIER', scope: 'STATION', permissions: PERMISSIONS_CAISSIER, org: ORG },
  plateforme: { email: 'admin@vehora.test', role: 'SUPER_ADMIN', scope: 'PLATFORM', permissions: [], org: null, admin: true },
  'sans-organisation': { email: 'sansorg@vehora.test', role: null, scope: null, permissions: [], org: null },
};

export const IDENTITE = { ORG, S1, S2, MOI };

const types = [
  { id: id('7', 1), code: 'BERLINE', label: 'Berline', sort_order: 1, is_active: true, created_at: ilYa(9e5) },
  { id: id('7', 2), code: 'SUV', label: 'SUV / 4×4', sort_order: 2, is_active: true, created_at: ilYa(9e5) },
  { id: id('7', 3), code: 'MOTO', label: 'Moto', sort_order: 3, is_active: true, created_at: ilYa(9e5) },
  { id: id('7', 4), code: 'MINIBUS', label: 'Minibus / Car rapide', sort_order: 4, is_active: true, created_at: ilYa(9e5) },
];

const clients = [
  ['Mame Diarra Ndiaye-Sarr', '+221 77 123 45 67'],
  ['Ibrahima Fall', '+221 76 555 12 34'],
  ['Société Transports Baobab SARL', '+221 33 820 00 11'],
  ['Fatou Sow', '+221 78 900 11 22'],
  ['Cheikh Tidiane Ba', null],
  ['Aminata Diop', '+221 70 444 55 66'],
].map(([full_name, phone], i) => ({
  id: id('c', i + 1), organization_id: ORG, full_name, phone,
  phone_digits: phone ? phone.replace(/\D/g, '') : null, email: i === 2 ? 'flotte@baobab.sn' : null,
  notes: i === 2 ? 'Flotte de 12 véhicules, facture en fin de mois.' : null,
  accepte_notifications: i !== 4, archived_at: null, created_at: ilYa(2e4 * (i + 1)), created_by: MOI, updated_at: ilYa(100),
}));

const vehicules = [
  ['DK-4521-BC', 0, 'Toyota', 'Corolla', 'Gris', 0],
  ['AA-117-XY', 1, 'Hyundai', 'Tucson', 'Noir', 1],
  ['DK-9988-ZZ', 3, 'Mercedes', 'Sprinter', 'Blanc', 2],
  ['TH-0042-A', 2, 'Yamaha', 'Crypton', 'Rouge', 3],
  ['DK-7310-LM', 0, 'Peugeot', '308', 'Bleu', 4],
  ['DK-2024-QW', 1, 'Toyota', 'Land Cruiser Prado', 'Blanc nacré', 5],
  [null, 0, 'Renault', 'Logan', null, null],
].map(([plate, t, make, model, color, c], i) => ({
  id: id('e', i + 1), organization_id: ORG, plate, plate_normalized: plate?.replace(/\W/g, '') ?? null,
  vehicle_type_id: types[t].id, make, model, color, notes: null,
  customer_id: c === null ? null : clients[c].id, archived_at: null, created_at: ilYa(1e4), created_by: MOI, updated_at: ilYa(50),
  // Embarqués que les écrans demandent (PostgREST les joint).
  vehicle_types: { label: types[t].label },
  customers: c === null ? null : { full_name: clients[c].full_name },
}));

// Le dernier est restitué avec un solde : la file le garde, « reste à encaisser ».
const statuts = ['ARRIVED', 'INSPECTION', 'WAITING', 'IN_PROGRESS', 'IN_PROGRESS', 'CONTROL', 'READY', 'READY', 'DELIVERED'];
const dossiers = statuts.map((status, i) => {
  const v = vehicules[i % vehicules.length];
  const client = clients.find((c) => c.id === v.customer_id);
  return {
    id: id('d', i + 1), organization_id: ORG, number: 1040 + i, status,
    arrived_at: ilYa(240 - i * 25), station_id: i % 3 === 2 ? S2 : S1, vehicle_id: v.id,
    customer_id: v.customer_id, notes: i === 1 ? 'Rayure portière arrière gauche signalée au client.' : null,
    started_at: null, completed_at: null, delivered_at: null, cancelled_at: null, cancellation_reason: null,
    created_at: ilYa(240 - i * 25), created_by: MOI, updated_at: ilYa(10),
    vehicles: { plate: v.plate, vehicle_types: { label: v.vehicle_types.label } },
    customers: client ? { full_name: client.full_name } : null,
  };
});

const prestations = [
  ['Lavage extérieur', 1, 20], ['Lavage complet intérieur + extérieur', 1, 45], ['Lustrage carrosserie', 2, 90],
  ['Nettoyage moteur', 2, 30], ['Shampoing sièges et moquettes', 2, 120], ['Lavage moto', 1, 15],
].map(([name, cat, duration_minutes], i) => ({
  id: id('5', i + 1), organization_id: ORG, name, category_id: id('4', cat), description: null,
  duration_minutes, is_active: i !== 4 || true, sort_order: i, created_at: ilYa(9e4), updated_at: ilYa(9e3),
}));

const tarifs = [];
prestations.forEach((p, i) => {
  types.forEach((t, j) => {
    if (i === 5 && j !== 2) return; // la moto seulement
    if (i !== 5 && j === 2) return;
    if (i === 4 && j === 3) return; // une prestation sans tarif pour un type : écran « sans tarif »
    tarifs.push({
      id: id('6', i * 10 + j), organization_id: ORG, service_id: p.id, vehicle_type_id: t.id, station_id: null,
      amount_minor: [2000, 5000, 15000, 7500, 25000, 1500][i] * (j === 1 ? 1.5 : j === 3 ? 2 : 1),
      currency: 'XOF', valid_from: jour(120), valid_to: null, created_at: ilYa(9e4), created_by: MOI, updated_at: ilYa(9e4),
    });
  });
});

const lignes = dossiers.flatMap((d, i) =>
  i === 0 ? [] : [prestations[1], ...(i % 2 ? [prestations[2]] : [])].map((p, k) => ({
    id: id('9', i * 10 + k), organization_id: ORG, service_order_id: d.id, service_id: p.id, service_name: p.name,
    price_id: null, quantity: 1, unit_amount_minor: k ? 15000 : 5000, discount_amount_minor: 0,
    line_total_minor: k ? 15000 : 5000, currency: 'XOF', created_at: ilYa(100), created_by: MOI,
  })),
);

const totaux = dossiers.map((d) => {
  const l = lignes.filter((x) => x.service_order_id === d.id);
  return {
    service_order_id: d.id, organization_id: ORG, currency: 'XOF', lignes: l.length,
    total_amount_minor: l.reduce((s, x) => s + x.line_total_minor, 0), discount_amount_minor: 0,
  };
});

const paiements = [
  { d: 6, montant: 20000, methode: 'CASH' },
  { d: 7, montant: 5000, methode: 'MOBILE_MONEY' },
  { d: 4, montant: 5000, methode: 'CASH' },
  { d: 8, montant: 2000, methode: 'MOBILE_MONEY' },
].map((p, i) => ({
  id: id('b', i + 1), organization_id: ORG, service_order_id: dossiers[p.d].id, station_id: S1,
  kind: 'PAYMENT', method: p.methode, status: 'COMPLETED', amount_minor: p.montant, currency: 'XOF',
  provider_name: p.methode === 'MOBILE_MONEY' ? 'Wave' : null, external_ref: p.methode === 'MOBILE_MONEY' ? 'WV-88213' : null,
  cash_register_id: p.methode === 'CASH' ? id('a', 1) : null, received_by: MOI, reverses_payment_id: null, reason: null, created_at: ilYa(30 + i),
}));

const soldes = totaux.map((t) => {
  const paye = paiements.filter((p) => p.service_order_id === t.service_order_id).reduce((s, p) => s + p.amount_minor, 0);
  const solde = t.total_amount_minor - paye;
  return {
    service_order_id: t.service_order_id, organization_id: ORG, total_amount_minor: t.total_amount_minor,
    paid_amount_minor: paye, balance_minor: solde,
    payment_status: paye === 0 ? 'UNPAID' : solde > 0 ? 'PARTIAL' : solde === 0 ? 'PAID' : 'OVERPAID',
  };
});

const employes = ['Moussa Diallo', 'Abdoulaye Ndiaye', 'Khady Mbaye', 'Pape Seck (ancien)'].map((full_name, i) => ({
  id: id('8', i + 1), organization_id: ORG, full_name, phone: i === 1 ? '+221 77 000 11 22' : null,
  phone_digits: null, profile_id: null, station_id: i === 2 ? S2 : S1, status: i === 3 ? 'INACTIVE' : 'ACTIVE',
  created_at: ilYa(5e4), created_by: MOI, updated_at: ilYa(5e3),
}));

const operations = lignes.slice(0, 6).map((l, i) => {
  const d = dossiers.find((x) => x.id === l.service_order_id);
  return {
    id: id('0', i + 1), organization_id: ORG, service_order_id: d.id, item_id: l.id, service_name: l.service_name,
    employee_id: i % 3 === 0 ? null : employes[i % 2].id, status: ['PENDING', 'IN_PROGRESS', 'DONE'][i % 3],
    started_at: i % 3 ? ilYa(40) : null, completed_at: i % 3 === 2 ? ilYa(5) : null, notes: null,
    created_at: ilYa(60 - i), updated_at: ilYa(5),
    service_orders: { number: d.number, status: d.status, station_id: d.station_id, vehicles: { plate: d.vehicles.plate } },
  };
});

const roles = [
  ['OWNER', 'Propriétaire', 'ORGANIZATION', 'Tous les droits sur l’organisation.'],
  ['MANAGER', 'Gérant', 'ORGANIZATION', 'Pilote les stations et l’équipe.'],
  ['STATION_MANAGER', 'Chef de station', 'STATION', 'Dirige une station.'],
  ['CASHIER', 'Caissier', 'STATION', 'Encaisse et restitue.'],
  ['OPERATOR', 'Opérateur', 'STATION', 'Exécute les prestations.'],
].map(([code, label, scope, description], i) => ({ id: id('r', i + 1), code, label, scope, description, is_system: true, created_at: ilYa(1e6) }));

export const TABLES = {
  organizations: [{
    id: ORG, name: 'Station Awa — Lavage & Detailing', city: 'Dakar', country_code: 'SN', currency: 'XOF',
    status: 'ACTIVE', address: 'Route de la Corniche Ouest, Liberté 6', phone: '+221 33 800 00 00', email: 'contact@awa.sn',
    timezone: 'Africa/Dakar', locale: 'fr-SN', slug: 'station-awa', is_platform: false, logo_path: null,
    created_at: ilYa(9e5), updated_at: ilYa(1e3),
  }],
  organization_settings: [{
    organization_id: ORG, max_discount_percent: 20, payment_before_delivery: 'ALLOW_DEBT',
    require_inspection: true, require_quality_control: true, updated_at: ilYa(1e3),
  }],
  stations: [
    { id: S1, organization_id: ORG, name: 'Liberté 6', city: 'Dakar', address: 'Rond-point Liberté 6', phone: '+221 33 800 00 01', kind: 'FIXED', status: 'ACTIVE', timezone: null, created_at: ilYa(9e5), updated_at: ilYa(9e3) },
    { id: S2, organization_id: ORG, name: 'Ouakam', city: 'Dakar', address: 'Route de l’aéroport', phone: null, kind: 'FIXED', status: 'ACTIVE', timezone: null, created_at: ilYa(8e5), updated_at: ilYa(9e3) },
    { id: id('a', 9), organization_id: ORG, name: 'Unité mobile — Almadies', city: 'Dakar', address: null, phone: null, kind: 'MOBILE', status: 'INACTIVE', timezone: null, created_at: ilYa(7e5), updated_at: ilYa(9e3) },
  ],
  vehicle_types: types,
  customers: clients,
  vehicles: vehicules,
  service_orders: dossiers,
  service_order_items: lignes,
  service_order_totals: totaux,
  service_order_payment_state: soldes,
  service_order_operations: operations,
  // La matrice RÉELLE (lue sur la base le 17 octobre) : la file en tire ses
  // boutons, filtrés par les droits et les conditions. Une maquette plus
  // permissive que la base montrerait des boutons qui n'existent pas.
  service_order_transitions: [
    ['ARRIVED', 'INSPECTION', 'inspections.write', null],
    ['ARRIVED', 'WAITING', 'service_orders.transition', 'INSPECTION_OPTIONAL'],
    ['ARRIVED', 'CANCELLED', 'service_orders.cancel', null],
    ['INSPECTION', 'WAITING', 'inspections.write', 'INSPECTION_DONE'],
    ['INSPECTION', 'CANCELLED', 'service_orders.cancel', null],
    ['WAITING', 'IN_PROGRESS', 'operations.execute', 'OPERATIONS_ASSIGNED'],
    ['WAITING', 'CANCELLED', 'service_orders.cancel', null],
    ['IN_PROGRESS', 'CONTROL', 'operations.execute', 'OPERATIONS_DONE'],
    ['IN_PROGRESS', 'READY', 'service_orders.transition', 'QUALITY_OPTIONAL'],
    ['IN_PROGRESS', 'CANCELLED', 'service_orders.cancel', null],
    ['CONTROL', 'IN_PROGRESS', 'quality_controls.execute', null],
    ['CONTROL', 'READY', 'quality_controls.execute', null],
    ['CONTROL', 'CANCELLED', 'service_orders.cancel', null],
    ['READY', 'DELIVERED', 'restitutions.execute', 'PAYMENT_RULE'],
    ['READY', 'CANCELLED', 'service_orders.cancel', null],
  ].map(([from_status, to_status, required_permission, condition_code]) => ({
    from_status, to_status, required_permission, condition_code,
    requires_reason: to_status === 'CANCELLED', must_audit: to_status === 'CANCELLED',
  })),
  service_categories: [
    { id: id('4', 1), organization_id: ORG, name: 'Lavage', sort_order: 1, is_active: true, created_at: ilYa(9e4), updated_at: ilYa(9e4) },
    { id: id('4', 2), organization_id: ORG, name: 'Detailing et soins', sort_order: 2, is_active: true, created_at: ilYa(9e4), updated_at: ilYa(9e4) },
  ],
  services: prestations,
  service_prices: tarifs,
  employees: employes,
  payments: paiements,
  // Deux caisses ouvertes à Liberté 6 : la sienne et celle d'Ousmane — le
  // remboursement en espèces choisit le tiroir d'où sortent les billets.
  cash_registers: [
    { id: id('a', 1), opened_by: MOI, titulaire: { full_name: 'Awa Ndiaye' }, opened_at: ilYa(300) },
    { id: id('a', 2), opened_by: id('p', 2), titulaire: { full_name: 'Ousmane Gueye' }, opened_at: ilYa(280) },
  ].map((c) => ({
    organization_id: ORG, station_id: S1, status: 'OPEN',
    opening_float_minor: 10000, currency: 'XOF', closed_at: null, closed_by: null, closing_note: null,
    declared_closing_minor: null, theoretical_minor: null, variance_minor: null, created_at: c.opened_at, updated_at: ilYa(30),
    ...c,
  })),
  cash_register_state: [{ cash_register_id: id('a', 1), organization_id: ORG, theoretical_minor: 31500, mouvements: 4 }],
  // La sortie de remboursement inscrite par une autre personne : l'écran doit
  // dire qui l'a autorisée (ADR-006).
  cash_transactions: [
    { kind: 'PAYMENT_IN', amount_minor: 20000, reason: null },
    { kind: 'PAYMENT_IN', amount_minor: 5000, reason: null },
    { kind: 'CASH_OUT', amount_minor: -1500, reason: 'Achat de savon et d’éponges au marché Tilène' },
    { kind: 'REFUND_OUT', amount_minor: -2000, reason: 'Faute de frappe : 7 000 au lieu de 5 000',
      created_by: id('p', 9), auteur: { full_name: 'Khady Mbaye' } },
  ].map((t, i) => ({ id: id('t', i + 1), organization_id: ORG, cash_register_id: id('a', 1), currency: 'XOF', payment_id: null, created_by: MOI, auteur: { full_name: 'Awa Ndiaye' }, created_at: ilYa(20 + i * 30), ...t })),
  cash_register_history: [3, 1, 0].map((n, i) => ({
    cash_register_id: id('h', i + 1), organization_id: ORG, station_id: i ? S2 : S1, station_name: i ? 'Ouakam' : 'Liberté 6',
    status: 'CLOSED', opened_at: ilYa(1440 * (i + 1) + 600), closed_at: ilYa(1440 * (i + 1)), opened_by: MOI, closed_by: MOI,
    opened_by_name: 'Ousmane Gueye', closed_by_name: 'Ousmane Gueye', opening_float_minor: 10000, currency: 'XOF',
    entrees_minor: 85000 + n * 1000, sorties_minor: 2500, mouvements: 14 + n, theoretical_minor: 92500 + n * 1000,
    declared_closing_minor: 92500 + n * 1000 - [0, 500, -1000][i], variance_minor: [0, -500, 1000][i],
    closing_note: i === 1 ? 'Billet de 500 introuvable' : null,
  })),
  notifications: dossiers.slice(4).map((d, i) => ({
    id: id('n', i + 1), organization_id: ORG, station_id: d.station_id, service_order_id: d.id, customer_id: d.customer_id,
    kind: 'VEHICLE_READY', destination: '+221771234567', body: `Station Awa : votre véhicule (dossier n° ${d.number}) est prêt.`,
    status: ['PENDING', 'CANCELLED', 'PENDING', 'SENT'][i], attempts: 0, last_error: null, sent_at: null,
    cancel_reason: i === 1 ? 'Client déjà prévenu par téléphone' : null, created_at: ilYa(15 + i * 5),
  })),
  receipts: [{
    id: id('f', 1), organization_id: ORG, service_order_id: dossiers[6].id, station_id: S1, number: 312,
    issued_at: ilYa(20), issued_by: MOI, currency: 'XOF', total_minor: 20000, paid_minor: 20000, replaces_receipt_id: null,
    // Forme de `ContenuRecu` (receipt.service.ts), telle que `emettre_recu()` la fige.
    contenu: {
      organisation: { nom: 'Station Awa — Lavage & Detailing', ville: 'Dakar', telephone: '+221 33 800 00 00' },
      station: { nom: 'Liberté 6', ville: 'Dakar', telephone: '+221 33 800 00 01' },
      dossier: { numero: dossiers[6].number, arrive_le: ilYa(90), restitue_le: ilYa(20) },
      client: { nom: 'Mame Diarra Ndiaye-Sarr', telephone: '+221 77 123 45 67' },
      vehicule: { plaque: dossiers[6].vehicles.plate, marque: 'Hyundai', modele: 'Tucson', type: 'SUV / 4×4' },
      lignes: [
        { prestation: 'Lavage complet intérieur + extérieur', quantite: 1, unitaire_minor: 5000, remise_minor: 0, total_minor: 5000 },
        { prestation: 'Lustrage carrosserie', quantite: 1, unitaire_minor: 15000, remise_minor: 0, total_minor: 15000 },
      ],
      paiements: [{ sens: 'PAYMENT', moyen: 'CASH', fournisseur: null, reference: null, montant_minor: 20000, le: ilYa(25) }],
      totaux: { total_minor: 20000, encaisse_minor: 20000, solde_minor: 0, devise: 'XOF' },
    },
  }],
  inspection_zones: ['Avant', 'Côté gauche', 'Arrière', 'Côté droit', 'Toit', 'Pare-brise', 'Jantes et pneus', 'Intérieur avant', 'Intérieur arrière', 'Coffre']
    .map((label, i) => ({ id: id('z', i + 1), code: `Z${i}`, label, sort_order: i, is_active: true })),
  vehicle_inspections: [{
    id: id('i', 1), vehicle_id: vehicules[0].id, performed_at: ilYa(4000), notes: 'Pare-choc avant éraflé.',
    inspection_items: [{ condition: 'ANOMALY', comment: 'Éraflure de 10 cm', inspection_zones: { label: 'Avant' } }, { condition: 'OK', comment: null, inspection_zones: { label: 'Arrière' } }],
    inspection_photos: [],
  }],
  organization_memberships: [
    ['Awa Ndiaye', 0], ['Ousmane Gueye', 3], ['Ibrahima Sarr', 3], ['Moussa Diallo', 4],
  ].map(([nom, r], i) => ({
    id: id('m', i + 1), organization_id: ORG, profile_id: i === 0 ? MOI : id('p', i + 1), role_id: roles[r].id, status: i === 3 ? 'SUSPENDED' : 'ACTIVE',
    created_at: ilYa(9e5 - i), updated_at: ilYa(9e3), invited_by: MOI,
    profiles: { full_name: nom }, roles: { code: roles[r].code, label: roles[r].label, scope: roles[r].scope },
  })),
  // Ousmane voit Liberté 6 ; Ibrahima n'a rien : l'écran montre les deux cas.
  station_users: [{ membership_id: id('m', 2), station_id: S1 }],
  organization_invitations: [{
    id: id('v', 1), organization_id: ORG, email: 'khady.mbaye.gerante.ouakam@gmail.com', role_id: roles[2].id,
    status: 'PENDING', token: 'K7Q2-9XPA', expires_at: new Date(Date.now() + 5 * 864e5).toISOString(),
    invited_by: MOI, accepted_at: null, accepted_by: null, created_at: ilYa(600), roles: { label: roles[2].label },
  }],
  roles,
  // ---- Espace plateforme ---------------------------------------------------
  platform_organizations: [
    ['Station Awa — Lavage & Detailing', 'ACTIVE', 2, 4, 1240, 312],
    ['Lavage Ouest Foire', 'TRIAL', 1, 2, 18, 18],
    ['Test plateforme mobile', 'SUSPENDED', 1, 1, 0, 0],
    ['Clean Auto Touba Express', 'ACTIVE', 3, 9, 4120, 640],
  ].map(([name, status, stations, membres_actifs, dossiers, dossiers_30j], i) => ({
    id: i === 0 ? ORG : id('o', i + 1), name, slug: name.toLowerCase().replace(/\W+/g, '-'), status, city: i === 3 ? 'Touba' : 'Dakar',
    country_code: 'SN', currency: 'XOF', stations, membres_actifs, dossiers, dossiers_30j, vehicules: dossiers ? 300 + i : 0,
    created_at: ilYa(9e5 / (i + 1)), derniere_activite: dossiers ? ilYa(30 * (i + 1)) : null,
  })),
  platform_subscriptions: [],
  plans: [
    ['ESSAI', 'Essai', 0, 1, 3], ['STATION', 'Station', 15000, 1, 5], ['RESEAU', 'Réseau', 45000, 5, 25], ['ILLIMITE', 'Illimité', 90000, null, null],
  ].map(([code, label, price_minor, max_stations, max_users], i) => ({
    id: id('l', i + 1), code, label, price_minor, currency: 'XOF', max_stations, max_users, sort_order: i, is_public: true, description: null, created_at: ilYa(1e6),
  })),
  platform_invoices: [
    ['2026-09', 'PAID', false], ['2026-10', 'ISSUED', true], ['2026-10', 'VOID', false],
  ].map(([periode, status, en_retard], i) => ({
    id: id('q', i + 1), organization_id: ORG, organization_label: 'Station Awa — Lavage & Detailing', plan_code: 'RESEAU',
    reference: `VH-${periode}-00${i + 1}`, period_start: `${periode}-01`, period_end: `${periode}-28`, amount_minor: 45000, currency: 'XOF',
    status, issued_at: ilYa(4e4 / (i + 1)), due_date: jour(i ? -2 : 20), paid_at: status === 'PAID' ? ilYa(3e4) : null,
    payment_reference: status === 'PAID' ? 'VIR-SGBS-7781' : null, en_retard, jours_de_retard: en_retard ? 2 : 0, void_reason: status === 'VOID' ? 'Doublon' : null,
  })),
  platform_audit_logs: ['organization.suspended', 'plan.changed', 'invoice.paid'].map((action, i) => ({
    id: i + 1, occurred_at: ilYa(60 * (i + 1)), actor_label: 'admin@vehora.test', organization_id: ORG, action,
    resource_id: ORG, resource_type: 'organization', reason: 'Demande du client par téléphone', old_value: null, new_value: null,
  })),
};

TABLES.platform_subscriptions = TABLES.platform_organizations.map((o, i) => ({
  organization_id: o.id, organisation: o.name, plan_code: ['RESEAU', 'ESSAI', 'STATION', 'ILLIMITE'][i],
  plan_label: ['Réseau', 'Essai', 'Station', 'Illimité'][i], status: o.status === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
  price_minor: [45000, 0, 15000, 90000][i], currency: 'XOF', max_stations: [5, 1, 1, null][i], max_users: [25, 3, 5, null][i],
  stations_utilisees: o.stations, membres_actifs: o.membres_actifs, started_at: ilYa(9e4), trial_ends_at: o.status === 'TRIAL' ? new Date(Date.now() + 9 * 864e5).toISOString() : null,
}));

export const FONCTIONS = {
  rechercher_clients: () => clients,
  rechercher_vehicules: () => vehicules.map((v) => ({
    ...v, type_label: v.vehicle_types.label, customer_name: v.customers?.full_name ?? null,
  })),
  mon_abonnement: () => [{
    plan_code: 'RESEAU', plan_label: 'Réseau', statut: 'ACTIVE', essai_jusqu_au: null,
    max_stations: 5, max_users: 25, stations_utilisees: 2, membres_actifs: 3,
  }],
  mes_fonctionnalites: () => [
    { cle: 'rapports', libelle: 'Rapports', actif: true },
    { cle: 'notifications', libelle: 'Messages aux clients', actif: true },
    { cle: 'export_csv', libelle: 'Export CSV', actif: true },
  ],
  fonctionnalite_active: () => true,
  mes_factures: () => TABLES.platform_invoices.map((f) => ({
    reference: f.reference, periode_debut: f.period_start, periode_fin: f.period_end, montant_minor: f.amount_minor,
    devise: f.currency, statut: f.status, echeance: f.due_date, payee_le: f.paid_at, en_retard: f.en_retard,
  })),
  rapport_journalier: () => [0, 1, 2, 3, 4, 5, 6].flatMap((j) => [S1, S2].map((s, k) => ({
    jour: jour(j), station_id: s, station_nom: k ? 'Ouakam' : 'Liberté 6', dossiers_livres: 14 - j - k * 5,
    encaisse_minor: (120000 - j * 9000) / (k + 1), especes_minor: (80000 - j * 6000) / (k + 1),
    mobile_minor: (35000 - j * 2500) / (k + 1), autres_minor: 5000 / (k + 1), panier_moyen_minor: 8500,
  }))),
  rapport_prestations: () => prestations.map((p, i) => ({ prestation: p.name, quantite: 40 - i * 6, montant_minor: (40 - i * 6) * [2000, 5000, 15000, 7500, 25000, 1500][i] })),
  resoudre_prix: () => [{ amount_minor: 5000, currency: 'XOF', price_id: tarifs[0].id, specificite: 'type' }],
};
