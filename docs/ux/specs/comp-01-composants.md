# COMP-01 : aucun contrôle natif, des composants de la marque

> Décision du client (21/11, structurante) : **aucun contrôle natif visible dans l'app**. Aujourd'hui, seul le déclencheur des listes est habillé (`select.css`) ; la liste ouverte reste celle du système (menu gris de macOS, liste de Windows). Inventaire du chef (apps/web et lecteur) :
>
> | Contrôle natif | Nombre |
> |---|---|
> | `<select>` | 69 |
> | date et heure | 2 |
> | couleur | 6 |
> | fichier | 16 |
> | `range` | 5 |
>
> **Maquette** : `maquettes/refonte/modales-composants.html`, vue « Composants (COMP-01) ». Captures dans `img/modales-composants/comp-{clair,sombre}.png`.
>
> **Ordre de la file** : juste après NAV-02 et §11 (les Paramètres l'utilisent en premier). Le reste de l'app migre dans le même lot.

Tous les composants vivent dans `packages/ui`. Leur popover est le même pour tous :
- rayon de 10 px, filet de 1 px `border`, ombre `--fd-shadow-md`, padding de 4 px, fond `surface` ;
- **positionnement** sous le déclencheur avec 4 px d'écart. S'il n'y a pas de place en dessous, il passe au-dessus, puis se cale dans la fenêtre. Il n'est jamais coupé par un conteneur à `overflow: hidden` : il est rendu dans un portail ;
- animation MOTION-01 : `scale(.96)` vers 1 et fondu, 200 ms.

## 1. Select (choix unique)

- **Déclencheur** :
  - 40 px de haut, apparence de champ (bordure `border-field`, rayon de 10 px), valeur en 14 px, `ChevronDown` de 16 px à droite ;
  - ouvert : bordure `primary` et halo de 3 px à 18 % ;
  - sans valeur : texte d'invite en `text-subtle`.
- **Liste** :
  - hauteur de 320 px au plus, puis défilement vertical ;
  - largeur au moins égale à celle du déclencheur.
- **Option** :
  - 36 px au moins, padding de 7 × 10 px, rayon de 8 px ;
  - libellé en 14 px, et **description facultative** en 12 px `text-muted` sous le libellé ;
  - option sélectionnée : `Check` de 16 px en `primary` à droite, libellé en 600 ;
  - option active (clavier ou survol) : fond `nav-active` ;
  - désactivée : `text-subtle`, avec `aria-disabled`.
- **Recherche** : champ de 36 px en tête de liste dès qu'il y a **plus de 8 options**. Il filtre au fil de la frappe, et affiche « Aucun résultat » s'il ne trouve rien.
- **Groupes** : titre en 11 px 600, capitales, `text-muted` (`role="group"` et `aria-labelledby`).
- **Clavier et ARIA** (APG « select-only combobox ») :
  - déclencheur en `role="combobox"`, avec `aria-expanded`, `aria-controls` et `aria-activedescendant` ;
  - liste en `role="listbox"`, options en `role="option"` avec `aria-selected` ;
  - Entrée, Espace ou Alt + Flèche bas ouvrent ;
  - Flèches haut et bas, Début et Fin déplacent l'option active ;
  - la saisie de lettres va à l'option qui commence ainsi (500 ms de mémoire) ;
  - Entrée valide, Échap ferme sans changer, Tab valide et passe au champ suivant ;
  - le focus revient au déclencheur à la fermeture.
- **Formulaire** : un `<input type="hidden" name>` porte la valeur. `onChange` garde la même signature que le `<select>` actuel, pour une migration mécanique.

## 2. Multi-sélection à puces (étiquettes, adresses e-mail)

- **Champ unique** de 40 px qui grandit sur plusieurs lignes. Puces de 28 px (fond `#EEF0F3` en clair, `#252B33` en sombre), puis un bouton « Retirer {valeur} » (`X` de 16 px).
- **Saisie libre** (adresses) : une puce se crée avec Entrée, la virgule, le point-virgule, l'espace, au collage (découpage d'une liste) ou en quittant le champ. Une valeur invalide donne une puce `danger` à 12 %, avec un message sous le champ.
- **Choix dans une liste** (étiquettes) : le même popover que le Select, avec une case cochée par option. La liste reste ouverte après chaque choix.
- **Clavier** :
  - Retour arrière dans le champ vide sélectionne la dernière puce, et un second Retour arrière la retire ;
  - Flèches gauche et droite naviguent entre les puces.
- Chaque ajout et chaque retrait sont annoncés en `aria-live` (« eve@example.com ajoutée »).

## 3. Date et heure

- **Déclencheur** : icône `CalendarDays` (ou `Clock`), date au format court français (« 21 déc. 2026 »).
- **Calendrier** dans un popover de 280 px :
  - en-tête « décembre 2026 » avec mois précédent et suivant ;
  - jours en grille de 7, la semaine commence le lundi ;
  - jours hors du mois en `text-subtle` ;
  - aujourd'hui cerclé d'un filet, jour choisi en `primary` avec le texte `on-primary` ;
  - bornes min et max : jours désactivés.
- **Saisie au clavier** : le déclencheur accepte aussi la saisie « jj/mm/aaaa ».
- **Clavier dans la grille** (APG « date picker dialog ») :
  - flèches pour le jour, Page haut et bas pour le mois, Début et Fin pour la semaine ;
  - Entrée choisit, Échap ferme.
- **Heure** : un Select de créneaux de 30 min (ou de 15 min selon le contexte), avec saisie libre « hh:mm ».
- Locale `fr-FR` par `Intl.DateTimeFormat`. Aucun `<input type="date|time">` visible.

## 4. Couleur

- **Nuancier de la marque** : 8 pastilles de 24 px (prune, framboise, prune-700, les trois couleurs de la DSIML, encre, blanc). La pastille choisie porte un double anneau (2 px `surface`, puis 2 px `text`). C'est un `radiogroup` : flèches pour se déplacer, Espace pour choisir.
- **Champ hexadécimal** de 180 px, avec un aperçu de 20 px. Saisie validée en direct, et message d'erreur sous le champ.
- **Sélecteur libre** : validé le 22/11, il est affiché directement sous les pastilles dans le même popover (pas de bouton « Autre couleur… » intermédiaire). C'est un sélecteur maison : une zone de teinte et saturation, une barre de teinte, et la valeur en hexadécimal. Tout se règle à la souris et au clavier, avec les flèches.
- **Contraste affiché** sous le champ (« Texte blanc sur cette couleur : 7,4:1 »). Il passe en `danger` sous 4,5:1. On garde la logique actuelle des Styles.

## 5. Fichier

- **Zone de dépôt** :
  - bordure pointillée de 1,5 px `border-field`, rayon de 12 px, padding de 24 px, icône de 24 px ;
  - « **Déposez une image** ou [Choisir un fichier] », puis les formats et la taille maximale ;
  - au survol avec un fichier : bordure `primary` et fond `primary` à 6 %.
- Le **`<input type="file">` reste dans le DOM**, masqué visuellement (classe `sr-only`, jamais `display: none`) et relié au bouton. Le clavier et les lecteurs d'écran gardent le choix natif du système, ce qui est permis : seule la boîte de dialogue du système apparaît.
- **En mode compact** (barre d'outils, ligne de réglage), un simple bouton secondaire avec icône, sans zone de dépôt.
- **Après le choix** : nom du fichier, taille, bouton « Retirer », et progression si l'envoi dure.

## 6. Curseur (range)

- **Piste** de 4 px (`border`), avec la partie remplie en `primary`. **Poignée** de 20 px (fond `surface`, bordure de 2 px `primary`, ombre légère). La valeur s'affiche à droite du libellé.
- **ARIA et clavier** :
  - `role="slider"`, avec `aria-valuemin`, `aria-valuemax`, `aria-valuenow` et un `aria-valuetext` lisible (« 160 % ») ;
  - flèches pour un pas, Page haut et bas pour 10 pas, Début et Fin pour les bornes.
- Focus : anneau **extérieur** de 2 px en `focus`, séparé de la poignée par 2 px de `surface` (`box-shadow: 0 0 0 2px var(--fd-color-surface), 0 0 0 4px var(--fd-color-focus)`). La couleur `focus` étant la même prune que la bordure de la poignée, changer seulement la bordure ne se voit pas (recette du 22/11 : focus invisible, WCAG 2.4.7).

## 7. Cases, radios, interrupteurs

- **Case** : 18 px, rayon de 5 px, bordure de 1,5 px `border-field`. Cochée : fond `primary` et `Check` blanc (noir en sombre, selon `on-primary`). État indéterminé : un trait.
- **Radio** : 18 px, rond. Choisi : bordure `primary` et point central de 8 px.
- **Interrupteur** :
  - 36 × 20 px, piste en `border-field`, et en `primary` quand il est activé ;
  - bouton rond de 16 px ;
  - `role="switch"`.
- **Partout le même composant** : on retire les `accent-color` et les cases du système encore visibles. La cible cliquable fait **24 px au moins**, libellé compris.

## 8. Menus « ⋯ » et popovers

- Même popover que le Select.
- **Entrées de menu** :
  - 36 px, avec une icône de 16 px, le libellé, puis le raccourci en `<kbd>` à droite ;
  - séparateurs de 1 px ;
  - entrée dangereuse en `danger`.
- **ARIA** : `role="menu"` et `role="menuitem"`, flèches pour se déplacer, Échap ferme et rend le focus. Bouton déclencheur avec `aria-haspopup="menu"` et `aria-expanded`.

## 9. e2e `controles-natifs.e2e.cjs`

1. Sur toutes les routes de `APP_PAGES` et `PLAYER_PAGES`, en clair et en sombre : **aucun** `<select>`, `<input type="date|time|datetime-local|month|week|color|range">` visible (taille supérieure à 0, hors `sr-only`), hors des internes d'un composant marqués `data-comp-internal`.
2. Les `<input type="file">` sont tous en `sr-only` et reliés à un bouton visible (`aria-controls` ou label).
3. Chaque Select, menu, calendrier et nuancier est **ouvert**, puis axe tourne sur l'état ouvert (0 violation serious ou critical) :
   - rôles et `aria-expanded` ;
   - `aria-activedescendant` valide ;
   - focus revenu au déclencheur après Échap.
4. **Clavier du Select** : ouverture par Entrée, Flèche bas deux fois, Entrée ; valeur changée ; `aria-expanded` repasse à false.
5. **Positionnement** : un Select ouvert en bas de la fenêtre s'ouvre au-dessus, entièrement visible.

## 10. Recette UX

- Captures en clair et en sombre de chaque composant, fermé, ouvert, au focus, en erreur et désactivé.
- Mesures : 40 px, 36 px, rayon, ombre.
- Contrastes : texte des options à 4,5:1, état sélectionné non porté par la seule couleur (coche, graisse).
- Défilement horizontal (§18.7) et espacements (§18.6) sur les pages migrées.

### 10.1 Recette du 22/11 (dev-mvp 0f9f638)

- **Date** (Partager > Accès) : conforme. Champ de 40 px, popover de 280 px, semaine du lundi, aujourd'hui cerclé, libellé complet du jour (« mercredi 30 décembre 2026 »), flèches et Page bas, Échap rend le focus au bouton. **À reprendre** : le mois s'écrit en minuscule (« novembre 2026 », pas « Novembre 2026 »).
- **Heure** : conforme. Champ de 40 px, liste de 48 créneaux de 30 min, options de 36 px.
- **Curseur** (seuil du quiz) : piste de 4 px, poignée de 20 px, `role="slider"`, `aria-valuetext` « 70 % », flèches, Page haut, Début et Fin conformes. **À reprendre** : le focus ne se voit pas (voir §6).
- **Couleur** (Thème et couleurs) : conforme. 8 pastilles en `radiogroup`, double anneau sur la pastille choisie, sélecteur libre affiché directement (voir §4), contraste affiché.
- Aucun contrôle natif visible sur ces pages.

## 11. FIELD-01 : une seule grille d'états pour tous les champs (décision du client, 21/11)

> **Décision du client** : **aucun double contour, nulle part**. C'est l'option B du comparatif (`maquettes/refonte/img/field-options/README.md`), **sans halo**. La première version (trait de 2 px plus un halo de 3 px) est abandonnée.
>
> **Portée** : input, textarea, déclencheur de Select, champ à puces, date et heure, couleur, recherche, champs à préfixe ou suffixe, dans `packages/ui`, en clair et en sombre.
>
> **Maquette** : vue « Champs (FIELD-01) » de `maquettes/refonte/modales-composants.html`. Captures dans `img/modales-composants/champs-{clair,sombre}.png`.

### 11.1 Grille d'états des champs

| État | Bordure | `box-shadow` | Fond et texte |
|---|---|---|---|
| Repos | 1 px `--fd-color-border-field` (#8A94A2 en clair, 3,07:1 ; #5E6978 en sombre, 3,16:1) | aucune | `surface`, `text` ; invite en `text-subtle` |
| Survol | 1 px `--fd-color-border-field-hover` (#5E6978 en clair, 5,6:1 ; #7A8494 en sombre, 4,7:1) | aucune | inchangé |
| **Focus** (souris **et** clavier) | 1 px `--fd-color-primary` (#A3195B en clair, 7,4:1 ; #CF86A9 en sombre, 6,4:1) | **`inset 0 0 0 1px var(--fd-color-primary)`** : un trait de 2 px, sans décaler la mise en page | inchangé (**pas de teinte au focus**) |
| Rempli | comme au repos | aucune | aucune teinte |
| **Rempli par le navigateur** | 1 px `primary` | `inset 0 0 0 1000px var(--fd-color-tint)` (fond, voir §11.2) | fond **`--fd-color-tint`** : #FBF0F5 (prune-50) en clair, #2A1A23 en sombre ; texte `text` (18,0:1 et 15,1:1) |
| Invalide | 1 px **`--fd-color-danger`** (nouveau rouge : #C42B1C en clair, 5,7:1 ; #F97066 en sombre, 6,3:1) | aucune | fond `surface`. Message de 13 px `danger` **avec l'icône `CircleAlert`** de 16 px, 6 px sous le champ. `aria-invalid="true"` et `aria-describedby` |
| Invalide, au focus | 1 px `danger` | `inset 0 0 0 1px var(--fd-color-danger)` | comme ci-dessus |
| Désactivé | 1 px `--fd-color-border` | aucune | fond `surface-sunken`, texte `text-muted` (lisible, 4,5:1 au moins) |
| Lecture seule | 1 px `border-field` | focus comme ci-dessus | fond `surface-sunken`, texte `text` |

- **Interdits sur les champs** :
  - tout `outline`, à tous les états (`outline: none`) ;
  - tout `box-shadow` **extérieur** (halo, anneau, double contour, décalage) ;
  - tout fond rose ou rouge pâle (en erreur, le fond reste `surface`).
- **Indicateur de focus** (WCAG 2.4.7 et 1.4.11) : le trait prune de 2 px, à 7,4:1 contre le fond en clair et 6,4:1 en sombre. L'épaisseur passe de 1 à 2 px et la couleur change, donc la couleur n'est pas le seul indice.
- **Transition** : `border-color` et `box-shadow` en `--fd-motion-duration-fast` (120 ms). Instantané en mouvement réduit.

### 11.2 Remplissage automatique du navigateur

On ne neutralise **pas** le remplissage automatique vers `surface` : on le teinte aux couleurs de la marque.

```css
.fd-field input:-webkit-autofill,
.fd-field input:-webkit-autofill:hover,
.fd-field input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--fd-color-text);
  caret-color: var(--fd-color-text);
  border-color: var(--fd-color-primary);
  box-shadow: inset 0 0 0 1000px var(--fd-color-tint);
  transition: background-color 600000s 0s; /* le fond jaune ou bleu du navigateur ne s'affiche jamais */
}
.fd-field input:-webkit-autofill:focus {
  box-shadow: inset 0 0 0 1px var(--fd-color-primary), inset 0 0 0 1000px var(--fd-color-tint);
}
```

Dans un groupe (§11.3), c'est le groupe qui prend le fond teinté et la bordure prune, avec `:has(input:-webkit-autofill)`.

### 11.3 Champs composés (préfixe, suffixe, icône, puces, bouton intégré)

- **Le groupe porte la bordure et le focus**, avec `:focus-within`. L'`<input>` intérieur n'a ni bordure, ni ombre, ni outline.
- Un bouton intégré (« + Variable », effacer) garde son propre focus clavier (§11.4).

### 11.4 Boutons, liens, onglets et éléments de navigation : aucun contour ajouté (révision du 21/11)

- **Au clavier seulement** (`:focus-visible`). Au clic souris, rien n'apparaît. **Jamais d'`outline`, de décalage ni d'ombre extérieure.**
- **Bouton secondaire et onglet** : c'est **leur propre bordure** qui passe en prune, sur 2 px (`border-color: primary` + `box-shadow: inset 0 0 0 1px primary`). Rien n'est ajouté à l'extérieur. Un onglet sans bordure au repos garde une bordure transparente de 1 px, pour ne pas bouger au focus.
  - Indicateur : prune sur blanc à 7,4:1 ; contre la bordure grise au repos, 2,4:1.
- **Bouton primaire** (fond prune), **décision du chef du 21/11** :
  - le fond **s'assombrit** (`prune-800` #67123B en clair, `prune-200` #E3A9C4 en sombre) ;
  - **et** un trait blanc intérieur de 2 px (`border-color: surface` + `inset 0 0 0 1px surface`) ;
  - la pastille garde sa forme, sans rien à l'extérieur ;
  - indicateur : trait blanc sur le fond assombri à 12,2:1 ; écart entre les fonds 1,65:1, renforcé par le trait.
  - Variante demandée par le chef, **trait blanc intérieur seul** sur le fond prune d'origine : conforme sur le papier (7,4:1), mais sur un fond de page blanc, le trait se confond avec la page. On croit voir le bouton rétrécir de 2 px, et le focus est **à peine perceptible** (captures `champs-*.png`, cellule « Bouton primaire »). Elle est déconseillée au regard de 2.4.7.
- **Bouton destructif** : même règle que le primaire, avec un fond assombri en rouge (#9A2216 en clair).
- **Lien** :
  - soulignement prune de **2 px** (`text-decoration-thickness: 2px`, `text-underline-offset: 3px`) ;
  - fond `--fd-color-tint` (#FBF0F5 en clair, #2A1A23 en sombre), avec un rayon de 4 px et un padding de 0 × 2 px ;
  - aucun cadre ;
  - lien prune sur le fond teinté : 6,6:1 en clair, 6,0:1 en sombre.
- **Éléments de navigation et options de liste** (fond `nav-active` au survol) : même principe que l'onglet, avec un trait prune intérieur de 2 px.

### 11.5 Jetons

- **Nouveaux** :
  - `--fd-color-border-field-hover` : #5E6978 en clair, #7A8494 en sombre ;
  - `--fd-color-tint` : #FBF0F5 en clair, #2A1A23 en sombre.
- **Modifiés** :
  - `--fd-color-focus` passe du bleu à la prune : #A3195B en clair, #CF86A9 en sombre ;
  - **`--fd-color-danger`** passe à **#C42B1C** en clair et **#F97066** en sombre, **dans toute l'app**, boutons destructifs compris (texte blanc sur #C42B1C : 5,7:1). On met aussi à jour les dérivés (`danger-soft`, bordures d'alerte, `--fd-shadow-focus-danger` qui est supprimé).
- **Retirés** : `--fd-shadow-focus` et `--fd-shadow-focus-danger`, avec leurs utilisations dans `base.css` (l. 50 et 235) et dans les CSS de page.

### 11.6 e2e `champs-focus.e2e.cjs`

Pour chaque champ visible de `APP_PAGES` (input, textarea, combobox, champ à puces, groupe à préfixe), en clair et en sombre :

1. **Focus clavier, puis souris** :
   - l'élément qui porte la bordure (le champ, ou le groupe en `:focus-within`) a une `border-color` égale à `--fd-color-primary` ;
   - son `box-shadow` contient **uniquement** l'anneau `inset` de 1 px prune, et **aucune ombre extérieure** ;
   - son `outline-style` vaut `none` ;
   - aucun ancêtre jusqu'au formulaire ne porte d'`outline` ni de `box-shadow` de focus ;
   - l'`<input>` intérieur d'un groupe n'a ni bordure, ni ombre, ni outline ;
   - le fond ne change pas au focus.
2. **Repos** : bordure `border-field`, sans ombre. **Survol** : bordure `border-field-hover`.
3. **Invalide** :
   - `aria-invalid="true"` avec une bordure `danger` (#C42B1C ou #F97066) ;
   - message relié par `aria-describedby`, qui contient un `svg.lucide-circle-alert` ;
   - fond égal à `surface`.
4. **Remplissage automatique** :
   - la feuille de styles contient la règle `:-webkit-autofill` avec un `box-shadow` inset de la couleur `--fd-color-tint`, et une bordure `primary` (contrôle statique) ;
   - sur la connexion, un champ rempli par l'autofill de Chromium (quand l'API est disponible) a un fond calculé égal à `tint`.
5. **Boutons, liens et onglets** au clavier (`Tab`) :
   - `outline-style` vaut `none` et il n'y a aucune ombre extérieure ;
   - secondaire et onglet : `border-color` prune et `box-shadow: inset 0 0 0 1px` prune ;
   - primaire et destructif : fond assombri (`prune-800` / `prune-200`, ou #9A2216), `border-color` `surface` et `inset 0 0 0 1px` `surface` ;
   - lien : `text-decoration-thickness` de 2 px et fond `tint` ;
   - au clic souris, aucun de ces indicateurs.
6. **Grep statique** : plus aucune occurrence de `--fd-shadow-focus`, `#1f7fb6`, `#51abdd`, ni de l'ancien danger `#d60b52` ou `#f07ca2`, dans `packages/ui` et `apps/*/src`.

## 12. NAV-03 : composants de navigation (directive du client, 21/11)

> **Directive du client, valable pour toute l'app** : rien ne doit être « posé à l'ancienne ». Il donne deux exemples. Le fil d'Ariane « Paramètres > Espace > Équipe », en liens soulignés suivis de texte brut, avec un grand H1 qui le répète. Et les liens « Retour » en texte nu (pages légales, invitation, éditeur, partage…).
>
> **Méthode réaffirmée** : aucun écran n'est codé sans sa maquette, et le dev la reproduit **à l'identique** (structure, espacements, composants, textes). La recette UX compare la maquette et l'app en superposant les captures, et tout écart vaut « à reprendre ».

Tous ces composants vivent dans `packages/ui`.

### 12.1 PageHeader

- **Barre fixe** (`position: sticky; top: 0`) de **56 px**, sur `--fd-color-content-bg`, avec un filet de 1 px `border` en bas et un padding de 0 × 32 px (16 px sous 768 px).
- **À gauche**, dans cet ordre : un `BackButton` s'il y en a un (§12.3), puis le `Breadcrumb` (§12.2), ou le titre de la page quand il n'y a pas de parent.
- **À droite** : les actions de la page (32 à 40 px), avec un gap de 8 px. Un bouton primaire au plus.
- **Outils globaux, tout à droite** (décision UX du 21/11, question du dev sur le lot 1) : un filet vertical de 1 × 20 px `border`, puis **Aide** (`CircleQuestionMark`) et **Notifications** (`Bell`, avec la pastille de non-lus), en boutons icône ghost de **32 px** et icônes de 16 px. Noms accessibles : « Aide » et « Notifications, n non lues ». Ils sont dans **chaque** PageHeader de l'app (pas dans l'éditeur, qui garde sa barre propre, ni dans le lecteur). Sous 768 px, ils passent dans la barre mobile du haut, à droite, en cibles de 44 px et icônes de 20 px. Ils ne vont pas dans la barre latérale : « Centre d'aide » y reste l'entrée vers la documentation, l'icône Aide ouvre le tiroir d'aide de la page courante.
- **Barre latérale, bouton de repli** : remplacé par NAV-04 (§14, retour client du 22/11). Il n'est plus au-dessus du logo, mais sur la même ligne que lui, à droite.
- **Le titre n'apparaît qu'une fois.** Le dernier élément du fil d'Ariane, ou le titre de la barre, est le `<h1>` de la page, en 14 px 500. **Plus jamais de grand H1** sous un fil d'Ariane qui dit la même chose.
- **Pages sans parent**, comme Démos, Analytics, Apprenants ou Sandbox (premières pages de navigation) :
  - le PageHeader porte le titre en 14 px 600, et les actions de la page ;
  - sous la barre, un **PageTitle** facultatif (§12.4) seulement si la page a besoin d'une phrase d'introduction.

### 12.2 Breadcrumb

- `<nav aria-label="Fil d'Ariane"><ol>`.
- **Éléments parents** : boutons ou liens en 14 px 500 `text-muted`, **sans soulignement**, hauteur de 28 px, padding de 0 × 6 px, rayon de 6 px.
  - Au survol : texte `text` et fond `nav-hover`.
  - Au focus clavier : FIELD-01 §11.4 (trait prune intérieur de 2 px).
- **Séparateur** : `ChevronRight` de 14 px en `text-subtle`, `aria-hidden`, 2 px d'écart.
- **Élément courant** : 14 px 500 `text`, `aria-current="page"`, sans lien. C'est le `<h1>`.
- **Chemin long** (plus de 3 niveaux, ou largeur insuffisante) : on garde le premier et les deux derniers niveaux. Au milieu, un bouton « … » ouvre un menu COMP-01 avec les niveaux masqués. Un libellé trop long est tronqué par une ellipse, et le libellé complet est donné par `title`.
- **Sous 768 px** : seul le parent direct reste, sous la forme d'un BackButton « ‹ Parent ». L'élément courant passe en titre de la barre.

### 12.3 BackButton

- **Bouton ghost** de 32 px de haut, padding de 0 × 10 px, rayon de 8 px. Icône `ChevronLeft` de 16 px, puis un **libellé court** : la destination (« Démos », « Paramètres », « Connexion », « Notifications »). Jamais « Retour » seul.
- **Couleurs** : texte `text-muted`. Au survol : texte `text` et fond `nav-hover`. Au focus : FIELD-01 §11.4.
- **Placé dans le PageHeader**, ou en tête d'un panneau ou d'un tiroir, dans son en-tête. **Jamais un lien texte nu.**
- **Nom accessible** : « Retour à {destination} » (`aria-label`), et le libellé visible reste court.

### 12.4 PageTitle et titres de section

- **PageTitle**, seulement s'il apporte une phrase utile : titre en 24 px 700 et sous-titre en 14 px `text-muted`. 32 px sous le PageHeader, 24 px avant le contenu.
- **Titre de section** : 16 px 600 et sous-titre en 13 px `text-muted`, avec l'action de la section à droite, puis un filet de 1 px. 16 px sous le texte, 32 px entre deux sections (§11.2 des retours client).
- Plus de titres en 32 px 800 dans l'app, sauf sur les pages d'authentification.

### 12.5 Liens dans le texte

- Un lien souligné n'existe que **dans une phrase** (« Contactez le support », « En savoir plus »). Dans ce cas : soulignement de 1 px, prune, et focus FIELD-01 (soulignement de 2 px et fond teinté).
- **Toute navigation hors phrase** (retour, aller à, ouvrir) prend un BackButton, un bouton ghost ou un bouton secondaire.

### 12.6 Inventaire des pages (app et lecteur)

| Route | PageHeader cible |
|---|---|
| `/demos` | titre « Démos » ; actions : recherche, Nouvelle démo. Dossier ouvert : Breadcrumb « Démos › {dossier} » (remplace `.demos-crumb`) |
| `/sandbox` | titre « Sandbox » ; action : Nouveau sandbox |
| `/demos/:id/edit` | en-tête de l'éditeur (P2-2) : BackButton « Démos », titre modifiable, onglets au centre, actions à droite |
| `/demos/:id/quiz` | BackButton « Éditeur », titre « Quiz », action Enregistrer |
| `/demos/:id/share` | devient la modale Partager (P1-3), plus de page |
| `/demos/:id/distribute` | modale Diffuser (MODAL-01), plus de page |
| `/demos/:id/analytics` | Breadcrumb « Analytics › {démo} » ; actions : période, Éditeur (bouton secondaire, remplace le lien `share.backToEditor`), Exporter |
| `/demos/:id/present` et `/present/:id/screen` | barre du présentateur : BackButton « Éditeur », titre de la démo |
| `/analytics` | titre « Analytics » ; onglets sous la barre ; actions : période, Exporter |
| `/leads` | titre « Leads » ; action : Exporter |
| `/learners` | titre « Apprenants » ; actions : Importer, Ajouter |
| `/center` | titre « Centre de formation » |
| `/settings/*` (16 routes) | Breadcrumb « {Groupe} › {Page} » (le groupe est cliquable : Espace, Marque, Contenu, Connexions, Mon compte). Plus de « Paramètres » en tête : la colonne des Paramètres le dit déjà. Actions de la page à droite (NAV-02 §11.7.3) |
| `/settings/integrations/:id`, `/settings/integrations/webhooks` | Breadcrumb « Connexions › Intégrations › {nom} ». Remplace le lien `integrations.backGeneral` |
| `/settings/brand/page` | Breadcrumb « Marque › Page publique » |
| `/onboarding` | barre de l'onboarding : logo, progression, « Passer ». BackButton « Étape précédente » à partir de l'étape 2 (remplace `onboarding.back`) |
| `/nouveautes` | titre « Nouveautés » |
| `/console/*` | titre « Console » et onglets ; BackButton « App » (remplace `console.back`) |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | pages d'authentification : logo (LOGO-01). Mot de passe oublié : BackButton « Connexion » en haut du formulaire (remplace `auth.backToLogin`) |
| `/invite/:token` | page d'invitation : logo, puis BackButton « Connexion » si on refuse l'invitation |
| `/legal/:doc` et `/legal/*.html` | PageHeader : logo compact à gauche, BackButton « TutoClick » (remplace `legal.back`), titre du document. Sommaire à gauche à partir de 1024 px |
| `/unsubscribe/:token`, `/t` | page simple : logo, puis un bouton secondaire « Ouvrir TutoClick » |
| **Lecteur** `/d/:id` | barre du lecteur inchangée (pas de navigation d'app). Écrans d'accès : bouton secondaire, sans lien nu |

### 12.7 Liens texte servant à naviguer, et leur remplacement

| Fichier (`apps/web/src/…`) | Lien actuel | Remplacement |
|---|---|---|
| `pages/settings/SettingsShell.tsx` (l. 95) | fil d'Ariane `.st-crumb` souligné, avec un grand H1 dessous | PageHeader + Breadcrumb (§12.1 et §12.2), sans grand H1 |
| `pages/demos/DemosPage.tsx` (l. 524) | `.demos-crumb` | Breadcrumb |
| `pages/editor/EditorPage.tsx` (l. 748), `EditorSkeleton.tsx` (l. 62), écran de chargement (l. 500) | « Retour aux démos » | BackButton « Démos » |
| `pages/editor/quiz/QuizEditorPage.tsx` (l. 58 et 84) | « Retour » | BackButton « Éditeur » |
| `pages/analytics/DemoAnalyticsPage.tsx` (l. 195 et 215) | « Retour », « Éditeur » | Breadcrumb, et bouton secondaire « Éditeur » dans les actions |
| `pages/share/SharePage.tsx` | « Éditeur » (`share.backToEditor`) | disparaît avec la modale Partager |
| `pages/auth/ForgotPassword.tsx` (l. 47) | « Retour à la connexion » | BackButton « Connexion » |
| `pages/auth/LegalSoon.tsx` (l. 16) et pages légales | « Retour » | BackButton « TutoClick » dans le PageHeader |
| `pages/Onboarding.tsx` (l. 518) | « Retour » | BackButton « Étape précédente » |
| `pages/console/ConsolePage.tsx` (l. 90) | « Retour à l'app » | BackButton « App » |
| `pages/settings/integrations/IntegrationsPage.tsx` (l. 95), `WebhooksPage.tsx` (l. 77) | « Retour » vers les intégrations | Breadcrumb |
| `components/notifications/NotificationBell.tsx` (l. 290) | « Retour aux notifications » | BackButton « Notifications » dans l'en-tête du tiroir |
| `help/HelpDrawer.tsx` (l. 200) | « Retour » | BackButton « Aide » dans l'en-tête du tiroir |
| `pages/editor/panels/*Panel.tsx` (Hotspot, Blur, Form, GuideBubble) | « Étape » (`editor.backToStep`) | BackButton « Étape » dans l'en-tête du panneau |
| `pages/demos/NewDemoDialog.tsx` (l. 316) | « Retour » (étape précédente de la modale) | bouton secondaire « Précédent » dans le pied MODAL-01 |
| Page d'invitation (`/invite/:token`) | lien « Retour » | BackButton « Connexion » |

Le dev complète la liste avec tout `<a>` ou `<Link>` hors d'une phrase qui sert à revenir en arrière.

### 12.8 e2e `navigation.e2e.cjs`

1. **Chaque route** de `APP_PAGES` :
   - un seul `<h1>` ;
   - s'il y a un `nav[aria-label="Fil d'Ariane"]`, son dernier élément porte `aria-current="page"` et **est** le `<h1>` (ou le contient) ;
   - aucun autre texte de titre identique en 24 px ou plus sur la page.
2. **PageHeader** : un `.fd-page-header` fixe de 56 px, avec un filet en bas.
3. **Aucun lien de navigation nu** : tout `<a>` ou `[role=link]` hors d'un `p`, `li` de texte ou `td`, dont le texte commence par « Retour » ou vaut un nom de page, est un échec. Ces éléments doivent être des `.fd-back` ou des boutons.
4. **Breadcrumb** : `text-decoration-line` vaut `none` sur les éléments parents, et un `ChevronRight` de 14 px sert de séparateur.
5. **À 390 px** : le Breadcrumb est réduit à un BackButton « ‹ Parent ».

### 12.9 Maquettes écran par écran (ordre des lots)

Chaque écran a sa maquette, dans le nouveau système (NAV-02, COMP-01, FIELD-01, MODAL-01 et PageHeader), en clair et en sombre, à 1440 et 390 px. Le chef la valide **avant** le dev. Ordre des lots :

1. Paramètres (toutes les pages)
2. Démos et Dossiers
3. Éditeur
4. Partager et Diffuser
5. Analytics
6. Apprenants et Parcours
7. Pages d'authentification et pages légales
8. Lecteur


## 13. ALIGN-01 : un seul bord droit par ligne de réglage (retour client du 22/11)

Le client veut que tout commence et finisse au même endroit, bien calé. Sur la page Profil en ligne, les champs, les listes, les segmentés, les interrupteurs et les boutons s'arrêtaient chacun à un endroit différent.

### 13.1 Règle

- Une ligne de réglage (libellé et aide à gauche, contrôle à droite) a **un seul bord droit : celui de son filet**. La colonne de contrôle commence à une abscisse unique (40 % de la ligne + 24 px, comme aujourd'hui) et **finit exactement à la fin du filet**. Aucun `max-width` sur la colonne.
- **Prennent toute la colonne** : champs texte, listes (Select, y compris les courtes : Langue, Durée, Fuseau), champ couleur (pastille + hexadécimal), jauges, segmentés (segments de largeur égale), zones de dépôt, groupe « champ + bouton » (adresse avec copie, ajout de domaine), blocs de code.
- **Se calent à droite, sur la fin du filet** : interrupteur, bouton d'action seul (« Mettre à jour le mot de passe », « Télécharger (.zip) », « Renouveler »), valeur texte non modifiable (« 12 mois », « 365 jours »), état avec son bouton (« Actif » + « Désactiver »), groupe avatar + bouton (photo, logo).
- **Deux champs côte à côte** (nouveau mot de passe et confirmation) : 50/50 de la colonne, 12 px d'écart, le second finit sur le filet.
- **Listes de choix** (radios, cases, pastilles d'événements, puces de domaines) : elles commencent au début de la colonne, ce sont des contenus ; leurs groupes d'ajout finissent sur le filet.
- **En-tête de section** : ses boutons (« Demander plus à la DSI », « Nouveau style ») finissent sur la fin du filet de la section.
- **Zone de danger** : le cadre va du début à la fin du filet ; son bouton finit à 16 px de son bord droit.
- Sous 768 px : la colonne passe sous le libellé et prend toute la largeur ; interrupteurs et valeurs restent à droite, sur la même ligne que le libellé.

### 13.2 Contrôle automatique

Ajouter à l'e2e d'espacements (§18.6) : pour chaque ligne de réglage des 14 pages des Paramètres et du détail d'un webhook, à 1440 et à 1024 px, **le bord droit du dernier contrôle est égal au bord droit du filet, à ±1 px**. Seules les listes de choix (radios, cases, pastilles) sont exemptées. Même contrôle pour les boutons d'en-tête de section.

### 13.3 Maquettes

Lots 1, 2, 5 et 6 refaits avec cette règle (captures du 22/11). Exemple : `lot1-parametres/profil-clair-1440`.

## 14. NAV-04 : en-tête de la barre latérale (retour client du 22/11)

Le bouton de repli, seul au-dessus du logo, créait un grand vide en tête de la barre et de la colonne des Paramètres.

- **Une ligne en tête** : le logo complet à gauche (avec « Porté par la DSIML », 184 px de large dans une barre de 256 px), le bouton de repli à droite (32 px, icône panneau, 20 px trait 2,1, `aria-label="Replier la barre latérale"`, `aria-expanded="true"`), centrés verticalement. Marges de la barre : 16 px.
- **Un filet dessous** (1 px `border`, 16 px au-dessus et 16 px au-dessous), comme celui au-dessus du bloc profil, puis le sélecteur d'espace.
- **Colonne secondaire** (Paramètres) : elle commence en haut, avec 16 px de marge. « ESPACE » est à la même hauteur que le haut du logo, sans vide en tête. La colonne Dossiers garde son en-tête (« Dossiers », bascule) en haut, elle aussi.
- **Barre repliée** (rail de 64 px) : seul le bouton de dépli en tête, centré (`aria-label="Déplier la barre latérale"`, `aria-expanded="false"`), le filet dessous, puis les icônes de navigation. Pas de logo dans le rail : il revient quand on déplie.
- Sous 1 024 px : inchangé (barre mobile).
- Mesures de la maquette (lot 1, 1440) : logo de 184 × 60 à x 16, y 16 ; bouton à x 208, y 30 ; sélecteur d'espace à y 111 ; « ESPACE » à y 16.
- **Pas de dépliage au survol** (correction du client, 22/11, qui remplace la règle du survol validée plus tôt) : le survol du rail ne l'ouvre plus. La barre a deux états seulement : **repliée** (rail de 64 px) ou **dépliée**, épinglée, de 256 px. Elle ne passe de l'un à l'autre que par le bouton (clic, Entrée ou Espace). L'état est mémorisé. Dans le rail, chaque icône garde son infobulle (L44) : c'est elle, et non une barre dépliée, qui donne le nom au survol.
- **Pastille de l'espace dans le rail** : elle reste, sous le filet, au-dessus des icônes de navigation (32 px, son infobulle donne le nom de l'espace).
- Nom du bouton : « Replier la barre latérale » / « Déplier la barre latérale », avec `aria-expanded` (plus d'`aria-pressed`).


### 14 bis. Rail replié : le logo en tête, qui devient « Déplier » au survol (retour client du 22/11)

Le client veut que le rail replié garde la marque en tête, comme dans l'outil de référence (Guideflow) : le logo, puis le bouton « Déplier » au survol.

- **Au repos** : en tête du rail, à la place du bouton nu, le **symbole TutoClick** tel quel (carré prune avec la flèche, `symbole-tutoclick.svg`) en **32 × 32 px**, la même taille que la pastille de l'espace dessous. Il est à x 16, y 30, comme le bouton d'aujourd'hui. Il est dessiné dans le bouton, ce n'est pas une image à part.
- **Au survol et au focus clavier** : le symbole laisse place, au même endroit et à la même taille, au bouton « Déplier » : carré de 32 px, rayon 8, fond prune **#A3195B dans les deux thèmes** (la couleur du symbole, pas le jeton `primary`, trop pâle en sombre), icône panneau de 20 px blanche. Au survol, fond #85164B, et l'infobulle « Déplier la barre latérale » à droite. Au focus clavier : anneau extérieur `0 0 0 2px nav-bg, 0 0 0 4px focus` (COMP-01 §6).
- **Transition** (MOTION-01) : fondu croisé des opacités en 150 ms `ease-out`, sans mouvement ni changement de taille. Si `prefers-reduced-motion`, la bascule est immédiate.
- **Un seul bouton** : c'est le même `<button>` dans les trois états, avec `aria-label="Déplier la barre latérale"` et `aria-expanded="false"`. Le symbole est décoratif (`alt=""` ou `aria-hidden`). Au clic : la barre se déplie et s'épingle, comme aujourd'hui.
- **Au clic sur « Déplier »** : la barre s'ouvre (256 px, fondu de la largeur en 200 ms, MOTION-01) et reste ouverte. Elle montre alors le logo complet à gauche (lien vers Démos, §14 ter) et le bouton « Replier » à droite, sur la même ligne. **On ne voit jamais en même temps le bouton prune « Déplier » et le logo complet.** Au clic sur « Replier », retour au rail. Le focus reste sur le bouton, qui change de nom et d'`aria-expanded`.
- Dessous, rien ne change : le filet (y 92), la pastille de l'espace (y 111), puis la navigation. **La barre dépliée et épinglée ne change pas** : logo complet à gauche, bouton « Replier » à droite.
- Maquettes : `lot1-parametres/rail-repos`, `rail-survol` et `rail-focus`, à 1440 px, en clair et en sombre.
- e2e (`barre-laterale-rail.e2e.cjs`) : le survol du rail pendant 1 s ne change pas sa largeur (64 px) ; dans le rail, le bouton en tête a le nom « Déplier la barre latérale » et `aria-expanded="false"` ; après un clic, la barre fait 256 px, le logo complet est visible, le bouton s'appelle « Replier la barre latérale » avec `aria-expanded="true"`, et aucun élément prune « Déplier » n'est visible ; au repos, le symbole est visible (opacité 1) ; au survol et au focus, l'icône panneau est visible et le symbole à l'opacité 0 ; position 16, 30, 32 × 32 dans les trois états.

### 14 ter. Le logo ramène à l'accueil (décision du chef, 22/11)

- **Barre dépliée** : le logo complet (184 px) est un **lien** vers l'accueil, la page Démos (`#/`), nommé « Démos, accueil de TutoClick » (`<a aria-label="Démos, accueil de TutoClick">` ; l'image dedans a `alt=""`). Au survol, curseur main, sans fond ni soulignement. Au focus clavier, l'anneau extérieur COMP-01 §6 autour du logo, avec un rayon de 8. Le bouton « Replier » à côté ne change pas. Sur la page Démos elle-même, le lien reste actif (il revient à la vue par défaut, filtres conservés), sans `aria-current`.
- **Rail replié** (§14 bis) : en tête, le bouton « Déplier », qui ne mène pas à l'accueil. Depuis le rail, l'accueil s'atteint par l'entrée Démos, comme dans Guideflow.
- **Hors coque, quand le logo est affiché** (onboarding, pages légales, connexion) : le logo mène à l'accueil si l'utilisateur est connecté, sinon à la page de connexion. Même nom accessible et même focus. Exception : pendant l'onboarding, en cours de création de l'espace, le logo n'est pas un lien, pour ne pas faire quitter l'étape par erreur.
- **Mobile** (barre mobile, symbole de 32 px) : même règle, le symbole est un lien vers l’accueil, « Démos, accueil de TutoClick ».
- e2e : depuis une page des Paramètres, un clic sur le logo de la barre dépliée mène à `#/` (Démos), et la touche Entrée sur le lien au focus aussi. Le nom accessible est « Démos, accueil de TutoClick ». Dans le rail, le bouton en tête déplie la barre et ne navigue pas.

## 15. COL-01 : seule la barre latérale principale est teintée (retour client du 22/11, révisé)

Le client a corrigé la première décision : « le seul qui aura une couleur différente, c'est la barre du logo ».
- **Seule la barre latérale principale** (logo, Démos, Sandbox, Parcours, Analytics, Apprenants, Paramètres…) garde la teinte de navigation.
- **Tout le reste est sur le blanc de la page** (`surface`) : la colonne Dossiers, la colonne secondaire des Paramètres, le panneau de prise en main ONB-01 et toute colonne à venir. Chacune est séparée du contenu par un **filet de 1 px `border`**.
- Dans ces colonnes blanches, l'entrée active garde son fond `nav-active`, et la carte « étape conseillée » d'ONB-01 prend le fond `tint` (prune à 6 %), sans bordure.
- Conséquence dans l'app : la colonne des Paramètres, aujourd'hui teintée, passe au blanc. La colonne Dossiers reste blanche et gagne son filet.
- Maquettes des lots 1, 2, 5 et 6 refaites le 22/11.

## 16. PAGE-01 : en-tête de page commun à toutes les pages principales (retour client du 22/11)

- Démos, Sandbox, Parcours de formation, Analytics, Apprenants et toute page principale reprennent **exactement la barre des Paramètres** (PageHeader, §12.1) : même hauteur, filet dessous, titre ou fil d'Ariane à gauche (« Démos », « Démos › Formation accueil »), actions à droite (recherche, bouton de prise en main ONB-01, bouton principal), puis Aide et Notifications après leur filet.
- **Le contenu ne répète pas le titre** : plus de grand H1 ni de sous-titre dans le contenu, plus de titre de section qui redit la page (« Toutes les démos »). Le nombre d'éléments est dans le segmenté (« Toutes · 4 »).
- **La barre de filtres est la première ligne du contenu** (statut segmenté, Type, Créé par, Étiquettes, tri, grille / liste), à 32 px sous le PageHeader. Les indicateurs viennent ensuite, puis la liste.
- Dans un dossier ouvert, la phrase d'accès (« Tout l'espace peut voir ce dossier. ») passe dans le bouton « Accès au dossier » du PageHeader (son infobulle et sa fenêtre).
- Maquettes : lot 2 (grille, liste, dossier, menu, nouvelle, vide), refaites le 22/11. Les lots 5 et 6 suivent la même règle quand ils sont repris.

**Précisions du 22/11 (questions du dev)** :
- La 1re ligne du contenu (filtres) est à **32 px sous le PageHeader, soit y 88** à 1440 px. Les maquettes du lot 2 la plaçaient à y 120 : la marge de section s'ajoutait au padding du contenu. Elles sont corrigées (`.wrap > .sec2:first-child { margin-top: 0 }`). Les indicateurs sont à y 140, la grille à y 275 ; dans un dossier et en liste, le tableau ou la grille est à y 140.
- COL-01 dans l'éditeur : la colonne Étapes passe au **fond du contenu**, avec son filet. Dans l'éditeur, rien n'est teinté. La carte choisie garde sa bordure prune ; une carte survolée prend `nav-hover`. Les maquettes du lot 3 la dessinaient déjà ainsi.

### 16.1 PAGE-01 vaut pour toutes les pages (rappel du client, 22/11)

PAGE-01 est une structure **globale**. Toute route de l'app qui s'affiche dans la coque (barre latérale) a, en haut, **une seule barre `.fd-page-header`** :
- 56 px de haut, collée en haut au défilement (`sticky`), fond du contenu, filet en bas ;
- à gauche, le titre (16 px, 600, comme Démos et les maquettes des lots 2, 5 et 6), ou le fil d’Ariane qui se termine par le titre (14 px, 500). Le **statut** de l'objet, s'il y en a un, est un **badge** juste après le titre : `pill` de 24 px, texte 12 px, et infobulle si le statut est abrégé (« Brouillon » : « Brouillon, jamais publié ») ;
- à droite, les actions de la page (32 à 36 px), puis Aide et Notifications, alignées sur le même axe vertical que le titre ;
- en dessous, le contenu. Il n'y a **aucun H1 en dehors de la barre**, ni de grand titre ou de sous-titre dans le contenu. Une phrase d'explication utile va en tête de la section qu'elle concerne.

Les éditeurs (démo, quiz, présentation) utilisent la variante **`.fd-page-header--editor`** : même hauteur et même filet, avec à gauche le retour et le titre modifiable, au centre les onglets éventuels et à droite les actions (lot 3). C'est la même barre, pas une exception.

**Hors coque**, sans barre latérale, donc sans PageHeader : connexion, inscription, mot de passe oublié, réinitialisation, invitation, désinscription, pages légales (lot 7, `AuthLayout`) ; l'onboarding (`/onboarding`, parcours plein écran) ; l'écran public de présentation (`/present/:id/screen`) ; la télécommande (`/t`) ; le lecteur. Ces écrans gardent **un seul H1** (visible ou `sr-only`) et aucune `.fd-page-header`. Le chef valide ou refuse cette liste.

**Relevé du 22/11** (dev-mvp 4d15a25, 1440 px, 30 routes parcourues) :

| Route | Page | Aujourd'hui | À faire |
|---|---|---|---|
| `/` | Démos | `.fd-page-header`, 1 H1 dans la barre | conforme (lot 2) |
| `/sandbox` | Sandbox | idem | conforme |
| `/settings/*` (14 routes, plus le détail d'un webhook) | Paramètres | idem | conforme |
| `/center` | Parcours de formation (Centre) | `page-head` avec grand H1 et sous-titre « Brouillon · jamais publié », actions détachées du titre | barre : « Centre de formation » + badge « Brouillon » ; à droite « Publier le centre ». Une fois publié : badge « Publié » et adresse, puis « Ouvrir » (ExternalLink, ouvre la page publiée) avant « Mettre à jour ». En brouillon, pas de bouton « Ouvrir » (ni grisé) : l'aperçu en direct est déjà sur la page ; libellé « Aperçu » du panneau de droite aligné sur le haut du premier bloc. Maquette `lot6-formation/centre-*` mise à jour |
| `/learners` | Apprenants | `page-head--refonte`, H1 hors barre | barre « Apprenants », avec à côté le compte « 48 apprenants · 3 formations » en 13 px text-muted (maquette `lot6-formation/apprenants-*`) ; actions dans la barre |
| `/learners` (tiroir d'un apprenant) | Détail apprenant | tiroir `l13-drawer` | pas de PageHeader (c'est un tiroir) ; en-tête du tiroir en H2 |
| `/analytics` et `?tab=leads` | Analytics de l'espace | `page-head`, H1 hors barre | barre « Analytics » ; période et export à droite ; onglets en 1re ligne du contenu (PAGE-01 §16) |
| `/demos/:id/analytics` | Analytics d'une démo | `page-head--refonte`, H1 « Démo CRM » | barre en fil d'Ariane « Démos › Démo CRM › Analytics » |
| `/demos/:id/share` | Partager | `page-head`, H1 « Partager la démo » | barre en fil d'Ariane « Démos › Démo CRM › Partager » ; « Copier le lien » à droite |
| `/demos/:id/distribute` | Diffuser | redirige vers l'éditeur (`?distribute=1`, modale) | rien de plus (c'est une modale) |
| `/nouveautes` | Nouveautés | `page-head--refonte`, H1 hors barre | barre « Nouveautés » |
| `/console/*` | Console (admin) | H1 `sr-only` par onglet, pas de barre | variante éditeur, voir §16.2 |
| `/demos/:id/edit` | Éditeur | `ed-bar`, H1 « Éditeur : … » dans la barre | ajouter `.fd-page-header fd-page-header--editor` à `ed-bar` |
| `/demos/:id/quiz` | Éditeur de quiz | `editor-bar`, H1 dans le contenu (`quiz-page__title`) | variante éditeur ; H1 dans la barre |
| `/demos/:id/present` | Présentateur | `pr-head`, H1 `sr-only` | variante éditeur sombre, voir §16.2 |
| Aide, Extension, Nouvelle démo… | fenêtres et menus | modales et popovers | hors PageHeader (MODAL-01) |

Reste à faire : 9 routes (Centre, Apprenants, Analytics ×2, Partager, Nouveautés, Console, Quiz, Présentateur) et la classe de variante sur l'Éditeur.

**e2e `page-header.e2e.cjs`** : sur chaque route de la coque ci-dessus (démo du jeu fictif, 1440 et 390 px), vérifier :
- exactement **une** `.fd-page-header` visible, dont le haut est à 0 (ou 56 px sur mobile, sous la barre mobile) ;
- **aucun `h1`** (visible ou `sr-only`) hors de cette barre ;
- `position: sticky` sur la barre, et un `border-bottom` non nul.

Sur les routes hors coque : aucune `.fd-page-header`, et exactement un `h1`.

### 16.2 Console et Présentateur : variante éditeur de la barre (questions du dev, 22/11)

Ces deux écrans sont hors coque (pas de barre latérale). Ils prennent la **variante éditeur** `.fd-page-header--editor` : 56 px, collante, filet, et une grille de trois colonnes `1fr auto 1fr`.

**Console** (`/console/*`, maquette `page01/console-*`). La barre **remplace** l'en-tête actuel (logo, « Console propriétaire », « Retour à l'app ») et la rangée d'onglets du dessous.
- À gauche : BackButton « Application » (chevron, 32 px, vers `#/`), séparateur vertical de 24 px, puis le titre h1 « Console propriétaire » (14 px, 600). Le sous-titre « Équipe TutoClick · tous les espaces » passe en infobulle du titre.
- Au centre : les onglets en segmenté (Vue d'ensemble, Retours avec son compteur en pastille prune, Backlog, Nouveautés, Équipe et journal). Ce sont des liens, avec `aria-current="page"` sur l'onglet actif.
- À droite : Aide.
- Contenu sur le fond du contenu (COL-01) : plus de fond gris, des cartes à filet. Largeur maximale de 1 232 px, centrée, 32 px de marge.
- Mobile : BackButton icône seule, titre ; les onglets passent sous la barre, sur une ligne qui défile.
- Il n'y a plus de h1 `sr-only` par onglet : le h1 est dans la barre, et chaque onglet ouvre son contenu par un h2.

**Présentateur** (`/demos/:id/present`, maquette `page01/presentateur-sombre-*`). La barre reste **sombre**, car le mode présentation est toujours sombre, quel que soit le thème.
- À gauche : BackButton « Éditeur », séparateur, h1 avec le titre de la démo (14 px, 600), puis « Présentation · étape 1 sur 3 » en 13 px text-muted.
- Au centre : l'état de l'écran public, en pastille (« Écran public fermé » en ambre, avec « Rouvrir » ; « Écran public ouvert » en vert, avec « Fermer »).
- À droite : « Piloter depuis mon téléphone » et « Terminer », deux boutons secondaires de 36 px.
- Dessous, sans changement : la scène, la barre de commande (minuteur, Précédente, Suivante, Écran noir) et la colonne Notes, Étape suivante et Raccourcis. Rien ne flotte plus au-dessus de la scène.
- Mobile : « Piloter depuis mon téléphone » devient un bouton icône ; la pastille de l'écran public est masquée, la télécommande étant faite pour le téléphone.

## 17. ONB-01 : prise en main dans un panneau à droite (retour client du 22/11, variante à choisir)

- La prise en main **sort du flux** : elle ne pousse plus les démos vers le bas. C'est un **panneau vertical à droite**, sous le PageHeader, qui **partage l'espace** avec la page (le contenu se resserre, comme quand on replie une colonne). Ni modale, ni surcouche. Teinte COL-01, filet à gauche.
- **Point d'entrée visible dans le PageHeader** : bouton secondaire « Prise en main 2/7 », avec un anneau de progression de 18 px (`aria-expanded`, `aria-controls`). Il ouvre et ferme le panneau ; la croix du panneau le ferme aussi. Le choix est gardé pour l'utilisateur. Quand les 7 étapes sont faites, le bouton disparaît (et l'entrée reste dans Aide).
- Avec le panneau ouvert, la barre de filtres passe au format compact (« Filtres ») et les indicateurs en 2 × 2, pour tenir dans la largeur restante.
- **Mobile (< 1 024 px)** : le même contenu dans un **tiroir par la droite** (340 px, voile, `role="dialog"`, `aria-modal`, focus piégé, Échap ferme et rend le focus au bouton) ; le bouton d'entrée est l'anneau seul de 44 px dans la barre.
- **Trois variantes à présenter au client** (maquettes `lot2-demos/onb-a`, `onb-b`, `onb-c`, en 1440 et 390, clair et sombre) :
  - **A, liste complète** (360 px) : les 7 étapes en liste, l'étape conseillée en carte, chaque étape avec son action sous le texte, les étapes faites barrées.
  - **B, étape suivante** (360 px) : une grande carte « Prochaine étape » avec son action principale, puis « À faire ensuite » en lignes compactes (chevron ou « Bientôt »), et « Terminées · 2 » replié.
  - **C, par thème** (320 px) : trois groupes (Espace, Créer, Diffuser) avec leur compteur ; seule l'étape en cours est dépliée avec son action, les autres en une ligne avec un chevron.
- Les textes sont ceux de l'app (7 étapes, dont « Flouter les données sensibles »). Le pied garde « Visible par les propriétaires et administrateurs. »

## 18. MEDIA-01 : photo de profil et logo d'espace (retour client du 22/11)

- **Un seul composant**, deux formes : **rond** (photo de profil) et **carré arrondi** (logo d'espace, rayon de 16 px). Taille de 72 px dans une ligne de réglage. Placé selon ALIGN-01 : calé à droite, sur la fin du filet ; l'aide (formats, taille) reste sous le libellé.
- **L'image est le bouton** (`<button>`, nommé « Changer la photo de profil » ou « Changer le logo de l'espace ») : un clic ou Entrée ouvre le choix de fichier. Au **survol et au focus**, un voile (noir à 62 %) avec l'icône Camera et « Changer » ; l'image dessous est floutée. Au focus clavier, en plus, l'anneau `focus` de 2 px à 2 px du bord.
- **Glisser-déposer** accepté sur l'image : pendant le survol avec un fichier, un bord pointillé de 2 px `primary`, un voile `primary` à 18 % et « Déposer ».
- **Petit bouton ⋯** de 28 px, rond, en bas à droite de l'image (« Options pour la photo de profil », `aria-haspopup="menu"`) : un menu de 200 px avec « Remplacer… » (Upload) et « Retirer » (Trash2, couleur danger). Plus de lien rouge brut ni de bouton « Choisir une photo » à côté.
- **Envoi** : voile, cercle de chargement et pourcentage (« 60 % »), `aria-busy="true"`. **Aperçu** : l'image choisie remplace tout de suite l'ancienne (le recadrage existant reste dans sa fenêtre).
- **Erreur dans le cadre** : bord de 2 px `danger` et message sous l'image, en 12 px avec CircleAlert (« Format non accepté : JPG, PNG ou WebP, 2 Mo au plus. », ou la taille), `role="alert"`. L'ancienne image reste.
- **Vide** (pas de photo ni de logo) : bord pointillé, icône Camera et « Ajouter » ; pas de bouton ⋯.
- Maquettes : `lot1-parametres/media-01` (planche de tous les états, rond et carré, 1440 et 390, clair et sombre), et les lignes « Photo » de Profil et « Logo » de Général.

### 18.1 Zone de dépôt (retour client du 22/11 sur le logo de Thème et couleurs)

La zone jugée « très mal travaillée » mélangeait texte et boutons sur deux lignes bancales. C'était aussi le cas dans ma maquette, qui est refaite.
- **Une seule rangée** : à gauche, l'aperçu (88 × 56, le fichier en place) ou une tuile d'icône de 56 px ; au centre, le titre (« Glissez un fichier ici », ou le nom du fichier) et une ligne d'aide (formats et taille, ou type, poids et date) ; à droite, **une source par bouton** : « Choisir un fichier » (Upload) et « Médiathèque » (Images), boutons secondaires de 36 px. **Jamais de bouton dans une phrase.**
- Avec un fichier en place : « Remplacer… », « Médiathèque » et un bouton icône Trash2 « Retirer le logo ». Le cadre devient plein (bordure `border`).
- **Glisser-déposer** : bordure pointillée de 2 px `primary`, fond `primary` à 7 %, « Déposez le fichier pour l'importer », boutons masqués.
- **Envoi** : l'aperçu, le nom, une barre de progression (`role="progressbar"`) avec « 60 % · 14 Ko sur 24 Ko », et « Annuler ».
- **Erreur** : bordure de 1,5 px `danger`, icône CircleAlert, « Ce fichier n'a pas été importé » puis la raison (`role="alert"`) ; les boutons restent pour réessayer.
- Dans une ligne de réglage, la zone passe **sous le libellé** et prend toute la largeur de la ligne, jusqu'à la fin du filet (ALIGN-01). Sous 768 px, les boutons passent sous le texte, en pleine largeur.
- Maquette : planche `media-01`, section « Zone de dépôt », et Thème et couleurs.

**Décisions du 22/11 (questions du dev, 24c93d5)** :
- **Envoi** : le stockage ne donne pas d'avancement. La zone affiche donc « Envoi en cours… » avec une **barre indéterminée** de 6 px (fond `border`, segment prune de 30 % qui glisse de gauche à droite en 1,2 s, en boucle). Si `prefers-reduced-motion`, le segment reste fixe. Pas de pourcentage ni de bouton « Annuler » tant que l'envoi n'est pas annulable. La barre porte `role="progressbar"` sans `aria-valuenow`, avec le nom « Envoi du logo ».
- **Rempli** : le titre est « Logo de {espace} » et l'aide donne le format du fichier (SVG, PNG…). Le nom d'origine, le poids et la date ne sont pas gardés en base : on ne les affiche pas.

**Focus de la vignette (décision du 22/11, 05c2ab7)** : l'image est un bouton, donc elle suit **FIELD-01 §11.4** : un seul indicateur de focus, **intérieur**. Pas d'anneau extérieur, ce qui remplace la phrase « anneau de 2 px à 2 px du bord » de §18. Le dev l'a fait : bordure et trait intérieur de 2 px en couleur `focus`, avec le voile « Changer » visible. Ce cas ne demande donc aucune exception dans le test `boutons-focus`. (L'exception de §6 reste réservée à la poignée du curseur.)

**Zones d'envoi dans un panneau étroit (décision du 22/11, question du dev)** : la zone de dépôt visible (§18.1) vaut pour les pages et les fenêtres. Dans un panneau de 360 px au plus (outils de l'éditeur : Voix, Sous-titres, Remplacer la capture), elle prendrait trop de hauteur à côté des autres actions. Règle :
- **Un bouton « Importer… »** (secondaire, 32 px, icône `Upload`) à la place de la zone, rangé avec les autres actions ; l'aide de format (« MP3, M4A, WAV ou WebM, 5 Mo au plus ») reste en 13 px `text-muted` dessous.
- **Le dépôt marche sur tout le bloc** : au survol avec un fichier, le bloc prend le pointillé `primary` de 2 px et le fond à 7 % (état « glisser » de §18.1), avec l'indication « Déposer le fichier ici » au centre. Si le fichier est refusé, message d'erreur `role="alert"` sous le bouton, comme la zone.
- **Envoi** : le bouton passe en « Envoi… » avec la barre indéterminée de 6 px dessous.
- **Remplacer la capture** : entrée « Remplacer la capture… » du menu ⋯ de l'étape, et dépôt d'une image sur la carte de l'étape ou sur le canevas ; pas de zone visible.
- **Fond des initiales (avatar, vignette)** : le jeton `--fd-color-primary-soft` (#FBF0F5 en clair, #35101F en sombre) fait foi, comme pour les autres avatars ; la valeur #F3D3E2 de mes maquettes est corrigée (jeton du dépôt, comme pour « Publier »).

### 18.2 Relevé des zones d'envoi de fichier de l'app (dev-mvp du 22/11)

Toutes utilisent MEDIA-01, sous l'un de ses trois formats : **vignette** (72 px, image d'identité), **zone** (pleine largeur) ou **bouton compact** (bouton secondaire à icône dans une barre d'outils ou un panneau ; l'hôte accepte aussi le dépôt).

| Écran (fichier) | Fichiers | Format MEDIA-01 |
|---|---|---|
| Profil, photo (`settings/ProfilePhoto.tsx`) | images | Vignette ronde |
| Général, logo d'espace | images | Vignette carrée |
| Centre de formation, logo (`center/CenterSettings.tsx`) | PNG, SVG, WebP | Vignette carrée |
| Thème et couleurs, logo de marque (`settings/brand/BrandSettings.tsx`) | PNG, JPEG, WebP, SVG | Zone, avec Médiathèque |
| Éditeur, Design, logo du thème (`editor/panels/ThemePanel.tsx`) | PNG, JPEG, WebP, SVG | Zone compacte du panneau, avec Médiathèque |
| Médiathèque, ajout (`components/media/MediaLibrary.tsx`) | images | Zone en tête de la fenêtre |
| Nouvelle démo, importer des images (`demos/NewDemoDialog.tsx`) | images, plusieurs | Zone (dans la ligne « Importer des images ») |
| Démos, dépôt sur la page (`demos/DemosPage.tsx`) | images | Voile de dépôt sur toute la liste, même style que l'état glisser-déposer |
| Onboarding, importer à la place (`Onboarding.tsx`) | images, plusieurs | Zone |
| Éditeur, ajouter une étape image (`editor/StepList.tsx`) | PNG, JPEG, WebP | Bouton compact |
| Éditeur, remplacer la capture (`editor/EditorPage.tsx`, `editor/Canvas.tsx`) | PNG, JPEG, WebP | Bouton compact ; le canevas accepte le dépôt |
| Avant / après (`editor/BeforeAfterEditor.tsx`) | images | Deux zones avec aperçu (Avant, Après) |
| Voix, importer un fichier (`editor/voice/VoiceFields.tsx`) | audio | Zone sans Médiathèque |
| Vidéo, importer des sous-titres (`editor/video/VideoFields.tsx`) | .vtt | Zone sans Médiathèque |
| Données, importer un CSV (`editor/data/DatasetDialog.tsx`) | .csv | Zone sans Médiathèque |
| Glossaire, importer un CSV (`settings/GlossarySettings.tsx`) | .csv | Zone sans Médiathèque (exemple sur la planche) |
| Partager, importer des liens (`share/ImportLinksDialog.tsx`) | .csv | Zone sans Médiathèque |

Les dépôts de `FolderColumn`, `FormPanel`, `GuideList` et `QuizEditorPage` servent à réordonner des éléments, pas à envoyer des fichiers : hors MEDIA-01.


## 19. COL-02 : poignée de bord des colonnes secondaires (retour client du 22/11)

Le client voyait un doublon : la même icône panneau pour replier la barre latérale (NAV-04) et la colonne Dossiers. **L'icône panneau est réservée à la barre latérale principale.**

### 19.1 Règle

- Une colonne secondaire repliable (colonne Dossiers ; colonne Étapes de l'éditeur, qui perd aussi son icône panneau) n'a plus de bouton dans son en-tête. Elle a une **poignée sur son bord droit**, à cheval sur le filet.
- **Format retenu (A, toujours visible)** : une pastille de 20 × 40 px (fond `surface`, bordure `border`, ombre légère), centrée verticalement dans la hauteur visible (`position: sticky`), avec un chevron de 14 px : `ChevronLeft` dépliée, `ChevronRight` repliée. C'est un **bouton** : « Replier les dossiers » / « Déplier les dossiers », `aria-expanded`, `aria-controls` (et « Replier les étapes » / « Déplier les étapes » dans l'éditeur).
- **Redimensionnement** : toute la hauteur du filet (zone de prise de 12 px, curseur `col-resize`) est un **séparateur** : `role="separator"`, `aria-orientation="vertical"`, `aria-label="Largeur des dossiers"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` (en px), `tabindex="0"`. Pendant le glissement, le filet passe en `primary` (2 px), la pastille aussi, et une bulle donne la largeur (« 300 px »). Au clavier, sur le séparateur : ← et → par 16 px, Début et Fin pour le minimum et le maximum, Entrée pour replier ou déplier.
- **Bornes** : colonne Dossiers de 200 à 360 px (232 par défaut) ; colonne Étapes de 232 à 360 px (264 par défaut). En dessous du minimum pendant un glissement, la colonne se replie.
- **Repliée** : la colonne Dossiers disparaît (largeur 0). Une demi-pastille de 18 × 40 px reste collée au bord gauche du contenu pour la rouvrir. La colonne Étapes devient son rail de 48 px (pastilles numérotées), avec la même poignée sur le bord du rail.
- **Mémoire** : la largeur et l'état replié sont gardés par utilisateur (navigateur), séparément pour chaque colonne.
- **Animation** (MOTION-01) : repli et dépli en 200 ms, `ease-out` sur la largeur, sans animation si `prefers-reduced-motion`. Pas d'animation pendant un glissement.
- **Mobile (< 1 024 px)** : pas de poignée. La colonne Dossiers reste un tiroir ouvert par la bascule « Dossiers » de la barre mobile (§ lot 2).
- La colonne des Paramètres ne se replie pas : pas de poignée.

**Largeurs intermédiaires (décision du 22/11, question du dev)** : la colonne à poignée vaut **dès 1 024 px**, comme à 1 440 : elle pousse le contenu, il n'y a plus ni rail de 48 px ni tiroir par-dessus entre 1 024 et 1 279 px. Sous 1 280 px, elle est **repliée par défaut** tant que la personne n'a rien choisi ; le choix est ensuite mémorisé (par largeur de fenêtre : un seul réglage par colonne). Contenu : la grille passe à 1 ou 2 colonnes par requête de conteneur. **Sous 1 024 px**, pas de poignée : tiroir ouvert par la bascule de la barre mobile, dont l'icône est **`FolderOpen`** (nom « Dossiers »), et non l'icône panneau, réservée à la barre latérale. Maquette 390 mise à jour.

### 19.2 Variante B (proposée, non retenue par défaut)

Même séparateur, mais la pastille (ronde, 24 px) n'apparaît qu'au survol ou au focus du bord. Plus discrète, mais moins découvrable ; à l'état replié, la demi-pastille reste toujours visible. Maquette `dossiers-poignee-b` (survol).

### 19.3 Maquettes

`lot2-demos/dossiers-poignee` (dépliée, format A), `dossiers-redim` (glissement à 300 px), `dossiers-replie` (repliée), `dossiers-poignee-b` (variante B au survol) ; 1440, clair et sombre. L'en-tête de la colonne n'a plus que « Dossiers » et « Nouveau dossier ».

**Colonne Étapes de l’éditeur (maquettes `lot3-editeur/edition-*` et `etapes-repliee-*`, 23/11).** En-tête « Étapes 3 » seul, sans icône. Dépliée : la même pastille 20 × 40 à cheval sur le filet entre la colonne et le canevas, centrée dans la hauteur visible ; séparateur 232 à 360 px, 264 par défaut. Repliée : rail de 48 px, en haut le bouton icône « Ajouter une étape » (Plus, 32 px, nom accessible et infobulle), un filet de 24 px, les numéros d’étape en boutons de 32 px (l’étape courante en primary-soft avec bord primary, `aria-current="step"`, nom « Étape 1 : Écran 1 ») ; en bas le bouton icône « Ajouter un quiz » (ListChecks). La demi-pastille 18 × 40 se pose contre le bord droit du rail (x 48), plate à gauche, comme celle des Dossiers contre le contenu. Sous 1 024 px, la vue étroite de l’éditeur ne change pas.


## 20. SPLIT-01 : tableau et panneau de détail côte à côte (retour client du 22/11, page d'un webhook)

Le client a relevé, sur la page de détail d'un webhook, des chevauchements et des textes collés. **La maquette du lot 1 portait elle-même ces défauts** : elle est corrigée (`lot1-parametres/webhook-*`, avec des captures à 1280 et 1024 px). La règle vaut pour tout tableau qui ouvre un panneau de détail à côté de lui.

### 20.1 Mise en page

- Une grille de deux colonnes : `minmax(0, 1fr)` pour le tableau et **320 px** pour le panneau, avec une **gouttière de 24 px** (`--fd-space-6`). Jamais de proportions `3fr / 2fr` : le panneau a une largeur fixe et le tableau prend le reste.
- **Le tableau est dans un conteneur à lui** (`min-width: 0; overflow-x: auto`). S'il ne tient pas, il défile dans son conteneur. Il ne passe jamais sous le panneau. La ligne choisie (fond `tint`) s'arrête au bord du tableau.
- **Empilement**. Quand la zone fait moins de 800 px de large, le panneau passe sous le tableau, à 24 px. On le mesure avec une requête de conteneur sur la section (`container: wl / inline-size` puis `@container wl (max-width: 799px)`), et non avec la largeur de la fenêtre, parce que la barre latérale et la colonne des Paramètres changent la place disponible. Pour les Paramètres de l'app, cela donne deux colonnes à 1440 px et à 1280 px, et une seule à 1024 px.
- Les cellules ont un padding horizontal de 12 px et ne passent pas à la ligne (`nowrap`). La seule cellule sur deux lignes est le statut, et c'est voulu : « HTTP 503 » sur la première ligne, puis « Essai 2 sur 6 » en dessous, en 12 px `text-muted`, aligné sur le texte et non sur l'icône. Fini le « HTTP 503 · essai 2 sur 6 » qui se coupait au hasard.
- Les colonnes de nombres (Durée) sont alignées à droite, en chiffres tabulaires, en-tête compris.

### 20.2 Panneau « Envoi sélectionné »

- L'en-tête tient sur une seule ligne : le titre « Envoi sélectionné » (15 px, 600, `nowrap`) à gauche, le bouton secondaire de 32 px **« Rejouer »** (icône `RotateCcw`) à droite, avec 12 px d'écart au moins. Si la place manque, le bouton passe en dessous (`flex-wrap`, 8 px). Le titre ne se coupe jamais.
- Sous l'en-tête, trois valeurs côte à côte : **Statut** (HTTP 503), **Durée** (2 010 ms), **Essai** (2 sur 6). L'étiquette est en 12 px, 600, `text-muted`, et la valeur en 14 px, 500, `nowrap`. La durée et l'essai ne sont plus noyés dans le bloc « Réponse ».
- « Corps envoyé » et « Réponse » sont des `pre` en `white-space: pre`, sans `overflow-wrap`, avec `overflow-x: auto`, 320 px de haut au plus (défilement vertical au-delà) et `tabindex="0"`, pour défiler au clavier. Le JSON est indenté à 2 espaces et un objet imbriqué s'écrit sur plusieurs lignes : on ne coupe jamais une valeur (« 2026-11-22T08:51:02Z » reste entier). « Réponse » montre la ligne de statut HTTP et les en-têtes ou le corps reçus, 1 024 caractères au plus.

### 20.3 Pastilles d'événements

Les pastilles sans bouton de retrait ont un padding horizontal de **12 px** (`--fd-space-3`). L'écart entre elles est de **8 px** (`--fd-space-2`), et leur hauteur de 28 px. Cela vaut partout où l'app affiche une liste de pastilles en lecture seule (événements d'un webhook, étiquettes, domaines…).

## 21. NUM-01 : un nombre ne se coupe jamais de son unité

- Entre un nombre et son unité, on met une **espace insécable U+00A0** : 2 010 ms, 5 min, 6 h, 2 Mo, 512 px, 44 %. Même chose dans « 2 sur 6 » et « 1 membre sur 5 », entre « sur » et le nombre qui suit.
- Le séparateur des milliers est lui aussi U+00A0, comme le fait déjà `formatNumber` (`lib/format.ts`). Tout nombre affiché passe donc par `formatNumber` ou `formatPercent`. Aujourd'hui, la durée d'un envoi de webhook est affichée brute (`${d.duration_ms} ms`, soit « 2010 ms »).
- Pour les textes traduits, l'insécable est écrit dans le fichier de langue (`{{n}} min`). J'ai relevé **87 chaînes** de `fr.json` avec une espace ordinaire avant une unité ou après « sur ». Elles sont à corriger en une seule fois, et `en.json` aussi pour les unités.
- Les pourcentages calculés (« 44 % », « plus 25 % par rapport à… ») suivent la même règle.

## 22. Contrôles automatiques (e2e `separation.e2e.cjs`)

Ce test passe à **1440, 1280, 1180, 1024 et 390 px**, en clair et en sombre, sur la page d'un webhook avec une ligne choisie (durée de 4 chiffres, statut avec essai). Il passe aussi sur les autres pages qui ont un tableau.

1. **Pas de chevauchement** : avec deux colonnes, `panneau.left − conteneurDuTableau.right ≥ 24`. Avec une seule colonne, `panneau.top − tableau.bottom ≥ 24`.
2. **Pas de débordement** : aucune cellule n'a `scrollWidth > clientWidth + 1`. Aucun tableau ne dépasse son conteneur sans un `overflow-x` à `auto` ou `scroll`.
3. **En-tête du panneau** : la hauteur du titre égale une seule ligne. L'écart entre le titre et le bouton est d'au moins 12 px.
4. **Pastilles** : un écart d'au moins 8 px entre deux pastilles voisines, et un padding horizontal d'au moins 12 px.
5. **Nombres** : aucun nœud de texte visible, hors `pre` et `code`, ne correspond à `/\d \d{3}\b|\d (ms|min|s|h|j|Mo|Ko|Go|px|%)(?![\wÀ-ÿ])|sur \d/`, avec une espace U+0020.
6. **pre** : `white-space` vaut `pre` et `overflow-x` vaut `auto`.

### 22.1 Passage sur les autres tableaux et panneaux (22/11, dev-mvp 13c1904)

J'ai passé 17 pages à 1440, 1280 et 1024 px : Accueil, Analytics, Leads, Apprenants, Centre, Utilisation, Équipe, Intégrations, Webhooks, Étiquettes, Variables, Glossaire, Offres, Sécurité, et pour une démo, Analytics, Partager et Diffuser. Résultats :

- **aucune cellule qui déborde**, aucun tableau plus large que son conteneur, aucune gouttière sous 24 px. Sur la page du webhook, l'app a déjà 24 px entre le tableau et le panneau, et empile sous 1 101 px de fenêtre ;
- les défauts qui restent sur cette page : le titre « Envoi sélectionné » sur deux lignes, le JSON coupé (`pre-wrap` et `anywhere`), « HTTP 503 · essai 2 sur 6 » sur deux lignes au hasard, la durée non formatée, les pastilles à 6 px d'écart et 10 px de padding, et les proportions `3fr / 2fr` ;
- **NUM-01** : des espaces ordinaires sur l'Accueil (« 44 % », « plus 25 % »), l'Analytics (« 160 · 60 % »), l'Utilisation et les Offres (« 0 Mo sur 500 Mo », « 12 sur 500 requêtes », « 0 sur 5 min »), l'Équipe (« 1 membre sur 5 ») et le Centre (« 512 Ko »).
- Les autres panneaux latéraux (Segments de l'Analytics avancé, tiroir des Apprenants, tiroir de la Console) sont soit des tiroirs superposés, soit des cartes à côté d'un formulaire. Ils ne relèvent pas de cette règle. Le test 2 les couvre tout de même.
