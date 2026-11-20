# L43 : composeur de message (assistant IA, commentaires)

> Retour client : dans l'assistant IA, le bouton « Envoyer » est à côté du champ et réduit sa largeur. Il faut faire comme dans les messageries modernes : un champ pleine largeur, le bouton d'envoi en icône **à l'intérieur**, en bas à droite, et la mention dessous.
> La règle vaut pour l'assistant IA et pour **tout champ de message similaire** : nouveau commentaire, réponse et modification d'un commentaire, puis tout futur champ de discussion.
> Maquette : `docs/ux/maquettes/refonte/l43-composeur.html`. Captures : `img/l43-assistant.png`, `img/l43-commentaires.png` et `img/l43-sombre.png`.
> Données fictives.
>## 1. Composant `Composer` (packages/ui)

Un seul composant, pour remplacer les compositions actuelles :
- `AssistantPanel.tsx` : `textarea` et `btn btn-primary`, placés côte à côte ;
- `CommentsPanel.tsx` : avatar, `MentionInput` et `Button`.

- **Cadre** (`fd-composer`) : bordure 1 px `border-strong`, arrondi 16 px, fond `surface`. Il contient, de haut en bas, la zone de texte et la barre d'actions. Au focus dans le champ : bordure `primary` et anneau `shadow-focus` sur le cadre entier, barre comprise.
- **Zone de texte** :
  - pleine largeur, police 15/22 px, marges intérieures de 12 px en haut, 16 px à gauche et à droite, 0 en bas (la barre suit) ;
  - hauteur automatique de 1 à **8 lignes** (34 à 192 px), puis défilement interne. La barre reste toujours visible.
- **Barre d'actions** (`fd-composer__bar`), 46 px, marges 6 px en haut, 8 px sur les côtés et en bas :
  - **à gauche**, des boutons à icône discrets de 32 px (`text-muted`, fond `surface-sunken` au survol et quand leur liste est ouverte), chacun avec son infobulle L44 :
    - `at-sign` « Mentionner » : dans les commentaires seulement. Il insère `@` au curseur et ouvre la liste des mentions ;
    - « Joindre » (`plus`) : **pas dans cette version**. Ni les commentaires ni l'assistant n'acceptent de pièce jointe aujourd'hui. L'emplacement est prévu pour une future zone de message qui en accepterait ;
  - **à droite** : le compteur éventuel, « Annuler » en modification, puis le bouton d'envoi.
- **Bouton d'envoi** :
  - rond de 32 px ; icône Lucide `arrow-up` de 18 px ; fond `primary`, icône `on-primary` ;
  - nom accessible « Envoyer », infobulle « Envoyer » avec la touche `Entrée` (L44) ;
  - désactivé (`disabled`, fond `surface-sunken`, icône `text-muted`) si le champ est vide ou ne contient que des espaces ;
  - zone cliquable portée à 40 × 40 px par un pseudo-élément, sans changer le dessin.
- **Pas d'avatar** à côté du champ : l'auteur est l'utilisateur lui-même. Les avatars restent dans la liste des messages et dans la liste des mentions.
- **Aide** : dans le placeholder (« Écrire un commentaire, @ pour mentionner ») et dans l'infobulle du bouton d'envoi (« Envoyer · Entrée »). Jamais de ligne d'aide sous le champ.
- **Clavier** :
  - **Entrée** envoie ; **Maj + Entrée** passe à la ligne ;
  - pendant une composition (accents, IME : `isComposing`), Entrée n'envoie jamais ;
  - liste des mentions ouverte : flèches pour choisir, Entrée ou Tab pour insérer, Échap pour fermer (sans vider le champ) ;
  - Échap dans le champ de modification d'un commentaire annule la modification (inchangé).
- **Liste des mentions** : popover de 280 px **au-dessus** du cadre, aligné à gauche, ouvert par `@` tapé ou par le bouton. Titre « Mentionner », une ligne par membre : avatar de 28 px, nom, rôle à droite. Filtrée par la saisie qui suit `@`. Positionnée par l'algorithme L44 (passe dessous si la place manque au-dessus).
- **Après l'envoi** : le champ est vidé, garde le focus et revient à une ligne.

jamais ;
  - dans les commentaires, quand la liste des mentions est ouverte, Entrée choisit la mention (comportement actuel de `MentionInput`) ;
  - Échap dans le champ de modification d'un commentaire annule la modification (inchangé).
- **Après l'envoi** : le champ est vidé, garde le focus et revient à une ligne.

## 2. Contextes

| Contexte | Placeholder | Barre (gauche) | Particularités |
|---|---|---|---|
| Assistant IA | « Posez une question sur cette démo… » | aucun outil | Pendant une réponse, le bouton devient « Arrêter la réponse » (icône `square` pleine, fond `text`, icône `surface`) et remplace « Arrêter » au-dessus du champ. Le champ reste modifiable pendant la réponse. 2 000 caractères au plus. |
| Nouveau commentaire | « Écrire un commentaire, @ pour mentionner » (« Commenter, @ pour mentionner » sous 480 px) | Mentionner | 500 caractères. Pas d'avatar. |
| Réponse à un commentaire | « Répondre, @ pour mentionner » | Mentionner | Même composant. |
| Modification d'un commentaire | texte existant | Mentionner | « Annuler » (bouton texte) à gauche de l'envoi, dans la barre ; le bouton prend l'icône `check` et le nom « Enregistrer » (infobulle « Enregistrer · Entrée »). Aujourd'hui c'est Ctrl + Entrée : on aligne sur la règle Entrée. |

- **Mentions de contexte** : « La conversation est effacée à la fermeture. » (assistant) et « Interne à l'équipe, jamais publié. » (commentaires) quittent le dessous du champ et passent **sous le titre du panneau**, en 12 px `text-muted`.
- **Compteur** : « 412 / 500 », dans la barre, à gauche du bouton d'envoi, affiché seulement à partir de 80 % de la limite. Au-delà de la limite, la saisie est bloquée (`maxLength`).
- **Erreur d'envoi** : le cadre passe en bordure `danger`, puis une ligne `role="alert"` apparaît sous le champ : « Le message n'a pas pu être envoyé. Réessayer ». Le texte saisi est conservé.
- **Désactivé** (pas d'étape choisie pour les commentaires, Assistance IA coupée) : le champ est désactivé et la raison remplace le placeholder (« Choisissez une étape pour commenter »).

## 3. Accessibilité

- Le champ a un libellé (masqué visuellement) : « Message à l'assistant », « Nouveau commentaire », « Répondre à {{auteur}} », « Modifier le commentaire ».
- `aria-describedby` relie le champ au compteur et à la mention de contexte du panneau.
- Le bouton « Mentionner » a `aria-haspopup="listbox"` et `aria-expanded` ; la liste est un `listbox` relié au champ par `aria-controls` et `aria-activedescendant`.
- Le bouton est un vrai `button type="submit"` dans un `form` : l'envoi au clavier passe par la soumission du formulaire.
- Les messages reçus de l'assistant sont annoncés par la zone `aria-live` existante. Le changement Envoyer / Arrêter est annoncé par le nouveau nom du bouton.

## 4. Recette

- Assistant et commentaires, en clair, en sombre, à 1 440 px et dans le panneau mobile.
- Entrée, Maj + Entrée, composition d'accents (texte « é » saisi avec une touche morte), mention avec Entrée.
- Champ qui grandit jusqu'à 8 lignes, puis défile ; la barre d'actions reste visible.
- États de la maquette : vide, rempli, multiligne, liste des mentions ouverte, modification ; en clair et en sombre.
- Aucun avatar à côté du champ ; aucune ligne d'aide sous le champ.
- Bouton désactivé si le champ est vide ou ne contient que des espaces ; « Arrêter » pendant une réponse de l'assistant.
- Erreur d'envoi simulée : le texte est conservé, et « Réessayer » fonctionne.
- Mise à jour des e2e `assistant` et `comments` (sélecteurs du bouton).
