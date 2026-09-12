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
export async function connecterApi(): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );
  const { error } = await client.auth.signInWithPassword({
    email: process.env['VEHORA_TEST_EMAIL']!,
    password: process.env['VEHORA_TEST_PASSWORD']!,
  });
  if (error) throw new Error(`connexion API : ${error.message}`);
  return client;
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
): Promise<DossierDeTest> {
  const api = await connecterApi();

  const { data: station } = await api.from('stations').select('id').order('name').limit(1).single();
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
): Promise<DossierDeTest> {
  const api = await connecterApi();

  const { data: station } = await api.from('stations').select('id').order('name').limit(1).single();
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
