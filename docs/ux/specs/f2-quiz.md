# Spec F2 : quiz de validation

> Le quiz se place à la fin d'un module. Il vérifie que l'apprenant a compris : questions, score, seuil de réussite et résultat. C'est un service public, donc **utilisable entièrement au clavier et au lecteur d'écran** (RGAA / WCAG 2.1 AA).
>
> Maquette : `docs/ux/maquettes/refonte/f2-quiz.html`, avec `?view=build|q|ok|ko|pass|fail` et `&theme=dark`.
> Microcopie FR/EN (75 clés) : `editor.quiz.*` et `player.quiz.*`.

## 1. Modèle

- Un module peut avoir **un quiz**, placé après sa dernière étape. Il a un nombre illimité de questions (10 conseillées : une aide l'indique à partir de 11).
- **Question** :
  - type : `single`, `multiple` ou `truefalse` ;
  - énoncé (200 caractères au maximum) ;
  - réponses (2 à 6 ; Vrai / Faux fixe), chacune marquée bonne ou mauvaise ;
  - explication, facultative mais conseillée ;
  - **étape liée** à revoir en cas d'erreur, facultative ;
  - points (1 par défaut).
- **Réglages du quiz** :
  - seuil de réussite (0 à 100 %, par pas de 5, 70 % par défaut) ;
  - tentatives (1, 2, 3 par défaut, 5 ou illimitées) ;
  - correction : après chaque question (par défaut) ou à la fin ;
  - mélanger les questions et les réponses (oui par défaut) ;
  - quiz obligatoire pour terminer le module (oui par défaut).
- **Score** = points obtenus / points totaux, arrondi à l'entier.
  - Choix multiples : tout ou rien. La question est juste si toutes les bonnes réponses sont cochées et aucune mauvaise.
  - Le détail « Réponse incomplète » (`partialTitle`) s'affiche si au moins une bonne réponse a été cochée sans faute.
- Chaque tentative est enregistrée : apprenant, réponses, score, réussite, date. Ces données alimentent F3. La meilleure tentative fait foi pour la validation.

## 2. Éditeur (onglet « Quiz » du module)

3 colonnes ; sous 1 100 px, une seule.

- **Gauche : liste des questions.**
  - Pastille de numéro noire, énoncé, puis en `caption` le type et « lié à l'étape n ».
  - La question courante a une bordure prune de 2 px.
  - Réordonnables au glisser-déposer et au clavier (Alt + flèches).
  - « Ajouter une question ».
- **Centre : question.**
  - Titre « Question n » avec un segmenté de type en pilules. Passer de Choix multiples à Choix unique garde la première bonne réponse ; un toast le signale.
  - Énoncé.
  - Réponses : une ligne `surface-sunken` avec poignée, champ, sélecteur « Bonne réponse » (radio pour un choix unique, case pour plusieurs) et corbeille. La bonne réponse a un contour **vert de 2 px** et l'icône `CircleCheck`. On ne s'appuie jamais sur la couleur seule.
  - Explication, « Étape à revoir en cas d'erreur » (select des étapes du module) et points.
- **Droite : « Validation du module ».**
  - Curseur du seuil, avec la valeur en texte et `aria-valuetext`.
  - Tentatives, correction (segmenté), deux interrupteurs, une aide sur la position.
  - « Tester le quiz » ouvre l'aperçu du player. Les tentatives de test ne sont pas comptées.
- **Validation** : `errEmpty`, `errTwoAnswers` et `errNoCorrect` s'affichent sous le champ (`aria-describedby`). Une question invalide affiche un point framboise dans la liste. La publication est bloquée tant qu'il reste une erreur, avec un message qui donne le numéro de la question.

## 3. Player : question

- Carte de 640 px au maximum, rayon 24 px, sur `--fd-player-backdrop`. Toujours **aux couleurs du thème de la démo**, en clair (`.fd-player-scope`).
- **En-tête** : « Question n sur N » ; barre de progression (`role="progressbar"` avec `aria-valuenow` = questions répondues) ; « Seuil : 70 % ».
- **Corps** :
  - un vrai `fieldset` avec `legend` = énoncé (22 px, 800) ;
  - l'aide sous l'énoncé (`hintSingle` / `hintMultiple` / `hintTrueFalse`) ;
  - réponses en **vrais `input` radio ou case à cocher dans un `label`**. Les options font 52 px de haut au minimum et toute la ligne est cliquable ;
  - sélection : bordure prune de 2 px et fond prune pâle ; focus : anneau bleu (`:has(:focus-visible)`) ;
  - Vrai / Faux : 2 options côte à côte (empilées sous 480 px).
- **Actions** :
  - « Précédente » (fantôme, `aria-label` « Question précédente » ; masqué à la question 1 et si la correction est immédiate et déjà vue) ;
  - « Valider ma réponse » (primaire, pleine largeur sous 480 px).

  Sans réponse : le bouton reste actif. Au clic, on affiche `selectFirst` en `role="alert"` et on remet le focus sur la première option. Pas de bouton désactivé muet.
- Clavier : Tab entre le groupe et les boutons, flèches dans un groupe radio, Espace pour une case, Entrée pour valider.

## 4. Player : correction (si « après chaque question »)

- Les options deviennent `disabled` (et `aria-disabled` sur le `label`).
- **Marquage par texte et icône, pas seulement par la couleur** :
  - bonne réponse : contour vert, `CircleCheck` + « Bonne réponse » ;
  - réponse choisie fausse : contour framboise, `CircleX` + « Votre réponse » ;
  - bonne réponse non cochée (choix multiples) : `markMissed`.
- **Encadré d'explication** (`role="status"`, annoncé) : titre `correctTitle` / `incorrectTitle` / `partialTitle`, puis l'explication saisie.
- Après une erreur, si une étape est liée : bouton « Revoir l'étape n du module ». Il ouvre le player sur l'étape, avec un bouton « Revenir au quiz » qui reprend à la même question.
- « Question suivante », ou « Voir mon résultat » à la dernière question. Le focus va au titre de l'encadré après la validation, puis au bouton suivant.
- Contrastes vérifiés : texte vert `#2F6A06` sur `#EEF7E2` et framboise `#B0083F` sur `#FDECF2` ≥ 4,5:1.

## 5. Player : résultat

- **Anneau de score** de 160 px, décoratif (`aria-hidden`) :
  - arc prune si le module est validé, ardoise sinon ;
  - un **trait noir marque le seuil** ;
  - au centre, « 80 % » (40 px, 800) et « seuil 70 % ».
- **Badge** :
  - validé : « Module validé » (`Award`), pilule vert DSI avec texte noir ;
  - non validé : « Pas encore validé » (`RefreshCw`), pilule neutre bordée. Jamais en framboise : un échec n'est pas une faute.
- **Titre `h2`** : `passTitle` ou `failTitle`, ton encourageant. Puis une **phrase de score complète en texte** (`role="status"`) : c'est elle que lit le lecteur d'écran, pas l'anneau.
- **Détail** : une ligne par question, avec icône et texte masqué « Réponse juste » ou « réponse fausse », et un lien « Revoir » vers l'étape liée.
- **Actions** :
  - validé : « Repasser le quiz » (s'il reste des tentatives), « Module suivant : … » (primaire) ou « Terminer » ;
  - non validé : « Revoir le module », « Réessayer le quiz » (primaire). Sans tentative restante : `noAttemptsLeft` à la place du bouton.
- Le focus arrive sur le `h2` à l'affichage du résultat. Pas d'animation de confettis ; l'arc est animé en 600 ms, sauf si `prefers-reduced-motion`.

## 6. Accessibilité : récapitulatif pour la recette

- Tout le quiz est jouable **sans souris** : ordre de tabulation logique, aucun piège, focus toujours visible (anneau bleu de 2 px).
- Lecteur d'écran (NVDA + Firefox, VoiceOver + Safari) :
  - l'énoncé est annoncé comme nom du groupe ;
  - le type de question est annoncé par l'aide ;
  - la correction est annoncée sans déplacer le focus de manière inattendue ;
  - le score est lu en phrase complète.
- Pas d'information portée par la couleur seule. Cibles de 44 px au minimum en tactile. Zoom à 200 % sans perte de contenu (carte fluide).
- Pas de limite de temps. Si un minuteur est ajouté plus tard, il devra pouvoir être désactivé (critère 2.2.1).

## 7. Recette prévue

Pour chaque écran : 1 440, 1 024 et 390 px, en clair et en sombre (l'interface en sombre, le player reste au thème de la démo). Parcours complet au clavier seul et au lecteur d'écran. Calcul du score : choix unique, choix multiples avec réponse partielle, Vrai / Faux. Seuil atteint à la valeur exacte (70 % pour un seuil de 70 % = validé). Décompte des tentatives. Les tentatives de « Tester le quiz » ne sont pas comptées.
