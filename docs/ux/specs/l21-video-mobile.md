# L21 : vidéo et mobile (F7)

> **Maquettes** :
> - `refonte/f7-capture.html?view=popup` : popup de l'extension, type de capture et format mobile ;
> - `refonte/f7-capture.html?view=rec` : barre d'enregistrement ;
> - `reference/editeur-video.html` : étape vidéo dans l'éditeur (structure de référence) ;
> - `reference/player-video.html` (`?etat=video|mobile|mobile-haut`) : lecteur.
>
> **Base** : `specs/f7-capture.md`, qui reste la référence détaillée. Cette spec fixe le découpage en états, les arbitrages et ce qui reste en « Bientôt ».
>
> **Données** : fictives (Acme, `.example`).

## 1. États et codes

| Code | État | Maquette | Remplace |
|---|---|---|---|
| L21-01 | Popup de l'extension : type de capture, options vidéo, format mobile | `refonte/f7-capture.html?view=popup` | F7-01 |
| L21-02 | Barre d'enregistrement dans l'onglet | `refonte/f7-capture.html?view=rec` | F7-02 |
| L21-03 | Éditeur : étape vidéo (montage, pauses-étapes, sous-titres) | `reference/editeur-video.html` | F7-03 |
| L21-04 | Lecteur : vidéo, pause-étape, sous-titres | `reference/player-video.html?etat=video` | F7-03 |
| L21-05 | Lecteur : démo mobile dans le cadre d'un téléphone | `reference/player-video.html?etat=mobile` | F7-04 |
| L21-06 | Lecteur mobile : hotspot en bas, feuille en haut | `reference/player-video.html?etat=mobile-haut` | F7-04 |

## 2. Arbitrages

- **Transcription automatique** : « Bientôt » (vague B). Il n'y a aucun envoi audio à un service tiers. Les sous-titres sont saisis ou importés (`.vtt`).
- **Voix off de synthèse** : hors périmètre. Seule la voix enregistrée au micro est possible.
- **Webcam** : conservée (option de la popup), désactivée par défaut. L'image de la webcam passe par la vérification des données (F1 §1) comme le reste de la vidéo.
- **Vérification des données avant l'envoi** : toujours active, jamais désactivable. L'interrupteur est affiché coché et désactivé, avec un libellé explicite.
- **Durée** : 10 minutes au plus par enregistrement. Seul l'onglet est enregistré (`chrome.tabCapture`), jamais l'écran entier.
- **Stockage** : WebM (VP9 et Opus) dans Supabase Storage. L'export MP4 et GIF passe par L15. **Le PDF d'une étape vidéo** reprend une image par pause-étape.

## 3. Extension (L21-01, L21-02)

Tout est conforme à F7 §1 et §2. Points à vérifier sur les captures :
- **Type de capture** : trois cartes radio dans un `fieldset` avec `legend` (« Type de capture »). La carte choisie a une bordure de la couleur principale et un fond pâle. Le focus reste visible sur la carte.
- **Options** : affichées seulement pour la vidéo.
- **Bouton** : « Démarrer l'enregistrement » pour la vidéo, « Démarrer la capture » pour les autres types.
- **Format mobile** :
  - appareil (Téléphone 390 × 844 par défaut, Grand téléphone, Tablette, Taille personnalisée) et orientation ;
  - aide : « L'onglet est redimensionné et passe en mode tactile le temps de la capture. Le site doit être responsive. » ;
  - la démo est marquée `device: mobile`.
- **Barre d'enregistrement** :
  - pilule noire déplaçable, avec un chronomètre `role="timer"` et la durée maximale ;
  - boutons Pause / Reprendre, Marquer une étape, Terminer ;
  - raccourcis Alt + Maj + P, M et S, rappelés au survol ;
  - à 9 minutes : toast « Plus qu'une minute » ;
  - à 10 minutes : arrêt automatique, puis vérification des données.
- **Refus du micro** : alerte « Le micro n'est pas autorisé : l'enregistrement continue sans son. » L'enregistrement n'est pas bloqué.

## 4. Étape vidéo dans l'éditeur (L21-03)

- **Rail** : icône `play` et titre de l'étape.
- **Canevas** :
  - image de la vidéo au temps courant ;
  - la pause-étape sélectionnée est signalée par une étiquette noire (« Pause-étape 2 · 00:42 ») et sa bulle ;
  - le sous-titre courant s'affiche en bas : fond noir à 82 % et texte blanc de 15 px semi-gras (contraste ≥ 7:1).
- **Barre d'outils flottante** (hotspot, flou, zoom) : masquée sur une étape vidéo. Le floutage de la vidéo se fait à la vérification de l'extension.
- **Montage** (sous le canevas, dans une carte) :
  - barre : « Lire », temps (« 00:42 / 02:14 · après coupe 01:38 »), « Couper ici » (C), « Ajouter une pause-étape » (P) ;
  - **piste vidéo** : segments titrés en couleur principale pâle, coupes en **hachures** (le motif suffit à les distinguer, sans dépendre de la couleur), pastilles noires numérotées pour les pauses (la pause sélectionnée a un contour), tête de lecture #D60B52 ;
  - **piste des sous-titres** : un bloc par sous-titre, redimensionnable ;
  - **échelle de temps** ;
  - **clavier** : flèches ±1 s, Maj + flèches ±5 s, C pour couper, P pour ajouter une pause, Suppr pour retirer la pause sélectionnée ;
  - chaque piste a un `role="img"` avec une synthèse. Une liste équivalente des pauses et des sous-titres est accessible dans le panneau (« Modifier (n) »).
- **Panneau « Étape »** :
  - **Pause-étape n · temps** : texte de la bulle, puis « Précédente » et « Suivante », et un bouton de suppression nommé ;
  - **Sous-titres** : « Modifier (n) » (liste éditable avec début, fin et texte), « Importer .vtt », « Transcription automatique · Bientôt », « Afficher les sous-titres par défaut » (activé si une piste voix existe) ;
  - **Lecture** : « Lecture automatique, sans son au départ », et « Voix enregistrée : Oui · durée » en lecture seule ;
  - **Convertir** : « Créer n étapes captures ». Une capture est créée par pause-étape, avec le texte de sa bulle, juste après l'étape vidéo. La vidéo reste en place.

## 5. Lecteur (L21-04 à 06)

- **Vidéo (L21-04)** :
  - contrôles natifs habillés : Lire / Pause, temps, barre de position (`role="slider"`, avec `aria-valuetext` en minutes et secondes), sous-titres (bouton `aria-pressed`, CC), plein écran ;
  - les pauses-étapes sont marquées sur la barre de position en vert DSI ;
  - à une pause, la vidéo s'arrête et la bulle s'affiche (« Pause n sur N », texte, « Continuer »). Le focus va sur la bulle ;
  - la lecture démarre **sans son**, avec un bouton « Activer le son » en haut à droite ;
  - les sous-titres sont activés par défaut s'il y a une piste voix.
- **Démo mobile (L21-05)** :
  - sur grand écran, elle s'affiche dans le cadre d'un téléphone : 9:19.5, rayon de 44 px, encoche décorative. Sur un vrai téléphone, elle passe en plein écran, sans cadre ;
  - la bulle devient une **feuille du bas** avec un bouton de 44 px de haut ;
  - le hotspot tactile mesure au moins 44 px, avec un anneau #D60B52 **opaque** de 3 px, visible en permanence (liseré blanc possible ; une pulsation n'anime qu'un halo à l'extérieur) ;
  - **cible plus large que 44 px** (bouton, champ) : l'anneau entoure la cible entière, en rectangle arrondi au rayon de la cible + 4 px. L'intérieur reste transparent et ni l'anneau ni le halo ne passent sur le libellé. Cette règle vaut aussi sur ordinateur ;
  - la microcopie dit « Touchez » au lieu de « Cliquez » pour une démo `device: mobile`.
- **Hotspot bas (L21-06)** : si le hotspot est dans le tiers bas de l'écran, la feuille passe **en haut**. Elle ne cache jamais le hotspot.

## 6. Accessibilité

- Vidéo : sous-titres pour toute piste voix, sinon une mention « Pas de son ». Les contrôles se pilotent au clavier (Espace, flèches, C pour les sous-titres) et chacun a un nom.
- Barre d'enregistrement : boutons nommés, chronomètre `role="timer"`, point qui pulse immobile si les animations sont réduites.
- Montage : pistes résumées et liste équivalente. Le motif des coupes ne dépend pas de la couleur.

## 7. Hors périmètre

- Capture sur plusieurs onglets.
- Animations de saisie et de défilement simulées.
- Voix off de synthèse et transcription automatique (« Bientôt »).
- Recadrage de la vidéo, ou résolution personnalisée au-delà des tailles prédéfinies.
