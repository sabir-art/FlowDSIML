# Spec A8 : éditeur HTML, Sandbox, Demo Center

> Lot A8 de la parité (Products, Personalize) : démos fondées sur une **capture HTML** (copie assainie du DOM), éditées élément par élément. Le **Sandbox** relie plusieurs pages HTML pour une navigation libre. Le **Demo Center** est le hub public des démos et **réutilise F4** (centre de formation) dans une variante sans compte ni progression.
>
> Maquette : `docs/ux/maquettes/refonte/a8-html.html`, avec `?view=html|sandbox|center` et `&theme=dark` (seulement pour l'interface d'édition).
> Microcopie FR/EN (62 clés) : `html.*`.

## 1. Capture HTML (extension)

- Nouveau mode de capture, « Capture HTML », à côté de « Captures à chaque clic » (F7 §1). L'extension sérialise le DOM rendu (styles calculés intégrés, images et polices en ressources), à la manière de rrweb.
- **Assainissement** :
  - côté extension : scripts, gestionnaires `on*`, `iframe` tierces, `object` / `embed`, valeurs des champs `password` et des champs remplis supprimés ;
  - **côté serveur**, à nouveau, avant le stockage.
- La page est servie depuis le **domaine des contenus**, isolé de l'app (bac à sable `sandbox` sans `allow-same-origin`, CSP stricte).
- La vérification des données (F1 §1) s'applique au **texte du DOM**, ce qui la rend plus précise qu'avec une image. Le flou d'un élément HTML devient `filter: blur()`, et son texte est **remplacé** par des caractères neutres dans le DOM stocké : le texte d'origine ne doit jamais rester dans la source.

## 2. Éditeur d'éléments (étape HTML)

- **Canevas** : la page capturée, rendue dans le thème du player. Badge « Étape HTML » et fil d'Ariane du sélecteur en mono (`body › main › div.kpi › b.value`, le dernier en gras).
- **Survol** : contour bleu pointillé de 1 px. **Clic** : sélection, avec un contour bleu de 2 px et une étiquette du sélecteur court (fond bleu DSI, texte noir).
  - Clavier : Échap remonte au parent ; Tab et Maj+Tab passent à l'élément suivant ou précédent ; Entrée ouvre l'édition du texte.
- **Barre d'outils flottante** (pilule noire, en portail, positionnée avec flip et shift comme au §15.7) :
  - Modifier le texte ;
  - Masquer (`EyeOff`) ;
  - Flouter ;
  - Lier à une étape (le clic sur l'élément mène à l'étape n : c'est un hotspot sur l'élément) ;
  - menu ⋯ : Remplacer l'image (médiathèque A2 §7), Supprimer l'élément, Copier le sélecteur.
- **Panneau « Élément »** :
  - texte (avec variables `{{…}}`) ;
  - **Appliquer** : segmenté « Cette étape » / « Toutes les étapes (n) ». Le second remplace le même élément (même sélecteur stable) partout, avec une seule entrée d'annulation.
- **« Modifications de l'étape · n »** : la liste de chaque modification (icône du type, sélecteur, avant et après), avec « Annuler cette modification ». Les modifications sont stockées comme **opérations** (sélecteur + action + valeur) et non comme un DOM réécrit. Elles survivent donc à une nouvelle capture ; si un élément n'existe plus, la modification est mise de côté (`notFound`, avertissement non bloquant).
- **Autres possibilités** :
  - **texte et nombres personnalisés** (y compris par variables) ;
  - **graphiques** : remplacer la valeur d'un graphique SVG ou canvas n'est pas couvert par cette version (A8+). Un graphique en HTML ou SVG simple se modifie comme du texte.

## 3. Sandbox

- Une démo « Sandbox » est un **ensemble de pages HTML** liées. Le visiteur clique librement, comme dans l'outil réel.
- **Plan** :
  - une carte par page (vignette, titre, « n liens ») et des liens dessinés en prune ;
  - badge « Départ » (vert) sur la page de départ ;
  - badge « À relier » (warning) sur une page orpheline, avec une alerte sous le plan et l'action « Relier un lien du menu » ;
  - `role="img"` et `aria-label` qui décrit les liens. Une **liste équivalente** des pages et de leurs liens est accessible dans le panneau.
- **Réglages** :
  - page de départ ;
  - **liaison automatique** des liens identiques (même `href` ou même libellé dans le menu → même page) ;
  - **clic sur un élément non relié** : message « Cette partie n'est pas disponible dans la démo » (toast du player, par défaut), ne rien faire, ou mettre en évidence les zones cliquables ;
  - **guide optionnel** : des étapes F1 (bulles, Spotlight) par-dessus la navigation libre, que le visiteur peut ignorer ;
  - « Ajouter une page (capture HTML) ».
- Les analytics (A4) comptent les pages vues et les chemins. La complétion devient « a vu les n pages clés » (réglable).

## 4. Demo Center (variante de F4)

- **Même composant que le centre de formation (F4)**. Un réglage « Type de centre » choisit entre :
  - Centre de formation : apprenants, progression, parcours, attestation ;
  - **Demo Center** : public, sans compte, sans progression.
- **Différences du Demo Center** :
  - en-tête : marque du workspace et CTA « Nous contacter » (pilule noire, lien ou formulaire de lead) ;
  - pas de carte « Mon parcours » ni de badges d'état ou de barres de progression ;
  - cartes de démo : type (« Démo guidée · n min », « Sandbox · n pages ») et **tags** (A2 §8) ;
  - catégories (filtres) = tags, et les sections sont des collections ;
  - SEO : indexable si l'option est activée (désactivée par défaut), avec une image Open Graph par démo.
- Le reste est **identique à F4** : recherche, grille (2 colonnes compactes sous 480 px), pied avec le statut d'accessibilité, configuration admin (sections, style, accès).

## 5. Accessibilité

- Éditeur : la sélection d'élément est utilisable au clavier (§2), la barre flottante est une `toolbar` nommée, et chaque modification de la liste a un bouton d'annulation nommé.
- **Player d'une démo HTML** : le DOM capturé reste **du vrai texte**, lisible par un lecteur d'écran (gain sur les captures en image). Les éléments masqués ont `aria-hidden` ; les éléments flous ont un texte remplacé.
- Sandbox : les liens réels sont navigables au clavier ; le message « non disponible » est annoncé en `role="status"`.

## 6. Sécurité (rappel pour le dev)

- Double assainissement (extension et serveur), domaine des contenus séparé, iframe `sandbox`, CSP sans `unsafe-inline` pour les scripts, aucun script exécuté depuis une capture.
- Taille maximale par page capturée : 10 Mo (ressources comprises). Images recompressées en WebP.

## 7. Recette prévue

- **Capture HTML** d'une page de test contenant des données fictives : assainissement (aucun script, aucun mot de passe), flou qui remplace bien le texte dans la source.
- **Éditeur** :
  - modification de texte sur une étape, puis sur toutes ;
  - masquage, lien vers une étape, annulation ;
  - nouvelle capture avec un élément disparu (`notFound`).
- **Sandbox** : navigation libre, liaison automatique, message « non disponible », page orpheline signalée.
- **Demo Center** : bascule depuis le centre de formation ; pas de progression ; CTA.
- Contrôles communs : 1 440, 1 024 et 390 px (player et Demo Center), en clair et en sombre (éditeur) ; clavier et lecteur d'écran.
