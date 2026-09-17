# Phase 14 — Abonnements, quotas et feature flags

Pas de moteur de facturation : ni passerelle de paiement, ni relance, ni
facture. Ce que cette phase pose, c'est ce dont le produit a besoin **avant**
d'avoir des clients payants — savoir quel plan porte une organisation, ce qu'il
lui ouvre, et faire appliquer les deux par la base.

## Trois niveaux, une seule résolution

Un flag s'évalue du plus précis au plus général : **organisation → plan →
défaut**. La résolution a lieu dans la base (`vehora.flag_actif`), jamais dans
le navigateur. Une clé inconnue est **fermée**, jamais ouverte par défaut.

Le frontend lit le résultat et masque ce qui n'est pas ouvert. Ce masquage est
un confort : `rapport_journalier()` et `rapport_prestations()` vérifient
elles-mêmes la fonctionnalité. **Un flag qui n'empêche rien n'est pas un flag** —
masquer l'écran ne ferme pas l'API, et c'est l'API qui rend le chiffre.

## Les quotas sont des règles, pas des affichages

`max_stations` et `max_users` sont appliqués par deux déclencheurs. `null` y
signifie « sans limite », jamais zéro — et chaque comparaison le dit
explicitement.

Deux choix qui évitent de casser ce qui tourne :

- **Les organisations existantes ne se voient pas imposer une limite
  rétroactivement.** Elles précèdent la facturation ; elles reçoivent un plan
  large et actif. Les organisations créées ensuite naissent en essai, par un
  déclencheur posé sur `organizations` — `provisionner_organisation()` n'a pas
  eu à le savoir.
- **Un changement de plan plus étroit que l'usage réel est refusé**, plutôt que
  de laisser une station ou un compte hors quota. Le quota s'applique à ce qu'on
  ajoute, pas à ce qui existe déjà.

Le siège se compte sur les comptes **actifs** : changer le rôle d'un membre déjà
actif n'en consomme pas un second — le déclencheur regarde `tg_op` et l'ancien
statut, pas seulement le nouveau.

## Ce qu'un client ne voit pas

Aucune policy de lecture pour `authenticated` sur `plans`, `subscriptions`,
`feature_flags`, `plan_features`, `organization_feature_overrides` : une
organisation lirait la grille tarifaire et les dérogations accordées ailleurs.
Elle interroge deux fonctions qui ne parlent que d'elle — `mon_abonnement()` et
`mes_fonctionnalites()`.

Aucune policy d'écriture nulle part : changer un plan ou une dérogation passe
par une fonction privilégiée qui vérifie le rôle de plateforme, **exige un
motif** et **audite**. Le support lit, il ne facture pas : seul `SUPER_ADMIN`
porte `platform.subscriptions.manage`.

## Ce que la validation a trouvé

**Trois défauts réels, dont deux qui attendaient la production.**

1. **Le journal d'audit rendait une organisation indestructible.** `audit_logs`
   référence `organizations` en `ON DELETE SET NULL` : supprimer une
   organisation demande un UPDATE sur ses lignes de journal, que le trigger
   d'immuabilité refusait. Toute organisation ayant une entrée d'audit
   rattachée devenait indéboulonnable. C'est la **troisième occurrence** de « un
   trigger de protection doit se taire quand l'écriture vient d'une cascade »
   (dernier propriétaire en phase 1, opérations en phase 10) — et la règle était
   écrite. Le trigger tolère désormais exactement une chose : la mise à NULL
   d'une clé étrangère, le reste de la ligne étant comparé champ à champ.

2. **Une fonction en droits d'appelant ne peut appeler que ce que l'appelant a
   le droit d'appeler.** `rapport_journalier` est en SECURITY INVOKER et
   appelait `vehora.flag_actif`, dont l'EXECUTE avait été révoqué de `public`
   pour empêcher de sonder les fonctionnalités d'une **autre** organisation.
   Résultat en production : « permission denied for function flag_actif » au
   lieu du chiffre ou d'un refus lisible. La sortie n'était pas de rouvrir
   `flag_actif`, mais d'exposer `fonctionnalite_active(cle)`, qui ne prend
   aucun identifiant d'organisation et ne peut donc répondre que sur la sienne.

3. **Le harnais de validation SQL mentait sur les droits d'exécution.**
   `scripts/validate-sql.sh` posait
   `alter default privileges in schema vehora grant execute … to authenticated`.
   Supabase n'en pose pas : c'est le défaut de PostgreSQL (`EXECUTE` à `PUBLIC`)
   qui rend ces fonctions appelables. Le harnais reposait donc un droit explicite
   qui **survivait au `revoke … from public`** d'une migration, et faisait passer
   pour ouvert ce qui était fermé en production. C'est la **deuxième fois** que
   ce script masque un défaut (phase 12 : les `grant` rejoués après les
   migrations). Un harnais de test qui s'écarte de la plateforme ne rassure sur
   rien.

Le défaut 2 n'a été vu que par la campagne d'intrusion, qui passe par l'API
réelle ; la suite SQL, elle, tournait sur le harnais faussé du défaut 3. Les
deux se tenaient : c'est le second qui cachait le premier.

Un défaut d'interface, trouvé à la capture d'écran : le formulaire de changement
de plan s'ouvrait sur le plan **déjà en cours**, que la base refuse de reposer.
Bouton inerte et raison affichée, comme ailleurs dans le produit.

## Vérification

- **243 assertions SQL** (213 avant la phase) : ce qu'un client ne voit pas, ce
  qu'il ne peut pas écrire, les deux quotas, la résolution à trois niveaux, la
  clé inconnue fermée, le motif obligatoire, l'audit, l'abonnement unique en
  cours, le retrait d'une dérogation, la forme des droits d'exécution, et la
  suppression d'une organisation qui a un journal.
- **Campagne d'intrusion** (`scripts/intrusion-abonnements.mjs`, **26
  assertions**) : lecture de la grille tarifaire, de l'abonnement du voisin et
  des dérogations, écriture directe, changement de plan par un client puis par
  un caissier, accès anonyme, motif, rétrogradation sous l'usage réel, bascule
  d'une clé inconnue, et dépassement du quota de stations.
- **219 tests Playwright** (211 avant la phase), dont l'écran d'abonnement en
  lecture seule et le changement de plan côté plateforme, journal compris.
- **Captures mobile et bureau** des deux écrans.
- **Advisors Supabase** : aucune catégorie nouvelle. `platform_subscriptions`
  rejoint les vues `SECURITY DEFINER` assumées (garde-fou dans le corps, `anon`
  révoqué, test structurel `00_platform_views.sql` qui couvre tout
  `platform_%`) ; `changer_plan`, `basculer_fonctionnalite`,
  `mon_abonnement`, `mes_fonctionnalites` et `fonctionnalite_active` rejoignent
  les fonctions privilégiées qui vérifient elles-mêmes leurs conditions.

## Laissé de côté, en connaissance de cause

- **Les dérogations de fonctionnalité n'ont pas d'écran.** La fonction existe,
  est testée et auditée ; l'écran de plateforme ne propose que le changement de
  plan. Une bascule par organisation est un geste rare, qui peut attendre un
  vrai besoin plutôt qu'être devinée.
- **Aucune facturation** : pas de prix appliqué, pas d'échéance, pas de
  relance. `price_minor` n'est qu'une étiquette, et `PAST_DUE` un statut que
  rien ne pose encore automatiquement.
- La fin d'essai (`trial_ends_at`) est affichée mais **n'a aucun effet** : rien
  ne suspend une organisation à l'expiration. C'est délibéré tant que personne
  ne paie.
