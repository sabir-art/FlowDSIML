# FlowDSIML

Plateforme SaaS de démos interactives : capture d'un parcours web par une extension Chrome, édition no-code (étapes, hotspots, textes, variables, formulaires), partage par lien ou embed iframe, analytics et leads.

Stack : **GitHub + Supabase** uniquement (voir [`docs/DECISIONS.md`](docs/DECISIONS.md) et [`docs/tech/architecture.md`](docs/tech/architecture.md)).

## Structure

```
apps/
  web/         SPA Vite + React : comptes, workspaces, éditeur, analytics (GitHub Pages)
  player/      Player public Preact : lecture des démos publiées, embed iframe (GitHub Pages)
  extension/   Extension Chrome MV3 (WXT) : capture des clics et screenshots
packages/
  manifest/        Schéma Zod du manifeste publié (contrat éditeur ↔ player ↔ functions)
  core/            Logique pure : variables, texte riche sûr, rôles, plans, analytics, CSV
  ui/              Design system (tokens provisoires, la Lead UX les remplacera)
  supabase-types/  Types TypeScript de la base
supabase/
  migrations/  Schéma SQL, RLS, RPC, buckets Storage, pg_cron
  functions/   Edge Functions (Deno)
  tests/       Tests pgTAP (+ tests/local pour un Postgres nu)
```

## Démarrer

Prérequis : Node ≥ 22, pnpm 10 (`corepack enable`).

```bash
pnpm install
cp .env.example apps/web/.env.local     # renseigner VITE_SUPABASE_ANON_KEY (clé publique)
cp .env.example apps/player/.env.local
pnpm --filter @flowdsiml/web dev        # http://localhost:5173
pnpm --filter @flowdsiml/player dev     # http://localhost:5174
pnpm --filter @flowdsiml/extension dev  # ouvre Chrome avec l'extension chargée
```

Pour charger l'extension à la main : `pnpm --filter @flowdsiml/extension build`, puis `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → `apps/extension/.output/chrome-mv3`.

## Qualité

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### Base de données

Avec la CLI Supabase et Docker : `supabase start`, `supabase db reset`, `supabase test db`.

Sans Docker, sur un Postgres 16 local avec pgTAP :

```bash
PGHOST=/tmp PGPORT=5432 PGUSER=postgres supabase/tests/local/run.sh
```

Le script applique une imitation minimale de Supabase (rôles, `auth.uid()`, `storage`), rejoue les migrations deux fois pour vérifier qu'elles sont idempotentes, puis lance les tests pgTAP.

### Tests de bout en bout (Playwright, faux Supabase)

```bash
# app sur :5173 et player sur :5174, avec une clé factice
VITE_SUPABASE_ANON_KEY=test VITE_PLAYER_URL=http://localhost:5174 pnpm --filter @flowdsiml/web dev
VITE_SUPABASE_ANON_KEY=test VITE_APP_ORIGIN=http://localhost:5173 pnpm --filter @flowdsiml/player dev
pnpm --filter @flowdsiml/web e2e          # éditeur, publication → player, analytics, tableau de bord
```

L'extension a son propre test (`apps/extension/e2e`, voir l'en-tête du fichier).

## Déploiement

Voir [`docs/tech/deploiement.md`](docs/tech/deploiement.md) : secrets et variables GitHub Actions, configuration Supabase Auth et SMTP, GitHub Pages, publication de l'extension.

## Sécurité

- Aucun secret dans le dépôt. La clé `anon` est publique par conception : la sécurité repose sur RLS.
- La clé `service_role` ne va jamais dans le front ni dans la CI : les Edge Functions la reçoivent de Supabase.
