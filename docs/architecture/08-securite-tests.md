# Sécurité et tests

La sécurité est vérifiée **à chaque phase**, pas à la fin.

## Les trois angles, pour chaque fonctionnalité

1. **Utilisateur autorisé** → la fonctionnalité marche.
2. **Utilisateur non autorisé** → l'accès est refusé, côté serveur.
3. **Utilisateur malveillant** → les contournements sont bloqués :
   ID manipulé (IDOR), `organization_id` falsifié, `station_id` d'une autre
   station, rôle modifié côté client, montant modifié, statut forcé, chemin de
   fichier manipulé, appel direct à l'API REST PostgREST.

## Pyramide de tests

| Niveau | Outil | Couvre |
|---|---|---|
| Sécurité base | SQL / pgTAP dans `supabase/tests/` | RLS, isolation multi-tenant, permissions, transitions interdites |
| Unitaire | Vitest / Jest | logique de calcul (totaux, résolution de prix, soldes) |
| Parcours | Playwright | arrivée → inspection → file → opération → contrôle → paiement → restitution |

Les tests d'isolation multi-tenant sont écrits en **SQL**, pas en Playwright :
plus rapides, plus fiables, exhaustifs table par table. Ils tournent en CI à
chaque commit, dès la phase 1.

## Test structurel permanent

Un test liste toutes les tables de `public` et échoue si l'une d'elles n'a pas
`ROW LEVEL SECURITY` activé, ou n'a aucune policy pour l'une des quatre
commandes. Il rend impossible l'oubli d'une table lors d'une phase ultérieure.
**Il ne doit jamais être désactivé ni assoupli.**

## Rapport de fin de phase

Écrit dans `docs/phases/phase-NN.md` : périmètre audité, tests réalisés,
vulnérabilités trouvées avec gravité (CRITICAL / HIGH / MEDIUM / LOW / INFO),
corrections, tests ajoutés, résultat après correction, risques résiduels.

CRITICAL et HIGH bloquent la validation de la phase.

## Rappels

- « Ça fonctionne » ≠ « c'est sécurisé ».
- « RLS est activé » ≠ « le multi-tenant est sécurisé ».
- « Le bouton n'est pas visible » ≠ « l'action est interdite ».
- Aucun secret dans le frontend. La clé `service_role` ne quitte jamais les
  Edge Functions et les variables d'environnement serveur.
