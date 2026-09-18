# Notifications au client — ce qui existe, ce qui manque

## Ce qui existe

La **file** est complète et vérifiée. Quand un dossier passe à `READY` (ou à
`DELIVERED`), la base prépare un message et le range dans `public.notifications`.

Ce qui est décidé, et ne bougera pas quand l'envoi arrivera :

| Question | Réponse, et où elle est appliquée |
|---|---|
| Qui a le droit de recevoir un message ? | Un client rattaché au dossier, avec un numéro, et qui n'a pas refusé (`customers.accepte_notifications`). Vérifié par le trigger, en base. |
| Qu'est-ce qu'on écrit ? | Un texte composé par la base : nom de l'organisation et numéro de dossier. **Aucune donnée saisie par un utilisateur** — ni les notes du dossier, ni un nom de prestation. |
| À quel numéro ? | Celui du client **au moment de la mise en file**, figé dans la ligne. Si le client change de numéro ensuite, on sait où le message est parti. |
| Combien de fois ? | Une, par dossier et par étape. Un index unique partiel le garantit ; une annulation ne compte pas. |
| Qui peut écrire dans la file ? | Personne. Aucune policy d'insertion ni de mise à jour : pouvoir y écrire, ce serait pouvoir envoyer un message au nom de la station, avec le texte de son choix. |
| Qui peut la lire ? | Qui lit les dossiers de la station (`service_orders.read`). |
| Comment renoncer à un message ? | `annuler_notification(id, motif)` — motif obligatoire, `service_orders.write` exigé, audité. Il reste dans la liste, marqué annulé : savoir qu'on a décidé de ne pas prévenir quelqu'un fait partie de l'histoire du dossier. |
| Et si la fonctionnalité est fermée ? | Rien n'est mis en file. Le drapeau `notifications` est fermé par défaut, pour tous les plans. |

L'écran `/messages` montre la file, filtrable par station et par état, et permet
d'annuler un message en attente. Il dit en haut, en toutes lettres, qu'aucun
message ne part.

## Ce qui manque : l'envoi

**Une décision, pas du code.** Il faut un fournisseur, un compte et un budget.

### Le choix à faire

| Piste | Ce qu'elle implique |
|---|---|
| Agrégateur régional (Orange, Expresso, un agrégateur sénégalais) | Meilleure délivrabilité locale, tarifs en F CFA, contrat local. Demande souvent un identifiant d'expéditeur déclaré. |
| Twilio / Vonage | Intégration immédiate, documentation abondante, facturation en devise étrangère et coût par SMS plus élevé vers l'Afrique de l'Ouest. |
| WhatsApp Business | Très répandu, plus riche qu'un SMS, mais demande un numéro dédié, une validation, et des modèles de message approuvés à l'avance. |

Le coût par message et la délivrabilité réelle vers les opérateurs locaux
comptent plus que la qualité de l'API : un message qui n'arrive pas coûte plus
cher qu'un message cher.

### Ce qu'il restera à écrire

Une fonction de bord Supabase, appelée périodiquement, qui :

1. lit les lignes `PENDING` de `public.notifications` avec la clé `service_role`
   (la seule qui contourne la RLS — **elle ne doit jamais apparaître dans le
   frontend**) ;
2. appelle le fournisseur, un message à la fois ;
3. écrit `SENT` + `sent_at`, ou `FAILED` + `last_error`, et incrémente
   `attempts` ;
4. abandonne après un petit nombre de tentatives, plutôt que de boucler.

Rien de ce qui précède n'est à refaire pour cela. Les colonnes `attempts`,
`last_error` et `sent_at` existent déjà et n'attendent qu'elle.

### Ce qu'il faudra décider en même temps

- **Le consentement à l'inscription.** Le champ existe et vaut « accepte » par
  défaut, ce qui convient à un usage où le message est attendu (« votre véhicule
  est prêt »). Si le marché ou la réglementation demandent un opt-in explicite,
  c'est une ligne à changer — et la valeur par défaut de la colonne.
- **Qui paie.** Les SMS sont un coût par organisation : ils relèvent soit du
  plan, soit d'une facturation à l'usage. La facturation existe (phase 20) mais
  ne sait compter que des abonnements.
