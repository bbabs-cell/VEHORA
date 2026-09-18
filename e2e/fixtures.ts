import './proxy-node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../src/environments/environment';
import type { Database } from '../src/app/types/database.types';

/**
 * Jeux de données propres à un test.
 *
 * Un test qui modifie une donnée partagée fait échouer ceux qui la lisent, et
 * l'ordre d'exécution décide du coupable apparent. Les tests qui font avancer
 * un dossier créent donc le leur, et le referment en sortant.
 *
 * Le montage passe par l'API réelle, avec les mêmes règles que l'application :
 * si une règle change, le montage casse — ce qui est exactement ce qu'on veut.
 */
/**
 * Un seul client par processus de test.
 *
 * Chaque appel ouvrait auparavant sa propre session : une soixantaine de
 * connexions pour une suite complète, qui s'ajoutaient aux connexions par
 * l'interface. Supabase limite les authentifications par adresse IP — depuis un
 * poste de travail unique, la suite finissait par recevoir « Request rate limit
 * reached », et l'échec tombait sur un test au hasard, jamais sur le vrai
 * problème.
 *
 * La session est donc montée une fois et partagée. Le client Supabase
 * rafraîchit son jeton tout seul ; rien d'autre ne change pour les tests.
 */
let clientPartage: Promise<SupabaseClient<Database>> | null = null;

export function connecterApi(): Promise<SupabaseClient<Database>> {
  clientPartage ??= (async () => {
    const client = createClient<Database>(
      environment.supabaseUrl,
      environment.supabasePublishableKey,
    );
    const { error } = await client.auth.signInWithPassword({
      email: process.env['VEHORA_TEST_EMAIL']!,
      password: process.env['VEHORA_TEST_PASSWORD']!,
    });
    if (error) {
      // Une connexion ratée ne doit pas rester en cache : le test suivant
      // hériterait d'une promesse rejetée sans jamais réessayer.
      clientPartage = null;
      throw new Error(`connexion API : ${error.message}`);
    }
    return client;
  })();

  return clientPartage;
}

/**
 * Chaque projet Playwright (mobile, desktop) travaille sur sa propre station.
 *
 * La caisse est une ressource par (station, utilisateur) : sans cette
 * séparation, deux projets qui tournent en parallèle se ferment mutuellement
 * leur session, et le test qui échoue n'est pas celui qui a le défaut.
 */
export function stationDuProjet(projet: string): number {
  return projet === 'desktop' ? 1 : 0;
}

export interface DossierDeTest {
  readonly id: string;
  readonly numero: number;
  /** Annule le dossier : il sort de la file et des opérations. */
  readonly nettoyer: () => Promise<void>;
}

/** Un dossier tout juste arrivé, avec une prestation tarifée. */
export async function creerDossierArrive(
  nomPrestation = 'Lavage complet',
  indexStation = 0,
): Promise<DossierDeTest> {
  const api = await connecterApi();

  const { data: stations } = await api.from('stations').select('id').order('name');
  const station = stations![indexStation] ?? stations![0];
  const { data: vehicule } = await api
    .from('vehicles')
    .select('id')
    .is('archived_at', null)
    .limit(1)
    .single();
  const { data: service } = await api
    .from('services')
    .select('id')
    .eq('name', nomPrestation)
    .single();

  const { data: dossier, error } = await api
    .from('service_orders')
    .insert({ station_id: station!.id, vehicle_id: vehicule!.id })
    .select('id, number')
    .single();
  if (error) throw new Error(`ouverture du dossier de test : ${error.message}`);

  await api
    .from('service_order_items')
    .insert({ service_order_id: dossier.id, service_id: service!.id });

  return {
    id: dossier.id,
    numero: dossier.number,
    nettoyer: async () => {
      await api.rpc('transitionner_dossier', {
        p_service_order_id: dossier.id,
        p_to_status: 'CANCELLED',
        p_reason: 'Dossier de test automatisé',
      });
    },
  };
}

/** Un dossier en file d'attente, avec une prestation et son opération. */
export async function creerDossierEnAttente(
  nomPrestation = 'Lavage complet',
  indexStation = 0,
): Promise<DossierDeTest> {
  const api = await connecterApi();

  const { data: stations } = await api.from('stations').select('id').order('name');
  const station = stations![indexStation] ?? stations![0];
  const { data: vehicule } = await api
    .from('vehicles')
    .select('id')
    .is('archived_at', null)
    .limit(1)
    .single();
  const { data: service } = await api
    .from('services')
    .select('id')
    .eq('name', nomPrestation)
    .single();

  const { data: dossier, error } = await api
    .from('service_orders')
    .insert({ station_id: station!.id, vehicle_id: vehicule!.id })
    .select('id, number')
    .single();
  if (error) throw new Error(`ouverture du dossier de test : ${error.message}`);

  await api
    .from('service_order_items')
    .insert({ service_order_id: dossier.id, service_id: service!.id });
  await api.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id,
    p_to_status: 'INSPECTION',
  });
  await api
    .from('vehicle_inspections')
    .insert({ vehicle_id: vehicule!.id, service_order_id: dossier.id });
  await api.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id,
    p_to_status: 'WAITING',
  });

  return {
    id: dossier.id,
    numero: dossier.number,
    nettoyer: async () => {
      await api.rpc('transitionner_dossier', {
        p_service_order_id: dossier.id,
        p_to_status: 'CANCELLED',
        p_reason: 'Dossier de test automatisé',
      });
    },
  };
}

/** Un dossier prêt à restituer : tout le cycle joué par l'API réelle. */
export async function creerDossierPret(
  nomPrestation = 'Lavage complet',
  indexStation = 0,
): Promise<DossierDeTest> {
  const api = await connecterApi();
  const dossier = await creerDossierEnAttente(nomPrestation, indexStation);

  const { data: employe } = await api
    .from('employees')
    .select('id')
    .eq('status', 'ACTIVE')
    .limit(1)
    .single();
  const { data: operation } = await api
    .from('service_order_operations')
    .select('id')
    .eq('service_order_id', dossier.id)
    .single();

  await api
    .from('service_order_operations')
    .update({ employee_id: employe!.id })
    .eq('id', operation!.id);
  await api
    .from('service_order_operations')
    .update({ status: 'IN_PROGRESS' })
    .eq('id', operation!.id);
  await api.from('service_order_operations').update({ status: 'DONE' }).eq('id', operation!.id);
  await api.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id,
    p_to_status: 'CONTROL',
  });
  await api.rpc('transitionner_dossier', {
    p_service_order_id: dossier.id,
    p_to_status: 'READY',
  });

  return dossier;
}

/**
 * Ferme les sessions de caisse ouvertes par le compte de test à UNE station.
 * Toutes les fermer viderait la station de l'autre projet en pleine course.
 */
export async function fermerMesCaisses(indexStation = 0): Promise<void> {
  const api = await connecterApi();
  const { data: moi } = await api.auth.getUser();
  const { data: stations } = await api.from('stations').select('id').order('name');
  const station = stations![indexStation] ?? stations![0];

  const { data: ouvertes } = await api
    .from('cash_registers')
    .select('id')
    .eq('status', 'OPEN')
    .eq('station_id', station.id)
    .eq('opened_by', moi.user!.id);

  for (const caisse of ouvertes ?? []) {
    await api.rpc('cloturer_caisse', {
      p_cash_register_id: caisse.id,
      p_declared_minor: 0,
      p_note: 'Nettoyage de test automatisé',
    });
  }
}
