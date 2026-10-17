import { traduireErreur } from '../../../core/erreurs/traduire-erreur';

/**
 * Les messages de Supabase Auth pour les écrans de compte, en français. Aucun
 * ne dit si une adresse a un compte : l'énumération de comptes est une fuite.
 */
export function messageCompte(message: string): string {
  return traduireErreur(
    { message },
    {
      marqueurs: {
        'User already registered':
          'Cette adresse ne peut pas être utilisée. Connectez-vous, ou utilisez « Mot de passe oublié ».',
        'Signups not allowed':
          'La création de compte est fermée. Demandez à votre responsable de vous créer un accès.',
        'Password should be at least': 'Le mot de passe est trop court.',
        'Password is known to be weak':
          'Ce mot de passe figure dans des fuites connues : choisissez-en un autre.',
        'New password should be different': 'Choisissez un mot de passe différent de l’ancien.',
        'Auth session missing': 'Ce lien a expiré ou a déjà servi : demandez-en un nouveau.',
        'Unable to validate email address': 'Cette adresse e-mail n’est pas valide.',
        'Email address': 'Cette adresse e-mail n’est pas acceptée.',
      },
      parDefaut: 'L’opération a échoué. Réessayez dans un instant.',
    },
  );
}
