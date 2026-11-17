# TutoClick : fichiers de production

Logo fourni par le client (`../logo-tutoclick.svg` et ses dérivés). Le texte est **vectorisé** en Inter 750, interlettrage −5 (mise en forme HarfBuzz, police Inter sous licence SIL OFL 1.1). Le résultat se superpose exactement au rendu de référence ; le contrôle a été fait par superposition.

Inventaire, règles d'usage et palette : `docs/ux/identite-visuelle.md` §2 et §3.0. Planche de contrôle : `apercu.html`.

## Intégration (pour le dev)

| Usage | Fichier |
|---|---|
| Barre latérale de l'app, en-tête de l'extension | `logo-tutoclick-compact.svg` (clair) / `logo-tutoclick-compact-sombre.svg` (sombre), 36 à 40 px de haut, `alt="TutoClick"` |
| Pages de connexion, e-mails, documents | `logo-tutoclick.svg` / `logo-tutoclick-sombre.svg` |
| `<link rel="icon">` | `favicon.svg` + `favicon.ico` (16, 32, 48) |
| `apple-touch-icon` | `icon-180.png` |
| Manifeste web | `icon-192.png`, `icon-512.png` |
| Extension Chrome (`manifest.icons`, `action.default_icon`) | `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png` |
| Impression en une couleur, tampons | `logo-tutoclick-mono-noir.svg` / `-mono-blanc.svg`, `symbole-tutoclick-mono-*.svg` |

Le wordmark « Tutoclic » préparé auparavant est **abandonné** et supprimé.
