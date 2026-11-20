# L43 : composeur de message (assistant IA, commentaires)

> Retour client : dans l'assistant IA, le bouton « Envoyer » est à côté du champ et réduit sa largeur. Il faut faire comme dans les messageries modernes : un champ pleine largeur, le bouton d'envoi en icône **à l'intérieur**, en bas à droite, et la mention dessous.
> La règle vaut pour l'assistant IA et pour **tout champ de message similaire** : nouveau commentaire, réponse et modification d'un commentaire, puis tout futur champ de discussion.
> Maquette : `docs/ux/maquettes/refonte/l43-composeur.html`. Captures : `img/l43-assistant.png`, `img/l43-commentaires.png` et `img/l43-sombre.png`.
> Données fictives.

## 1. Composant `Composer` (packages/ui)

Un seul composant, pour remplacer les compositions actuelles :
- `AssistantPanel.tsx` : `textarea` et `btn btn-primary`, placés côte à côte ;
- `CommentsPanel.tsx` : `MentionInput` et `Button`.

- **Structure** : un cadre (`fd-composer`) contient le `textarea` et le bouton d'envoi, posé en position absolue, en bas à droite. La mention et l'éventuel compteur viennent dessous (`fd-composer__note`).
- **Cadre** : bordure 1 px `border-strong`, arrondi 16 px, fond `surface`. Au focus dans le champ : bordure `primary` et anneau `shadow-focus` sur le cadre entier.
- **Champ** :
  - pleine largeur, police 15/22 px, marges intérieures de 13 px en haut et en bas, 16 px à gauche, **56 px à droite** (réservés au bouton : le texte ne passe jamais dessous) ;
  - hauteur automatique de 1 à 6 lignes (48 à 168 px), puis défilement interne.
- **Bouton d'envoi** :
  - rond de 32 px, à 8 px du bas et du bord droit ; icône Lucide `arrow-up` de 18 px ;
  - fond `primary`, icône `on-primary` ;
  - nom accessible « Envoyer », infobulle « Envoyer · Entrée » (L44) ;
  - désactivé (`disabled`, fond `surface-sunken`, icône `text-muted`) si le champ est vide ou ne contient que des espaces ;
  - zone cliquable portée à 40 × 40 px par un pseudo-élément, sans changer le dessin.
- **Clavier** :
  - **Entrée** envoie ; **Maj + Entrée** passe à la ligne ;
  - pendant une composition (accents, IME : `isComposing`), Entrée n'envoie jamais ;
  - dans les commentaires, quand la liste des mentions est ouverte, Entrée choisit la mention (comportement actuel de `MentionInput`) ;
  - Échap dans le champ de modification d'un commentaire annule la modification (inchangé).
- **Après l'envoi** : le champ est vidé, garde le focus et revient à une ligne.

## 2. Contextes

| Contexte | Placeholder | Mention dessous | Particularités |
|---|---|---|---|
| Assistant IA | « Posez une question sur cette démo… » | « La conversation est effacée à la fermeture. » | Pendant une réponse, le bouton devient « Arrêter la réponse » (icône `square` pleine, fond `text`, icône `surface`) et remplace « Arrêter » au-dessus du champ. Le champ reste modifiable pendant la réponse. 2 000 caractères au plus. |
| Nouveau commentaire | « Écrire un commentaire… @ pour mentionner » (le placeholder court existant sous 480 px) | « Interne à l'équipe, jamais publié. » | L'avatar à gauche du champ est **conservé** (choix du client, révision L45 §4) : il est centré sur le cadre du champ quand celui-ci fait une ligne, et aligné en haut quand il en fait plusieurs. 500 caractères. |
| Réponse à un commentaire | « Répondre… » | aucune | Même composant, plus compact (1 ligne au départ). |
| Modification d'un commentaire | texte existant | « Entrée pour enregistrer, Échap pour annuler » (aujourd'hui, c'est Ctrl + Entrée : on aligne sur la règle Entrée) | Le bouton prend l'icône `check` et le nom « Enregistrer ». « Annuler » reste en lien sous le champ. |

- **Compteur** : « 412 / 500 », à droite de la mention, affiché seulement à partir de 80 % de la limite. Au-delà de la limite, la saisie est bloquée (`maxLength`).
- **Erreur d'envoi** : le cadre passe en bordure `danger`, puis une ligne `role="alert"` apparaît sous le champ : « Le message n'a pas pu être envoyé. Réessayer ». Le texte saisi est conservé.
- **Désactivé** (pas d'étape choisie pour les commentaires, Assistance IA coupée) : le champ est désactivé, avec la raison sur la ligne de mention.

## 3. Accessibilité

- Le champ a un libellé (masqué visuellement) : « Message à l'assistant », « Nouveau commentaire », « Répondre à {{auteur}} », « Modifier le commentaire ».
- `aria-describedby` relie le champ à la ligne de mention et au compteur.
- Le bouton est un vrai `button type="submit"` dans un `form` : l'envoi au clavier passe par la soumission du formulaire.
- Les messages reçus de l'assistant sont annoncés par la zone `aria-live` existante. Le changement Envoyer / Arrêter est annoncé par le nouveau nom du bouton.

## 4. Recette

- Assistant et commentaires, en clair, en sombre, à 1 440 px et dans le panneau mobile.
- Entrée, Maj + Entrée, composition d'accents (texte « é » saisi avec une touche morte), mention avec Entrée.
- Champ qui grandit jusqu'à 6 lignes, puis défile ; le texte ne passe jamais sous le bouton.
- Bouton désactivé si le champ est vide ou ne contient que des espaces ; « Arrêter » pendant une réponse de l'assistant.
- Erreur d'envoi simulée : le texte est conservé, et « Réessayer » fonctionne.
- Mise à jour des e2e `assistant` et `comments` (sélecteurs du bouton).
