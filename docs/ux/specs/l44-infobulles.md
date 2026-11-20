# L44 : infobulles des boutons à icône

> Retour client : tout bouton à icône seule doit avoir une infobulle, au survol comme au focus clavier.
> Il faut un composant unique dans `packages/ui`, dans le style de Figma : une bulle sombre avec une flèche vers l'icône, un délai court et une position qui ne sort jamais de l'écran.
> Aujourd'hui, la plupart des boutons n'ont que l'attribut `title`. Il n'apparaît pas au clavier, il est placé par le navigateur, et celui du bouton Langue du lecteur est coupé au bord.
> Le composant s'applique à l'app, au lecteur et à l'extension.
> Maquette : `docs/ux/maquettes/refonte/l44-infobulles.html` (le placement y est calculé par l'algorithme du §3). Captures : `img/l44-placements.png`, `img/l44-bords.png` et `img/l44-sombre.png`.

## 1. Quand

- **Obligatoire** sur tout bouton ou lien **sans texte visible** : `fd-btn--icon`, barres d'outils du canevas, contrôles du lecteur, bouton « ⋯ », boutons Fermer, aide, cloche, Langue, Plein écran, et ainsi de suite.
- **Facultatif** sur un bouton avec texte, seulement pour afficher un raccourci (« Publier · Ctrl Entrée », si ce raccourci existe).
- **Jamais** sur un élément désactivé sans le rendre focalisable : un bouton désactivé qui a besoin d'une explication utilise `aria-disabled` (il reste focalisable) et l'infobulle donne la raison (« Lecture seule : action réservée aux admins »).
- L'attribut `title` est **retiré** partout où l'infobulle est posée, pour ne pas avoir deux bulles.

## 2. Aspect (`fd-tooltip`)

- **Bulle** :
  - fond `#12161B`, texte blanc, 13/18 px, graisse 500 ;
  - marges intérieures de 6 × 10 px, arrondi de 8 px, largeur de 240 px au plus (le texte peut alors passer à la ligne) ;
  - ombre `0 4px 12px rgb(8 10 14 / .18)`.
- **En sombre** : fond `#2A3039`, texte `#F3F5F8` et contour de 1 px `#3A424D`, pour rester détachée d'un fond sombre.
- **Flèche** :
  - carré de 10 px tourné de 45°, de la couleur de la bulle, qui dépasse de 4 px du côté du bouton ;
  - toujours **dans l'axe du centre de l'icône**, même quand la bulle est décalée (au moins 10 px des coins).
- **Raccourci** :
  - à droite du libellé, chaque touche dans une pastille (`rgb(255 255 255 / .14)`, arrondi 4 px) : « Annuler » `Ctrl` `Z` ;
  - sur Mac : `⌘` à la place de Ctrl, et `⌥` à la place d'Alt ;
  - seulement pour des raccourcis **qui existent** (liste des raccourcis de l'éditeur, F1 pour l'aide).
- **Libellé** : le nom accessible du bouton, en 1 à 4 mots, sans point final.
- **Distance** : 8 px entre la bulle et le bouton.
- **Animation** : apparition en fondu de 120 ms ; aucune avec `prefers-reduced-motion`.

## 3. Placement (ne sort jamais de l'écran)

1. **Côté préféré** :
   - par défaut, `top` ;
   - `bottom` pour la barre du haut de l'app et de l'éditeur ;
   - `right` pour une barre d'outils verticale à gauche ;
   - `top` pour la barre de contrôle du lecteur.
2. Si la bulle déborde de la fenêtre de ce côté (marge de 8 px), elle passe au **côté opposé**.
3. Puis elle est **décalée le long du bord** pour rester entière dans la fenêtre (8 px de marge). La flèche reste sur l'icône.
4. La bulle est rendue dans un **portail** (`document.body` dans l'app ; racine du lecteur dans un iframe ; corps de la popup de l'extension), en `position: fixed`. Elle n'est donc jamais coupée par un `overflow: hidden` (règle §15.7 des composants).
5. Elle se recalcule au défilement et au redimensionnement. Si le bouton sort de l'écran, elle se ferme.

C'est le cas du bouton Langue du lecteur : à droite de la barre de contrôle, la bulle se décale vers la gauche et la flèche reste sur l'icône (maquette, section 2).

## 4. Comportement

- **Survol** : ouverture après **300 ms**. Si une autre infobulle vient de se fermer (moins de 500 ms), ouverture immédiate : on parcourt une barre d'outils sans attendre.
- **Focus clavier** (`:focus-visible`) : ouverture immédiate. Pas d'ouverture au focus donné par un clic.
- **Fermeture** : en quittant le survol et le focus, avec **Échap** (sans fermer la modale ou le panneau parent, en arrêtant la propagation de cette touche), au clic sur le bouton, au défilement de la page.
- **WCAG 1.4.13** : l'infobulle reste ouverte si le pointeur passe dessus (marge de 100 ms), et elle ne masque jamais le bouton.
- **Tactile** : pas d'infobulle à l'appui. Un appui long ouvre l'infobulle pendant 1,5 s, sans déclencher l'action.

## 5. Accessibilité

- La bulle a `role="tooltip"` et un `id` unique.
- **Si l'infobulle n'ajoute rien au nom** (le libellé seul) : le bouton garde `aria-label`, et la bulle est `aria-hidden="true"`, pour ne pas faire lire le nom deux fois.
- **Si elle ajoute une information** (raccourci, raison d'une désactivation) : le bouton a `aria-describedby` vers la bulle, et la bulle n'est pas masquée. Le raccourci y est écrit en toutes lettres pour les lecteurs d'écran (`aria-label` sur la partie clavier : « raccourci Ctrl Z »).
- La bulle n'est jamais focalisable et ne contient jamais de lien.

## 6. API (`packages/ui`)

```tsx
<Tooltip label="Annuler" shortcut={['Ctrl', 'Z']} side="top">
  <IconButton aria-label="Annuler" icon={<Undo2 />} />
</Tooltip>
```

- `IconButton` (le composant existant, ou celui de `fd-btn--icon`) **exige** désormais `aria-label`, et pose l'infobulle automatiquement avec ce libellé. Il n'y a rien à ajouter pour les cas simples.
- **Lecteur et extension** : ils sont en Preact ou dans un autre contexte ; le dev choisit entre partager le même composant ou une petite variante, avec le même CSS (`fd-tooltip`) et le même algorithme de placement.

## 7. Recette

- **Inventaire** : aucun bouton sans texte visible ne reste sans infobulle (contrôle automatisé dans les e2e a11y, sur les boutons dont le nom accessible ne vient que d'`aria-label` ou d'une icône). Aucun `title` ne reste sur ces boutons.
- **Lecteur** :
  - à 390 px et à 1 280 px, les infobulles Langue et Plein écran sont entières et la flèche est sur l'icône ;
  - même vérification dans un iframe d'intégration de 600 px.
- **App** : barre du haut (infobulles en dessous), barre d'outils du canevas, menu ⋯, panneau latéral étroit.
- **Extension** : popup de 360 px, avec les boutons près des bords.
- **Clavier** : ouverture immédiate à la tabulation, fermeture avec Échap sans fermer la modale parente.
- **Lecteur d'écran** : le nom n'est pas lu deux fois ; le raccourci est lu comme description.
- **Captures** : clair et sombre ; `prefers-reduced-motion` sans fondu.
