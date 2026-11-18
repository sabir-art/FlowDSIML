# Spec L12 : gains rapides de l'éditeur

> Ce lot active six fonctions de l'éditeur validé, aujourd'hui absentes ou marquées « Bientôt » : masquage opaque, déplacement du zoom, style appliqué à toutes les étapes, rechercher-remplacer, étiquettes des boutons et raccourcis clavier. La structure de l'éditeur ne change pas (EDT-01 à EDT-13) ; seuls des panneaux, une barre de recherche et deux modales s'ajoutent.
>
> **Maquette** (clair et sombre) : `docs/ux/maquettes/reference/editeur-gains.html`, états `?etat=masque|zoom|style|recherche|boutons|raccourcis`.

## 1. États (codes de l'outil de suivi)

| Code | État | Maquette |
|---|---|---|
| L12-01 | Masquage opaque (Aplat) | `?etat=masque` |
| L12-02 | Zoom sur une zone, déplaçable | `?etat=zoom` |
| L12-03 | Modale « Appliquer le style à toutes les étapes » | `?etat=style` |
| L12-04 | Rechercher et remplacer | `?etat=recherche` |
| L12-05 | Étiquettes des boutons de la bulle | `?etat=boutons` |
| L12-06 | Modale « Raccourcis clavier » | `?etat=raccourcis` |
| L12-07 | Étiquettes des démos (tableau de bord et réglages) | `refonte/l12-etiquettes.html?etat=cartes|filtre|carte`, `editeur-gains.html?etat=etiquettes` |

## 2. Masquage opaque (L12-01)

- Le segmenté **Flou / Pixels / Aplat** du panneau de zone (EDT-07) devient actif. « Aplat » recouvre la zone d'une couleur pleine. Le titre du panneau devient « Zone masquée » et l'étiquette sur le canevas « Masque ».
- **Couleur** :
  - quatre pastilles : ardoise, gris clair, blanc, et une couleur détectée autour de la zone pour un masque discret ;
  - un champ hexadécimal.
- **Texte sur le masque** (facultatif), par exemple « Donnée masquée ».
- « Appliquer à » : Cette étape seulement, ou Toutes les étapes, même position.
- Encadré d'information : le masque est incrusté dans l'image publiée, et l'original n'est jamais envoyé aux visiteurs.
- L'outil de la barre flottante devient « Flou ou masque » (raccourci B).

## 3. Zoom sur une zone (L12-02)

- Sur le canevas, un cadre avec l'étiquette « Zoom 200 % » et quatre poignées. L'extérieur du cadre est assombri, et une pastille centrale porte l'icône de déplacement.
- **Déplacement** : glisser le cadre à la souris, ou utiliser les flèches au clavier (1 % par appui, 10 % avec Maj). Le cadre a `role="slider"` et une `aria-valuetext` qui décrit sa position.
- **Panneau** :
  - Niveau : 150, 200 ou 300 % ;
  - position Horizontal et Vertical en pourcentage ;
  - bouton « Centrer sur le hotspot ».
- **Mouvement** :
  - Transition Fluide ou Directe ;
  - interrupteur « Garder ce zoom à l'étape suivante » ;
  - « Fluide » est ignoré si le visiteur a demandé moins d'animations (`prefers-reduced-motion`).

## 4. Appliquer le style à toutes les étapes (L12-03)

- Nouvelle section « Style de l'étape » dans le panneau Étape, avec un bouton « Appliquer à toutes les étapes… ».
- La modale coche ce qui est copié :
  - position de la bulle ;
  - libellés des boutons ;
  - type de guidage, décoché par défaut ;
  - avance au clic.
- Elle dit aussi ce qui est épargné : le formulaire, l'écran de fin et les textes des bulles.
- Le bouton est compté (« Appliquer à 6 étapes »). Le toast propose l'annulation : « Ctrl Z pour annuler ».

## 5. Rechercher et remplacer (L12-04)

- Ouverture par Ctrl F ou par le menu « … » (nouvelle entrée « Rechercher et remplacer »). La barre flotte en haut à droite du canevas, sans masquer le rail.
- **Contenu de la barre** :
  - champ de recherche avec compteur « 1 sur n », boutons précédent et suivant, Fermer (Échap) ;
  - champ de remplacement ;
  - options « Respecter la casse » (Aa) et « Mot entier » (ab), en boutons `aria-pressed` ;
  - portée : Bulles, titres et boutons ; Bulles seulement ; Titres des étapes seulement ;
  - boutons « Remplacer » et « Tout remplacer (n) ».
- **Résultats** : une liste « Étape n » + extrait, avec le terme surligné en orange clair et le résultat courant en orange plus soutenu. Le rail affiche une pastille orange avec le nombre de résultats sur la vignette de chaque étape concernée.
- Les variables `{{…}}` ne sont jamais modifiées. Tout remplacement s'annule avec Ctrl Z.

## 6. Étiquettes des boutons (L12-05)

- La section « Boutons », aujourd'hui en « Bientôt », devient active : libellés « Précédent » et « Suivant » éditables, avec un compteur de 24 caractères.
- Nouvel interrupteur « Afficher « Précédent » ».
- Un libellé vide reprend celui du thème : « Précédent », « Suivant », et « Terminer » à la dernière étape.
- La bulle du canevas montre tout de suite les libellés saisis.

## 7. Raccourcis clavier (L12-06)

- L'entrée « Raccourcis clavier » du menu « … » n'est plus en « Bientôt ». Elle ouvre la modale, comme la touche « ? ».
- Quatre groupes en deux colonnes : Général, Étapes, Canevas, Texte. Chaque touche est une `kbd` bordée.
- Les raccourcis à une lettre (H, B, Z) sont inactifs pendant la saisie de texte. Sur Mac, Ctrl devient ⌘.

## 8. Étiquettes des démos (L12-07)

Elles servent à organiser et filtrer les formations par outil, par public ou par module, comme la ligne « Tags » du tableau de parité.

**Tableau de bord** (structure de la refonte validée) :
- **Cartes** : les pastilles d'étiquettes s'affichent sous la ligne de méta. Chacune a un point et un texte de sa couleur, sur fond clair de la même teinte. Il y a une couleur par catégorie, prise dans la palette DSI (bleu, vert, orange, framboise, prune), pour respecter la règle D13.
- **Filtre** : le bouton « Étiquettes » se place entre « Dossiers » et le tri. Il porte un compteur prune quand un filtre est actif.
  - Le panneau contient une recherche, puis la liste à cocher avec le nombre de démos par étiquette.
  - Combinaison : « Au moins une » ou « Toutes ».
  - En pied : « Effacer » et « Gérer les étiquettes » (renommer, recolorer, supprimer).
- **Menu « … » de la carte** : nouvelle entrée « Étiquettes », qui ouvre un sous-panneau à droite.
  - Recherche ou création, liste à cocher.
  - « Créer « … » » avec le choix parmi les 5 couleurs.
  - Limites : 20 étiquettes par workspace, 5 par démo.

**Éditeur** (`editeur-gains.html?etat=etiquettes`) : section « Étiquettes » en tête de l'onglet Réglages.
- Champ à pastilles, avec retrait par pastille et ajout par saisie et Entrée.
- Une aide rappelle l'usage et la limite.

**Accessibilité** :
- le filtre est un bouton `aria-expanded` relié à son panneau (`aria-controls`) ;
- le sous-panneau est un `dialog` étiqueté ;
- les pastilles de couleur ont un nom accessible ;
- la couleur n'est jamais le seul repère, car le nom de l'étiquette est toujours écrit.

Les libellés des boutons de la bulle (L12-05) restent dans le lot.

## 9. Règles

- Données fictives uniquement. Icônes Lucide, aucun caractère utilisé comme icône. Les flèches et ⌘ sont des libellés de touches, pas des icônes.
- Couleurs du surlignage de recherche : `orange-100` et `orange-300` en clair, sur un texte inchangé. Le contraste du texte reste celui du corps.
- Toute action de masse (style à toutes les étapes, tout remplacer) se fait en une seule étape d'annulation.
