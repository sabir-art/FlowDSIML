# RADIUS-01 — Une règle de rayon par famille

Retour utilisateur du 25/11 : sur Équipe, « Rechercher un membre » a des coins arrondis et « Inviter » est en pilule, sur la même ligne et à la même hauteur. Ce n'est pas la forme qui gêne, c'est l'incohérence, et elle doit être réglée dans tout l'outil. Décision UX : **coins arrondis pour tous les contrôles, plus de pilule**. La structure, le fond et la palette ne changent pas.

Planche avant / après (Équipe, fenêtre « Inviter des membres », éditeur ; clair et sombre ; 1440 et 390) : `docs/ux/propositions/radius-01/planche-radius-avant-apres.png`.

## 1. Familles et jetons

À ajouter dans `packages/ui/src/tokens.css`. Les jetons existants (`--fd-radius-xs` … `-full`) restent la base. Les nouveaux jetons sont des alias par famille, et le code n'utilise que ces alias.

| Famille | Jeton | Valeur | Ce qui en relève |
|---|---|---|---|
| Contrôle (36 à 48 px) | `--fd-radius-control` | 10 px | Boutons primaire, secondaire, fantôme et danger ; champs texte, zones de texte, recherche, listes déroulantes, sélecteur de date, champ à préfixe (`https://`, `tutoclick/`), champ de couleur, bouton de fichier ; conteneur des segmentés et des onglets en pastille ; composeur |
| Petit contrôle (24 à 34 px) | `--fd-radius-control-sm` | 8 px | Boutons `--sm` et boutons à icône (barre du haut, ⋯, fermer, outils du rail) ; options d'un segmenté ou d'onglets en pastille (rayon du conteneur moins son retrait de 2 px) ; pastilles de filtre ; éléments actifs de navigation |
| Marque (≤ 24 px, non interactif) | `--fd-radius-tag` | 6 px | Badges de statut (« Actif », « Invité », « Bientôt » sur fond), étiquettes L52, compteurs en texte, pastilles de type |
| Détail | `--fd-radius-detail` | 4 px | `kbd` (« Ctrl K »), code en ligne, barre d'adresse fictive du cadre navigateur |
| Surface | `--fd-radius-surface` | 12 px | Cartes, tableaux encadrés, menus, popovers, infobulles riches, toasts, encadrés (zone de danger, bandeaux), vignettes |
| Surface superposée | `--fd-radius-overlay` | 16 px | Fenêtres modales, tiroirs et feuilles (seulement leurs coins libres : `16px 16px 0 0` pour une feuille du bas), panneau d'aide |
| Rond | `--fd-radius-round` | 50 % ou `--fd-radius-full` | Avatars, interrupteurs (piste et pastille), points d'état, pastilles numérotées des hotspots, curseurs de glissière, barres de progression (piste et remplissage), boutons ronds du lecteur public |

Règles :
- **Même hauteur, même rayon.** Deux contrôles côte à côte ont toujours le même rayon. Un contrôle qui change de taille change de famille, jamais de règle.
- **Imbrication** : un élément dans un autre prend le rayon du parent moins le retrait. Exemple : un segmenté de 10 px avec 2 px de retrait donne des options de 8 px.
- **Focus** : l'anneau de focus suit le rayon du contrôle (`outline` avec `outline-offset` ; pas de `box-shadow` à rayon fixe).
- **Pas de pilule** pour un contrôle, nulle part. Le rond est réservé à la famille « Rond ».
- La règle s'applique en clair et en sombre, à toutes les largeurs.

## 2. Lecteur public et extension

- **Lecteur** : les rayons viennent du thème de la marque choisi par le client (Thème et couleurs : `--p-radius` pour les surfaces, `--p-btn-radius` pour les boutons). C'est un réglage client, donc on ne l'écrase pas. Les seules contraintes sont les suivantes :
  - aucun rayon en dur dans `apps/player` ni `player-core` ; tout passe par `--p-radius`, `--p-btn-radius` ou des dérivés (`calc(var(--p-radius) - 4px)`) ;
  - les champs du lecteur (formulaires, quiz) suivent `--p-btn-radius`, comme ses boutons, pour rester cohérents entre eux ;
  - la valeur par défaut du thème passe à 10 px pour les boutons.
- **Extension** (popup, barres de capture, vérification) : mêmes familles et mêmes valeurs que l'app, avec des jetons recopiés dans le CSS de l'extension, puisqu'elle ne charge pas `packages/ui`.
- **Pages d'accès** : comme l'app. L'illustration (fenêtre, bulle) relève de la famille « Surface ».

## 3. Garde CI (comme MOTION-01 §6)

Un contrôle statique dans `mouvement-regles.e2e.cjs`, ou un fichier frère `rayons-regles.e2e.cjs`, échoue sur deux cas :
1. Un `border-radius` avec une valeur littérale (px, rem, %), hors des fichiers de jetons et hors des exceptions listées avec leur raison. Exceptions admises : `0`, `inherit`, `50%` uniquement sur un sélecteur de la famille Rond (avatar, interrupteur, point, pastille numérotée).
2. Un sélecteur de contrôle (`.fd-btn`, `.fd-input`, `.fd-sel`, `.segmented`, `.fd-tabs`, `.stg-search`, `.stg-group`, `[class*='-btn']`…) dont le rayon n'est pas `var(--fd-radius-control)` ou `var(--fd-radius-control-sm)`, ou `--p-btn-radius` dans le lecteur.

Il faut aussi une vérification dynamique sur 6 pages (Équipe, Général, Démos, éditeur, Analytics, lecteur) : deux contrôles de même hauteur ±2 px, alignés sur la même ligne, ont le même rayon calculé.

## 4. Ordre de reprise conseillé

1. `packages/ui` : jetons, `.fd-btn`, `.fd-segmented`, `.fd-tabs`, `.fd-pill`, le bouton de fichier, `modal.css` (16 → overlay), `popover.css` (10 → surface 12), `datefield.css`, `colorswatch.css`.
2. `app.css` (`.segmented`, poignée de colonne) et `settings.css` (`.stg-pill`, `.stg-search`).
3. `editor.css`, `demos.css`, puis le reste de l'app par fichier, dans l'ordre de l'inventaire.
4. Extension, puis lecteur.

## 5. Inventaire (relevé statique)

Relevé du 2026-11-25 sur claude/dev-mvp : 1023 déclarations border-radius, dont 812 en dur (hors 0, inherit, var()).

### Composants communs (packages/ui) — 43 en dur

Valeurs : `8px` ×13, `50%` ×11, `10px` ×5, `16px` ×3, `4px` ×2, `999px` ×2, `6px` ×2, `16px 16px 0 0` ×2, `5px` ×1, `2px` ×1, `0 0 16px 16px` ×1

Fichiers : `base.css` 9, `composer.css` 7, `controls.css` 5, `colorswatch.css` 5, `popover.css` 5, `datefield.css` 4, `modal.css` 4, `tooltip.css` 2, `navigation.css` 2

Contrôles encore en pilule (à passer au jeton de leur famille) :

- `base.css` — `.fd-btn`
- `base.css` — `input[type='file']::file-selector-button`
- `base.css` — `.fd-pill`
- `controls.css` — `.fd-segmented`
- `controls.css` — `.fd-segmented > button`
- `controls.css` — `.fd-tabs`
- `controls.css` — `.fd-tabs > [role='tab']`

### App — 536 en dur

Valeurs : `8px` ×72, `999px` ×72, `50%` ×71, `12px` ×63, `10px` ×54, `6px` ×41, `4px` ×36, `3px` ×23, `16px` ×21, `14px` ×18, `2px` ×16, `99px` ×12

Fichiers : `pages/editor/editor.css` 81, `styles/maquette-ajouts.css` 51, `pages/demos/demos.css` 42, `app.css` 35, `pages/center/center.css` 29, `pages/present/present.css` 26, `pages/learners/learners.css` 23, `pages/settings/settings.css` 23, `styles/maquette.css` 19, `pages/share/distribute.css` 15, `pages/share/share-dialog.css` 15, `pages/onboarding.css` 14, `pages/editor/video/video.css` 12, `pages/settings/integrations/integrations.css` 12

Contrôles encore en pilule (à passer au jeton de leur famille) :

- `app.css` — `.segmented`
- `app.css` — `.segmented button`
- `app.css` — `.fd-cgrip__btn`
- `styles/maquette-ajouts.css` — `.mk .logo-block__acts--stack > .btn`
- `styles/maquette-ajouts.css` — `.mk .l11-chip`
- `styles/maquette-ajouts.css` — `.email-chip`
- `pages/editor/editor.css` — `.var-pill`
- `pages/editor/editor.css` — `.canvas-form-chip`
- `pages/editor/editor.css` — `.steplist-move button`
- `pages/editor/editor.css` — `.gdpr-chip`
- `pages/editor/editor.css` — `.ba-pill`
- `pages/editor/editor.css` — `.ck-pill`
- `pages/editor/editor.css` — `.rail-tab`
- `pages/editor/editor.css` — `.cap-chip`
- `pages/editor/editor.css` — `.mk .ed-tabs`
- `pages/editor/editor.css` — `.mk .ed-tabs :is(button, a)`
- `pages/editor/html/html.css` — `.eltb > button`
- `pages/editor/quiz/quiz.css` — `.quiz-list__move button`
- `pages/present/present.css` — `.presenter button:not(dialog button)`
- `pages/present/present.css` — `.presenter .pr-tabs`
- `pages/present/present.css` — `.presenter .pr-tabs [role='tab']`
- `pages/present/present.css` — `.presenter .pr-top .fd-btn`
- `pages/share/distribute.css` — `.tab-count`
- `pages/share/share-dialog.css` — `.mk .she-art--button`
- `pages/demos/demos.css` — `.search-pill .fd-input`
- `pages/learners/learners.css` — `.gm-chips .chip`
- `pages/learners/learners.css` — `.gm-chips .chip button`
- `pages/settings/settings.css` — `.st-wrap--plain .segmented.stg-seg`
- `pages/settings/settings.css` — `.st-wrap--plain .segmented.stg-seg button`
- `pages/settings/settings.css` — `.stg-pill`
- `pages/settings/settings.css` — `.hc-chip`
- `pages/settings/keys/keys.css` — `.ak-chip`
- `pages/extension/extension.css` — `.mk .xt-chip`
- `pages/demo/demo-views.css` — `.mk .dv-tabs`
- `pages/demo/demo-views.css` — `.mk .dv-tabs a`
- `pages/console/console.css` — `.console .console-tabs`
- `pages/console/console.css` — `.console .console-tabs .console-tab`

### Pages d'accès — 22 en dur

Valeurs : `3px` ×7, `50%` ×4, `4px` ×2, `999px` ×2, `14px` ×1, `5px` ×1, `2px` ×1, `8px` ×1, `10px` ×1, `1px` ×1, `12px` ×1

Fichiers : `pages/auth/auth-illustration.css` 22

### Lecteur — 136 en dur

Valeurs : `999px` ×25, `50%` ×16, `12px` ×14, `16px` ×13, `10px` ×10, `8px` ×9, `3px` ×9, `6px` ×5, `20px` ×4, `2px` ×4, `99px` ×4, `24px` ×4

Fichiers : `player.css` 92, `center.css` 30, `public-page.css` 10, `player-core.css` 4

Contrôles encore en pilule (à passer au jeton de leur famille) :

- `public-page.css` — `.pill`
- `player.css` — `.p-checklist-pill`
- `player.css` — `.p-ba-pill`
- `player.css` — `.p-ba-seg`
- `player.css` — `.p-ba-seg button`
- `player.css` — `.p-sound-btn`
- `center.css` — `.ctr-search`
- `center.css` — `.ctr-tags button`

### Extension — 75 en dur

Valeurs : `12px` ×19, `8px` ×16, `999px` ×13, `3px` ×6, `4px` ×6, `6px` ×4, `20px` ×3, `14px` ×2, `10px` ×2, `50%` ×2, `12px 12px 0 0` ×1, `16px` ×1

Fichiers : `apps/extension/entrypoints/review/style.css` 25, `apps/extension/entrypoints/popup/style.css` 21, `apps/extension/entrypoints/html-review/style.css` 17, `apps/extension/entrypoints/video-review/style.css` 12

Contrôles encore en pilule (à passer au jeton de leur famille) :

- `apps/extension/entrypoints/review/style.css` — `.rv-pill`
- `apps/extension/entrypoints/review/style.css` — `.rv-chip`
- `apps/extension/entrypoints/review/style.css` — `.btn`
- `apps/extension/entrypoints/review/style.css` — `.rv-panel__chip`
- `apps/extension/entrypoints/review/style.css` — `.rv-seg`
- `apps/extension/entrypoints/review/style.css` — `.rv-seg button`
- `apps/extension/entrypoints/popup/style.css` — `.btn`
- `apps/extension/entrypoints/popup/style.css` — `.pill`
- `apps/extension/entrypoints/html-review/style.css` — `.fd-segmented`
- `apps/extension/entrypoints/html-review/style.css` — `.fd-segmented > button`

