# Recette de cc1b8f6 (lecture audio ronde) et ac81c0a (CHOIX-01, coche à droite) : VERT

Recette du 26/11 sur `claude/dev-mvp` (ac81c0a), app et lecteur locaux, faux backend et données fictives. J'ai vérifié à 1440 et à 390, en clair et en sombre.

## Tests du dev, rejoués en clair et en sombre

| e2e | Clair | Sombre |
|---|---|---|
| partager | 106/106 | 106/106 |
| l48g-types | 53/53 | 53/53 |
| media-page | 26/26 | 26/26 |
| dashboard | 31/31 | 31/31 |
| l48a-dossiers | 31/31 | 31/31 |
| voix-off | 47/47 | 47/47 |
| voix-sous-titres-ia | 69/69 | 69/69 |

## CHOIX-01 : menus mesurés et vus à l'écran

| Menu | Mesure (1440 et 390, clair et sombre) |
|---|---|
| Démos › Tri | 4 `menuitemradio` de 36 px ; texte à 12 px du bord, sur toutes les lignes ; coche de fin sur « Modifiées récemment » seulement ; aucune colonne vide |
| Démos › Type (1440) | même chose, coche à droite de « Tous ». À 390, Type est dans le panneau Filtres, et pas en menu |
| Médiathèque › Catégorie | icônes de 16 px en tête, avec le texte à 36 px, alignées sur Renommer et Télécharger ; coche à droite de « Logo » seulement ; plus de `mp-blank` |
| Partager › Afficher sur la page publique | icône Globe en tête ; coche à droite quand l'option est active (`public-coche-light.png`) ; sans page publique, l'entrée est grisée et sans coche |

Captures : `planche-recette.png`, `tri-1440-dark.png`, `type-1440-light.png`, `media-*.png`, `public-coche-light.png`, `tri-390-light.png`.

## Lecture audio ronde (RADIUS-01, famille Rond)

- **Bulle du lecteur** : le bouton lecture est rond, en clair et en sombre (`planche-recette.png`, en haut).
- **Barre du lecteur** : le bouton lecture/pause de la voix (`.p-voice-toggle`) est rond. C'est mesuré par `voix-off`, dans les deux thèmes.
- **Aperçu de la voix off et sélecteur** : le bouton Écouter est rond, de 32 px. C'est mesuré par `voix-sous-titres-ia`, et je l'ai vu sur mes captures de la recette du lot voix 1.

Aucun écart.
