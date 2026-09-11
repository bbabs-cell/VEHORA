# Fondation 2 — Organization / Station / User / Employee

## Le problème résolu ici

Confondre « personne qui travaille » et « personne qui se connecte » est
l'erreur structurelle la plus coûteuse de ce type de produit. Sur le terrain :
un laveur n'a souvent pas de compte, mais son travail doit être tracé ; à
l'inverse, un comptable a un compte mais ne lave aucune voiture.

## Les entités

```
auth.users (Supabase)          identité d'authentification — 1 par personne connectable
      │ 1-1
   profiles                    données affichables : nom, téléphone, avatar, locale
      │ 1-N
organization_memberships       « ce compte appartient à cette organisation avec ce rôle »
      │ 1-N
  station_users                « ce membre est affecté à cette station »

  employees                    personne qui travaille pour l'organisation
      │ 0-1 (nullable)
   profiles                    lien facultatif vers un compte de connexion
```

### `organizations`
L'entreprise cliente. Racine de tout cloisonnement : **toute donnée métier
porte `organization_id`**, sans exception. Possède : stations, services, prix,
clients, véhicules, prestations, finances, abonnement, paramètres.

### `stations`
Un site physique ou opérationnel. `organization_id` obligatoire. Une station
mobile (équipe qui se déplace) est une station comme une autre, avec
`kind = 'MOBILE'` — cela évite un deuxième modèle parallèle (§41 du prompt).

### `profiles`
Miroir applicatif de `auth.users`, créé par trigger à l'inscription. Ne contient
aucune donnée d'organisation : un même compte peut appartenir à plusieurs
organisations (utile pour les consultants et pour notre propre support).

### `organization_memberships`
La table pivot centrale. `(profile_id, organization_id)` unique, porte le
`role_id` et un `status` (`ACTIVE`, `SUSPENDED`). **Suspendre un membre ici
coupe tout son accès aux données de l'organisation**, sans toucher à son compte
Supabase.

### `station_users`
Affectation d'un membre à une station. Ne sert que si le rôle du membre est de
portée `STATION`. Un membre de portée `ORGANIZATION` voit toutes les stations
sans ligne ici.

### `employees`
Personne qui travaille. Porte : nom, téléphone, station de rattachement,
statut, services qu'elle est autorisée à exécuter. `profile_id` est **nullable**.

- Employé **sans** compte : le chef d'équipe assigne et valide pour lui. C'est
  le cas par défaut du MVP, et le plus courant sur le terrain.
- Employé **avec** compte : il ouvre l'application, voit ses opérations, les
  démarre et les termine lui-même.

Les opérations référencent `employee_id`, jamais `profile_id`. Un employé qui
quitte l'entreprise est désactivé ; son historique de travail reste intact,
même si son compte de connexion est supprimé.

## Règles invariantes

1. Toute table métier porte `organization_id NOT NULL`.
2. Une station appartient à exactement une organisation.
3. Un employé appartient à exactement une organisation.
4. Un `profile` peut appartenir à plusieurs organisations ; ses droits sont
   toujours évalués **dans le contexte de l'organisation active**.
5. Une organisation a toujours au moins un `OWNER` actif.
6. Supprimer une organisation est une opération de plateforme, jamais un
   `DELETE` en cascade déclenché depuis l'application cliente.

## Organisation active

Un utilisateur multi-organisations choisit son organisation à la connexion. Le
choix est porté par le JWT (claim `org_id`), pas par un paramètre de requête —
sinon l'organisation devient manipulable côté client. Changer d'organisation =
rafraîchir le token.

## Ce qui est volontairement reporté

- Équipes / shifts / pointage : hors MVP (§31).
- Hiérarchie d'organisations (groupe possédant plusieurs entreprises) : le
  modèle le supporterait via un `parent_organization_id`, mais ne pas
  l'implémenter tant qu'aucun client ne le demande.
