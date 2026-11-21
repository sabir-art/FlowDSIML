# Retours client du 21 novembre (prioritaires)

> Relevé sur `claude/dev-mvp` (c63b0e4), en clair et en sombre, avec le faux backend et des données fictives (Acme, `@example.com`).
> Règles : `composants.md` §15, §17 et §18. Chaque point a une recette mesurable (§12).

## 1. Éditeur : les commentaires dans un panneau en bas du canevas

**Constat.** Les commentaires (`CommentsPanel`) occupent un panneau latéral à droite, qui réduit la largeur du canevas.
**Demande du client.** Un panneau en bas du canevas, comme les notes du présentateur de Figma Slides.

### 1.1 Disposition
- Le panneau est placé **sous le canevas**, dans la colonne du canevas : il ne recouvre ni la colonne des étapes à gauche, ni le panneau d'outils à droite. Il ne réduit jamais la largeur du canevas.
- **Replié** : une barre basse de **40 px** de haut, sur toute la largeur de la colonne du canevas. Fond `surface`, filet de 1 px `border` en haut.
  - À gauche, un bouton « Commentaires », avec l'icône `message-square` de 16 px, le badge (§1.2) et le chevron `chevron-up`.
  - À droite, pour l'étape courante : « Étape {n} », en 13 px `text-muted`.
- **Déplié** :
  - le panneau fait par défaut **320 px** de haut, entre **200 px** au moins et **50 %** de la hauteur de la colonne du canevas au plus. À 240 px, on ne voyait qu'un commentaire (barre de 40 px, saisie de 91 px) : 320 px en montrent 2 à 3 (arbitrage du 21 novembre) ;
  - une **poignée** de redimensionnement le borde en haut : 8 px de zone de saisie, avec un trait centré de 32 × 4 px `border-strong`, et `cursor: row-resize` ;
  - au clavier, la poignée est un `role="separator"` avec `aria-orientation="horizontal"`, `aria-valuenow`, `aria-valuemin` et `aria-valuemax`. Les flèches haut et bas changent la hauteur de 16 px ; Début et Fin vont au minimum et au maximum ;
  - l'en-tête de 40 px reste le même qu'en replié, avec le chevron `chevron-down`. Dessous, le contenu actuel du panneau défile à l'intérieur : liste, « Afficher les résolus », champ de saisie ;
  - le champ de saisie est collé en bas du panneau.
- **Ne jamais masquer la bulle sélectionnée** : quand le panneau s'ouvre ou s'agrandit, le canevas réduit sa hauteur et se recadre (« Ajuster »). Si la bulle ou le hotspot sélectionné sortirait de la zone visible, la vue défile pour le garder à au moins 16 px du bord haut du panneau.

### 1.1 bis Arbitrages sur la livraison 0e2c518 (21 novembre)
- « Commentaires » **sort du rail d'outils** de l'éditeur, avec son point « non lu ». Le badge de la barre est la seule porte d'entrée (§1.2).
- La mention « Interne à l'équipe, jamais publié. » passe dans la barre, avec le cadenas, à droite et avant « Étape n ». Elle est tronquée si la place manque ; le texte entier est dans `title` et dans l'`aria-describedby` du champ.
- Le champ de saisie fait 4 lignes au plus dans le panneau.
- Alt + C fonctionne aussi depuis le champ. Sur Mac, où Option + C tape « ç », **Échap dans un champ vide** referme le panneau et rend le focus au bouton « Commentaires ».

### 1.2 Badge
- Le badge compte les **commentaires ouverts** (non résolus) de l'**étape courante**. C'est ce que montre le panneau déplié.
- Il prend la forme d'une pastille ronde à côté du libellé : hauteur de 18 px, largeur minimale de 18 px, padding horizontal de 5 px, rayon plein, texte de 11 px 700 en chiffres tabulaires. Au-delà de 99, il affiche « 99+ ».
  - Si au moins un de ces commentaires est **non lu** : fond `primary`, texte `on-primary` (pastille d'appli).
  - S'ils sont tous lus : fond `surface-sunken`, texte `text`.
  - Sans commentaire ouvert : pas de badge.
- C'est le seul indicateur. Il n'y a pas de second compteur dans l'en-tête de l'éditeur.

### 1.3 État retenu
- Replié ou déplié, ainsi que la hauteur, sont gardés **par utilisateur**, pour tous les éditeurs. On les stocke dans `localStorage` (`fd.comments.dock` : `{ open, height }`) avec une valeur par défaut sûre si le stockage est indisponible.
- Par défaut, le panneau est replié. Exception : on ouvre l'éditeur par un lien vers un commentaire (notification, mention). Le panneau s'ouvre alors sur ce commentaire, sans changer l'état retenu.

### 1.4 Accessibilité
- Le bouton de l'en-tête est un `button` avec `aria-expanded` et `aria-controls` vers le panneau. Son nom accessible est « Commentaires, {n} ouverts, dont {u} non lus », ou « Commentaires, aucun ouvert ». Le texte visible est « Commentaires » et le badge.
- Raccourci : Alt + C ouvre ou ferme le panneau ; il est ajouté à la fenêtre « Raccourcis clavier ».
- À l'ouverture, le focus va sur le champ de saisie. À la fermeture, il revient sur le bouton.
- `prefers-reduced-motion` : pas d'animation de hauteur.

### 1.5 Petits écrans
- Sous 1024 px (`EditorNarrow`), le comportement actuel ne change pas.

## 2. Démos et Sandbox : colonne Dossiers sur toute la hauteur

**Constat.** La colonne `.fcol` est collante, de la hauteur de la fenêtre. Mais la mise en page ne s'étend pas jusqu'en bas, ce qui laisse un vide blanc sous la colonne et sous la barre latérale quand la page est courte. À 1024 px, la colonne (232 px) et la barre latérale ne laissent que 470 px environ au contenu : les indicateurs et la prise en main passent sur 4 à 8 lignes.

### 2.1 Hauteur
- La mise en page occupe au moins toute la hauteur de la fenêtre (`min-height: 100dvh`), même si la page est courte.
- La colonne est collante, avec `top` égal à la marge de la page. Elle a `height: calc(100dvh - 2 × marge)` : elle commence en haut et finit en bas de la fenêtre, avec la même marge que la barre latérale.
- La liste des dossiers **défile à l'intérieur**. « Nouveau dossier » et « Archivées » restent visibles en bas de la colonne, séparés par un filet.
- Fond `surface` sur toute la hauteur : il n'y a plus jamais de vide sous la colonne.

### 2.2 Largeurs
| Largeur de fenêtre | Colonne Dossiers |
|---|---|
| ≥ 1280 px | Visible, 232 px, repliable (comme aujourd'hui) |
| 1024 à 1279 px | **Repliée par défaut** en rail de 48 px, avec le bouton « Dossiers » (icône `folder`, `aria-expanded`). Dépliée, elle s'ouvre **par-dessus** le contenu, en tiroir de 280 px avec ombre, sans pousser le contenu. Échap et un clic dehors la ferment. |
| < 1024 px (tablette et mobile) | Pas de colonne. Le filtre « Dossier » s'affiche dans la barre de liste (comportement actuel). |
- Le choix de l'utilisateur (repliée ou dépliée) est gardé, comme aujourd'hui, mais seulement pour la largeur ≥ 1280 px.

## 3. Paramètres : un seul espacement entre les cartes (forme remplacée par le §11)

**Constat (mesures à 1440 px).**
- Profil : 16 px entre « Profil » et « Changer de mot de passe », puis **0 px** entre « Changer de mot de passe » et « Mes données ».
- Équipe, Sécurité et Thème et couleurs : 16 px.
- Général : un vide de 162 px entre deux cartes.

**Règle.**
- **24 px** entre deux cartes empilées dans toutes les pages des Paramètres, posés une seule fois sur le conteneur de la page (`.settings-main` en `display: flex; flex-direction: column; gap: 24px`, cartes à `margin: 0`).
- Le même conteneur sert à la description de page, aux cartes et aux tableaux. Il n'y a pas de marge propre à une carte.
- À vérifier sur toutes les pages : Général, Équipe, Utilisation, Sécurité, Confidentialité, Thème et couleurs, Page publique, Variables, Glossaire, Étiquettes, Assistance IA, Intégrations, Profil.

## 4. Profil : photo de profil

### 4.1 Carte « Profil »
- En tête de la carte, avant « Nom », la ligne « Photo » :
  - l'avatar de 64 px : la photo, ou l'initiale actuelle si aucune photo n'est enregistrée ;
  - à droite, le bouton secondaire « Choisir une photo » (icône `image-plus`), et « Retirer » en lien `danger` s'il y a une photo ;
  - dessous, l'aide « JPG, PNG ou WebP, 2 Mo au plus. » en 13 px `text-muted`.
- Au clic sur « Choisir une photo », le sélecteur de fichier s'ouvre (`accept="image/jpeg,image/png,image/webp"`).
- Erreurs écrites sous la ligne, en `danger`, avec `role="alert"` :
  - « Ce fichier n'est pas une image JPG, PNG ou WebP. »
  - « Cette image dépasse 2 Mo. »

### 4.2 Recadrage
- La fenêtre s'appelle « Recadrer la photo ». La zone de recadrage est **carrée**, avec un aperçu rond de 96 px à côté.
  - Curseur « Zoom » (de 100 à 300 %). L'image se déplace par glisser, et aux flèches du clavier par pas de 8 px.
  - Pied : Annuler, puis « Enregistrer la photo » (principal).
- À l'enregistrement, l'image est recadrée et réduite **dans le navigateur** en 256 × 256 px WebP. Le réencodage retire les métadonnées EXIF, dont la position GPS. Seule cette image est envoyée.

### 4.3 Stockage et confidentialité
- Bucket de stockage **privé** `avatars`, à un chemin non devinable (`{user_id}/{uuid}.webp`). Seuls les membres d'un espace commun peuvent lire la photo, par une URL signée.
- « Retirer » supprime le fichier, puis remet l'initiale.
- La photo est incluse dans l'export « Mes données ». Elle est supprimée avec le compte.

### 4.4 Partout où il y a un avatar
- La photo remplace l'initiale dans :
  - la barre latérale (carte de l'utilisateur) ;
  - les commentaires et les réponses ;
  - les mentions (liste de suggestions) ;
  - Paramètres › Équipe ;
  - la présence dans l'éditeur ;
  - les notifications ;
  - les invitations en attente.
- Rendu : `object-fit: cover`, rayon plein, même taille que l'initiale actuelle à chaque endroit. L'image est décorative (`alt=""`) quand le nom est écrit à côté. Sinon, `alt` porte le nom.
- Si l'image ne se charge pas, l'initiale actuelle s'affiche à la place, sans icône d'image cassée.

## 5. « Bientôt » sans point

- Dans le Profil, « E-mail quand un lead est collecté » et « Résumé hebdomadaire des vues » affichent « Bientôt » avec un point d'état. Règle §18.4 et L50 X4 : « Bientôt » s'écrit en texte de 13 px `text-muted`, **sans point**. L'interrupteur est désactivé (`disabled`).
- Rechercher dans toute l'app les autres « Bientôt » rendus par `fd-status` (`Status` avec le texte `shell.soon`), et les passer en `soon-text`.

## 6. Barre latérale principale repliable en rail d'icônes

- **Replié** : un rail de **64 px**.
  - En haut, le logo réduit à son icône (32 px), puis les icônes de navigation (20 px dans des cibles de 44 × 44 px, centrées). L'élément actif garde son fond (§18.3).
  - En bas : Extension, Centre d'aide, Paramètres, puis l'avatar (32 px, photo ou initiale, §4).
  - Le sélecteur d'espace devient la pastille de l'espace (32 px).
  - Pas de texte.
- **Survol du rail** : après 150 ms, la barre se déplie à sa largeur actuelle **par-dessus** le contenu, avec une ombre `--fd-shadow-lg`. Elle ne pousse pas le contenu, et se replie 300 ms après la sortie de la souris.
- **Bouton d'épinglage**, en haut de la barre (icône `panel-left`, 32 × 32 px), **au même endroit dans les deux états** :
  - « Épingler la barre latérale » : elle reste dépliée et pousse le contenu, comme aujourd'hui ;
  - « Réduire la barre latérale » : elle redevient un rail.
  - `aria-pressed` indique l'état épinglé.
- **État retenu par utilisateur** (`localStorage` `fd.sidebar` : `pinned` ou `rail`). Par défaut, elle est épinglée à partir de 1440 px et en rail en dessous.
- **Clavier** :
  - le focus qui entre dans le rail le déplie, et il reste déplié tant que le focus y est ;
  - Échap le replie et rend le focus à l'élément actif du rail.
- **Noms accessibles** : chaque icône du rail est un lien qui garde son nom accessible (le libellé masqué visuellement). Une infobulle affiche ce libellé au survol et au focus, après 300 ms, à droite de l'icône.
- **Mobile** (< 1024 px) : comportement actuel, inchangé.

## 7. Colonne Dossiers : masquer et afficher, au même endroit

**Constat.** Une fois la colonne repliée, le bouton « Dossiers » réapparaît loin, à côté des filtres : on ne retrouve pas la colonne.

- **Repliée**, la colonne devient un **rail de 48 px**, **au même endroit**, sur toute la hauteur (§2.1), avec :
  - en haut, le bouton de bascule (icône `panel-left-open`, 32 × 32 px), nommé « Afficher les dossiers » ;
  - dessous, l'icône `folder` avec le nombre de dossiers en 11 px `text-muted`.
- **Dépliée** : le même bouton de bascule (icône `panel-left-close`), nommé « Masquer les dossiers », **à la même position** que dans le rail (même `top` et même `left`, mesuré).
- Le bouton « Dossiers » placé à côté des filtres est **retiré** à partir de 1024 px. Sous 1024 px, le filtre « Dossier » de la barre de liste reste.
- Ce rail est le même qu'au §2.2 (1024 à 1279 px), et suit la même logique que le rail de la barre latérale (§6) : même largeur d'icône, même bouton, même infobulle.

## 8. Éditeur : liste des hotspots

- « Ajouter un hotspot » est collé au dernier hotspot de la liste (`HotspotsTool.tsx`, conteneur `.sec` sans écart).
- **Règle §18.6** : 4 px entre deux lignes de la liste (lignes de 36 px qui ont leur propre padding), **12 px** entre la liste et « Ajouter un hotspot ». C'est le même modèle pour toutes les listes du panneau : étapes du guide, variables, sondages.
- La correction se fait par le `gap` de `.sec`, pour tous les panneaux de l'éditeur, et non par une marge sur ce bouton.

## 9. Espacements partout (le client insiste)

- La règle mesurable est au §18.6 de `composants.md`. Le dev écrit `espacements.e2e.cjs`, qui la vérifie sur toutes les routes, en clair et en sombre, à 1440 et 390 px. Il ajoute ce test à la CI.
- Le relevé du test est joint à chaque livraison. Je contrôle les captures élément par élément.

## 10. Éditeur : le panneau « Points d'intérêt » défile en largeur (bug client)

- Au trackpad, le panneau « Points d'intérêt » glisse vers la gauche ou la droite : le contenu se décale et laisse un vide sur le côté.
- Correction à la source, selon la règle §18.7 : le panneau et ses sections n'ont jamais `scrollWidth > clientWidth`. On vérifie en particulier :
  - les champs en `width: 100%` avec bordure ;
  - les sélecteurs CSS affichés (« Élément visé : … ») et les adresses, à couper avec `overflow-wrap: anywhere` ;
  - les rangées flex sans `min-width: 0`.
- e2e global : aucun conteneur sans `data-scroll-x` ne dépasse en largeur, sur toutes les routes et dans tous les panneaux de l'éditeur.
- Dans la même capture, « Libre · Bientôt » a encore un point : à passer en texte, sans point (§5).

## 11. Paramètres : une mise en page commune, aérée (référence fournie par le client)

> Principes tirés de captures fournies par le client comme **inspiration**. On ne copie rien : nos couleurs, notre typographie et nos composants. Aucune de ces captures n'est versionnée.
> Ce modèle **remplace le §3** pour la forme des pages. La règle des 24 px reste pour les rares pages qui gardent plusieurs surfaces (Zone de danger, par exemple).

### 11.0 Cible mesurable (priorité n° 1 du chef, avec le défilement horizontal)
- **Maquette avant/après** : `docs/ux/maquettes/refonte/parametres-aere.html`, sur Général et Profil, avec le sélecteur Avant/Après et Clair/Sombre. Captures à 1440 px dans `img/parametres-aere/` (`avant-*` : app réelle sur c63b0e4 ; `apres-*` : maquette).
- **Constat sur Général, à 1440 px** :
  - champs de 542 px, beaucoup plus larges sur un grand écran, car ils prennent toute la colonne ;
  - bordure #768294 ;
  - aides sur toute la largeur ;
  - « Bientôt » avec un point ;
  - « Changer le logo » grisé et peu lisible.
- **Cible** :
  - contenu centré de **880 px** au plus ;
  - rangées : libellé et aide à gauche sur **40 %** (aide limitée à 40 caractères de large), contrôle à droite sur **60 %**, **420 px au plus**, et **240 px** pour les données courtes (adresse personnalisée, fuseau horaire, langue) ;
  - **padding vertical de 20 px** par rangée, filet de 1 px `border` entre les rangées ;
  - champs de **40 px** de haut, police de 14 px, rayon de 10 px, **bordure `--fd-color-border-field`** (nouveau jeton). Il vaut #8A94A2 en clair (3,07:1 sur `surface`) et #5E6978 en sombre (3,16:1). C'est la bordure la plus claire qui garde le **3:1 exigé par le RGAA** (critère 3.3, WCAG 1.4.11) pour repérer un champ. Un filet clair comme `border` (#E2E8EF, 1,23:1) serait non conforme, d'où ce compromis ;
  - en-tête de page : titre, sous-titre, puis **Annuler et Enregistrer à droite** ;
  - **Zone de danger** encadrée à part, en bas.
- Le jeton `--fd-color-border-field` est à ajouter dans `tokens.ts`, puis tokens.css est régénéré. Il sert à tous les champs de l'app, pas seulement dans les Paramètres.

### 11.1 Gabarit de page
- Le contenu des Paramètres est **centré**, avec une largeur maximale de **880 px** et des marges latérales de 32 px (16 px sous 768 px).
- En haut, l'en-tête de page : fil d'Ariane, titre H1, puis une phrase de description en 14 px `text-muted`. 32 px avant la première section.
- **Une seule surface** `surface` par page (rayon `--fd-radius-xl`, filet de 1 px `border`, padding de 24 px, 32 px à partir de 1280 px), qui contient toutes les sections. Plus de pile de cartes.

### 11.2 Section
- **En-tête de section** :
  - à gauche, le titre (16 px 600) et le sous-titre (14 px `text-muted`, une ou deux lignes) ;
  - à droite, l'action principale de la section quand il y en a une (« Enregistrer », « Inviter des membres », « Nouvelle variable »), alignée en haut ;
  - 24 px entre l'en-tête et la première rangée.
- Deux sections de la même surface sont séparées par un filet de 1 px `border`, avec **32 px** au-dessus et au-dessous.

### 11.3 Rangées
- **Rangée de réglage** : libellé (14 px 600) et aide (13 px `text-muted`) à gauche, sur 40 % ; le contrôle à droite, sur 60 %, 420 px au plus (champ, interrupteur, segmenté, liste). Padding vertical de 20 px. Rangées séparées par un filet de 1 px `border`. Sous 768 px, le contrôle passe sous le libellé, à 8 px.
- **Rangée de formulaire en 2 colonnes** quand deux champs vont ensemble : Prénom et Nom, Langue et Fuseau horaire, Nouveau mot de passe et Confirmation. Gap de 16 px entre les colonnes et 20 px entre deux lignes de champs (§15.4 bis). Une seule colonne sous 768 px.
- « Bientôt » : texte de 13 px `text-muted` à droite du libellé, sans point. Le contrôle est désactivé (§18.4).

### 11.4 Tableaux (Variables, Glossaire, Étiquettes, Équipe)
- En-tête de section avec, à droite, la recherche (240 px) puis le bouton d'ajout.
- Lignes de 56 px au moins, padding horizontal de 16 px, séparées par un filet. En-tête de colonnes en 12 px 600 `text-muted`.
- L'état vide est dans la surface, centré, sans pastille (L48-B).

### 11.5 Profil
1. **Photo de profil**, en tête : vignette ronde de **56 px** (photo ou initiale), titre « Photo de profil », aide « JPG, PNG ou WebP, 2 Mo maximum. », puis à droite « Changer la photo » (secondaire) et « Retirer » (lien `danger`, seulement s'il y a une photo). Le recadrage et le stockage suivent le §4.
2. **Informations** : Prénom et Nom en 2 colonnes ; E-mail en lecture seule, avec l'aide « Contactez le support pour changer d'e-mail. ».
3. **Préférences** : Langue et Apparence en 2 colonnes, puis les rangées de notifications (« Bientôt » sans point).
4. **Mot de passe** : Nouveau mot de passe et Confirmation en 2 colonnes, avec l'aide actuelle ; « Mettre à jour le mot de passe » à droite.
5. **Mes données** : la phrase et « Télécharger mes données (.zip) ».
6. **Zone de danger**, en dernier, dans un **encadré séparé** sous la surface, à 24 px :
   - filet de 1 px `danger` à 30 % d'opacité, fond `surface` ;
   - titre « Zone de danger » en 16 px 600 `danger` ;
   - la phrase d'explication en 14 px `text-muted` ;
   - à droite, « Supprimer mon compte » en bouton `danger` ;
   - aucun aplat rouge.
- Un seul « Enregistrer », dans l'en-tête de la page, pour Informations et Préférences. Le mot de passe garde son propre bouton.

### 11.6 Pages concernées
- Le gabarit s'applique aux 13 pages : Général, Équipe, Utilisation, Sécurité, Confidentialité, Thème et couleurs, Page publique, Variables, Glossaire, Étiquettes, Assistance IA, Intégrations, Profil.
- Chaque page est découpée en sections selon son contenu actuel. Le dev propose le découpage, page par page, dans sa livraison.
- Ordre de livraison : **Profil** en premier (avec la photo, §4), puis Général, Équipe et Variables, puis le reste.

## 12. Recette (captures réelles en clair et en sombre)

| # | Contrôle | Mesure attendue |
|---|---|---|
| 1 | Éditeur à 1440 et 1280 px : les commentaires ne sont plus à droite ; la barre repliée fait 40 px de haut, sous le canevas | `getBoundingClientRect().height === 40` ; largeur du canevas inchangée entre replié et déplié |
| 2 | Badge : 3 commentaires ouverts sur l'étape, dont 1 non lu → « 3 » sur fond `primary` ; tous lus → fond `surface-sunken` ; aucun → pas de badge | couleurs calculées |
| 3 | Bouton : `aria-expanded` passe de `false` à `true` ; nom accessible « Commentaires, 3 ouverts, dont 1 non lus » | arbre d'accessibilité |
| 4 | Poignée : 320 px par défaut ; glisser jusqu'à 400 px, puis Flèche bas × 2 → 368 px ; Début → 200 px ; Fin → 50 % de la colonne | `aria-valuenow` |
| 5 | Bulle sélectionnée en bas du canevas : à l'ouverture du panneau, elle reste visible, à 16 px au moins du bord du panneau | rects |
| 6 | Recharger la page : l'état (déplié, 368 px) est gardé ; ouvrir par un lien de mention : le panneau s'ouvre sur le commentaire | |
| 7 | Démos et Sandbox, à 1440, 1280, 1024 et 390 px : la colonne va du haut au bas de la fenêtre, sans vide dessous ; la liste défile à l'intérieur avec 30 dossiers ; à 1024 px, rail de 48 px et tiroir par-dessus ; à 390 px, pas de colonne | `bottom === innerHeight - marge` |
| 8 | Paramètres : 24 px entre deux cartes sur les 13 pages | écarts mesurés |
| 9 | Profil : téléverser un PNG de 1,5 Mo, recadrer, enregistrer → l'avatar change dans la barre latérale, un commentaire, Équipe et les mentions ; un PDF → message ; 3 Mo → message ; Retirer → initiale | captures |
| 10 | L'image envoyée fait 256 × 256 px en WebP, sans EXIF | faux stockage |
| 11 | Plus aucun « Bientôt » avec un point dans l'app | `boutons-natifs` ou e2e : aucun `.fd-status` qui contient « Bientôt » |
| 12 | axe sans violation grave ; `boutons-natifs.e2e.cjs` passe sur l'éditeur avec le panneau déplié | |
| 13 | Barre latérale : rail de 64 px ; survol → dépliée par-dessus, sans décaler le contenu (le `left` du contenu ne change pas) ; épinglée → elle pousse le contenu ; état gardé au rechargement ; focus au clavier → dépliée, Échap → repliée ; chaque icône a un nom accessible et une infobulle | rects, arbre d'accessibilité |
| 14 | Colonne Dossiers : le bouton de bascule a la même position (`top`, `left`) repliée et dépliée ; « Afficher les dossiers » et « Masquer les dossiers » ; plus de bouton « Dossiers » près des filtres à partir de 1024 px | rects |
| 15 | Éditeur : 12 px entre le dernier hotspot et « Ajouter un hotspot » ; même écart pour les étapes du guide | mesure |
| 16 | `espacements.e2e.cjs` passe sur toutes les routes, en clair et en sombre, à 1440 et 390 px | relevé joint |
| 17 | Panneau « Points d'intérêt » et tous les panneaux de l'éditeur : geste horizontal au trackpad et molette avec Maj → aucun déplacement, `scrollLeft === 0` ; e2e global « aucun débordement horizontal » vert | mesure |
| 18 | « Libre · Bientôt » et tous les « Bientôt » de l'éditeur : texte sans point | captures |
| 19 | Paramètres, sur les 13 pages, à 1440, 1024 et 390 px : contenu centré de 880 px au plus ; une seule surface ; en-tête de section avec l'action à droite ; 32 px et un filet entre les sections ; rangées de 40 % et 60 % avec un padding de 20 px ; champs de 420 px au plus (240 px pour les données courtes) et 40 px de haut ; bordure de champ rgb(138, 148, 162) en clair et rgb(94, 105, 120) en sombre | rects, styles calculés |
| 20 | Profil : photo de 56 px en tête ; Prénom et Nom, Langue et Apparence, Mot de passe et Confirmation en 2 colonnes (une seule à 390 px) ; Zone de danger encadrée en dernier, 24 px sous la surface, sans aplat rouge | captures et mesures |
| 21 | Tableaux (Variables, Glossaire, Étiquettes, Équipe) : recherche et ajout à droite de l'en-tête ; lignes de 56 px au moins | mesure |
