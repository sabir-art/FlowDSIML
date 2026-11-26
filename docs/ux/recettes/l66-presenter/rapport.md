# Recette réelle : L66 Présenter (fenêtre, minuteur, bilan, historique)

**Banc** : branche `claude/dev-mvp` à 8414cab, qui contient c5fbf23, 4a8c639, 48ffd55, d5da49d et la migration `20261201340000_presenter_historique`. App locale lancée comme en CI, faux Supabase, données fictives. Chromium à 1440 px, en clair et en sombre.

**e2e** : `presenter-l66` passe à 24/24 en clair comme en sombre. J'ai aussi écrit un script de banc à part : il fait 10 ouvertures et fermetures, mesure l'ouverture, attend la fin du fondu avant de capturer et produit un bilan court.

## Verdict : VERT

### §1 Fenêtre

Tout est conforme :
- 2 cartes radio, chacune avec un schéma SVG de 112 px et une phrase ;
- l'aide « Une seconde fenêtre s'ouvre : glissez-la sur le vidéoprojecteur, puis F11. » ne s'affiche qu'avec « Deux fenêtres » ;
- plus de bloc bleu ;
- Commencer à et Minuteur sont sur une ligne, en 40 px, de même largeur (249 px) ;
- les options sont des lignes dans un encadré de rayon 12 ;
- pied : Historique (n) à gauche, Annuler, puis Lancer la présentation.

Captures : `fenetre-un-ecran-clair.png`, `fenetre-deux-fenetres-clair.png`, `fenetre-sombre.png`.

### Gel à l'ouverture (signalé par le client) : non reproduit

J'ai ouvert et fermé Présenter 10 fois, en alternant Deux fenêtres et Un seul écran, puis Annuler et Échap. À chaque fois :

| Point mesuré | Résultat |
| --- | --- |
| Ouverture, du clic sur « Plus d'options » à la fenêtre visible | 401 à 572 ms |
| Clic sur une carte | 7 à 282 ms |
| Tâches longues pendant l'ouverture | 52 à 121 ms au plus, aucune ne dépasse 400 ms |
| Copie figée du menu | aucune |
| Élément au premier plan au centre de la fenêtre | la fenêtre elle-même |
| Après fermeture | la page est de nouveau cliquable (« Ajouter une étape » au premier plan) |

L'e2e vérifie aussi, dès l'ouverture, qu'aucune copie du menu ne reste figée (d5da49d).

Si le client voit encore un gel, il me faut son navigateur et l'action exacte. Mon banc est headless, sans accélération graphique : il peut masquer un gel lié au rendu.

### §2 Minuteur

Conforme : anneau de 36 px, temps en 22 px, « sur 15:00 ». À 13:00, il passe en orange avec « Plus que 2 min », annoncé poliment aux lecteurs d'écran. Après la fin, il passe en rouge avec « +1:20 ». Une pastille par étape, l'étape en cours marquée, « Étape 2 sur 3 ». Sans minuteur : le temps écoulé seul, sans anneau.

Captures : `minuteur-plus-que-2-min.png`, `minuteur-depasse.png`.

### §3 Bilan et historique

Conforme :
- 3 cartes : la durée avec son verdict, les étapes montrées et sautées, les notes modifiées ;
- le temps par étape, avec la légende (la plus longue, les autres) ;
- l'historique, avec « celle-ci » et la mention « Gardé 90 jours, visible par vous seul. » ;
- « Voir » rouvre un bilan passé, et Fermer revient au bilan en cours.

Une fois le fondu fini, la fenêtre est bien opaque (opacité 1, fond blanc en clair, #15191f en sombre). Sur la capture de l'e2e, le décor transparaît, mais elle a été prise pendant le fondu (`bilan-depasse-capture-e2e-en-fondu.png`). Ce n'est pas un défaut de l'app.

Captures : `bilan-plus-court-clair.png`, `bilan-plus-court-sombre.png`.

### Seuil « Plus courte que prévu » : tranché

Je valide la proposition du dev, sur la durée réelle rapportée à la durée prévue :

| Durée réelle | Verdict affiché |
| --- | --- |
| moins de 80 % | « Plus courte que prévu », en étiquette neutre (grise) et non en alerte, car finir plus tôt n'est pas une faute |
| de 80 à 100 % | « Dans les temps » |
| au-delà de 100 % | « Dépassée de m min ss » |
| sans minuteur | pas de verdict |

Vu en réel : 7 min sur 15 donne « Plus courte que prévu », et 16 min 21 sur 15 donne « Dépassée de 1 min 21 ».

### Remarques non bloquantes, à faire avec un prochain lot

1. **Vide de 44 px** entre la ligne Commencer à / Minuteur et l'encadré des options. Ailleurs dans la fenêtre, l'écart entre groupes est d'environ 24 px (proximité). Je demande 24 px.
2. **« Historique (0) »** est affiché et cliquable alors qu'il n'y a encore aucune présentation. Je propose de le masquer à 0, ou de le désactiver avec l'infobulle « Aucune présentation pour l'instant ».

Demandes concernées : L66 Présenter · fenêtre (cartes avec schéma, aide du vidéoprojecteur, Commencer à et Minuteur, pied) · gel à l'ouverture de la fenêtre Présenter · minuteur en anneau · bilan et historique des présentations · seuil « Plus courte que prévu ».
