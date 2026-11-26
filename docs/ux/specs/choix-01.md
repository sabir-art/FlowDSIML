# CHOIX-01 — Choix unique dans une liste : pas de colonne de coche à gauche

Décision du client du 26/11 (sélecteur de voix, L62). Une coche à gauche réserve une colonne vide sur toutes les lignes, ce qui décale les avatars et le texte. Elle disparaît de toutes les listes à choix unique de l'app.

## Règle

1. **Aucune colonne réservée** : le premier élément de chaque ligne (avatar, icône ou texte) s'aligne sur la marge intérieure de la liste, sélectionné ou non.
2. **L'élément choisi** garde le **fond teinté** de sa ligne (`color-mix(--fd-prune-500 8 %)`, `aria-selected="true"` ou `aria-checked="true"`). On y ajoute un repère **sans décalage** :
   - **ligne avec avatar ou vignette** : une pastille cochée de 16 px, en bas à droite de l'avatar (décalée de −3 px). Elle est ronde, en couleur principale (`--fd-prune-700` ; `--fd-prune-500` en sombre), avec une coche blanche de 10 px et un contour de 2 px de la couleur du fond de la ligne ;
   - **ligne de texte seul** (menus de tri, de type, de filtre) : une coche de 16 px, en couleur principale, **à droite** de la ligne, dans la colonne de fin. Il n'y a plus de `menu-blank` ni de `<span />` vide en tête.
3. La couleur n'est jamais seule à porter l'état : la pastille ou la coche est toujours présente, et l'état est exposé aux lecteurs d'écran (`aria-selected` ou `aria-checked`).

## Où l'appliquer (audit du 26/11 sur claude/dev-mvp)

| Écran | Aujourd'hui | Après |
|---|---|---|
| Éditeur › Voix off › sélecteur de voix | coche dans une colonne à gauche | pastille sur l'avatar (L62 §8) |
| Démos › menu Tri (`DemosPage.tsx`, `icon: sort === k ? <Check/> : <span/>`) | coche à gauche et colonne vide | coche à droite |
| Démos › menu Type de capture (`icon: ctype === k …`) | idem | coche à droite |
| Médiathèque › filtre de type (`MediaPage.tsx`, `mp-blank`) | idem | coche à droite |
| Partager › Page de la démo › liste (`usePublicPageList.tsx`, `menu-blank`) | coche et case vide à gauche | coche à droite |
| Sélecteur d'espace (`WorkspaceSwitcher.tsx`, `ws-check`) | coche à droite, tuiles alignées : déjà sans colonne réservée | pastille sur la tuile de l'espace, pour suivre la règle des lignes avec avatar (faible priorité) |

Les menus dont **toutes** les entrées ont une icône (Plus d'options, par exemple) gardent leur colonne d'icônes : ce ne sont pas des listes à choix unique.

## e2e

Dans chaque liste à choix unique :
- le premier enfant visible de chaque ligne a le même `left`, que la ligne soit choisie ou non ;
- la ligne choisie a `aria-selected` ou `aria-checked` à `true`, et contient la pastille (avec avatar) ou la coche de fin (texte seul) ;
- aucune ligne ne contient de `span` vide en tête.
