# Phase 4 — Approvisionnement d'organisation et gestion des utilisateurs

## Périmètre

Ce qui manquait pour intégrer un vrai client : créer une entreprise et inviter
son équipe **depuis l'application**, sans SQL.

## Choix de conception : invitation plutôt que création de compte

On n'invite pas quelqu'un en créant son compte à sa place. Un administrateur
qui crée un compte doit en choisir le mot de passe, donc le connaître — c'est
un mauvais schéma. Et créer un compte exige la clé `service_role`, qui n'a
rien à faire dans ce flux.

À la place : une invitation **nommée par e-mail**, portant un jeton de 32 octets
aléatoires. La personne crée son propre compte avec son propre mot de passe,
puis colle le code. Aucun secret ne circule, l'invitation expire au bout de
14 jours et reste révocable à tout moment.

## Ce qui a été construit

| Élément | Emplacement |
|---|---|
| Table des invitations + RLS | `20260912140000_invitations.sql` |
| `provisionner_organisation()` | `20260912140100_provisionnement.sql` |
| `accepter_invitation()` | idem, corrigée par `20260912140200` |
| Services frontend | `core/organization/provisioning.service.ts`, `core/members/member.service.ts` |
| Écran de création d'entreprise | `features/organization/` |
| Écran d'accueil à deux chemins | `features/auth/no-organization/` |
| Gestion des utilisateurs | `features/users/` |

Créer une organisation produit en une opération : l'organisation (statut
`TRIAL`), ses paramètres, l'adhésion `OWNER`, et une première station — une
organisation sans station ne peut rien faire.

Le slug est translittéré depuis le français : « Lavage Thiès Élite » devient
`lavage-thies-elite`, avec un suffixe numérique en cas de collision.

## Défauts trouvés et corrigés

### MEDIUM — un refus remontait en HTTP 500

`no_data_found` (P0002) est traduit par PostgREST en **500**. Un jeton inconnu
n'est pas une panne : c'est un refus. Remonter 500 polluerait la supervision
d'erreurs qui n'en sont pas, et masquerait les vraies pannes dans le bruit.
Passage à `insufficient_privilege` → **403**.

Le message reste volontairement identique pour « jeton inconnu » et
« destiné à quelqu'un d'autre » : sinon on confirmerait l'existence d'une
invitation à qui essaie des jetons au hasard.

### MEDIUM — le sélecteur de rôle affichait le mauvais rôle

**Trouvé par la capture d'écran, pas par les tests.** Le sélecteur montrait
« Propriétaire » pour tous les membres alors que le texte dessous disait
« Caissier ». Cause : `[value]` sur un `<select>` est ignoré parce que les
options sont rendues après.

**Impact.** Un responsable lisant l'écran aurait cru que tout le monde était
propriétaire, et aurait pu promouvoir quelqu'un en croyant ne rien changer.

**Correction.** La sélection est portée par `[selected]` sur l'option. Test de
non-régression ajouté : le libellé de l'option cochée doit correspondre au rôle
réel.

C'est le deuxième défaut de cette nature (après le thème clair en phase 2) que
seule la vérification visuelle a détecté.

### MEDIUM — échec silencieux du formulaire d'invitation

Le bouton « Inviter quelqu'un » était actif avant le chargement des rôles. Le
formulaire était alors invalide sans qu'aucun message ne l'explique :
l'utilisateur cliquait dans le vide. Bouton désactivé tant que les rôles ne
sont pas là, message explicite si le rôle manque, et rôle par défaut le **moins
privilégié** — mieux vaut élargir un accès trop étroit que retirer un accès
trop large.

### LOW — jointure ambiguë refusée par PostgREST

`organization_memberships` porte deux clés étrangères vers `profiles`
(`profile_id` et `invited_by`) : la jointure devait nommer la sienne. Sans
cela, la liste des membres restait vide avec un message d'erreur générique.

Au passage, ma transcription du fichier de types avait vidé les métadonnées de
relations. Elles sont rétablies pour les tables concernées, et le fichier
indique désormais comment le régénérer.

## Constat de sécurité accepté, non corrigé

L'advisor Supabase signale les deux fonctions `SECURITY DEFINER` comme
appelables par un utilisateur connecté. **C'est volontaire** : ce sont les
points d'entrée privilégiés du produit, et révoquer `EXECUTE` casserait
l'inscription et les invitations.

Ce qui rend l'exposition acceptable, c'est que chaque fonction vérifie
elle-même ses conditions — vérifié par 11 tests sur l'API réelle. L'intention
est désormais inscrite en commentaire **dans la base**, pour que le prochain
lecteur de l'advisor ne « corrige » pas ce qui est un choix.

## Tests

| Suite | Résultat |
|---|---|
| Types stricts | ✅ |
| Build | ✅ 117,8 kB transférés |
| Sécurité SQL | ✅ **21 assertions** |
| Parcours Playwright | ✅ **61 tests** |

### Les trois angles

1. **Autorisé** — un compte neuf crée son entreprise (organisation, paramètres,
   rôle, station) ; le propriétaire invite, révoque, change un rôle, suspend ;
   le bon destinataire accepte, y compris avec une casse d'e-mail différente.
2. **Non autorisé** — un caissier ne peut pas inviter (**403**) ni lire aucune
   invitation ; `/utilisateurs` par l'URL renvoie au tableau de bord ; un
   propriétaire ne peut pas modifier son propre rôle.
3. **Malveillant** — un membre existant ne peut pas créer une seconde
   organisation ; un jeton inventé est refusé sans révéler quoi que ce soit ;
   une invitation destinée à quelqu'un d'autre est refusée avec le **même**
   message ; une invitation ne sert qu'une fois ; **inviter à un rôle de
   plateforme est refusé** — c'était la porte d'entrée évidente vers le Super
   Admin.

Les opérations privilégiées écrivent dans `audit_logs`, vérifié par l'API.

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Le code d'invitation se transmet à la main (pas d'e-mail ni WhatsApp) | MEDIUM | l'envoi automatique viendra avec les notifications ; le code reste copiable |
| Aucune limite de fréquence sur la création d'organisations | LOW | un compte ne peut en créer qu'une ; une limite par IP relèverait de la plateforme |
| `confirm()` natif pour suspendre | LOW | à remplacer par une modale du design system |
| Cinq comptes de démonstration en base | LOW | à supprimer avant production |
| Policies Storage non écrites | MEDIUM | phase 5 |

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 4 validée.**

## Suite

Le produit peut désormais accueillir un vrai client de bout en bout. La suite
logique est la roadmap : CRM clients, puis véhicules et inspection.
