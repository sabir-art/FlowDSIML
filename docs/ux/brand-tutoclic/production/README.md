# TutoClick : fichiers de production

**Logo officiel fourni par le client le 20 novembre 2026** (`../logo-tutoclick-source.svg`, copie de `docs/brand/tutoclick-logo.svg`). Il remplace le logo précédent (bulle en dégradé, « Click » en bleu). Les déclinaisons sont tirées du fichier source sans redessiner les formes :
- **sombre** : seules certaines couleurs changent ;
- **compact** : cadrage serré, sans la signature ;
- **mono** : une couleur, curseur et cercles évidés ;
- **symbole et petit** : le carré seul, et pour la version petite, sans les cercles de visée.

Inventaire, règles d'usage et palette : `docs/ux/identite-visuelle.md` §2 et §3.0, et `docs/ux/composants.md` §16. Planche de contrôle : `apercu.html`.

## Intégration (pour le dev)

| Usage | Fichier |
|---|---|
| Barre latérale de l'app, en-tête de l'extension | `logo-tutoclick-compact.svg` (clair) / `logo-tutoclick-compact-sombre.svg` (sombre), 36 à 40 px de haut, `alt="TutoClick"` |
| Pages de connexion, e-mails, documents | `logo-tutoclick.svg` / `logo-tutoclick-sombre.svg` |
| `<link rel="icon">` | `favicon.svg` (symbole petit) + `favicon.ico` (16, 32, 48) |
| `apple-touch-icon` | `icon-180.png` (fond magenta plein, le système arrondit les coins) |
| Manifeste web | `icon-192.png`, `icon-512.png` |
| Extension Chrome (`manifest.icons`, `action.default_icon`) | `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png` |
| Impression en une couleur, tampons | `logo-tutoclick-mono-noir.svg` / `-mono-blanc.svg`, `symbole-tutoclick-mono-*.svg` |

Le wordmark « Tutoclic » et le logo en dégradé précédents sont **abandonnés** : mêmes noms de fichiers, contenu remplacé.
