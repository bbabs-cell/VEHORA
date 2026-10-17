import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.client';
import { traduireErreur } from '../erreurs/traduire-erreur';

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
    return traduireErreur(erreur, {
      marqueurs: {
        VEHORA_DEJA_MEMBRE: 'Ce compte appartient déjà à une organisation.',
        VEHORA_NOM_INVALIDE: "Le nom de l'entreprise est requis.",
        VEHORA_PAYS_INVALIDE: 'Sélectionnez un pays.',
        VEHORA_INVITATION_INTROUVABLE:
          'Ce code est inconnu, ou destiné à une autre adresse e-mail.',
        VEHORA_INVITATION_UTILISEE: 'Cette invitation a déjà été utilisée ou révoquée.',
        VEHORA_INVITATION_EXPIREE: 'Cette invitation a expiré. Demandez-en une nouvelle.',
        VEHORA_QUOTA_MEMBRES:
          'L’entreprise qui vous invite a atteint le nombre de comptes de son plan. Prévenez votre responsable.',
      },
    });
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
      p_ville: entree.ville ?? undefined,
      p_nom_station: entree.nomStation ?? undefined,
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
