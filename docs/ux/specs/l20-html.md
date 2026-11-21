# L20 : capture HTML, éditeur d'éléments, Sandbox, Catalogue de démos (A8)

> **Maquettes** :
> - `reference/editeur-html.html` : étape HTML dans l'éditeur (structure de référence) ;
> - `refonte/a8-html.html?view=sandbox` : plan du Sandbox ;
> - `refonte/a8-html.html?view=center` : Catalogue de démos, à corriger selon le §5.
>
> **Base** : `specs/a8-html.md`, qui reste la référence détaillée (assainissement, sécurité, opérations). Cette spec fixe les états, les écarts et les corrections.
>
> **Données** : fictives (Acme, `.example`).

## 1. États et codes

| Code | État | Maquette | Remplace |
|---|---|---|---|
| L20-01 | Éditeur : étape HTML, élément sélectionné, barre d'actions, modifications | `reference/editeur-html.html` | A8-01 |
| L20-02 | Sandbox : plan des pages, page à relier, réglages | `refonte/a8-html.html?view=sandbox` | A8-02 |
| L20-03 | Catalogue de démos (variante du centre de formation L14) | `refonte/a8-html.html?view=center` + §5 | A8-03 |

## 2. Capture HTML (extension)

- Elle ajoute une **quatrième carte** « Capture HTML » au choix du type de capture (L21-01), avec l'icône `code` et la description « Page reproduite et modifiable ».
- Tout le reste suit A8 §1 :
  - double assainissement (extension et serveur) ;
  - domaine des contenus séparé ;
  - iframe `sandbox` sans `allow-same-origin` ;
  - CSP stricte ;
  - 10 Mo au plus par page.
- La vérification des données (F1 §1) s'applique au **texte du DOM**. Un élément flouté voit son texte **remplacé** dans la source stockée (« Xxxxxx Xxxxxx »), en plus du `filter: blur()`.

## 3. Éditeur d'éléments (L20-01)

- **Rail** : icône `code` et titre de l'étape.
- **Fil du sélecteur**, en tête du canevas : badge « Étape HTML », puis `body › main › div.kpi › b.value` en mono, le dernier élément en gras. Chaque maillon est un bouton qui sélectionne le parent correspondant.
- **Canevas** : la page capturée, rendue telle quelle dans le cadre navigateur.
  - **Survol** : contour pointillé de 1 px (#2897D5).
  - **Sélection** : contour de 2 px (#2897D5), décalé de 2 px, avec une étiquette du sélecteur court (fond #2897D5, texte #080808, contraste 6,2:1).
  - Élément **masqué** : barré et estompé dans l'éditeur, absent du lecteur (`display: none`).
  - Élément **flouté** : flou visible, texte déjà remplacé.
- **Barre d'actions** (`role="toolbar"`, nommée « Actions sur l'élément sélectionné ») :
  - pilule noire, en portail, placée sous l'élément et retournée au-dessus s'il n'y a pas la place ;
  - elle ne cache jamais l'élément sélectionné ;
  - boutons : Modifier le texte, Masquer, Flouter, Lier à une étape, et un menu ⋯ (Remplacer l'image via la médiathèque L18, Supprimer l'élément, Copier le sélecteur).
- **Clavier** :
  - Tab et Maj+Tab : élément suivant ou précédent ;
  - Échap : élément parent ;
  - Entrée : édition du texte ;
  - Suppr : masquer.
- **Barre flottante** (hotspot, flou, zoom) : masquée. Le hotspot d'une étape HTML est un **lien sur un élément** (« Lier à une étape »).
- **Panneau « Élément · {{sélecteur}} »** :
  - **Texte** : avec variables `{{…}}`. L'aide en donne un exemple ;
  - **Appliquer** (`radiogroup`) :
    - « Cette étape » ;
    - « Toutes les étapes (n) » : le même élément (sélecteur stable) est modifié partout, et une seule annulation suffit.
- **« Modifications de l'étape · n »** : une ligne par opération, avec :
  - l'icône du type (texte, masqué, flou, lien) ;
  - le sélecteur en mono ;
  - l'avant et l'après (« « 312 » → « 1 248 » ») ;
  - un bouton nommé « Annuler la modification … ».
- **Élément introuvable** : après une nouvelle capture, une ligne avec contour warning indique « Élément introuvable dans la nouvelle capture : modification mise de côté », avec un bouton « Supprimer ». L'avertissement ne bloque pas la publication.
- **Rappel** sous le panneau : « Capture HTML : copie assainie de la page (scripts retirés, champs vidés), servie depuis le domaine des contenus. Les modifications ne touchent jamais le vrai site. »
- **Graphiques** : un graphique en canvas n'est pas modifiable dans cette version. Le bouton « Modifier le texte » est alors désactivé, avec l'aide « Graphique non modifiable : remplacez l'image ».

## 4. Sandbox (L20-02)

Tout est conforme à A8 §3. Points à vérifier :
- **Plan** :
  - une carte par page, avec la vignette, le titre et « n liens » ;
  - les liens sont tracés en couleur principale ;
  - badge « Départ » sur la page de départ, badge « À relier » sur une page orpheline ;
  - alerte warning sous le plan : « « {{page}} » n'est reliée à aucune page : les visiteurs ne peuvent pas l'atteindre. », avec l'action « Relier un lien du menu ».
- **Accessibilité du plan** : `role="img"` avec une description des liens, et une **liste équivalente** dans le panneau (page → pages liées), navigable au clavier.
- **Réglages** :
  - page de départ ;
  - lier automatiquement les liens identiques (activé par défaut) ;
  - clic sur un élément non relié : par défaut, le message « Cette partie n'est pas disponible dans la démo » (`role="status"`) ;
  - guide optionnel (désactivé par défaut) ;
  - « Ajouter une page (capture HTML) ».
- **Complétion** : « a vu les n pages clés ». Les pages clés sont choisies dans le panneau (cases à cocher par page) ; par défaut, toutes les pages reliées.

## 5. Catalogue de démos (L20-03)

- **Même composant que le centre de formation (L14)**, avec le réglage « Type de centre » : Centre de formation / Catalogue de démos. Les différences sont celles d'A8 §4 : pas de compte ni de progression, CTA « Nous contacter », cartes avec le type et les étiquettes, filtres par étiquette.
- **Corrections à apporter à la maquette `a8-html.html?view=center`**, pour respecter les règles en vigueur :
  - **pas de durée** sur les cartes (« · 3 min ») ni dans le titre (« en 3 minutes ») tant qu'elle n'est pas mesurée. Les cartes affichent « Démo guidée · n étapes » ou « Sandbox · n pages » ;
  - **mention d'accessibilité** du pied de page : celle réglée par le workspace (L14-08), **« non conforme » par défaut**, jamais « conforme partiellement » sans audit (voir `a11y/declaration-accessibilite.md`) ;
  - **nom du centre** : celui du workspace (« Démos d'Acme »), pas un libellé figé ;
  - le titre et le sous-titre du héros sont modifiables dans les réglages (comme L14-08). Les valeurs par défaut sont « Découvrez nos outils » et « Des démos interactives, sans inscription. ».
- **SEO** : indexation désactivée par défaut, `og:image` par démo (capture de l'étape 1 floutée).
- **CTA « Nous contacter »** :
  - lien, ou formulaire de lead (L11 / EDT-08) ;
  - le formulaire n'envoie **aucun e-mail** tant que l'envoi d'e-mails n'est pas arbitré : les leads arrivent dans Leads et dans les webhooks (`lead.created`).

## 6. Accessibilité

- Le lecteur d'une démo HTML lit du **vrai texte**. Les éléments masqués sont absents du DOM rendu, et les éléments floutés ont un texte de remplacement.
- Dans l'éditeur, tout se fait au clavier (§3). La barre d'actions est une `toolbar` nommée, et chaque modification a son bouton d'annulation nommé.
- Dans le Sandbox, les liens réels sont navigables au clavier, et le message « non disponible » est annoncé.

## 7. Hors périmètre

- Modification des valeurs d'un graphique canvas ou SVG complexe.
- Import de jeux de données.
- Édition du style CSS élément par élément (couleurs, tailles).
