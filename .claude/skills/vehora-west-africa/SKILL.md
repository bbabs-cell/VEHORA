---
name: vehora-west-africa
description: Adaptation de VEHORA au contexte ouest-africain — appareils, réseau, devises, Mobile Money, langue, habitudes métier. À charger pour toute décision touchant la performance, les paiements, la saisie client, les formats, ou l'usage terrain.
---

# Contexte Afrique de l'Ouest

Marché initial : Sénégal, Mali, Côte d'Ivoire, Burkina Faso, Guinée, Bénin, Togo.

**L'adaptation est fonctionnelle, pas décorative.** Aucun cliché visuel
africain : ni motifs, ni palette « terre », ni imagerie folklorique. Le produit
doit avoir l'air international, et fonctionner localement.

## Appareils et réseau

Android majoritaire, souvent d'entrée de gamme, écran modeste, RAM limitée.
Réseau 3G instable, coupures fréquentes, données payées au volume.

Conséquences non négociables :
- bundle initial ≤ 250 Ko compressé, budgets vérifiés en CI ;
- listes paginées, **jamais** de chargement complet d'une table ;
- images compressées avant envoi, miniatures pour l'affichage ;
- pas d'effet visuel coûteux (glassmorphism, ombres animées) sur une liste ;
- toute opération rejouable est **idempotente** ;
- les formulaires longs sont sauvegardés localement pendant la saisie ;
- un échec réseau se dit et propose de réessayer — jamais de perte silencieuse.

## Argent

- Devise par défaut **XOF (FCFA)**, sans décimale à l'affichage. Architecture
  multi-devises dès le départ (`amount_minor` + `currency`).
- Format : séparateur d'espace insécable pour les milliers, `5 000 FCFA`.
- **Espèces majoritaires** → la caisse n'est pas un module secondaire, c'est un
  écran quotidien central.
- **Mobile Money** très répandu : Wave, Orange Money, MTN MoMo, Moov Money. Dans
  le MVP, le caissier **saisit** le paiement reçu ; aucune intégration d'API.
  La structure (`provider`, `external_ref`, `status`) est prête pour plus tard.
- Le paiement différé du client régulier existe : `ALLOW_DEBT` est le défaut
  (ADR-004), avec suivi des impayés.

## Clients

- Le **téléphone** est l'identifiant naturel, pas l'email (souvent absent).
  Stocker au format international (`+221…`), afficher au format local.
- Orthographe des noms variable → recherche tolérante, jamais une correspondance
  exacte imposée.
- Un même client peut avoir plusieurs véhicules, et un véhicule plusieurs
  conducteurs. Ne pas modéliser un lien exclusif.
- **WhatsApp** est le canal de communication réel. Prévoir le partage d'un reçu
  par lien, plutôt qu'un SMS payant ou un email jamais lu.

## Langue et formats

Français d'abord. Architecture prête pour l'anglais (Ghana, Nigeria voisins) :
aucun texte en dur dans les composants. Dates au format `JJ/MM/AAAA`, heure sur
24h. Fuseau par organisation (`Africa/Dakar`, `Africa/Abidjan`, `Africa/Bamako`…).

## Réalités métier

Plusieurs pays, plusieurs devises, plusieurs fuseaux dès le départ.
L'eau est un coût réel et parfois rationnée → le suivi de consommation aura du
sens plus tard, il est hors MVP.
Beaucoup de très petites structures : l'application doit être utilisable par
une station de deux personnes **sans formation**, tout en tenant un réseau de
dix sites.
