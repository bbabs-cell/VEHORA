// Assertions sur la conversion unique des erreurs serveur.
//
// Fonction pure : elle se vérifie sous Node, sans navigateur ni base (méthode
// MagyaPro, « fonctions pures testées à part »). Ce qui est gardé ici, ce sont
// les règles qui avaient divergé entre les quinze copies qu'elle remplace.
import {
  MESSAGE_DROIT,
  MESSAGE_ECHEC,
  MESSAGE_INTROUVABLE,
  MESSAGE_RESEAU,
  traduireErreur,
} from '../src/app/core/erreurs/traduire-erreur.ts';

let ko = 0;
const verifier = (label, reel, attendu) => {
  if (reel === attendu) {
    console.log('  ok —', label);
    return;
  }
  ko++;
  console.log(`  ÉCHEC — ${label}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(reel)}`);
};

// --- Réseau : les trois navigateurs, pas seulement Chrome -------------------
for (const brut of ['TypeError: Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) {
  verifier(`« ${brut} » est une perte de réseau`, traduireErreur({ message: brut }), MESSAGE_RESEAU);
}

// --- Isolement : « introuvable », jamais « appartient à un autre » ---------
verifier(
  'une violation de tenant ne confirme pas l’existence de la donnée',
  traduireErreur({ code: 'P0001', message: 'VEHORA_TENANCY_VIOLATION: vehicle' }),
  MESSAGE_INTROUVABLE,
);
verifier('`.single()` sans ligne = introuvable', traduireErreur({ code: 'PGRST116', message: 'x' }), MESSAGE_INTROUVABLE);
verifier('clé étrangère absente = introuvable', traduireErreur({ code: '23503', message: 'fk' }), MESSAGE_INTROUVABLE);

// --- Le service garde le sens de ses codes ---------------------------------
const clients = { codes: { '23505': 'Un client existe déjà avec ce numéro de téléphone.' } };
verifier('23505 prend le sens du service', traduireErreur({ code: '23505', message: 'dup' }, clients),
  'Un client existe déjà avec ce numéro de téléphone.');
verifier('42501 reste commun', traduireErreur({ code: '42501', message: 'rls' }, clients), MESSAGE_DROIT);
verifier(
  'un service peut préciser 42501',
  traduireErreur({ code: '42501', message: 'rls' }, { codes: { '42501': 'Pas le droit de modifier ces paramètres.' } }),
  'Pas le droit de modifier ces paramètres.',
);

// --- Le marqueur métier passe avant le code --------------------------------
verifier(
  'un marqueur du service l’emporte sur le marqueur commun',
  traduireErreur(
    { code: 'P0001', message: 'VEHORA_TENANCY_VIOLATION' },
    { marqueurs: { VEHORA_TENANCY_VIOLATION: 'Ce client est introuvable.' } },
  ),
  'Ce client est introuvable.',
);
verifier(
  'un marqueur l’emporte sur 42501',
  traduireErreur({ code: '42501', message: 'VEHORA_CREANCE_NON_AUTORISEE' }, {
    marqueurs: { VEHORA_CREANCE_NON_AUTORISEE: 'Pas de restitution avec solde.' },
  }),
  'Pas de restitution avec solde.',
);
verifier('le motif manquant est commun', traduireErreur({ message: 'VEHORA_MOTIF_REQUIS' }), 'Un motif est obligatoire.');

// --- Rien de brut ne sort ---------------------------------------------------
verifier(
  'une erreur inconnue devient le message générique',
  traduireErreur({ code: 'XX000', message: 'insert or update on table "payments" violates …' }),
  MESSAGE_ECHEC,
);
verifier('le défaut du service est respecté',
  traduireErreur({ message: '???' }, { parDefaut: 'L’enregistrement a échoué.' }), 'L’enregistrement a échoué.');
verifier('une absence d’erreur ne plante pas', traduireErreur(null), MESSAGE_ECHEC);
verifier('session expirée', traduireErreur({ message: 'JWT expired' }), 'Votre session a expiré. Reconnectez-vous.');
verifier('limite de débit', traduireErreur({ message: 'Request rate limit reached' }),
  'Trop de tentatives. Patientez une minute, puis réessayez.');

console.log(ko === 0 ? '\n✅ Conversion des erreurs : tout est conforme.' : `\n❌ ${ko} assertion(s) en échec.`);
process.exit(ko === 0 ? 0 : 1);
