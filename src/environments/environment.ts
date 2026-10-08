/**
 * Configuration publique de l'application.
 *
 * L'URL du projet et la clé « publishable » sont conçues pour être publiques :
 * elles n'accordent aucun droit par elles-mêmes. Toute la sécurité repose sur
 * la RLS et sur les claims du JWT (fondation 3).
 *
 * La clé `service_role` NE DOIT JAMAIS apparaître ici, ni nulle part dans le
 * frontend.
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://liragiqjtwlwqkfiyedk.supabase.co',
  supabasePublishableKey: 'sb_publishable_HxQu-SCB2RQWdci03LZ7jg_Mf_NCzBB',
} as const;
