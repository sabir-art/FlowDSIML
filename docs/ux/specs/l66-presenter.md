# L66 — Présenter : affichage, minuteur, bilan et historique

Planche : `docs/ux/propositions/l66/planche-l66-presenter.png` (avant/après à 1440, clair et sombre). Présenter n'existe que dans l'éditeur, donc à partir de 1024 px.

## 1. Fenêtre « Présenter »

Elle passe au gabarit MODAL-01 en taille md : en-tête avec une tuile d'icône (Presentation), le titre « Présenter « {démo} » » et la croix de fermeture.

**Correctif** : le menu « Plus d'options » doit se fermer avant l'ouverture de la fenêtre. Aujourd'hui, il reste visible par-dessus.

- **Affichage** : 2 cartes radio côte à côte (`role="radiogroup"`). Chaque carte contient un **schéma** de 112 px de haut (fond `surface-sunken`), un bouton radio, un nom et **une phrase**.
  - **Deux fenêtres** : « Vos notes et le minuteur sur votre écran ; la démo seule sur le vidéoprojecteur. » Le schéma montre deux écrans reliés par une flèche : à gauche « Votre écran » (la démo en petit, les notes et le minuteur), à droite « Public » (la démo seule).
  - **Un seul écran** : « La démo en plein écran ; la touche N affiche ou masque vos notes. » Le schéma montre un écran avec la démo et un panneau de notes en pointillés, marqué « N ».
  - Le schéma est un SVG aux couleurs des jetons : démo en ardoise et bleu, point chaud et notes en couleur de marque. Il est `aria-hidden` : la phrase porte le sens.
  - Sous les cartes, avec Deux fenêtres seulement, une aide d'une ligne : « Une seconde fenêtre s'ouvre : glissez-la sur le vidéoprojecteur, puis F11. »
  - Le bloc bleu d'information est retiré.
- **Commencer à** et **Minuteur** sur une ligne : deux listes de 40 px de même largeur.
  - Les choix du minuteur : Sans minuteur, 5, 10, 15, 20, 30, 45, 60 min, ou Autre… (saisie en minutes).
  - L'interrupteur et le champ séparés disparaissent.
- **Options** : dans un encadré de lignes (rayon 12, filets), chaque ligne a un libellé, une aide d'une ligne et un interrupteur à droite :
  - « Masquer les points chauds à l'écran public » ;
  - « Piloter depuis mon téléphone ».
- **Pied** :
  - à gauche, le lien **Historique ({n})** (icône History), qui ouvre la liste du §3 ;
  - à droite, **Annuler**, puis **Lancer la présentation** (primaire, icône Play).

## 2. Minuteur (vue présentateur)

Le minuteur est à gauche de la barre de commandes. La ligne de progression au-dessus de la barre est retirée.

- Un **anneau** de 36 px (trait de 4 px) se remplit avec le temps écoulé.
- À côté, le **temps écoulé** en 22 px demi-gras, chiffres tabulaires, puis « sur 15:00 » en 12 px dessous.
- **États** :
  - *normal* : anneau en couleur de marque claire, texte blanc ;
  - *2 dernières minutes* : anneau et texte orange, avec la pastille « Plus que 2 min ». La pastille apparaît une fois, et le lecteur d'écran l'annonce poliment (`aria-live="polite"`) ;
  - *dépassé* : anneau plein, texte rouge et pastille « +1:20 », qui compte le dépassement.
- Sans minuteur : seul le temps écoulé s'affiche, sans anneau ni « sur ».
- Le minuteur est un `role="timer"`, nommé « {écoulé} écoulées sur {total} ». Il ne s'annonce pas à chaque seconde.
- Après un filet vertical, la **position** : une pastille par étape (faite, en cours, à venir) et « Étape 2 sur 3 ».
- La touche T remet le minuteur à zéro (comme aujourd'hui).

## 3. Bilan « Présentation terminée » et historique

Le bilan s'ouvre dans une fenêtre MODAL-01 en taille lg : tuile Flag, titre « Présentation terminée », sous-titre « {date, heure} · {affichage} ».

1. **Trois chiffres** dans des cartes (rayon 12) :
   - **Durée** : « 12 min 40 », « Prévu : 15 min » et une étiquette « Dans les temps » (verte), « Dépassée de 1 min 20 » (orange) ou « Plus courte que prévu » (neutre) ;
   - **Étapes montrées** : « 3 / 3 » et « Aucune sautée », ou « 1 sautée » ;
   - **Notes modifiées** : nombre d'étapes, avec « Étape 1, enregistrée ».
2. **Temps par étape** : une ligne par étape (numéro, titre, barre de 8 px, durée en m:ss).
   - Une **légende** dit ce que montrent les couleurs : orange pour l'étape la plus longue, couleur de marque pour les autres.
   - Aide : « Mesuré pendant la présentation. Une présentation n'est pas comptée comme une vue de la démo. »
3. **Historique des présentations** : un tableau des dernières présentations de cette démo par la personne, avec la date, la durée et les étapes, plus un lien « Voir ».
   - « Voir » rouvre le bilan de cette présentation.
   - La ligne en cours est mise en évidence (« celle-ci »).
   - Aide : « Gardé 90 jours, visible par vous seul. »
4. **Pied** : **Fermer**, puis **Retour à l'éditeur** (primaire).

**Données** : un bilan par présentation (démo, personne, date, affichage, durée prévue, temps par étape, étapes sautées, notes modifiées). Il est conservé 90 jours et visible seulement par la personne qui a présenté. Aucune donnée du public.

## 4. e2e

- Le menu « Plus d'options » est fermé quand la fenêtre est ouverte.
- Les 2 cartes ont un schéma et une phrase ; l'aide du vidéoprojecteur n'apparaît qu'avec Deux fenêtres.
- Commencer à et Minuteur ont la même hauteur (40) et la même largeur.
- Minuteur : l'état « Plus que 2 min » s'affiche à 13:00 sur 15:00, et « +m:ss » après la fin ; sans minuteur, pas d'anneau.
- Bilan : les 3 chiffres, la légende des couleurs et l'historique avec la ligne « celle-ci ». « Voir » rouvre un bilan passé.
- Tout est vérifié en clair et en sombre, à 1440.
