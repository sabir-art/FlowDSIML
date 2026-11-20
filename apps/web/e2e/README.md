# Tests de bout en bout (e2e)

Les tests `*.e2e.cjs` pilotent Chromium (Playwright) contre l'app web et le lecteur servis par vite.
Aucun vrai Supabase : `fake-supabase.cjs` intercepte les appels réseau de la page (base, stockage,
Edge Functions) et sert l'adresse publique du lecteur. Toutes les données sont fictives (`.example`).

## Lancer en local

Depuis la racine du dépôt, après `pnpm install --frozen-lockfile` :

```bash
# 1. Navigateur (une fois)
pnpm --filter @flowdsiml/web exec playwright install chromium

# 2. Serveurs de dev, avec CET environnement (les deux serveurs reçoivent les mêmes variables)
export VITE_SUPABASE_URL=https://api.tutoclick.example   # hôte fictif, servi par fake-supabase.cjs
export VITE_SUPABASE_ANON_KEY=test
export VITE_PLAYER_URL=https://demos.tutoclick.example  # adresse publique fictive du lecteur
export VITE_APP_ORIGIN=http://localhost:5173            # origine RÉELLE de l'app (voir plus bas)
unset VITE_REMOTE_ORIGIN                                # par défaut : origine de la page
(cd apps/web && npx vite --port 5173 --strictPort) &
(cd apps/player && npx vite --port 5174 --strictPort) &

# 3. Un test (code de sortie 1 et lignes « NOT OK » en cas d'échec)
cd apps/web && node e2e/publish-player.e2e.cjs
```

Variantes : `THEME=dark` (thème sombre), `SHOTS_DIR=/chemin` (captures d'écran),
`APP_URL=http://localhost:5173` (adresse de l'app, valeur par défaut).

## Pièges connus

- **`VITE_APP_ORIGIN` doit être l'origine réelle de l'app** (`http://localhost:5173`). Le lecteur en
  aperçu (éditeur, aide, présentateur, quiz) n'accepte que les messages de cette origine : avec une
  autre valeur, il reste sur « Loading demo… » et les tests `aide`, `editor`, `present`,
  `quiz-editor` échouent par délai d'attente.
- **Serveurs déjà lancés** : `--strictPort` refuse de démarrer si le port est pris. Après un
  changement d'environnement, arrêter les anciens serveurs (`pkill -f "vite.*--port 517"`) et
  vérifier les variables du processus en cours, sinon l'ancien environnement reste actif.
- **Pas de touche envoyée pendant un rendu** : attendre l'état visible attendu (par exemple le
  compteur « 2 / 3 » du lecteur) puis cliquer le bouton, plutôt qu'appuyer sur une flèche juste
  après la fermeture d'un formulaire : l'écouteur clavier peut encore voir l'état précédent.
- **Un serveur de dev par campagne** : ne pas modifier le code de l'app pendant une série de tests,
  vite recharge la page en cours de test.

## En CI

`.github/workflows/ci.yml`, jobs « Accessibilité » (`a11y`, `a11y-clavier`) et « E2E publication »
(`publish-player`), avec le même environnement que ci-dessus.
