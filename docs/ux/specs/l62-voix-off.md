# L62 — Voix off : panneau, lecteur audio et contrôles du visiteur

Retour de l'utilisateur du 25/11 (tests réels), avec une référence décrite en texte. On reprend la structure de la référence, pas sa marque. Planche : `docs/ux/propositions/l62/planche-l62.png`. Elle montre le panneau actuel et le panneau proposé, la liste des voix, le lecteur dans l'éditeur, et le lecteur côté visiteur à 1440 et 390, en clair et en sombre.

## 1. Panneau « Voix off » (outil du rail de l'éditeur)

En haut, un segmenté **Générer · Enregistrer · Importer**. Le conteneur fait 40 px, rayon 10 ; les options font 32 px, rayon 8 (RADIUS-01). Sous le segmenté, de haut en bas, 16 px entre les blocs :

1. **Texte lu** :
   - une zone de texte de 3 lignes au moins ;
   - les variables s'affichent en pastille (« Entreprise ») ;
   - aide en dessous : « {n} caractères · environ {s} s · sert aussi de sous-titres ».
2. **Langue** :
   - une liste de 40 px, avec à gauche un **drapeau** de 20 × 14 px (rayon 3, filet) et le nom de la langue ;
   - par défaut, la langue de la démo ;
   - les drapeaux sont dessinés en SVG ou en CSS, jamais en emoji.
3. **Voix** :
   - une liste de 40 px, avec à gauche un **avatar** de 24 px : un rond teinté portant l'initiale de la voix, dans la palette BADGE-01. Pas de photo de vraie personne ;
   - à côté, le nom (« Antoine ») et un descripteur gris (« grave, calme ») ;
   - dans la liste ouverte, chaque voix a son avatar, son nom, son descripteur sur une 2e ligne, et un mini-bouton ▶ (28 px, rayon 8) pour un échantillon fixe, qui ne consomme pas de quota ;
   - les voix proposées dépendent de la langue choisie.
4. **Aperçu** :
   - à gauche, un bouton carré de 40 px (▶ / ❚❚, rayon 10), **de la même hauteur que les champs**. C'est la correction du ▶ plus haut que la liste ;
   - à droite, une piste de 40 px sur `surface-sunken` : une **onde** dont la partie déjà lue prend la couleur de marque, puis le temps « 0:02 / 0:05 » en chiffres tabulaires ;
   - l'aperçu lit **le texte saisi** avec la voix choisie, sans rien enregistrer. Il compte dans le quota, ce que dit l'aide : « Lit le texte saisi avec la voix choisie, sans enregistrer. Compte dans le quota du mois. » ;
   - il est relancé après chaque modification du texte, de la langue ou de la voix ;
   - pendant la préparation : onde grise animée en battement d'opacité (MOTION-01).
5. **Générer la voix** : bouton primaire pleine largeur, 40 px. L'avertissement sur l'envoi au service de synthèse vocale reste sous le bouton, en aide.
6. **Pour toute la démo**, dans un encadré de lignes (rayon 12, filets) :
   - **Lecture automatique** (interrupteur). Sous la ligne, l'avertissement en couleur d'attention, avec l'icône Info : « Sur la 1re étape, le son démarre au premier clic du visiteur : les navigateurs bloquent le son avant. »
   - **Sous-titres** (interrupteur).
   - **Position du lecteur** : un segmenté de 5 options icône seule (36 × 32 px) : haut gauche, haut droite, bas gauche, bas droite, **Libre**.
     - Chaque option a un nom accessible : « En haut à gauche »…, « Libre ».
     - L'aide dit le choix courant : « Bas à droite. » Avec « Libre », elle dit : « Faites glisser le lecteur dans l'aperçu. »

**Enregistrer et Importer** : mêmes blocs Aperçu (onde de l'enregistrement) et « Pour toute la démo ». Les boutons d'action ont tous 40 px.

## 2. Lecteur audio dans l'éditeur

- Le lecteur (« bulle audio ») est **visible dans l'aperçu de l'étape**, à la position choisie, à 16 px des bords du cadre :
  - 44 px de haut, rayon 12, surface, ombre de menu ;
  - de gauche à droite : poignée de déplacement (Grip), bouton ▶ (32 px, rayon 8, couleur de marque), onde, durée, bouton « Couper le son ».
- **Placement** :
  - quand l'outil Voix off est ouvert, un contour pointillé de marque entoure le lecteur, avec la mention « Lecteur audio · glissez pour le placer » ;
  - le glisser passe la position en « Libre » et enregistre `x`/`y` en pourcentage du cadre. Le lecteur reste toujours entier dans le cadre ;
  - au clavier : focus sur la poignée, puis flèches (1 % ; Maj : 5 %), et Échap annule le déplacement en cours ;
  - un double-clic sur la poignée remet le lecteur au coin le plus proche.
- La position vaut pour toute la démo. Il n'y a pas de position par étape en v1.

## 3. Côté visiteur (lecteur public)

- Le lecteur audio a la même forme, sans poignée.
  - **Pause / Lecture** (32 px, couleur de marque du thème client, `--p-btn-radius`).
  - Onde et temps.
  - **Couper le son / Rétablir le son** (`aria-pressed`). Ce choix est mémorisé pour toute la visite.
- Sous-titres activés : bandeau centré en bas du cadre, au-dessus du lecteur, fond noir à 78 %, texte blanc de 15 px (13 px à 390), deux lignes au plus.
- Raccourcis : **K** met en pause ou relance la voix, **M** coupe ou rétablit le son. Ils sont annoncés dans l'aide du lecteur.
- À 390 : lecteur et bandeau au-dessus de la feuille du guide. Le lecteur prend 220 px au plus, sans l'onde si la place manque (le temps reste).
- Mouvement réduit : pas d'animation de l'onde. La progression se lit au temps et à la couleur de la partie lue.

## 4. Contrôles de même hauteur

Tous les contrôles du panneau font 40 px : listes, bouton d'aperçu, bouton principal et segmentés (conteneur). Les mini-boutons de la liste des voix font 28 px. Les rayons suivent RADIUS-01. Le test e2e vérifie que le bouton ▶ et la liste « Voix » ont la même hauteur et le même rayon.

## 5. e2e

- Panneau : avatars des voix (pas d'`<img>` de personne) et drapeau sans emoji.
- Aperçu : un nouvel aperçu à chaque changement de texte ou de voix.
- Position : 4 coins et Libre (glisser à la souris et au clavier).
- Lecture auto : l'avertissement est affiché ; les sous-titres s'allument et s'éteignent.
- Visiteur : Pause, Couper le son et les raccourcis K et M.
- Le tout en clair et sombre, à 1440 et 390.
