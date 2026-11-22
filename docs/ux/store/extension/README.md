# Visuels Chrome Web Store : TutoClick Capture (22/11)

À copier tels quels dans `docs/extension/store`, sous les mêmes noms. Textes cohérents avec `docs/extension/store/fiche.md`.

L'interface montrée est la vraie :
- le popup de l'extension, construite à partir du code ;
- l'écran « Vérifier les données avant l'envoi », avec ses flous réels ;
- la barre de la capture HTML ;
- le badge REC.

Le logiciel capturé, « Acme RH », est fictif. Ses données sont inventées et ses e-mails sont en `@example.com`. Aucune marque tierce n'apparaît.

| Fichier | Taille | Bénéfice | Titre | Sous-titre |
|---|---|---|---|---|
| `capture-1-1280x800.png` | 1280 × 800, RGB | Créer une démo en parcourant son logiciel | Créez une démo en parcourant votre logiciel | Ouvrez votre logiciel web, choisissez le type de capture, puis faites votre parcours comme d’habitude. |
| `capture-2-1280x800.png` | 1280 × 800, RGB | Chaque clic devient une étape avec sa bulle | Chaque clic devient une étape | Avec sa bulle d’explication. Retouchez les textes dans TutoClick, puis publiez : chacun suit la démo à son rythme. |
| `capture-3-1280x800.png` | 1280 × 800, RGB | Données personnelles floutées avant l'envoi | Données personnelles floutées avant l’envoi | Noms, e-mails, téléphones : la détection se fait dans votre navigateur, et vous validez avant tout envoi. |
| `capture-4-1280x800.png` | 1280 × 800, RGB | Trois types de capture | Trois types de capture | Choisissez dans l’extension selon ce que vous voulez montrer. (Captures à chaque clic, Capture HTML, Vidéo de l’onglet) |
| `capture-5-1280x800.png` | 1280 × 800, RGB | Partager par lien, intranet ou SCORM | Partagez par lien, intranet ou SCORM | Publiez la démo dans TutoClick, puis diffusez-la là où vos équipes travaillent. |
| `vignette-440x280.png` | 440 × 280, RGB | Petite vignette | Des démos interactives en un parcours | Extension TutoClick Capture |
| `marquee-1400x560.png` | 1400 × 560, RGB | Grande vignette (facultative) | Créez une démo interactive en parcourant votre logiciel | Chaque clic devient une étape, avec sa bulle d’explication. |
| `icone-128.png` | 128 × 128, RGBA | Icône de la boutique | Symbole LOGO-01 : 96 px de dessin, 16 px de marge transparente, net en 16, 32 et 48 px | |

Le format mobile et la page entière sont « Bientôt » : aucun visuel ne les montre comme disponibles. Le popup de la capture 1 s'arrête au-dessus de la carte « Format mobile ».

## Source de chaque bloc d'interface (mise à jour du 22/11)

| Visuel | Bloc | Source |
|---|---|---|
| capture-1 | popup, badge REC | extension construite |
| capture-1 | logiciel Acme RH | page fictive Acme RH (données inventées) |
| capture-2 | colonne Étapes, canevas, point de clic et bulle « Créez la fiche » | capture de l'app en ligne (main 7888251), éditeur, démo fictive « Créer une fiche collaborateur » de 5 étapes |
| capture-3 | « Vérifier les données avant l'envoi », flous | extension construite |
| capture-4 | barre de la capture HTML, badge REC | extension construite |
| capture-4 | barre vidéo | recopiée du code de l'extension (`videobar.content.ts`), non capturable en headless |
| capture-5 | onglet « Lien » de Partager la démo | capture de l'app en ligne (main 7888251) ; l'adresse du lecteur est remplacée par `demos.acme.example` (domaine fictif) |
| capture-5 | fenêtre « Diffuser », onglet SCORM | capture de l'app en ligne (main 7888251), démo publiée |
| marquee | colonne Étapes et bulle | capture de l'app en ligne (main 7888251), comme capture-2 |
| vignette | bouton, point de clic et bulle | dessin à la charte (petite taille, illustratif) |

À refaire quand les lots 3 et 4 (nouvel éditeur, nouvelles pages Partager et Diffuser) seront en ligne.
