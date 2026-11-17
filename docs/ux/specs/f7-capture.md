# Spec F7 : capture vidéo et capture mobile

> Certains gestes ne se montrent pas bien en captures successives : saisie, glisser-déposer, défilement. D'autres outils sont utilisés sur téléphone. F7 ajoute à l'extension la **vidéo de l'onglet** et le **format mobile**, ainsi qu'une **étape vidéo** dans l'éditeur.
>
> Maquette : `docs/ux/maquettes/refonte/f7-capture.html` (`?view=popup|rec|video|mobile`, `&theme=dark`).
> Microcopie FR/EN (56 clés) : `extension.capture.*`, `editor.video.*` et `player.mobile.*`.

## 1. Popup de l'extension

- **En-tête** : wordmark TutoClick (version claire ou sombre selon le thème), nom du workspace à droite. Titre « Nouvelle capture ».
- **Type de capture** : `fieldset` de 3 cartes radio. Chaque carte contient une puce d'icône, un titre et une description, puis le rond radio. La carte choisie a une bordure prune sur fond prune pâle, et le focus est visible.

  | Type | Icône | Description |
  |---|---|---|
  | Captures à chaque clic | `MousePointerClick` | Comportement actuel |
  | Vidéo de l'onglet | `Video` | Geste continu |
  | Format mobile | `Smartphone` | Taille téléphone ou tablette |

- **Options** (bloc `surface-sunken`, seulement pour la vidéo) :
  - « Enregistrer ma voix » (micro) ;
  - « Webcam dans un coin » (pastille ronde de 120 px en bas à droite, déplaçable au montage) ;
  - « Vérifier les données avant l'envoi » : **toujours actif et non désactivable** (F1 §1). L'interrupteur est affiché coché et désactivé, avec un libellé qui le dit.
- Aide : durée maximale (10 minutes) ; seul l'onglet est enregistré (`chrome.tabCapture`), jamais l'écran entier.
- Bouton : « Démarrer l'enregistrement » (vidéo) ou « Démarrer la capture ».
- **Autorisations** : le navigateur demande le micro et la webcam à la première utilisation (`permMic`). En cas de refus, `permDenied` en alerte et l'enregistrement continue sans son.
- **Format mobile** :
  - appareil : Téléphone 390 × 844 (par défaut), Grand téléphone 430 × 932, Tablette 820 × 1180, Taille personnalisée ;
  - orientation : Portrait / Paysage ;
  - bouton « Redimensionner et capturer ».

  L'onglet est émulé à cette taille (Chrome DevTools Protocol, viewport + tactile), puis la capture à chaque clic se fait normalement. La démo est marquée `device: mobile`.

## 2. Enregistrement en cours

- **Barre flottante** dans l'onglet : pilule noire, déplaçable, toujours au-dessus (`z-index` max, en portail dans le shadow DOM de l'extension). Elle contient :
  - point rouge qui pulse (immobile avec `prefers-reduced-motion`) ;
  - chronomètre `role="timer"` et durée maximale ;
  - boutons « Pause » / « Reprendre », « Marquer une étape », « Terminer ».
- **Raccourcis** : Alt + Maj + P, M, S (déclarés dans `commands` du manifest, modifiables dans Chrome). Ils sont rappelés au survol de la barre.
- Les **clics détectés** pendant l'enregistrement sont horodatés et proposés comme **pauses-étapes** au montage. « Marquer une étape » en ajoute une manuellement.
- À 9 minutes : toast `limitSoon`. À 10 minutes : arrêt automatique.
- Après « Terminer » : vérification des données (F1 §1, sur les images clés de la vidéo), puis envoi et ouverture de l'éditeur sur l'étape vidéo.

## 3. Étape vidéo (éditeur)

- **Canevas** : lecteur 16:9, avec les sous-titres en bas (fond noir à 82 % et texte blanc 15 px semi-gras, contraste ≥ 7:1).
- **Montage** sous le canevas :
  - barre d'outils : « Lire », temps (`current / total · après coupe`), « Couper ici », « Ajouter une pause-étape » ;
  - **piste vidéo** : segments prune pâle titrés, **coupes en hachures** (le motif suffit à les distinguer, sans dépendre de la couleur), pastilles noires numérotées pour les pauses-étapes, tête de lecture framboise ;
  - **piste de sous-titres** : un bloc par sous-titre, redimensionnable ;
  - échelle de temps ;
  - au clavier : flèches pour ±1 s (Maj pour ±5 s), C pour couper, P pour ajouter une pause ;
  - chaque piste est un `role="img"` résumé, plus une liste équivalente accessible dans le panneau.
- **Panneau « Vidéo »** :
  - texte de la pause-étape sélectionnée (la vidéo s'arrête et affiche une bulle ; l'apprenant clique pour continuer) ;
  - sous-titres : « Modifier (n) » (liste éditable avec les temps), « Importer .vtt ». La transcription automatique est en **vague B**, affichée avec le badge « Bientôt disponible » et jamais présentée comme active ;
  - « Lecture automatique, sans son au départ » ;
  - **Convertir** : « Transformer les pauses en n étapes captures » (une capture par pause, avec le texte de la bulle). La vidéo reste disponible.
- **Player** :
  - la vidéo se lit avec des contrôles accessibles (lecture, pause, temps, sous-titres activables, plein écran) ;
  - les pauses-étapes affichent la bulle habituelle ;
  - sans son au départ, avec un bouton « Activer le son » ;
  - les sous-titres sont activés par défaut s'il y a une piste voix.
- **Formats** : enregistrement en WebM (VP9 ou Opus), stocké dans Supabase Storage. Export MP4 et GIF via A3.

## 4. Démo mobile (player)

- **Grand écran** : cadre téléphone centré (A2 §1, cadre « Mobile »), en 9:19.5, rayon de 44 px.
- **Vrai téléphone** : plein écran, sans cadre.
- La bulle devient une **feuille du bas**, qui ne doit jamais cacher le hotspot : si le hotspot est dans le tiers bas, la feuille passe en haut.
- **Hotspot tactile** : zone de 44 px au minimum, anneau framboise de 3 px. La microcopie utilise « Touchez » au lieu de « Cliquez » pour une démo `device: mobile` (`player.mobile.tap`).
- Le PDF « mode d'emploi » (F5) d'une démo mobile met 2 captures portrait côte à côte par étape.

## 5. Recette prévue

- **Enregistrement** de 2 minutes avec voix ; pause et reprise ; marquage ; arrêt automatique (à tester avec une limite abaissée en développement) ; refus du micro.
- **Montage** : coupe, ajout de pauses, sous-titres importés en .vtt, conversion en étapes.
- **Mobile** : capture d'un site responsive en 390 × 844 ; lecture sur un vrai téléphone et dans le cadre ; feuille du bas au-dessus du hotspot quand il est bas.
- Contrôles communs : clavier et lecteur d'écran sur le lecteur vidéo et la barre d'enregistrement ; 1 440, 1 024 et 390 px ; clair et sombre.
