import { Injectable, inject } from '@angular/core';
import type { AuthError } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/supabase/supabase.client';

/**
 * Création de compte et mot de passe. Hors d'`AuthService` volontairement :
 * celui-ci part dans le bundle initial de chaque téléphone, alors que ces
 * trois écrans servent une fois par personne. Chargé avec eux.
 */
@Injectable({ providedIn: 'root' })
export class CompteService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Crée un compte. Sans organisation, il n'a aucun droit (aucun claim) : il
   * arrive sur « Sans organisation », d'où l'on crée son entreprise ou l'on
   * rejoint celle qui l'a invité. Jusqu'en phase 25, aucun écran ne créait de
   * compte : une invitation disait « elle crée son compte avec l'adresse
   * invitée », et c'était impossible ailleurs que dans le tableau de bord
   * Supabase.
   *
   * `confirmationRequise` : Supabase exige (par réglage du projet) que
   * l'adresse soit confirmée par un lien avant toute connexion.
   */
  async inscrire(
    nom: string,
    email: string,
    password: string,
  ): Promise<{ error: AuthError | null; confirmationRequise: boolean }> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email: email.trim(),
      password,
      // `full_name` remplit le profil (`vehora.handle_new_user`) : sans lui,
      // chaque membre invité s'affichait « Sans nom » chez son responsable.
      options: { emailRedirectTo: `${location.origin}/connexion`, data: { full_name: nom.trim() } },
    });
    return { error, confirmationRequise: !error && !data.session };
  }

  /**
   * Envoie le lien de réinitialisation. La réponse ne dit jamais si le compte
   * existe : l'écran affiche le même message dans tous les cas.
   */
  async demanderReinitialisation(email: string): Promise<AuthError | null> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/nouveau-mot-de-passe`,
    });
    return error;
  }

  /** Change le mot de passe de la session courante — ouverte par le lien reçu. */
  async changerMotDePasse(password: string): Promise<AuthError | null> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    return error;
  }
}
