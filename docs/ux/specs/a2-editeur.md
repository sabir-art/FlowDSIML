# Spec A2 : éditeur avancé

> Lot A2 de la parité Guideflow (`docs/product/matrice-fonctionnalites.md` : Edit, Personalize).
> Maquette : `docs/ux/maquettes/refonte/editeur-avance.html`. La barre en bas à gauche bascule entre les 10 fonctions, et l'URL accepte `?view=modes|popup|checklist|survey|choix|ab|assets|tags|find|apply` et `&theme=dark`.
> Microcopie FR/EN : `editor.advanced.*` dans `docs/ux/i18n` (127 clés).
> Base : refonte DSI de l'éditeur (`refonte.md` §6), commentaires (`commentaires.md`), overlays en portail (§15.7).

## 0. Principes communs

- Toute nouvelle fonction se règle dans le **panneau de droite** : une section qui commence par `fd-icon-chip` + `h2.fd-card__title`, avec des champs espacés de 20 px.
- Les **nouveaux types d'étape** sont ajoutés via le menu « Ajouter une étape » du rail : Capture, Pop-up, Checklist, Sondage, Menu de choix, Étape texte, Image importée. Chaque type a son icône Lucide dans le menu et sur le titre de la vignette du rail.
- Les réglages qui valent pour toute la démo le disent en `fd-help` (« Ces réglages valent pour toute la démo »).
- Les étapes interactives (pop-up, sondage, choix) sont rendues par **player-core** : le canevas montre exactement ce que verra le visiteur.

## 1. Modes de lecture : Visite guidée et Spotlight, cadre navigateur

- Onglet Design, section « Mode de lecture » : 2 cartes-choix illustrées (`aria-pressed`), **Visite guidée** (par défaut) et **Spotlight**.
- **Spotlight** :
  - voile `--fd-player-overlay` à 60 % sur toute la capture, avec un **trou** sur la zone du hotspot (`clip-path` ou masque SVG) ;
  - anneau de 3 px de la couleur du hotspot ;
  - transition de 200 ms entre deux étapes, désactivée si `prefers-reduced-motion` ;
  - la bulle reste au-dessus du voile.
- **Cadre** (segmenté avec icônes : Aucun / Navigateur `Monitor` / Mobile `Smartphone`) :
  - **Navigateur** : barre de 40 px en `--fd-player-browser-bar`, 3 pastilles et barre d'adresse pilule en mono ;
  - **Mobile** : contour d'appareil arrondi, en 9:19.5 ;
  - « Adresse affichée » : modifiable, par défaut l'URL de la capture, et masquée si le cadre vaut Aucun.
- Les deux réglages s'appliquent à toute la démo. On peut les surcharger par étape dans Réglages → « Pour cette étape ».

## 2. Étape pop-up

- Modale centrée dans le player, de 380 px au maximum, avec le rayon du thème et une ombre `lg`, sur un fond **Capture floutée** (par défaut), **Couleur** ou **Image** (médiathèque).
- Champs : titre, texte (éditeur riche existant, avec variables), bouton (texte, action : étape suivante, lien ou CTA), interrupteur « Afficher l'icône ».
- Accessibilité : le focus va au bouton à l'affichage, Échap équivaut à « Suivant » si l'étape le permet, et `role="dialog"` est nommé par le titre.

## 3. Checklist

- Réglage au niveau de la **démo** (onglet Étape quand une étape checklist est sélectionnée, ou Réglages) :
  - interrupteur « Afficher la checklist dans le player » ;
  - titre ;
  - éléments = **un par chapitre**, dans l'ordre et réordonnables (poignée `GripVertical`) ;
  - position Gauche / Droite / Repliée.
- **Player** : carte de 260 px en bas à droite (feuille du bas en mobile), titre, « 2 sur 5 terminées », barre de progression orange sur piste pâle.
  - Éléments terminés : `CircleCheck`, texte barré `text-muted`.
  - Élément en cours : fond `primary-soft`, en gras.
  - Un clic sur un élément ouvre la première étape du chapitre.
- `aria-live="polite"` : « Chapitre « … » terminé ».

## 4. Sondage

- Types : Recommandation (0 à 10), Note (1 à 5 étoiles), Choix unique, Choix multiples, Réponse libre.
- Champs : question, libellés du minimum et du maximum (échelles), options (choix), « Réponse obligatoire ».
- Player : modale ; échelle NPS en 11 boutons de 30 px minimum (44 px en tactile) en `role="radiogroup"`, la valeur choisie en `primary`. « Passer » est masqué si la réponse est obligatoire. « Envoyer » affiche `thanks` pendant 1,5 s puis passe à l'étape suivante.
- Les réponses alimentent Analytics → Sondages (lot A4) et l'export CSV.

## 5. Menu de choix (branching)

- Étape modale avec une question, un sous-texte facultatif et 2 à 6 boutons de choix (pleine largeur, rayon 12 px).
- Panneau : chaque choix est un bloc `surface-sunken` avec le **libellé** sur toute la largeur, puis une ligne `ArrowRight` + **destination** (select : une étape « n · titre », un chapitre, Fin de la démo, Ouvrir un lien…) + corbeille. « Ajouter un choix » (6 au maximum).
- **Rail** : badge `info` « 3 choix » (`GitBranch`) sur la vignette, et une icône `GitBranch` dans le titre.
- **Contrôle de cohérence** : `Alert warning` si une étape n'est atteinte par aucun chemin (`unreachable`). Même avertissement au moment de publier, sans bloquer la publication.
- Analytics : l'entonnoir suit le chemin réel. La répartition des choix est affichée dans A4.

## 6. Test A/B

- Point d'entrée : Réglages de l'étape → « Créer une variante B ». Cela duplique le titre et le texte de la bulle (et le CTA) ; la capture reste partagée.
- Panneau « Test A/B » + badge d'état (« En cours · J+6 », `trend-up-soft`) :
  - 2 cartes-variantes : pastille A (`chart-5`) / B (`chart-3`), libellé, valeur de l'objectif. La meilleure variante a une bordure de 2 px de sa couleur ;
  - répartition du trafic (50 / 50 par défaut, curseur par pas de 10) ;
  - objectif : Taux de complétion, Clics CTA, Leads ;
  - phrase de résultat **prudente** : « B mène de 11 points sur 412 visiteurs. » + « Résultat fiable à partir d'environ 1 000 visiteurs. » (pas de jargon statistique) ;
  - actions : « Garder B et terminer » (primaire) et « Arrêter le test » (avec confirmation).
- Le canevas montre la variante sélectionnée (segmenté A / B au-dessus du canevas).
- Un visiteur voit toujours la même variante (affectation mémorisée).

## 7. Médiathèque (assets library)

- Modale (`<dialog>`, 720 px) ouverte par « Choisir dans la médiathèque » depuis tout champ image ou police : logo, fond de pop-up, image importée, police.
- Contenu :
  - recherche en pilule et segmenté Tout / Logos / Images / Polices ;
  - grille de 4 colonnes (2 en mobile), avec en première case « Importer » (bordure pointillée, glisser-déposer, PNG, JPG, SVG ou WOFF2 de 5 Mo au maximum) ;
  - vignettes avec le nom tronqué (le nom complet en `title`), et la sélection en bordure prune de 2 px ;
  - pied : usage « Utilisé dans n démos · 12,4 Mo sur 500 Mo », « Annuler » et « Utiliser ce fichier ».
- Supprimer un fichier utilisé : `ConfirmDialog` avec `inUseWarning`.

## 8. Tags

- Réglages de la démo → « Tags de la démo » : champ à puces (comme A1), création à la volée avec Entrée. Liste « Tags du workspace » cliquable pour ajouter.
- Couleur de tag auto-attribuée parmi `chart-1` à `chart-5` (pastille de 8 px, fond à 14 %). Le texte reste `text`, donc le contraste est garanti.
- Tableau de bord : filtre « Tags » (menu pilule à cases multiples) à côté des dossiers. Les tags figurent sur la carte de démo (2 au maximum, puis « +n »). Les mêmes filtres servent au Catalogue de démos (A8).

## 9. Rechercher et remplacer

- Ouverture par Ctrl+H (⌘+Maj+H) ou par le bouton loupe de la barre de l'éditeur (`aria-label` + `title` avec le raccourci).
- Modale de 560 px : Rechercher / Remplacer par, options (casse, mot entier, inclure les variables et CTA), compteur `role="status"`.
- Liste de résultats :
  - pastille du numéro d'étape (noire), extrait avec la correspondance surlignée (`orange-200`, texte noir), bouton « Remplacer » ;
  - un clic sur la ligne sélectionne l'étape dans le canevas.
- « Tout remplacer (n) » : toast `replaced_*` avec « Annuler » pendant 8 s. **Pas de remplacement dans les captures** (images) : on l'indique en `fd-help` si une capture contient le texte (OCR hors périmètre).

## 10. « Appliquer à… » (appliquer à toutes les étapes)

- À côté du **libellé** de chaque réglage de bulle ou de hotspot transposable (position de la bulle, pulsation, couleur de la pastille, largeur de la bulle, CTA, cadre), un bouton `ghost` compact « Appliquer à… » (`CopyPlus`).
- Popover ancré, en portail (§15.7), avec le titre « Appliquer « valeur » » et un radio :
  - Toutes les étapes (n) ;
  - Ce chapitre (n) ;
  - Étapes choisies…, qui ouvre une sélection multiple dans le rail, avec des cases sur les vignettes.

  Boutons « Annuler » et « Appliquer ».
- Toast `done_*` avec « Annuler » (8 s). L'opération compte pour **une seule** entrée dans l'historique d'annulation.

## 11. Accessibilité et recette

- Cartes-choix et segmentés : `aria-pressed`. Modales en `<dialog>` avec focus piégé. Popovers en portail. Raccourcis annoncés dans `title` / `aria-keyshortcuts`.
- Spotlight et checklist : contraste du texte de la bulle conservé (le voile ne passe jamais sur la bulle). Le mode Spotlight respecte `prefers-reduced-motion`.
- Recette prévue : chaque fonction en 1 440 / 1 024 (390 pour le player : checklist, sondage, choix, pop-up), en clair et en sombre, au clavier.
