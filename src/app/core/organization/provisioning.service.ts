import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.client';

/**
 * Opérations d'entrée dans une organisation.
 *
 * Les deux passent par des fonctions serveur : créer une organisation n'a
 * volontairement aucune policy, et accepter une invitation exige de lire une
 * ligne que l'invité n'a pas le droit de lire.
 */
@Injectable({ providedIn: 'root' })
export class ProvisioningService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /** Traduit les erreurs nommées du serveur en messages pour l'utilisateur. */
  private message(erreur: { message: string }): string {
    const m = erreur.message;
    if (m.includes('VEHORA_DEJA_MEMBRE')) {
      return 'Ce compte appartient déjà à une organisation.';
    }
    if (m.includes('VEHORA_NOM_INVALIDE')) return "Le nom de l'entreprise est requis.";
    if (m.includes('VEHORA_PAYS_INVALIDE')) return 'Sélectionnez un pays.';
    if (m.includes('VEHORA_INVITATION_INTROUVABLE')) {
      return 'Ce code est inconnu, ou destiné à une autre adresse e-mail.';
    }
    if (m.includes('VEHORA_INVITATION_UTILISEE')) {
      return 'Cette invitation a déjà été utilisée ou révoquée.';
    }
    if (m.includes('VEHORA_INVITATION_EXPIREE')) {
      return 'Cette invitation a expiré. Demandez-en une nouvelle.';
    }
    if (m.toLowerCase().includes('failed to fetch')) {
      return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
    }
    return "L'opération a échoué. Réessayez dans un instant.";
  }

  async creerOrganisation(entree: {
    nom: string;
    pays: string;
    ville?: string;
    nomStation?: string;
  }): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('provisionner_organisation', {
      p_nom: entree.nom,
      p_pays: entree.pays,
      p_ville: entree.ville ?? null,
      p_nom_station: entree.nomStation ?? null,
    });

    if (error) return this.message(error);

    // Les claims (organisation, rôle, permissions) ne changent qu'au
    // renouvellement du jeton : sans cela, l'utilisateur resterait « sans
    // organisation » malgré la création (ADR-001).
    await this.auth.refreshClaims();
    return null;
  }

  async accepterInvitation(code: string): Promise<string | null> {
    const { error } = await this.supabase.client.rpc('accepter_invitation', {
      p_token: code.trim(),
    });

    if (error) return this.message(error);

    await this.auth.refreshClaims();
    return null;
  }
}
