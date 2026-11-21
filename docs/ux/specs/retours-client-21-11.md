# Retours client du 21 novembre (prioritaires)

> Relevé sur `claude/dev-mvp` (c63b0e4), en clair et en sombre, avec le faux backend et des données fictives (Acme, `@example.com`).
> Règles : `composants.md` §15, §17 et §18. Chaque point a une recette mesurable (§6).

## 1. Éditeur : les commentaires dans un panneau en bas du canevas

**Constat.** Les commentaires (`CommentsPanel`) occupent un panneau latéral à droite, qui réduit la largeur du canevas.
**Demande du client.** Un panneau en bas du canevas, comme les notes du présentateur de Figma Slides.

### 1.1 Disposition
- Le panneau est placé **sous le canevas**, dans la colonne du canevas : il ne recouvre ni la colonne des étapes à gauche, ni le panneau d'outils à droite. Il ne réduit jamais la largeur du canevas.
- **Replié** : une barre basse de **40 px** de haut, sur toute la largeur de la colonne du canevas. Fond `surface`, filet de 1 px `border` en haut.
  - À gauche, un bouton « Commentaires », avec l'icône `message-square` de 16 px, le badge (§1.2) et le chevron `chevron-up`.
  - À droite, pour l'étape courante : « Étape {n} », en 13 px `text-muted`.
- **Déplié** :
  - le panneau fait par défaut **240 px** de haut, entre **160 px** au moins et **50 %** de la hauteur de la colonne du canevas au plus ;
  - une **poignée** de redimensionnement le borde en haut : 8 px de zone de saisie, avec un trait centré de 32 × 4 px `border-strong`, et `cursor: row-resize` ;
  - au clavier, la poignée est un `role="separator"` avec `aria-orientation="horizontal"`, `aria-valuenow`, `aria-valuemin` et `aria-valuemax`. Les flèches haut et bas changent la hauteur de 16 px ; Début et Fin vont au minimum et au maximum ;
  - l'en-tête de 40 px reste le même qu'en replié, avec le chevron `chevron-down`. Dessous, le contenu actuel du panneau défile à l'intérieur : liste, « Afficher les résolus », champ de saisie ;
  - le champ de saisie est collé en bas du panneau.
- **Ne jamais masquer la bulle sélectionnée** : quand le panneau s'ouvre ou s'agrandit, le canevas réduit sa hauteur et se recadre (« Ajuster »). Si la bulle ou le hotspot sélectionné sortirait de la zone visible, la vue défile pour le garder à au moins 16 px du bord haut du panneau.

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

## 3. Paramètres : un seul espacement entre les cartes

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

## 6. Recette (captures réelles en clair et en sombre)

| # | Contrôle | Mesure attendue |
|---|---|---|
| 1 | Éditeur à 1440 et 1280 px : les commentaires ne sont plus à droite ; la barre repliée fait 40 px de haut, sous le canevas | `getBoundingClientRect().height === 40` ; largeur du canevas inchangée entre replié et déplié |
| 2 | Badge : 3 commentaires ouverts sur l'étape, dont 1 non lu → « 3 » sur fond `primary` ; tous lus → fond `surface-sunken` ; aucun → pas de badge | couleurs calculées |
| 3 | Bouton : `aria-expanded` passe de `false` à `true` ; nom accessible « Commentaires, 3 ouverts, dont 1 non lus » | arbre d'accessibilité |
| 4 | Poignée : glisser jusqu'à 400 px, puis Flèche bas × 2 → 368 px ; Début → 160 px ; Fin → 50 % de la colonne | `aria-valuenow` |
| 5 | Bulle sélectionnée en bas du canevas : à l'ouverture du panneau, elle reste visible, à 16 px au moins du bord du panneau | rects |
| 6 | Recharger la page : l'état (déplié, 368 px) est gardé ; ouvrir par un lien de mention : le panneau s'ouvre sur le commentaire | |
| 7 | Démos et Sandbox, à 1440, 1280, 1024 et 390 px : la colonne va du haut au bas de la fenêtre, sans vide dessous ; la liste défile à l'intérieur avec 30 dossiers ; à 1024 px, rail de 48 px et tiroir par-dessus ; à 390 px, pas de colonne | `bottom === innerHeight - marge` |
| 8 | Paramètres : 24 px entre deux cartes sur les 13 pages | écarts mesurés |
| 9 | Profil : téléverser un PNG de 1,5 Mo, recadrer, enregistrer → l'avatar change dans la barre latérale, un commentaire, Équipe et les mentions ; un PDF → message ; 3 Mo → message ; Retirer → initiale | captures |
| 10 | L'image envoyée fait 256 × 256 px en WebP, sans EXIF | faux stockage |
| 11 | Plus aucun « Bientôt » avec un point dans l'app | `boutons-natifs` ou e2e : aucun `.fd-status` qui contient « Bientôt » |
| 12 | axe sans violation grave ; `boutons-natifs.e2e.cjs` passe sur l'éditeur avec le panneau déplié | |
