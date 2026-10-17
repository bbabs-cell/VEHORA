# ADR-006 — Un remboursement en espèces sort du tiroir d'où sort l'argent

**Statut :** acceptée · Phase 27 · **décision métier du propriétaire**

## Contexte

Seuls le propriétaire, l'administrateur et le chef de station ont
`payments.refund`. Jusqu'en phase 26, un remboursement en espèces s'inscrivait
obligatoirement dans la caisse ouverte **par la personne qui rembourse**.

Le cas le plus courant : un caissier encaisse 50 000 F au lieu de 5 000 F. Il
ne peut pas rembourser ; la propriétaire doit ouvrir sa propre caisse pour le
faire, pendant que l'argent sort physiquement du tiroir du caissier. Le soir,
la caisse du caissier montre un **manque** de 45 000 F et celle de la
propriétaire un **excédent** de 45 000 F. Les deux écarts s'annulent, mais le
caissier passe pour avoir perdu de l'argent, et rien ne relie les deux.

## Décision

**Une sortie d'espèces s'inscrit dans le tiroir d'où sort l'argent.** La
personne qui rembourse (avec `payments.refund` et un motif) désigne la caisse
ouverte, **de la station du dossier**, d'où sortent les billets. Sans
désignation, la base choisit :

1. la caisse qui a reçu le paiement d'origine, si elle est encore ouverte ;
2. sinon, la caisse ouverte de la personne qui rembourse, à cette station ;
3. sinon, le remboursement en espèces est refusé : il n'y a pas de tiroir.

La sortie porte le motif du remboursement et le nom de qui l'a autorisée : le
caissier la voit dans sa propre caisse. Le remboursement est audité, avec la
caisse touchée.

Le caissier ne gagne aucun droit : il ne rembourse toujours pas.

## Conséquences

- La clôture du caissier est juste, et celle du responsable aussi.
- Une personne écrit dans la caisse d'une autre. C'est limité au
  remboursement, au droit `payments.refund`, à une caisse **ouverte** de la
  station du dossier, de la même organisation ; c'est visible dans la caisse
  touchée et audité.
- Les mouvements libres (achat de savon, appoint) restent personnels : chacun
  les écrit dans **sa** caisse, et la base le vérifie désormais (elle ne le
  vérifiait pas — voir `docs/phases/phase-27.md`).

## Alternatives écartées

- **Laisser le caissier corriger ses propres erreurs** (annuler un paiement
  qu'il vient d'encaisser, dans sa caisse ouverte) : plus rapide pour une faute
  de frappe, mais c'est un nouveau droit pour le caissier. Écartée par le
  propriétaire ; reste possible plus tard, sans remettre en cause celle-ci.
- **Ne rien changer et faire saisir un transfert** (sortie chez le caissier,
  entrée chez le responsable) : deux saisies de plus, faciles à oublier, et
  l'écart revient dès qu'on les oublie.
