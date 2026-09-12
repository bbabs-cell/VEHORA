import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from '../../types/database.types';

/**
 * Client Supabase unique de l'application.
 *
 * Aucun composant n'appelle ce client directement : il passe toujours par un
 * service de feature (règle `vehora-frontend`). Cela garde les requêtes
 * testables et optimisables en un seul endroit.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient<Database> = createClient<Database>(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
}
