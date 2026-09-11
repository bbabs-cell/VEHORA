# Structure du projet

```
/
├── CLAUDE.md
├── docs/
│   ├── PROMPT-MAITRE.md            source de vérité produit
│   ├── architecture/               les fondations
│   ├── decisions/                  ADR — journal des décisions
│   └── phases/                     rapports de phase (fonctionnel + sécurité)
├── supabase/
│   ├── migrations/                 SQL versionné, appliqué dans l'ordre
│   ├── functions/                  Edge Functions (opérations privilégiées)
│   ├── tests/                      tests de sécurité SQL (RLS, multi-tenant)
│   └── seed.sql                    données de démonstration
├── src/
│   ├── app/
│   │   ├── core/                   auth, garde, intercepteurs, client Supabase
│   │   ├── shared/                 composants et pipes réutilisables
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── customers/
│   │   │   ├── vehicles/
│   │   │   ├── services/
│   │   │   ├── service-orders/
│   │   │   ├── queue/
│   │   │   ├── operations/
│   │   │   ├── payments/
│   │   │   ├── cash/
│   │   │   ├── employees/
│   │   │   ├── settings/
│   │   │   └── platform/           Super Admin — routes et layout séparés
│   │   └── types/                  database.types.ts (généré)
│   └── styles/                     tokens, base, utilitaires
├── e2e/                            Playwright
└── .claude/skills/                 skills projet
```

## Règles

- **Une feature = un dossier lazy-loadé.** Aucune feature n'importe une autre
  feature ; ce qui est partagé remonte dans `shared/` ou `core/`.
- `core/` ne contient que des singletons (services `providedIn: 'root'`).
- `platform/` (Super Admin) est un arbre de routes distinct, avec son propre
  layout, sa propre navigation et son propre garde. Ce n'est pas un onglet de
  l'application cliente.
- Aucun appel Supabase dans un composant : toujours via un service de feature.
  Cela rend les règles testables et les requêtes optimisables en un seul endroit.
- `database.types.ts` est **généré**, jamais édité à la main.

## Configuration Angular

- Composants standalone, pas de `NgModule`.
- `ChangeDetectionStrategy.OnPush` partout.
- Signals pour l'état local, RxJS pour les flux Realtime.
- `strict: true` + `strictTemplates: true`.
- **Pas de SSR** : SPA statique sur Vercel (ADR-005).
