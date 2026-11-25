# L60 — Capture de bout en bout : l'extension

Décision du client du 25/11 : la capture est la priorité absolue. Planche : `docs/ux/propositions/l60/planche-l60-capture.png` (avant/après, clair et sombre).

**Principe** : le moins de clics possible.
- Aujourd'hui, il faut 4 à 6 décisions avant de démarrer : titre, type, espace, démo, puis Démarrer.
- Demain, il en faut **2** : ouvrir l'extension, puis choisir le mode. Le mode démarre la capture.
- **Entrée** relance le dernier mode utilisé (ouvrir, puis Entrée).

## 1. Popup : « Que voulez-vous capturer ? »

- **Titre** : 16 px, demi-gras. Dessous, la page reconnue : « Sur ExampleCRM · app.example.com » (icône Globe, 13 px gris). Elle confirme que la bonne page est visée.
- **4 modes**, une ligne par mode. Chaque ligne fait 64 px au moins, rayon 12, et les lignes sont espacées de 8 px. Une ligne contient :
  - une tuile d'icône de 40 px ;
  - le nom du mode, en 14 px demi-gras ;
  - une phrase de 13 px, en gris, sur une seule ligne ;
  - un chevron à droite.

| Mode | Icône | Phrase |
|---|---|---|
| Captures d'écran | MousePointerClick | Une image à chaque clic |
| HTML | Code | La page rejouée, nette partout |
| Vidéo | Video | L'onglet filmé, avec votre voix |
| Sandbox | Box | Des pages libres à explorer |

- **Un clic sur une ligne démarre** la capture dans ce mode. Il n'y a plus de bouton « Démarrer ».
- **Dernier mode mémorisé** (par personne et par navigateur) :
  - sa ligne est encadrée en couleur de marque (bordure et contour intérieur de 1 px), sa tuile est teintée ;
  - à la place du chevron, elle porte la touche **Entrée** ;
  - il a le focus à l'ouverture du popup, donc Entrée le lance.
- **Destination** : une ligne de 44 px sous les modes : « Dans **Acme** · Nouvelle démo », avec un bouton **Changer**.
  - Changer ouvre l'espace et la démo, avec la liste « Ajouter à une démo existante ».
  - Par défaut : le dernier espace utilisé, et une nouvelle démo.
- **Titre de la démo** : le champ disparaît du popup. La démo prend le titre de l'onglet (« ExampleCRM ») et se renomme dans l'éditeur, en un clic sur le titre.
- **Aide** sous la destination : « Un clic démarre la capture. Le mode encadré est votre dernier choix : Entrée le relance. »
- **Pied** : à gauche, **Réglages** (icône Sliders) ; à droite, « Données vérifiées » (comme aujourd'hui). Il a 12 px au-dessus et 16 px en bas.
- **Hauteur** : le popup s'arrête à la hauteur du contenu, sans hauteur fixe ni minimale, 600 px au plus.
- **Réglages** : une vue du popup avec un bouton Retour. Tous les réglages sont mémorisés.
  - **Taille de l'onglet** : Actuelle, 1440 ou Mobile. « Format mobile » cesse d'être un type de capture et devient ce réglage.
  - **Suivre les nouveaux onglets** (Captures et HTML).
  - **Micro** (Vidéo).
  - **Flouter en direct** (Vidéo).
- **Page impossible à capturer** (page du navigateur, boutique d'extensions) : les 4 lignes sont désactivées (`aria-disabled`) et une alerte est affichée, comme aujourd'hui. Les lignes ne disparaissent jamais.
- **HTML et Sandbox interdits** par la règle de l'espace (L49) : la ligne reste visible, grisée. Sa phrase est remplacée par la raison (« Désactivé par l'espace »).
- **Avertissement HTML** (« Capturez uniquement des logiciels que vous êtes autorisé à reproduire… ») : il s'affiche **une seule fois**, dans le popup, au premier choix de HTML ou de Sandbox, avec une case « Compris ». Il ne recouvre plus la page.
- **Accessibilité** : les modes forment une liste de boutons. Le nom accessible de chaque bouton est « Démarrer : {mode}, {phrase} ». Les flèches haut et bas passent d'un mode à l'autre.

## 2. Barre de capture dans la page (les 4 modes)

**Une seule barre**, avec la même forme partout :
- une capsule de 48 px, en bas au centre, à 20 px du bord ;
- un fond sombre fixe (#16181d) pour rester lisible sur tous les sites, et une ombre de menu ;
- des contrôles de 36 px, ronds, centrés sur la même ligne ;
- elle se déplace en la glissant (comme aujourd'hui) et ne cache jamais le contenu en permanence.

**De gauche à droite** :
1. **État** : un point rouge (enregistrement) ou orange (pause), le nom du mode, puis un compteur en pastille (« 3 étapes », « 2 pages », « 00:42 »).
2. **Partie propre au mode** :
   - **Captures d'écran** : le segmenté Page / Élément / Zone (EXT-02 §5).
   - **HTML** : « Chaque clic devient une étape », puis le bouton **Ajouter cette page**.
   - **Sandbox** : « Chaque page visitée est ajoutée ». Rien à faire de plus.
   - **Vidéo** : « {n} clics repérés » (ils deviendront les pauses de la vidéo), puis le bouton **Micro** (`aria-pressed`).
3. Un filet, puis **Pause** (bouton icône).
4. **Terminer** : bouton blanc avec l'icône Check.

**Retour à chaque capture** (Captures d'écran, HTML) :
- une carte sombre apparaît 8 px au-dessus de la barre pendant 2 s ;
- elle montre la miniature de la capture (72 × 45), « Étape 3 capturée », le libellé du clic (« Cliquez sur “+ Nouvelle opportunité” ») et le bouton **Annuler** (retire cette étape) ;
- un anneau rouge marque le point cliqué pendant 400 ms (rien en mouvement réduit) ;
- la carte est annoncée en `role="status"`, poliment.

**Pause** :
- le point devient orange et le texte dit « En pause » et « Vos clics ne sont pas capturés » ;
- **Reprendre** remplace Pause ;
- raccourci : Alt + Maj + P.

**Vidéo** :
- avant l'enregistrement, un compte à rebours de **3 s** en plein écran, avec un fond assombri à 55 % ;
- le texte dit : « L'enregistrement commence. Échap pour annuler » ;
- en mouvement réduit, le chiffre change sans animation.

## 3. Terminer et arrivée dans l'app

1. **Terminer** : la barre devient un panneau d'envoi.
   - Il affiche « Envoi des étapes… 5 / 8 » et une barre de progression.
   - L'aide dit : « La démo s'ouvre dans TutoClick dès que c'est prêt. Vous pouvez fermer cet onglet. »
2. **Vérification des données** (F1) : **seulement s'il y a des détections**. Sans détection, on passe directement à l'étape 3, sans écran de plus.
3. **Ouverture de l'app** : la démo s'ouvre dans l'éditeur (onglet TutoClick déjà ouvert, sinon un nouvel onglet), sur l'étape 1.
   - Un toast dit « Démo prête : {n} étapes capturées », avec l'action **Aperçu**.
   - Les nouvelles étapes portent l'étiquette verte **Nouvelle** jusqu'à la première modification.
4. **En direct** : si la démo est déjà ouverte dans l'éditeur (cas « Capturer de nouvelles étapes », L45), les étapes arrivent pendant la capture.
   - En tête de la liste d'étapes, un bandeau dit : « En direct depuis l'extension · 3 étapes reçues · Captures d'écran ».
   - L'étape suivante s'affiche en ligne pointillée « Étape 4 · réception… ».
   - À la fin, le bandeau laisse la place au toast « Démo prête ».
5. **HTML et Vidéo** : un traitement suit l'envoi (pages à préparer, vidéo à encoder). Les étapes s'affichent tout de suite avec l'état « Préparation… {n} % » sur la miniature, et l'éditeur reste utilisable.

## 4. Recette (exigence du client)

À chaque livraison sur la capture, la recette UX est **réelle** :
- l'extension est construite et chargée dans Chromium ;
- des parcours sont capturés sur le banc de sites d'essai, dans les 4 modes ;
- le résultat est ouvert dans l'app et jugé : est-il fidèle ? se parcourt-il ? est-il clair ? manque-t-il quelque chose ?
- le rapport contient des captures, un VERT ou un ROUGE, et la liste des améliorations.

Aucun VERT sur la seule lecture du code ou des tests.

**Limite connue** : la Vidéo ne s'enregistre pas dans un Chromium sans écran (« Flux de l'onglet indisponible »). Il faut soit un faux flux d'onglet dans le banc, soit une vérification par l'utilisateur sur sa machine. La recette le dira à chaque fois.

## 5. e2e à prévoir (dev)

- Popup : 4 modes visibles. Un clic démarre dans le bon mode. Le dernier mode a le focus, et Entrée le relance.
- Aucune page n'est jamais vide : page interdite, mode désactivé par l'espace.
- Barre : mêmes hauteurs et même centre pour tous les contrôles, dans les 4 modes. Pause, puis un clic : pas d'étape.
- La carte « Étape n capturée » apparaît, et son Annuler retire l'étape.
- Terminer sans détection ouvre l'éditeur sans passer par la vérification.
- Toast « Démo prête », étiquettes « Nouvelle ».
- En direct : les étapes apparaissent dans l'éditeur ouvert avant Terminer.
