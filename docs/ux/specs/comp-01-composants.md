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
- **« Autre couleur… »** ouvre un popover avec un sélecteur maison : une zone de teinte et saturation, une barre de teinte, et la valeur en hexadécimal. Tout se règle à la souris et au clavier, avec les flèches.
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
- Focus : anneau `focus` de 2 px autour de la poignée.

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

### 11.4 Boutons, liens, onglets et éléments de navigation : un seul trait de 2 px, collé

- **Au clavier seulement** (`:focus-visible`). Au clic souris, rien n'apparaît.
- **Bouton secondaire, ghost, lien, onglet, élément de navigation, option de liste** :
  - `outline: 2px solid var(--fd-color-focus)` et **`outline-offset: 0`** : un seul trait, collé, qui suit le rayon ;
  - prune sur blanc : 7,4:1 ;
  - pour un lien en texte, `border-radius: 4px` pendant le focus.
- **Bouton primaire (fond prune)** :
  - `outline: none` et **`box-shadow: inset 0 0 0 2px var(--fd-color-surface)`** : un trait blanc intérieur de 2 px (blanc sur prune : 7,4:1 ; en sombre, `surface` #15191F sur #CF86A9 : 6,4:1) ;
  - **rien à l'extérieur** du bouton.
- **Bouton destructif** (fond `danger`) : même règle que le primaire, avec un trait intérieur `surface`.
- **Interdits** : `outline-offset` positif, double anneau, halo.

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
   - un seul indicateur : `outline` de 2 px prune avec `outline-offset` de 0, **ou** (bouton primaire ou destructif) `box-shadow: inset 0 0 0 2px` en `surface`, sans `outline` ;
   - aucune ombre extérieure ;
   - au clic souris, aucun indicateur.
6. **Grep statique** : plus aucune occurrence de `--fd-shadow-focus`, `#1f7fb6`, `#51abdd`, ni de l'ancien danger `#d60b52` ou `#f07ca2`, dans `packages/ui` et `apps/*/src`.
