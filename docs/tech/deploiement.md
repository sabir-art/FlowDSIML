# Déploiement FlowDSIML (GitHub + Supabase)

Ce document décrit la mise en production : base de données, Edge Functions, front (app + player) sur GitHub Pages **du dépôt public séparé `sabir-art/flowdsiml-app`** (le dépôt de code `FlowDSIML` est privé, et Pages y serait payant), extension Chrome. **Aucune valeur secrète ne figure dans le dépôt.**

## 1. Vue d'ensemble

| Élément | Où | Déployé par |
|---|---|---|
| Schéma SQL, RLS, RPC, buckets, pg_cron | Supabase `ffzlhlxfratcbitkuvli` | `.github/workflows/deploy.yml`, job `supabase` (`supabase db push`) |
| Edge Function `track` | Supabase | même job (`supabase functions deploy`) |
| App (éditeur, dashboard) | `https://sabir-art.github.io/flowdsiml-app/` (branche `gh-pages` de `flowdsiml-app`) | job `pages` |
| Player public | `https://sabir-art.github.io/flowdsiml-app/player/` | job `pages` |
| Extension Chrome (.zip) | artefact GitHub Actions → Chrome Web Store (manuel) | `.github/workflows/extension.yml` (tag `ext-v*`) |

Le workflow `Deploy` se lance sur un push sur `main`, ou à la main (*Actions → Deploy → Run workflow*). L'option « skip_database » permet de ne redéployer que le front.

## 2. Secrets et variables GitHub Actions

À créer dans *Settings → Secrets and variables → Actions*. Les secrets du job `supabase` vont de préférence dans l'**environnement `production`** (*Settings → Environments*), avec une règle d'approbation.

### Secrets (valeurs confidentielles)

| Nom | Où l'obtenir | Utilisé par |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → *Account → Access Tokens* (jeton personnel d'un membre du projet) | CLI : `link`, `db push`, `functions deploy` |
| `SUPABASE_DB_PASSWORD` | *Project Settings → Database → Database password* (le réinitialiser si inconnu) | `db push` |
| `PAGES_DEPLOY_TOKEN` | GitHub → *Settings → Developer settings → Fine-grained tokens* : accès limité au dépôt `flowdsiml-app`, permission **Contents : Read and write** | publication du site compilé vers `flowdsiml-app` (branche `gh-pages`) |

### Variables (non secrètes)

| Nom | Valeur | Utilisé par |
|---|---|---|
| `SUPABASE_PROJECT_REF` | `ffzlhlxfratcbitkuvli` | job `supabase` |
| `VITE_SUPABASE_URL` | `https://ffzlhlxfratcbitkuvli.supabase.co` | builds web, player, extension |
| `VITE_SUPABASE_ANON_KEY` | *Project Settings → API → anon / publishable key*. Publique par conception, car la sécurité repose sur RLS | builds web, player, extension |
| `SITE_URL` *(optionnel)* | URL publique de l'app si domaine perso, ex. `https://app.exemple.com` | job `pages`, extension |
| `PAGES_REPO` *(optionnel)* | dépôt public cible (défaut : `flowdsiml-app`) | job `pages` |
| `BASE_PATH` *(optionnel)* | `/` avec un domaine perso (défaut : `/flowdsiml-app/`) | job `pages` |
| `VITE_PLAYER_URL` *(optionnel)* | URL du player si elle est séparée de l'app (recommandé avant la bêta) | job `pages` |

**Ne jamais** mettre la clé `service_role` dans GitHub ni dans le front. Les Edge Functions la reçoivent automatiquement de Supabase (`SUPABASE_SERVICE_ROLE_KEY`).

### Secrets des Edge Functions (côté Supabase)

Aucun n'est nécessaire au MVP. Ils seront à ajouter plus tard via `supabase secrets set NOM=valeur` (ou *Edge Functions → Secrets*) :

| Nom | Quand |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | intégration du paiement |
| `AI_API_KEY` | V2 : génération de textes, traductions |
| `SMTP_*` | si une fonction envoie des emails elle-même (sinon, SMTP configuré dans Supabase Auth) |

## 3. Première mise en production (checklist)

1. **Supabase, Auth** (*Authentication → URL Configuration*) :
   - Site URL : `https://sabir-art.github.io/flowdsiml-app/` (ou le domaine perso) ; **déjà configuré** ;
   - Redirect URLs : la même URL suivie de `**`, et `http://localhost:5173/**` pour le dev.
2. **Supabase, Auth → Providers** : Email activé, confirmation d'email activée. Google est optionnel (client OAuth Google requis).
3. **Supabase, SMTP** (*Authentication → Emails → SMTP Settings*) : **obligatoire avant la bêta**. Le SMTP intégré n'envoie qu'aux membres de l'équipe du projet, avec un débit très faible.
4. **GitHub Pages** : créer le dépôt **public** `sabir-art/flowdsiml-app`. Après le premier déploiement (création de la branche `gh-pages`), dans *flowdsiml-app → Settings → Pages* : Source « Deploy from a branch », branche `gh-pages`, dossier `/ (root)`.
5. **Secrets et variables** du §2.
6. **Branche `main`** : la créer à partir de la branche d'intégration validée, puis pousser. Le workflow `Deploy` :
   - affiche les migrations (`--dry-run`) puis les applique ;
   - déploie la fonction `track`, sans JWT (`supabase/config.toml`) ;
   - construit et publie l'app et le player.
7. **Vérifications** :
   - inscription, puis email reçu, puis création d'un workspace ;
   - capture avec l'extension (chargée non empaquetée), édition, publication ;
   - ouverture du lien public ; les vues apparaissent dans Analytics.

### Migrations : règles

- Uniquement additives et idempotentes (`create … if not exists`, `create or replace`). **Aucun `drop` de données.**
- Testées en CI sur un Postgres 16 vierge, avec deux passages pour vérifier l'idempotence, plus pgTAP (`supabase/tests`).
- Pour régénérer les types après une migration : `pnpm db:types` (CLI Supabase connectée), puis commiter `packages/supabase-types/src/database.ts`.

## 4. Extension Chrome

- **Développement** : `pnpm --filter @flowdsiml/extension build`, puis `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → `apps/extension/.output/chrome-mv3`.
- **Publication** : pousser un tag `ext-vX.Y.Z`. Le workflow `Extension` produit le `.zip` (artefact), qui est ensuite téléversé à la main dans le tableau de bord Chrome Web Store. Il faut :
  - un compte développeur (frais d'inscription uniques) ;
  - une politique de confidentialité publique ;
  - la justification des permissions. `<all_urls>` sert à réinjecter l'enregistreur après une navigation ; la revue sera plus longue.

## 5. Limites connues de l'hébergement GitHub Pages

- **Même origine pour l'app et le player** (`sabir-art.github.io`). Le player, embarqué chez des tiers, partage l'origine de la session de l'éditeur. Parades en place :
  - le player ne lit jamais la session ;
  - tout le texte utilisateur passe par un rendu échappé ;
  - aucun HTML capturé n'est exécuté.

  **Avant la bêta** : un domaine perso avec `app.` et `play.` (variables `SITE_URL` et `VITE_PLAYER_URL`), ou le player publié depuis une organisation GitHub distincte.
- **Pas d'en-têtes HTTP** (CSP, `frame-ancestors`) sur Pages. La liste des sites autorisés à intégrer une démo est vérifiée par le player : c'est une protection contournable.
- **Pas de rendu serveur.** Les liens de démo ne génèrent pas d'aperçu Open Graph spécifique.

## 6. Retour arrière

- **Front** : relancer `Deploy` (option `skip_database`) sur un commit antérieur, ou revenir à un commit précédent de la branche `gh-pages` de `flowdsiml-app`.
- **Démo publiée** : chaque publication crée un manifeste versionné (`published/<demo>/v<n>.json`). Republier remet `latest.json` à jour.
- **Base** : pas de retour automatique. Toute correction se fait par une nouvelle migration additive.
