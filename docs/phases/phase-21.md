# Phase 21 — Notifications au client : la file, pas l'envoi

## La limite, posée d'abord

« Votre véhicule est prêt » est l'attente la plus évidente d'un client de
station. Envoyer un SMS demande un fournisseur, un compte et un budget — une
décision qui appartient au propriétaire du produit.

Cette phase livre donc **tout ce qui ne dépend pas du fournisseur**, et c'est la
part difficile : à qui on a le droit d'écrire, ce qu'on écrit, combien de fois,
et ce qu'on garde. **Rien n'est envoyé, et l'écran le dit en toutes lettres.**
`docs/notifications.md` récapitule ce qui reste à brancher, et ce qu'il faudra
décider en même temps.

## Cinq décisions

### 1. Le message est composé par la base

Le client ne fournit ni le texte, ni le destinataire. Un SMS partant au nom de
la station avec un contenu choisi par un utilisateur, c'est **un canal
d'hameçonnage offert** : « Envoyez 50 000 F au 77… pour récupérer votre
véhicule », signé du lavage. Le texte porte le nom de l'organisation et le
numéro du dossier, rien d'autre — ni les notes du dossier, ni un nom de
prestation.

La campagne d'intrusion tente précisément cette insertion, depuis deux rôles.

### 2. Le destinataire est figé dans la ligne

Comme un reçu fige ce qu'il constate. Si le client change de numéro après coup,
on saura à quel numéro le message est parti.

### 3. Un refus se respecte partout

`customers.accepte_notifications`, une case visible du formulaire. Aucune
notification n'est mise en file pour quelqu'un qui a refusé, ni pour un client
sans numéro : **la vérification est dans le trigger, pas à l'écran.**

### 4. Une étape ne notifie qu'une fois

Un index unique partiel le garantit. La matrice des transitions ne permet pas
aujourd'hui de revenir de `READY` à `CONTROL` — mais ouvrir une transition est
une ligne à insérer, et l'invariant ne doit pas dépendre de ce qu'on n'a pas
encore ouvert. L'assertion vise donc l'index, pas la matrice.

### 5. Personne n'écrit dans cette file

Aucune policy d'insertion ni de mise à jour. La base met en file ; une fonction
annule, avec motif, audité. Une notification annulée reste dans la liste :
savoir qu'on a décidé de ne pas prévenir quelqu'un fait partie de l'histoire du
dossier.

## Le drapeau, fermé

`notifications` est fermé par défaut et pour tous les plans : tant que l'envoi
n'existe pas, rien ne se met en file. L'écran l'explique au lieu de montrer une
liste vide — un écran qui ne s'explique pas fait douter du reste.

## Un défaut vu à l'écran

Le bandeau « aucun message n'est envoyé » était rouge : un bandeau rouge dit que
**quelque chose est cassé**, alors que c'est le comportement voulu. Il est
devenu une information, et l'état vide ne répète plus la même phrase.

## Validation

| Contrôle | Résultat |
|---|---|
| `npm run types:check` (app et tests) | ✅ |
| `npm run test:unit` | ✅ 16 assertions |
| `npm run build` | ✅ budgets respectés |
| `npm run validate:sql` | ✅ **287 assertions** (+16) |
| `npm run e2e` | ✅ **257 passés, 1 ignoré** |
| `scripts/intrusion-notifications.mjs` | ✅ **12 assertions**, tout bloqué |
| 9 campagnes d'intrusion antérieures | ✅ inchangées |
| Capture d'écran | ✅ file et consentement |

**Une limite de la campagne d'intrusion, dite plutôt que masquée** : le drapeau
étant fermé, la file est vide sur le projet de démonstration, et les tentatives
de réécriture d'un message existant n'y sont pas exercées. Elles le sont dans
les assertions SQL, sous RLS. Le script l'annonce lui-même au lieu de compter
un succès qu'il n'a pas obtenu.

## Reste à faire (propriétaire)

- **Choisir un fournisseur de SMS** — c'est le seul verrou. Les trois pistes et
  leurs conséquences sont dans `docs/notifications.md`.
- Activer la protection contre les mots de passe divulgués dans Supabase.
- Créer le projet Supabase de production (`docs/deploiement.md`).
