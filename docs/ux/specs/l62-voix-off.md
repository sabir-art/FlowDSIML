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

## 6. Passer d'une source à l'autre sans rien perdre (retour du client du 25/11)

Planche : `docs/ux/propositions/l62/planche-l62-source.png` (avant/après, à 1440, clair et sombre).

Aujourd'hui, une fois une voix enregistrée, il faut la supprimer pour retrouver « Générer ». Ce n'est plus le cas :

- **Source toujours visible** : en haut du panneau, « Source de la voix » est un segmenté de 40 px avec **Générée · Enregistrée · Fichier**. La source de la voix en place porte un point vert (« Voix en place »). Changer d'onglet ne supprime jamais rien.
- **Voix en place** :
  - c'est une carte (rayon 12) qui contient : une icône de la source, « Voix en place », une ligne grise « Enregistrée · 0:12 » (ou « Générée · Antoine · 0:11 »), le lecteur de 40 px et un menu ⋯ (Télécharger, Supprimer la voix) ;
  - dans un autre onglet, elle se réduit à une ligne de 44 px (Lecture, nom, durée) et reste au-dessus de l'outil.
- **Nouvelle voix** :
  - toute nouvelle voix, qu'elle soit générée, réenregistrée ou importée, arrive dans une carte à bordure de marque. Elle porte l'étiquette « À écouter » et son lecteur ;
  - deux actions : **Utiliser cette voix** (primaire) et **Garder l'actuelle** (fantôme) ;
  - la voix en place n'est remplacée qu'à « Utiliser cette voix ». Le toast « Voix remplacée par la voix générée » porte alors **Annuler**, qui remet l'ancienne voix.
- **Transcription → voix en un clic** : sous la transcription d'une voix enregistrée ou importée, le bouton secondaire de 40 px **Générer la voix depuis ce texte** (icône Sparkles).
  - Son aide dit : « Avec {voix} ({langue}). Votre enregistrement reste en place jusqu'à ce que vous choisissiez la nouvelle voix. »
  - Un seul clic lance la génération avec la voix par défaut de la langue, puis affiche la carte « Nouvelle voix ».
  - Une fois une voix générée en place, le bouton devient **Régénérer depuis ce texte**, avec l'aide « À faire après une modification de la transcription ».
- Dans l'onglet Générée, le texte lu est **repris de la transcription** (c'est indiqué à droite du libellé), et l'aide rappelle : « La voix en place n'est pas touchée tant que vous n'avez pas choisi. »
- Le « Remplacer… » de la carte disparaît : le segmenté le remplace.

## 7. Lecteur audio côté visiteur : Bulle, Orbe, Barre

Planche : `docs/ux/propositions/l62/planche-l62-orbe.png`.

Animation : `docs/ux/propositions/l62/orbe/orbe-animation.gif` (et `.webm`). Démo vivante : `orbe/orbe-demo.html`. Code de référence : `orbe/orbe.js`, un canvas 2D sans dépendance d'environ 85 lignes.

- **Réglage « Lecteur audio »** : dans le panneau, sous « Pour toute la démo », il remplace la liste.
  - Ce sont 3 cartes radio (`role="radiogroup"`), Bulle, Orbe et Barre. Chacune a un mini-aperçu de 44 px qui bouge au survol (rien en mouvement réduit), son nom et une aide d'une ligne : « Avec l'onde », « Voix visible », « Durée, avance ».
  - Avec Orbe, une ligne **Couleurs de l'orbe** s'ajoute : Thème de la démo ou Neutre.
- **Bulle** et **Barre** : on garde l'existant. La Barre est pleine largeur du cadre, à 16 px des bords, avec Lecture, temps, avance, sous-titres et muet.
- **Orbe** :
  - **Taille** : 72 px à 1440, 56 px sous 600 px. Sa place : en bas à droite du cadre, à 16 px des bords. Il se déplace comme la bulle (poignée invisible : on glisse l'orbe) et reste au-dessus du contenu (z-index du lecteur).
  - **Dessin** :
    - une sphère dans un dégradé de la couleur principale vers la couleur secondaire du thème ;
    - trois volutes claires en mode « screen », qui tournent à l'intérieur ;
    - un filet clair qui s'enroule, un reflet de verre et un liseré blanc ;
    - un halo dont la taille et l'opacité suivent le volume.
  - **Volume réel** :
    - un `AnalyserNode` est branché sur l'élément audio, avec un RMS sur `getByteTimeDomainData` ;
    - le lissage a une attaque rapide (0,5) et une relâche lente (0,12) (`TutoOrb.levelFrom`) ;
    - le volume règle la vitesse et la taille des volutes, ainsi que le halo.
  - **États** :
    - *parle* : il s'anime ;
    - *au repos* (voix lancée mais silencieuse, ou en attente du premier clic) : il respire, avec un battement de ±2,5 % ;
    - *en pause* : il est figé, et ses couleurs sont grisées à 85 % ;
    - *muet* : il s'anime, et une icône Volume barré est posée en bas à droite.
  - **Interactions** :
    - un clic met en pause ou relance ;
    - le **survol** ou le **focus** ouvre une pastille de 36 px à gauche de l'orbe : temps « 0:02 / 0:05 », Muet, Sous-titres ;
    - une infobulle dit « Cliquez pour mettre en pause · K » ;
    - les raccourcis K et M restent ceux du §3.
  - **Accessibilité** :
    - l'orbe est un `role="button"` qui prend le focus. Son nom dépend de l'état : « La voix off parle — mettre en pause », ou « Voix off en pause — reprendre la lecture » ;
    - il a un `aria-pressed` ;
    - la couleur n'est jamais seule à porter l'état : en pause, une icône Pause apparaît au centre (12 px, blanche à 90 %).
  - **Mouvement réduit** : pas de volutes ni de respiration. Un simple anneau autour de la sphère pulse selon le volume ; il est fixe en pause.
  - **Performances** :
    - un seul canvas, dessiné à `devicePixelRatio` ;
    - la boucle `requestAnimationFrame` ne tourne que si la voix joue ou si l'orbe respire ; elle s'arrête quand l'onglet est caché ;
    - pas de WebGL ;
    - environ 4 Ko minifié, à charger seulement si le style Orbe est choisi (import dynamique dans le lecteur Preact).
  - **Couleurs** :
    - la couleur principale et la secondaire viennent du thème de la démo (`--p-primary`, `--p-secondary`) ;
    - la variante neutre utilise l'ardoise (#5b6b82 vers #2b3445) ;
    - le contraste ne s'applique pas à l'orbe (élément décoratif doublé d'un nom et d'une icône), mais la pastille de survol suit les règles du lecteur.
- **e2e** :
  - le réglage est enregistré, et le lecteur affiche le bon style ;
  - l'orbe a un nom accessible qui change entre lecture et pause ;
  - au clavier : focus, Entrée, K et M ;
  - en mouvement réduit, aucune volute n'est dessinée (drapeau de test exposé par le composant) ;
  - le canvas cesse d'être redessiné en pause et quand l'onglet est caché.
