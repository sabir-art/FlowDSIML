# Recette du §6 « source de la voix » : 5578f31 (écarts du 1/3) et 84ca98e (commit 2/3) : ROUGE léger

Recette du 26/11 sur `claude/dev-mvp` (84ca98e), app locale avec faux backend. J'ai comparé l'app à `propositions/l62/planche-l62-source.png` (vues 2, 3 et 4), en clair et en sombre. Capture : `source-2-clair-sombre.png` ; de gauche à droite : ligne de 44 px, prise « À écouter », voix générée « À écouter », toast.

## Ce qui marche

- **e2e** :

  | e2e | Clair | Sombre |
  |---|---|---|
  | voix-off | 52/52 | 52/52 |
  | voix-sous-titres-ia | 69/69 | 69/69 |
  | formation-outils | 28/28 | 28/28 |

- **Écarts du 1/3, corrigés** :
  - « Source de la voix » s'affiche au-dessus du segmenté ;
  - la ligne de 44 px a le bouton Lecture en tête, puis « Voix en place / Fichier », puis la durée à droite ;
  - l'icône de la carte dépend de la source ;
  - l'infobulle « désactivé par l'espace » est sur l'onglet Générée grisé.
- **Plus rien n'est remplacé d'office** : la prise, l'import et la voix générée arrivent dans une carte « À écouter » à bordure de marque. La voix en place ne bouge pas avant « Utiliser cette voix ».
- **Plus de fenêtre de confirmation.** Après « Utiliser cette voix », le toast « Voix remplacée par la voix enregistrée » porte **Annuler**, qui remet l'ancienne voix (chemin, durée, transcription, options).

## Écarts avec la planche (vues 3 et 4)

1. **La carte « À écouter » ne dit pas quelle voix on écoute.**
   - Il n'y a que l'étiquette « À écouter », puis le lecteur.
   - **Attendu** : en tête de carte, l'icône de la source, puis « Nouvelle voix », puis en gris « Générée · Antoine · 0:11 » (ou « Enregistrée · 0:08 », ou « Fichier · 0:05 »). L'étiquette « À écouter » se place à droite de cette ligne.
   - Pour une voix générée, c'est ce qui permet de comparer avec la voix en place, et de savoir quelle voix on garde.
2. **Les actions de la voix générée sont hors de la carte.**
   - Aujourd'hui, « Régénérer » est un bouton pleine largeur sous la carte, et « Garder l'actuelle » et « Utiliser cette voix » sont encore en dessous.
   - Pour la prise, en revanche, les actions sont dans la carte.
   - **Attendu** : comme pour la prise, les 3 actions sont **dans la carte**, sous le lecteur :
     - « Garder l'actuelle » et « Utiliser cette voix », côte à côte, à droite ;
     - « Régénérer » (ou « Recommencer », ou « Choisir un autre fichier ») en lien avec icône, à gauche de la même ligne ou dessous.
   - Une seule forme pour les 3 sources.
3. **« Utiliser cette voix » touche la bordure de la carte** (prise, à droite). Il faut un retrait intérieur de 12 px partout dans la carte, comme pour la carte « Voix en place ».

## Remarques (non bloquantes)

- La ligne de 44 px affiche « Fichier » à gauche et « 0:02 » à droite, alors que la planche a « Enregistrée · 0:12 » sur la ligne grise. Les deux se valent : accepté.
- En sombre, « Utiliser cette voix » est rose clair avec un texte blanc. C'est le bouton principal du thème sombre, partout dans l'app, et ce n'est pas propre à ce lot.

## Pour le VERT

Les points 1 à 3, à livrer avec le commit 3/3.
