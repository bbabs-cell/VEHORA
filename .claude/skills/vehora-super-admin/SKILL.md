---
name: vehora-super-admin
description: Règles du Platform Command Center VEHORA — séparation Super Admin / organisation, accès plateforme, abonnements, feature flags, audit, session d'assistance. À charger pour tout travail sur l'espace Super Admin, les abonnements, la configuration globale ou les analytics de plateforme.
---

# Super Admin — Platform Command Center

Référence : `docs/architecture/03-rls-super-admin.md`, ADR-002, ADR-003.

## Séparation fondamentale

Le Super Admin n'est **pas un rôle ajouté à l'application cliente**. C'est un
espace distinct : arbre de routes `features/platform/`, layout propre,
navigation propre, garde propre. Ne jamais afficher un écran de plateforme dans
la navigation d'une organisation, ni l'inverse.

Deux rôles (ADR-002) : `SUPER_ADMIN` (tout) et `PLATFORM_SUPPORT` (lecture des
métadonnées, aucune action sensible). Le travail quotidien de support utilise le
second.

## Règle d'accès — la plus importante

**Le Super Admin n'a aucune policy de lecture sur les tables métier des
clients.** Pas de `or is_platform_admin()` sur `service_orders`, `payments`,
`customers`, etc. Ce serait un contournement unique, global et silencieux de
tout le cloisonnement multi-tenant.

Il pilote la plateforme via :
- des tables `platform_*` (organisations, abonnements, plans, tickets, flags) ;
- des **vues agrégées** (compteurs, chiffres, tendances) — jamais un accès ligne
  à ligne aux prestations d'un client ;
- des **Edge Functions `service_role`** pour les actions sensibles, qui
  vérifient les droits et écrivent dans `audit_logs`.

## Deux niveaux financiers, jamais mélangés

- **CA de l'organisation** : ce que la station encaisse de ses clients.
- **Revenus VEHORA** : les abonnements payés par les organisations.

Tables séparées, écrans séparés. Aucune requête ne les additionne.

## Actions sensibles — audit obligatoire

Suspendre · réactiver · désactiver une organisation · changer un plan ·
modifier une permission · modifier la configuration globale · ouvrir une session
d'assistance · toute suppression.

Chaque entrée d'audit : qui · quoi · quand · quelle organisation · quelle
ressource · ancienne valeur · nouvelle valeur · motif · contexte technique.
Écriture par `vehora.write_audit_log(...)` uniquement. Le journal est immuable,
y compris pour `service_role`.

## Statuts d'organisation

`TRIAL` · `ACTIVE` · `SUSPENDED` · `EXPIRED` · `DEACTIVATED`.
Une suspension coupe l'accès des utilisateurs de l'organisation, sans jamais
supprimer ni altérer ses données.

## Abonnements et feature flags

Architecture prête (`plans`, `subscriptions`, `feature_flags`), **pas de moteur
de facturation dans le MVP**. Un flag s'évalue dans l'ordre : organisation →
plan → global. Résolution côté serveur ; le frontend ne fait que lire.

## Session d'assistance — reportée (ADR-003)

Non implémentée dans le MVP. Quand elle le sera, contraintes non négociables :
jamais le mot de passe du client · adhésion temporaire en **lecture seule** ·
30 minutes maximum · motif obligatoire · écritures refusées par RLS quand le
claim `impersonation_session_id` est présent · bandeau permanent « MODE
ASSISTANCE SUPER ADMIN — organisation X » · sortie en un clic · début, fin et
chaque action auditées · organisation notifiée.

## Périmètre MVP

Liste des organisations · fiche organisation · suspendre / réactiver · journal
d'audit. Le reste (analytics, revenus, support, alertes, impersonation) après
les premiers clients payants — voir le rapport de phase 0.
