# Phase 6 — Véhicules

## Périmètre

Fiches véhicules rattachées aux clients : plaque, type, marque, modèle,
couleur, propriétaire. Recherche par plaque, par modèle ou par nom du
propriétaire. Les photos et l'inspection viennent ensuite — elles amèneront les
policies Storage.

## Décisions

### Le référentiel de types est global, pas propre à chaque organisation

Le type conditionne le tarif, et « SUV » doit vouloir dire la même chose
partout : sinon les comparaisons entre stations d'un même réseau n'ont plus de
sens. Neuf types, ordonnés **du plus fréquent au plus rare en station**, pas par
ordre alphabétique — le réceptionniste doit trouver « Berline » sans chercher.

### La plaque est l'identifiant, normalisé par la base

Même raisonnement que pour les numéros de téléphone en phase 5 :
`dk1234a`, `DK 1234 A`, `dk-1234-a` et `DK.1234.A` désignent le même véhicule.
Quatre écritures, une seule fiche.

### Le propriétaire est facultatif et non exclusif

Un véhicule peut être amené par un proche, un chauffeur, un collègue. Le client
qui l'amène sera enregistré **sur la prestation**, pas sur le véhicule. Un
véhicule sans propriétaire l'affiche explicitement plutôt que de laisser un vide.

### Un garde-fou que la RLS ne couvrait pas

La policy vérifie le véhicule, **pas ce qu'il référence**. Un identifiant client
appartenant à une autre organisation serait passé. Un trigger le refuse
désormais — vérifié par l'API et par une assertion SQL.

## Défauts trouvés et corrigés

### MEDIUM — échec silencieux du formulaire, deuxième occurrence

Le type de véhicule est obligatoire et vient d'un chargement asynchrone. Quand
il n'était pas encore là, le formulaire était invalide et **rien ne s'affichait**
au clic sur « Enregistrer ». L'utilisateur croit à une panne.

C'est exactement le défaut corrigé en phase 4 sur le formulaire d'invitation.
Deuxième occurrence ⇒ la règle est entrée dans le skill `vehora-frontend` :

> Désactiver l'action qui ouvre le formulaire tant que la donnée n'est pas là ;
> renseigner le défaut par un `effect` dès qu'elle arrive ; afficher un message
> explicite si la validation bloque sur ce champ.

### MEDIUM — le formulaire débordait de sa modale

**Trouvé par la capture d'écran.** Le champ « Modèle » sortait du cadre. Piège
classique de CSS Grid : une piste `1fr` ne descend pas sous la largeur
intrinsèque de son contenu, et un `<input>` en a une par défaut. Corrigé en
`minmax(0, 1fr)` plus `min-width: 0`.

Le test de débordement horizontal existait depuis la phase 2, mais **ne
couvrait que le tableau de bord**, jamais une modale ouverte. Étendu : chaque
champ doit rester dans les limites de sa modale.

### Mon test est devenu faux une fois le bug corrigé

Le test « le formulaire n'échoue jamais en silence » attendait un message
d'erreur. Une fois le défaut corrigé, le formulaire s'envoyait normalement —
donc aucun message, donc test en échec. Et il créait un véhicule parasite qu'il
ne nettoyait pas.

Réécrit sur le **véritable invariant** : à l'ouverture, le champ obligatoire
venu du réseau a déjà une valeur. C'est cela qui rend l'échec silencieux
impossible, et cela ne dépend pas du chemin d'erreur.

## Tests

| Suite | Résultat |
|---|---|
| Types stricts | ✅ |
| Build | ✅ 117,7 kB transférés |
| Sécurité SQL | ✅ **31 assertions** |
| Parcours Playwright | ✅ **99 tests** |
| API réelle | ✅ 13 assertions |

### Les trois angles

1. **Autorisé** — création avec propriétaire choisi dans un sélecteur de
   recherche, modification, archivage ; recherche par plaque sans séparateur,
   par modèle, et par nom de propriétaire mal orthographié.
2. **Non autorisé** — le caissier (`vehicles.read` sans `vehicles.write`) voit
   la liste mais **aucune action d'écriture**, et l'API refuse la création (403).
3. **Malveillant** — une autre organisation ne voit aucun véhicule, la recherche
   ne traverse pas les organisations, et rattacher un client d'une autre
   organisation est refusé (403).

## Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Les tests laissent des véhicules archivés en base (16 après plusieurs passages) | LOW | inactifs, sans effet sur les tests ; un nettoyage périodique suffira |
| Pas de fiche véhicule détaillée (historique, photos) | MEDIUM | dépend des prestations et du Storage |
| `confirm()` natif pour l'archivage | LOW | à remplacer par une modale du design system — dette accumulée sur trois écrans |
| Policies Storage non écrites | MEDIUM | prochaine phase |

Deux avertissements d'advisor restent ouverts, **tous deux déjà arbitrés** :
les fonctions `SECURITY DEFINER` volontairement exposées (documenté en base,
phase 4) et la protection contre les mots de passe compromis (réglage du
tableau de bord, action propriétaire).

Aucune vulnérabilité CRITICAL ou HIGH. **Phase 6 validée.**

## Suite

Inspection du véhicule et photos : premier usage de Supabase Storage, donc
premières policies de fichiers — le point de sécurité le plus sensible depuis
la RLS elle-même.
