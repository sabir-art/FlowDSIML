# MOTION-01 : mouvement de l'interface

> Retour client du 21/11 (priorité haute) : « un outil vivant et moderne », « des animations très, très fluides ». La référence est l'éditeur d'un outil concurrent, décrit par le chef : quand un panneau d'outil s'ouvre, toute la scène de travail (cadre de navigateur et capture) **rétrécit en douceur** pour lui faire place, comme un zoom arrière, et non comme une remise en page. Elle s'agrandit à la fermeture. Aucune capture de cet outil n'est versionnée.
>
> **Ordre de la file du dev** : logo, NAV-02 et §11, ICON-01, éditeur P1, **MOTION-01**, puis P2.

## 1. Jetons (existants, à garder)

`packages/ui/src/tokens.css` définit déjà les jetons de mouvement. On les garde, on n'en crée pas de doublons :

| Jeton | Valeur | Usage |
|---|---|---|
| `--fd-motion-duration-fast` | 120 ms | Survol, focus, petits changements d'état (interrupteur, coche, couleur) |
| `--fd-motion-duration-base` | 200 ms | Menus, popovers, infobulles, toasts, onglets, contenu qui remplace un squelette |
| `--fd-motion-duration-slow` | 320 ms | Scène de l'éditeur, panneaux, tiroirs, modales, dépli de la barre latérale |
| `--fd-motion-ease-standard` | `cubic-bezier(.2, .8, .2, 1)` | Entrées et changements de taille (décélération) |
| `--fd-motion-ease-exit` | `cubic-bezier(.4, 0, 1, 1)` | Sorties (accélération), à 80 % de la durée d'entrée |

- `--fd-motion-ease-emphasized`, avec son dépassement de 1,3, est **réservé** aux confirmations ponctuelles (coche « Copié », pastille de nouveauté). Il est interdit sur la scène, les panneaux, les menus et les modales : un rebond y paraît mou.
- Les trois durées tombent déjà à 0 ms sous `prefers-reduced-motion: reduce` (tokens.css). Toute animation **doit** passer par ces jetons pour en hériter (§4).
- Les noms courts proposés par le chef (`--fd-motion-fast`, `-base`, `-slow`) ne sont pas créés. Ce seraient des doublons des jetons existants.

## 2. Éditeur : la scène suit les panneaux (FLIP)

### 2.1 Ce qui bouge

- **La scène** est l'élément qui contient le cadre de navigateur, la capture et tout ce qui est posé dessus : hotspots, bulle, zones de flou, cadre de zoom, poignées. C'est `.frame` (cadre de navigateur et capture), parent de `.canvas-frame`, dans `.editor-center` : c'est `.frame` qui porte le transform ; la largeur se lit sur `.canvas-frame` (précision du 24/11, recette 48f3be7 conforme). Tout ce qui est dans la scène suit automatiquement, puisque c'est le même sous-arbre.
- **Déclencheurs** :
  - ouverture et fermeture d'un panneau du rail d'outils (Étape, Bouton d'action, Points d'intérêt, Voix off…) ;
  - changement de panneau : aucune animation de la scène, puisque la largeur disponible ne change pas ; seul le contenu du panneau passe en fondu ;
  - ouverture, fermeture et redimensionnement du panneau des commentaires (axe vertical) ;
  - repli et dépli de la liste des étapes, si elle devient repliable ;
  - « Ajuster » quand l'échelle change (zoom de la vue).

### 2.2 Technique

1. **Avant** le changement, on lit le rectangle de la scène (`getBoundingClientRect`) : `first`.
2. On applique le changement de mise en page (le panneau s'ouvre, la grille change). Le calcul d'ajustement existant donne la nouvelle échelle de la capture. On lit le rectangle final : `last`.
3. On pose sur la scène `transform: translate(dx, dy) scale(s)`, avec `s = first.width / last.width` et `dx`, `dy` tels que la scène semble n'avoir pas bougé, avec `transform-origin: 0 0` et sans transition.
4. À l'image suivante (`requestAnimationFrame`), on remet `transform: none` avec `transition: transform var(--fd-motion-duration-slow) var(--fd-motion-ease-standard)`.
5. À la fin (`transitionend` ou délai de garde de 400 ms), on retire `transition` et `will-change`.

- **Seules les propriétés `transform` et `opacity` sont animées.** Jamais `width`, `height`, `left`, `top`, `margin`, `padding` ni `grid-template-columns` : elles déclenchent une remise en page à chaque image.
- La grille de l'éditeur change **d'un coup**, sans transition CSS sur `grid-template-columns`. Seul le FLIP rend le mouvement fluide.
- **Netteté** : `will-change: transform` est posé seulement pendant l'animation, puis retiré. Une capture qui garde cette propriété en permanence devient floue.
- **Interaction** : pendant les 320 ms, les clics sur la scène restent permis. Les coordonnées du pointeur se calculent sur le rectangle final (`last`), comme aujourd'hui. Un glisser commencé pendant l'animation la termine aussitôt (`transform: none`).
- **Interruption** : si un autre panneau s'ouvre avant la fin, on relit `first` depuis l'état visuel en cours (le rectangle transformé) et on repart de là. Pas de saut.

### 2.3 Le panneau

- **Entrée** : `transform: translateX(16px)` et `opacity: 0`, vers `none` et `1`, en 320 ms `ease-standard`, en même temps que la scène.
- **Sortie** : l'inverse, en 240 ms `ease-exit`. La scène s'agrandit en même temps (320 ms).
- **Changement de panneau** : seul le contenu passe en fondu (`opacity`, 120 ms). Le cadre du panneau ne bouge pas.
- **Panneau des commentaires** (en bas) : même principe sur l'axe vertical, avec `translateY(16px)`. Le redimensionnement à la poignée n'est **pas** animé : il suit le pointeur.

## 3. Où ajouter du mouvement dans l'app

| Élément | Mouvement | Durée et courbe |
|---|---|---|
| **Barre latérale en rail** (§6, NAV-04) | Pas de dépli au survol (correction client, NAV-04 §14 bis). Bascule replié ↔ déplié par le bouton : la colonne change de largeur d'un seul coup, les libellés apparaissent en `opacity` de 0 à 1 après la bascule, et le contenu principal suit par FLIP | 200 ms `standard` |
| **Colonne Dossiers** (§7) | Bascule : FLIP sur le contenu principal ; colonne en `translateX(-16px)` et `opacity` | 320 ms `standard` |
| **Menus, déroulants, popovers** | `opacity` de 0 à 1 et `scale(.96)` vers 1, origine au déclencheur | 200 ms `standard` ; sortie en 120 ms `exit` |
| **Infobulles** | `opacity`, après le délai existant de 300 ms | 120 ms |
| **Modales** | Voile en `opacity` ; boîte en `opacity` et `translateY(8px) scale(.98)` vers `none` | 200 ms `standard` ; sortie en 160 ms `exit` |
| **Tiroirs** (mobile, Dossiers sous 1280 px) | `translateX(-100 %)` vers 0, voile en `opacity` | 320 ms `standard` ; sortie en 240 ms `exit` |
| **Toasts** | Entrée par le bas : `translateY(8px)` et `opacity` ; les autres toasts remontent par FLIP | 200 ms `standard` |
| **Squelette vers contenu** | Fondu croisé : squelette de 1 à 0, contenu de 0 à 1. Jamais un contenu qui « saute » | 200 ms |
| **Onglets** (onglets segmentés, en-tête de l'éditeur P2-2, Partager) | Le soulignement ou la pastille active glisse d'un onglet à l'autre par `transform: translateX() scaleX()` sur un seul élément | 200 ms `standard` |
| **Réordonnancement de liste** (étapes, chapitres, glisser-déposer) | FLIP sur les éléments déplacés | 200 ms `standard` |
| **Lecteur : changement d'étape** | Capture en fondu croisé ; bulle en `opacity` et `translateY(4px)` ; le zoom d'étape existant garde sa propre durée | 200 ms `standard` |
| **Interrupteurs, cases, puces** | Position du bouton et couleur de fond | 120 ms `standard` |

- **Pas d'animation au premier affichage d'une page.** Une page s'affiche directement dans son état final, sans fondu de toute la page ni cascade de cartes. Seuls les changements provoqués par l'utilisateur, ou par l'arrivée des données (squelette vers contenu), sont animés.
- **Pas d'animation en boucle**, sauf les indicateurs de chargement (`--fd-motion-duration-pulse`) et l'enregistrement en cours.

## 4. Mouvement réduit (obligatoire, RGAA 13.8 et WCAG 2.3.3)

- Sous `prefers-reduced-motion: reduce`, **tout est instantané**. Les durées valent déjà 0 ms par les jetons.
- **Fondu court toléré** : seulement pour les modales et les toasts, en `opacity` sur 120 ms au plus. On utilise pour cela un jeton dédié, `--fd-motion-duration-fade-reduced: 120ms`, qui ne tombe pas à 0. Il n'y a jamais de déplacement ni de changement d'échelle.
- **Le FLIP de la scène est désactivé** (le script lit `matchMedia('(prefers-reduced-motion: reduce)')`) : la scène prend sa taille finale tout de suite.
- **Aucune valeur en dur** (`transition: 200ms`) : la règle e2e §6 le vérifie.

## 5. Performance

- **Uniquement `transform` et `opacity`.** Pas de `box-shadow` animée : on anime l'`opacity` d'un pseudo-élément qui porte l'ombre. Pas de `filter: blur` animé.
- **60 images par seconde mesurées** dans l'éditeur, en ouvrant et fermant un panneau 10 fois. Trace Chromium avec un processeur ralenti 4 fois (`CPU throttling 4x`) : 0 tâche longue de plus de 50 ms pendant l'animation, et 95 % des images en moins de 16,7 ms.
- **Pas de remise en page pendant l'animation** : la trace ne montre ni `Layout` ni `Recalculate Style` entre la première et la dernière image, hormis la première image (étape 2 du FLIP).

## 6. e2e `mouvement.e2e.cjs`

1. **Scène de l'éditeur** (1440 px) :
   - lire la largeur de `.canvas-frame`, sans panneau ;
   - ouvrir « Bouton d'action » ; à t + 16 ms, la scène porte un `transform` dont l'échelle est entre la largeur finale et 1 ;
   - à t + 400 ms, `transform` vaut `none` et la largeur finale est inférieure à celle de départ ;
   - fermer : mêmes contrôles en sens inverse ;
   - les hotspots restent dans la scène : leur position relative à la scène est identique avant et après, à 1 px près.
2. **Durées lues dans les styles calculés** :
   - scène : `transition-duration` vaut 0,32 s pendant l'animation ;
   - panneau : 0,32 s à l'entrée ;
   - menu : 0,2 s ;
   - modale : 0,2 s ;
   - `transition-timing-function` vaut `cubic-bezier(0.2, 0.8, 0.2, 1)` pour les entrées.
3. **Propriétés animées** : sur toute l'app (`APP_PAGES`), aucune règle de `transition` ou d'`animation` ne cible `width`, `height`, `top`, `left`, `margin`, `padding` ou `grid-template-columns`. Le contrôle parcourt `document.styleSheets`.
4. **Mouvement réduit** (`reducedMotion: 'reduce'` dans le contexte Playwright) :
   - à l'ouverture d'un panneau, la scène n'a jamais de `transform` (relevé à t + 16 ms) ;
   - `getAnimations()` sur le document renvoie une liste vide, ou seulement des animations d'`opacity` de 120 ms au plus (modales, toasts) ;
   - les durées calculées des menus et des panneaux valent `0s`.
5. **Premier affichage** : `document.getAnimations().length === 0` sur chaque page de `APP_PAGES`, 50 ms après le chargement, hors indicateurs de chargement.
6. **Aucune durée en dur** : aucune règle CSS de `transition` ni d'`animation` n'a de durée littérale en ms ou en s hors des fichiers de jetons. Le contrôle passe par une analyse statique des CSS dans l'e2e.

## 7. Recette UX

- Captures vidéo (enregistrement Playwright) de l'ouverture et de la fermeture d'un panneau, du dépli de la barre latérale, d'un menu, d'une modale et d'un changement d'onglet, en clair et en sombre.
- Les mêmes en mouvement réduit.
- La trace de performance du §5.
- Contrôle visuel : aucun saut à la fin d'une animation, capture nette après le zoom, hotspots alignés pendant tout le mouvement.
