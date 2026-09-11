---
name: vehora-security
description: Méthode et checklist de sécurité VEHORA — multi-tenant, RLS, permissions, auth, storage, règles financières, audit. À charger pour tout travail touchant aux données, aux permissions, à l'authentification, aux paiements, ou à la fin de chaque phase pour l'audit obligatoire.
---

# Sécurité VEHORA

Référence : `docs/architecture/08-securite-tests.md`.
La sécurité se vérifie **à chaque phase**, jamais à la fin.

## Les trois axiomes

- « Ça fonctionne » ≠ « c'est sécurisé ».
- « RLS est activée » ≠ « le multi-tenant est sécurisé ».
- « Le bouton n'est pas visible » ≠ « l'action est interdite ».

## Les trois angles de test, pour chaque fonctionnalité

1. **Autorisé** → la fonctionnalité marche.
2. **Non autorisé** → refusé **côté serveur**, pas seulement masqué.
3. **Malveillant** → contournements bloqués : ID d'une autre organisation,
   `organization_id` falsifié à l'insertion, station d'un autre site, rôle
   modifié côté client, montant modifié, statut forcé, chemin de fichier
   manipulé, appel direct à l'API REST sans passer par l'interface.

## Checklist d'audit de fin de phase

**Authentification** — accès non authentifié · session expirée · compte
suspendu · accès après déconnexion.

**Autorisation** — permission absente · escalade de privilèges · accès direct
par URL · rôle manipulé côté client · attribution d'un rôle `PLATFORM` depuis
une organisation.

**Multi-tenant** — A → B en lecture et en écriture, **table par table** ·
station A → station B · IDOR · filtrage uniquement côté frontend.

**RLS** — policy manquante · `using (true)` · `INSERT` sans `with check` ·
`UPDATE`/`DELETE` non protégés · fuite par table liée · table sans RLS
(le test `00_rls_coverage.sql` doit rester au vert).

**Storage** — fichier d'une autre organisation · bucket public involontaire ·
type MIME non validé · chemin manipulable.

**Métier** — transition de statut hors matrice · montant calculé côté client ·
prix historique modifié · restitution sans condition remplie · caisse
manipulée · paiement supprimé au lieu d'être annulé.

**Super Admin** — accès aux données métier d'un client · escalade · action
sensible non auditée.

## Règle « trouver puis corriger »

Ne jamais écrire « aucune faille détectée » sans avoir réellement cherché.
Pour chaque faille : cause → impact → correction de la **cause** → test de
non-régression → nouvel audit.

`service_role` contourne la RLS. Tout ce qui doit tenir contre lui se protège
par **trigger ou contrainte**, pas par policy. (C'est ainsi que le journal
d'audit est rendu immuable.)

## Gravité

CRITICAL / HIGH / MEDIUM / LOW / INFO.
**CRITICAL et HIGH bloquent la validation de la phase.**

## Rapport de phase

`docs/phases/phase-NN.md` : périmètre · tests réalisés · vulnérabilités et
gravité · corrections · tests ajoutés · résultat après correction · risques
résiduels.

## Secrets

Aucun secret dans le frontend. La clé `service_role` ne quitte jamais les Edge
Functions et les variables d'environnement serveur. Aucune donnée sensible dans
les logs ni dans les messages d'erreur affichés.
