# FlowDSIML : spécifications des composants

> Livrable 3 de la phase 2, design. Ce document est la référence pour `packages/ui` (shadcn/ui et Radix, stylés par les tokens).
> Tous les noms de tokens renvoient à `packages/ui/src/tokens.ts` (préfixe CSS `--fd-`).
> L'implémentation conseillée : primitives **Radix** pour le comportement et l'accessibilité, styles par les tokens, variantes par `cva`.
> Les maquettes de `docs/ux/maquettes/` montrent ces composants en situation.

---

## 0. Accessibilité : règles transverses (non négociables)

Cible : **WCAG 2.1 AA** pour l'app et le player. Le player tourne chez les clients de nos clients : c'est aussi un argument de vente.

### 0.1 Contraste
- Texte normal : **≥ 4,5:1**. Texte large (≥ 18,66 px gras, ≥ 24 px normal) : **≥ 3:1**.
- Composants d'interface (contours de champs, icônes porteuses de sens, hotspot, anneau de focus) : **≥ 3:1** avec le fond adjacent.
- Les paires de tokens sont vérifiées (voir `identite-visuelle.md` §3.3). Toute nouvelle paire se vérifie avec `docs/ux/tools/contrast.py`.
- Une information n'est **jamais portée par la couleur seule** : un état d'erreur a une icône et un texte, un graphique a des libellés ou des motifs.
- Thème de démo personnalisé : l'éditeur calcule le contraste de la couleur principale avec le texte du bouton et **avertit** sous 4,5:1 (voir §11.1).

### 0.2 Focus
- Tout élément interactif a un **focus visible** : `box-shadow: var(--fd-shadow-focus)` (1 px de fond, puis 3 px Lagoon 500 à 45 %). Ne jamais écrire `outline: none` sans le remplacer.
- Le focus apparaît au **clavier** (`:focus-visible`), pas au clic souris, sauf pour les champs texte, toujours mis en évidence.
- Ordre de tabulation = ordre visuel. Pas de `tabindex` positif.
- **Lien d'évitement** « Aller au contenu » en première tabulation de l'app.
- À l'ouverture d'une modale, d'un menu ou d'un popover, le focus va au premier élément pertinent. À la fermeture, il **revient à l'élément déclencheur**.

### 0.3 Clavier
| Contexte | Touches |
|---|---|
| Global app | `Tab` / `Maj+Tab` ; `/` place le focus dans la recherche ; `?` ouvre l'aide des raccourcis |
| Menus, listes d'options | `↑ ↓` pour se déplacer, `Entrée`/`Espace` pour valider, `Échap` pour fermer, frappe de lettres pour sauter à l'option |
| Onglets | `← →` pour se déplacer et activer (activation automatique), `Début`/`Fin` |
| Modales | `Échap` pour fermer (sauf si une action est en cours), piège de focus |
| Éditeur | `↑ ↓` dans le rail d'étapes ; `Ctrl/⌘+Z` et `Ctrl/⌘+Maj+Z` pour annuler et rétablir ; `Suppr` sur l'élément sélectionné (avec annulation possible) ; flèches pour déplacer le hotspot de 1 % (`Maj` = 5 %) ; `Ctrl/⌘+D` pour dupliquer l'étape ; `P` pour l'aperçu |
| Player | `→`/`Entrée` étape suivante, `←` précédente, `Échap` ferme une pop-up, `Tab` parcourt le CTA de la bulle |

### 0.4 Sémantique et lecteurs d'écran
- Composants Radix ou rôles ARIA standard : `dialog`, `menu`, `tablist`, `listbox`, `alert`, `status`.
- Chaque champ a un `<label>` visible. Un placeholder n'est jamais un libellé.
- Boutons-icônes : `aria-label` obligatoire, plus une infobulle au survol et au focus.
- Les messages dynamiques (toasts, sauvegarde, erreurs de formulaire) passent par une région `aria-live` : `polite` par défaut, `assertive` pour les erreurs bloquantes.
- **Player** : chaque étape a un titre accessible (« Étape 3 sur 8 : Créer un projet ») annoncé au changement. L'image d'étape a un `alt` issu du titre de l'étape. Le hotspot est un `<button>` avec le texte de la bulle comme nom accessible.

### 0.5 Cibles, mouvement, langue
- Taille minimale de cible : **24 × 24 px** (WCAG 2.5.8). Visée : 32 px pour l'app desktop, **44 px** pour le player sur mobile.
- `prefers-reduced-motion` : transitions à 0 ms, pulsation du hotspot remplacée par un anneau statique, pas d'autoplay de vidéo.
- `lang` sur `<html>` (fr ou en). Le player utilise la langue de la démo.
- Le zoom à 200 % ne casse pas la mise en page. Le player respecte `font-size` de l'utilisateur (unités `rem`).

---

## 1. Boutons

### 1.1 Variantes
| Variante | Usage | Fond / texte / bordure (clair) |
|---|---|---|
| `primary` | Action principale de l'écran (1 par zone) | `primary` / `on-primary` / — |
| `accent` | Conversion : « Publier », « Passer au plan supérieur ». **1 par écran au maximum** | `accent` / `on-accent` / — |
| `secondary` | Actions secondaires | `surface` / `text` / `border-strong` |
| `ghost` | Barres d'outils, actions répétées dans des listes | transparent / `text-muted`, survol `surface-hover` |
| `danger` | Suppression, révocation (dans une confirmation) | `danger` / `on-danger` |
| `danger-ghost` | Entrée de menu ou lien de suppression | transparent / `danger` |
| `link` | Action dans du texte | transparent / `primary`, souligné au survol |

### 1.2 Tailles
| Taille | Hauteur | Padding horizontal | Texte | Icône | Rayon |
|---|---|---|---|---|---|
| `sm` | 32 px | 12 px | `label` | 16 px | `sm` |
| `md` (défaut) | 40 px | 16 px | `label` 600 | 18 px | `md` |
| `lg` | 48 px | 20 px | `body-lg` 600 | 20 px | `md` |

Espace de 8 px entre l'icône et le texte. Les **boutons-icônes** sont carrés (32, 40 ou 48) et toujours accompagnés d'un `aria-label` et d'une infobulle.

### 1.3 États
| État | Rendu |
|---|---|
| Survol | `*-hover` ; transition `duration-fast` |
| Appui | `*-active` ou `translateY(1px)` |
| Focus | `shadow-focus` (anneau `focus-danger` pour `danger`) |
| Désactivé | opacité 0,5, `cursor: not-allowed`, `aria-disabled="true"`. Rester focusable si une infobulle explique la raison (« Réservé aux éditeurs ») |
| Chargement | spinner de 16 px à la place de l'icône, libellé conservé (« Publication… »), `aria-busy="true"`, clics ignorés. La largeur ne bouge pas |

### 1.4 Règles
- Libellé = **verbe à l'infinitif + objet** (« Créer une démo », pas « OK »). Voir `microcopy.md`.
- Ordre dans un pied de modale : secondaire à gauche, principal à droite. Sur mobile, empilés, principal en haut.
- **Groupe de boutons segmentés** (choix exclusif, par exemple Hotspot / Bulle / Spotlight) : `role="radiogroup"`, l'élément sélectionné en `surface-selected` avec texte `primary-soft-text`.

---

## 2. Champs de formulaire

### 2.1 Anatomie (`FormField`)
`Libellé` (label, `text`) · indicateur « (facultatif) » plutôt qu'un astérisque · **contrôle** · `Aide` (caption, `text-subtle`) ou `Erreur` (caption, `danger`, avec icône `alert-circle`). Espacements : 6 px entre le libellé et le contrôle, 6 px entre le contrôle et l'aide, 20 px entre deux champs.

### 2.2 Champ texte, zone de texte, recherche
- Hauteur de 40 px (32 px en `sm`), padding horizontal de 12 px, rayon `md`, bordure de 1 px `border-strong`, fond `surface`.
- **Focus** : bordure `primary`, plus `shadow-focus`.
- **Erreur** : bordure `danger`, plus `aria-invalid="true"` et `aria-describedby` vers le message. Le message dit **quoi corriger** (« Saisissez une adresse email valide, par exemple nom@entreprise.example »).
- **Désactivé** : fond `surface-sunken`, texte `text-disabled`. **Lecture seule** : fond `surface-sunken`, texte `text`, sélectionnable.
- Préfixe ou suffixe possible (icône, `https://`, unité). Recherche : icône loupe et bouton « Effacer » (`aria-label`).
- Zone de texte : 3 lignes minimum, redimensionnable verticalement, compteur de caractères en `caption` si une limite existe (bulle : 280 caractères conseillés).
- **Validation** : au `blur`, puis en direct une fois l'erreur affichée. À la soumission, le focus va au **premier champ en erreur**, avec un résumé en tête de formulaire au-delà de 3 erreurs.

### 2.3 Select, combobox
- Select natif stylé pour les listes courtes. **Combobox** (Radix `Popover` et `Command`) pour les listes longues ou filtrables : polices, membres, démos.
- Option sélectionnée : coche à droite. Liste : hauteur maximale de 320 px avec défilement.

### 2.4 Case à cocher, bouton radio, interrupteur
- Case à cocher et radio : 16 px dans une zone cliquable de 24 px ; le libellé est cliquable. Coché : fond `primary` et coche `on-primary`. État indéterminé pris en charge (sélection partielle dans un tableau).
- **Interrupteur** (`Switch`, `role="switch"`) : 36 × 20 px. Pour un **réglage appliqué immédiatement** (« Accès public », « Lecture automatique »). Libellé à gauche, interrupteur à droite. Jamais dans un formulaire avec un bouton « Enregistrer ».

### 2.5 Contrôles spécifiques de l'éditeur
| Contrôle | Spécification |
|---|---|
| **Sélecteur de couleur** | Pastille de 24 px, champ hexadécimal en mono, popover (dégradé, teinte, nuancier du workspace). Avertissement de contraste en ligne (§11.1) |
| **Curseur** (opacité, flou, zoom) | Radix `Slider`, valeur affichée et éditable à droite ; flèches ±1, `Pg↑`/`Pg↓` ±10 |
| **Champ de position** | Segment de 8 positions (haut, bas, gauche, droite, plus 4 diagonales) avec mini-schéma ; « Auto » par défaut |
| **Pastille de variable** | `{{first_name}}` en mono sur fond `primary-soft`, rayon `xs`, insérée comme un jeton atomique (suppression en un retour arrière). Bouton « + Variable » sous les champs qui les acceptent |
| **Champ « copier »** | Champ en lecture seule (mono) avec un bouton « Copier » qui devient « Copié ✓ » pendant 2 s ; annonce `aria-live` « Lien copié » |
| **Bloc de code** (embed) | Fond `surface-sunken`, mono, défilement horizontal, bouton « Copier le code » en haut à droite |

---

## 3. Modales (Dialog)

- **Tailles** : `sm` 400 px (confirmation), `md` 560 px (défaut), `lg` 720 px (partage, choix de plan), `full` (plein écran, mobile < 640 px).
- **Anatomie** : en-tête (titre `h2`, bouton de fermeture), corps (défilement interne si besoin, hauteur maximale de 85 vh), pied (actions à droite). Padding de 24 px, rayon `xl`, `shadow-lg`, voile `overlay`.
- **Comportement** : `role="dialog"`, `aria-modal`, `aria-labelledby` (titre). Piège de focus, `Échap` et clic sur le voile pour fermer, **sauf** si le formulaire contient des modifications : on demande alors « Abandonner les modifications ? ». Le défilement de la page est bloqué. Le focus revient au déclencheur.
- **Confirmation destructive** : titre « Supprimer “Nom” ? », conséquence explicite, bouton `danger` au libellé précis (« Supprimer la démo »). Pour les objets lourds (workspace), on demande de **saisir le nom**. L'action réversible est préférée : archiver plutôt que supprimer, et un toast « Annuler ».
- **Animation** : fondu et `scale(.98 → 1)` en `duration-slow` `ease-standard` ; sortie en `ease-exit`.

## 4. Toasts (notifications)

- **Position** : en bas à droite sur desktop (24 px des bords), en bas au centre sur mobile. Pile de 3 au maximum, la plus récente en bas.
- **Largeur** : 360 px maximum. Anatomie : icône d'état, titre (label 600), description facultative, une action facultative (« Annuler », « Voir »), bouton de fermeture.
- **Variantes** : `neutral` (surface inversée), `success`, `warning`, `danger`, `info` ; fond `surface-raised`, bordure fine 1 px `border`, état porté par **l'icône Lucide colorée** (`CircleCheck`, `TriangleAlert`, `CircleAlert`, `Info`) — pas de barre latérale (§15.6).
- **Durée** : 5 s, 8 s avec une action. Les erreurs **ne disparaissent pas** seules. Pause au survol et au focus.
- **Accessibilité** : `role="status"` (`polite`) ; `role="alert"` pour les erreurs. Le toast ne prend pas le focus. Son action reste accessible au clavier (raccourci `F6` pour atteindre la région des notifications).
- **Ne pas utiliser** pour une erreur de formulaire (message en ligne) ni pour une information qu'il faut garder (bannière).

## 5. Bannières et alertes en ligne

- **Bannière de page** (pleine largeur sous la barre du haut, fond `*-soft`, bordure basse 1 px, icône Lucide d'état) : quota atteint, essai, maintenance. Elle se ferme sauf si elle est bloquante.
- **Alerte en ligne** (dans le contenu) : fond `*-soft`, **bordure fine 1 px uniforme** (couleur d'état à 30 %), icône Lucide 18 px de la couleur d'état, texte `text`, rayon `lg`, padding de 12 × 16 px, action facultative en `link`. Jamais de barre épaisse sur un seul côté.

## 6. Tableaux

- **Usage** : sessions, leads, membres, factures, liens personnalisés.
- **En-tête** : `caption` 600 en `text-muted`, fond `surface`, collant au défilement. Lignes de 48 px (densité confortable) ou 40 px (compacte, option), séparateur `border`, survol `surface-hover`.
- **Tri** : en-tête cliquable (`<button>` dans `<th>`), icône ↑ ou ↓, `aria-sort`. Une seule colonne de tri à la fois.
- **Alignement** : texte à gauche ; nombres, durées et pourcentages à droite en `tabular-nums` ; actions à droite (menu « ⋯ » en `ghost` 32 px).
- **Sélection multiple** : case à cocher en 1re colonne. Une barre d'actions groupées remplace l'en-tête (« 3 sélectionnés · Exporter · Supprimer »).
- **Pagination** : 25 lignes par défaut, sélecteur 25 / 50 / 100, « 1–25 sur 312 », précédent et suivant. Le défilement infini est réservé au flux d'activité.
- **Responsive** : sous `md`, les lignes deviennent des **cartes** (libellé : valeur), les colonnes secondaires sont masquées.
- **États** : chargement (5 lignes squelettes), vide (§9), erreur (§10, avec « Réessayer » dans le tableau).
- **Accessibilité** : vrai `<table>` sémantique, `<caption>` (éventuellement masquée visuellement), cellule de ligne avec `scope="row"`.

## 7. Onglets

- **Style souligné** (navigation de section, onglets de l'éditeur) : texte `label`, `text-muted`. L'onglet actif est en `text` 600 avec un soulignement de 2 px `primary`. Hauteur de 40 px, espacement de 24 px.
- **Style segmenté** (bascules locales : Général / Sessions, Mensuel / Annuel) : conteneur `surface-sunken`, rayon `md`, élément actif `surface` et `shadow-xs`.
- **Comportement** : Radix `Tabs`, `role="tablist"`, flèches, activation automatique. Badge de compteur facultatif (« Leads 12 »). Au-delà de la largeur disponible, défilement horizontal (boutons chevrons aux extrémités si besoin), sans retour à la ligne.

## 8. Menus, popovers, infobulles

- **Menu d'actions** (Radix `DropdownMenu`) : déclencheur « ⋯ » ou bouton avec chevron. Élément de 36 px, icône de 16 px, raccourci à droite en `caption` `text-subtle`, séparateurs, groupe destructif **en dernier** en `danger`. Largeur de 200 à 280 px, rayon `lg`, `shadow-md`, entrée en `duration-base`.
- **Menu contextuel** (clic droit sur une étape du rail) : mêmes entrées que le menu « ⋯ ».
- **Popover** (sélecteur de couleur, réglages rapides) : padding de 16 px, se ferme au clic extérieur et à `Échap`.
- **Infobulle de l'app** (pas celle du player) : fond `surface-inverse`, texte `text-inverse`, `caption`, rayon `sm`, délai de 400 ms à l'entrée et de 0 ms à la sortie. Elle apparaît au survol **et** au focus. Jamais d'information indispensable dans une infobulle.

## 9. États vides

**Anatomie** : illustration (sentier, Lagoon 100-300 + touche Ember, 120 px), titre `h3`, une phrase d'explication, **une action principale**, et un lien d'aide facultatif. Centré, largeur maximale de 400 px.

| Contexte | Titre | Action |
|---|---|---|
| Tableau de bord, aucune démo | « Créez votre première démo » | « Installer l'extension » ou « Importer des captures » |
| Dossier vide | « Ce dossier est vide » | « Déplacer des démos ici » |
| Recherche sans résultat | « Aucun résultat pour “xyz” » | « Effacer la recherche » |
| Analytics, aucune vue | « Pas encore de vues » | « Copier le lien de la démo » |
| Leads | « Aucun lead pour l'instant » | « Ajouter un formulaire » (ouvre l'éditeur) |
| Membres (seul) | « Travaillez en équipe » | « Inviter des membres » |

Le texte complet est dans `microcopy.md`. Un **état vide filtré** (des filtres actifs masquent tout) propose de « Réinitialiser les filtres », pas de créer un objet.

## 10. Erreurs

| Niveau | Composant | Exemple |
|---|---|---|
| Champ | Message en ligne sous le champ (§2.2) | « Le mot de passe doit contenir au moins 8 caractères. » |
| Formulaire | Alerte `danger` en tête, focus sur le premier champ | « 2 champs à corriger. » |
| Action | Toast `danger` persistant, avec « Réessayer » | « La démo n'a pas pu être publiée. Réessayer. » |
| Bloc | Encart dans la zone concernée (tableau, graphique) | « Impossible de charger les sessions. Réessayer. » |
| Page | Page d'erreur plein écran (illustration, code discret, action) | 404 « Cette page n'existe pas », 403 « Accès réservé », 500 « Un problème est survenu de notre côté » |
| Réseau | Bannière « Vous êtes hors ligne : vos modifications seront enregistrées à la reconnexion » | — |
| Player | Écran simple dans le cadre de la démo | « Cette démo n'est plus disponible », « Lien expiré », « Mot de passe requis » |

**Règles** : dire **ce qui s'est passé**, **pourquoi** si on le sait et **quoi faire**. Pas de jargon ni de code d'erreur en premier plan (code et identifiant de requête dans un « Détails » repliable). On ne blâme jamais l'utilisateur. On conserve toujours la saisie.

## 11. Chargement

- **Squelettes** (préférés pour les contenus structurés : listes, tableaux, cartes de démo, KPI) : `skeleton`, rayon de l'élément simulé, animation de **scintillement** de 1,4 s (désactivée en mouvement réduit). Ils s'affichent après **300 ms** de latence seulement, pour éviter le clignotement.
- **Spinner** (actions courtes dans un bouton ou un champ) : anneau de 16 ou 20 px, `currentColor`, rotation de 0,8 s. `aria-label` « Chargement ».
- **Barre de progression** (téléversement des captures, génération d'export, publication) : 4 px, `primary`, pourcentage et étape textuelle (« Téléversement de 12 étapes sur 18 »). Indéterminée si la durée est inconnue. `role="progressbar"` avec `aria-valuenow`.
- **Sauvegarde automatique** (éditeur) : indicateur discret dans la barre d'outils, « Enregistrement… », puis « Enregistré » (horodatage au survol), ou « Hors ligne : modifications en attente » en `warning`. Région `aria-live="polite"`.
- **Optimiste** : renommer, déplacer ou réordonner les étapes s'appliquent tout de suite. En cas d'échec, l'état précédent revient avec un toast d'erreur.

### 11.1 Avertissement de contraste du thème
Il apparaît sous un sélecteur de couleur quand le ratio est inférieur à 4,5:1 avec le texte prévu : icône `warning`, « Contraste faible (2,9:1) : le texte des boutons sera difficile à lire », et action « Utiliser #0B6B62 » (variante la plus proche qui passe l'AA).

---

## 12. Autres composants de base

| Composant | Spécification |
|---|---|
| **Badge** | Hauteur de 20 px, `caption` 600, rayon `xs`, fond `*-soft` et texte de la couleur d'état. Statuts : `Brouillon` (stone), `Publiée` (success), `Modifiée` (warning : des modifications non publiées), `Archivée` (stone). Toujours un texte, pas seulement une pastille. |
| **Avatar** | 24, 32 ou 40 px, rond. Initiales sur fond Lagoon 100 / Lagoon 800 si pas de photo. Pile de 3 au maximum puis « +N ». |
| **Carte de démo** (tableau de bord) | Vignette 16:10 (première étape), titre (1 ligne, tronqué, titre complet en infobulle), méta (« 12 étapes · modifiée il y a 2 h »), badge de statut, menu « ⋯ ». Survol : `shadow-sm` et bouton « Ouvrir ». Toute la carte est un lien. Le menu est un bouton distinct, hors du lien. |
| **Barre latérale** | 240 px, éléments de 36 px, icône de 20 px. Actif : fond `surface-selected`, texte et icône `primary-soft-text`, graisse 600 (pas de barre à gauche, §15.6). Sélecteur de workspace en haut. Usage du plan et profil en bas. Repliable (64 px, infobulles). |
| **Barre du haut** | 56 px : fil d'Ariane, recherche (`/`), aide, notifications, bouton principal contextuel. |
| **Fil d'Ariane** | `caption`, séparateur `/` ou chevron, dernier élément non cliquable (`aria-current="page"`). |
| **Jauge d'usage** | Barre de 6 px, `primary` ; `warning` à partir de 80 %, `danger` à 100 %. Texte « 4 / 5 démos ». |
| **Carte KPI** | Libellé (caption muted), valeur (`display` Bricolage, `tabular-nums`), variation (▲ ou ▼, couleur et signe, jamais la couleur seule), mini-courbe facultative. |

## 13. Composants propres à l'éditeur et au player

### 13.1 Rail des étapes (éditeur)
- Colonne de 248 px. Chaque élément fait 72 px : numéro (caption), vignette 16:10 de 96 px, titre sur 2 lignes, icônes d'état (bulle, flou, pop-up, voix off).
- **Connecteur** : trait vertical de 2 px `border` entre les vignettes (le motif « sentier ») ; point `hotspot` si l'étape porte un hotspot.
- **Sélectionné** : bordure de 2 px `border-selected` et fond `surface-selected`. **Survol** : poignée de glissement à gauche et menu « ⋯ ».
- **Réordonner** : glisser-déposer avec un repère d'insertion de 2 px `primary`. Au clavier : focus sur l'élément, `Espace` pour saisir, `↑ ↓` pour déplacer, `Espace` pour déposer, `Échap` pour annuler, avec annonces `aria-live`. `role="listbox"` avec `aria-activedescendant`.
- **Ajout** : bouton « + » entre deux étapes au survol, et bouton « Ajouter une étape » en bas (capturer, importer une image, pop-up seule, étape d'une autre démo [V2]).

### 13.2 Canevas (éditeur)
- Fond `canvas-editor`. La capture est centrée et mise à l'échelle (« Ajuster », 50 %, 100 %, 150 %), dans le cadre navigateur si celui-ci est activé.
- **Sélection** d'un élément (hotspot, zone de flou, zone de zoom) : contour de 2 px `primary`, 8 poignées de redimensionnement de 8 px (blanches, bordure `primary`), étiquette de type au-dessus (« Flou »).
- Barre d'outils flottante en bas du canevas : `Hotspot` · `Flou` · `Zoom` · `Recadrer` · zoom du canevas. Ce sont des boutons-icônes `ghost` 40 px avec libellé au survol.

### 13.3 Hotspot (rendu player et canevas)
- Pastille de **20 px** `player-hotspot` avec centre blanc de 8 px, anneau extérieur pulsé (de 1× à 2,4×, opacité de 0,55 à 0, 1,8 s). Cible tactile étendue à 44 px.
- Variantes de style (thème) : `Pulse` (défaut), `Anneau` (sans plein), `Discret` (sans pulsation).
- Position stockée **en % de l'image** (x, y), pour rester indépendante de la résolution.

### 13.4 Bulle (tooltip du player)
- Largeur de 240 à 360 px, padding de 16 px, rayon `player-radius`, fond `player-tooltip-bg`, `shadow-lg`, flèche de 10 px orientée vers la cible.
- **Contenu** : compteur « 3/8 » (caption muted), titre facultatif (h3), texte (body-lg, variables résolues), actions : « Précédent » (ghost) et « Suivant » (primary, couleur `player-primary`). La dernière étape affiche le CTA de fin.
- **Placement** : `auto` (côté au plus grand espace libre), ou forcé parmi 8 positions. Elle ne dépasse jamais du cadre et bascule automatiquement.
- **Variantes** : `Bulle` (avec hotspot), `Zone` (walkthrough : voile `player-overlay` avec découpe autour de la cible, rayon de 8 px), `Spotlight` (carte libre sans cible).

### 13.5 Pop-up du player (début, fin, formulaire)
- Carte centrée de 440 px (mobile : feuille en bas plein écran), padding de 32 px, logo facultatif, titre `h2`, texte, 1 ou 2 boutons, voile `player-overlay`.
- **Formulaire de lead** : champs empilés (§2), case de consentement **non cochée par défaut** avec lien vers la politique de confidentialité, bouton plein largeur, mention « Passer » si le formulaire est facultatif. Erreurs en ligne. Confirmation en ligne (« Merci, c'est noté ! ») puis passage à l'étape suivante.

### 13.6 Chrome du player
- **Barre de progression** en haut : segments par étape (le sentier), 4 px.
- **Contrôles** en bas : précédent, suivant, « 3 / 8 », plein écran, sélecteur de langue [V2], son [V2]. Ils s'affichent au survol sur desktop et en permanence sur mobile.
- **Cadre navigateur** facultatif : barre de 36 px (3 pastilles, URL factice), clair ou sombre.
- **Filigrane** (plan Free) : en bas à droite, lien externe `rel="noopener"`.
- **Mobile** (< 640 px) : capture en pleine largeur, bulle **ancrée en feuille du bas** (et non flottante) avec un repère pointé sur le hotspot, boutons de 44 px, balayage gauche ou droite pour naviguer.

---

## 14. Check-list de recette accessibilité (par écran)

- [ ] Parcours complet au clavier, sans souris
- [ ] Focus visible partout, ordre logique, retour du focus après modale ou menu
- [ ] Contrastes AA (outil d'audit et `contrast.py` pour les nouvelles paires)
- [ ] Libellés de champs, `aria-invalid` et messages reliés
- [ ] Boutons-icônes nommés
- [ ] Annonces `aria-live` : sauvegarde, toasts, changement d'étape du player
- [ ] Zoom à 200 % et largeur de 320 px (player, dashboard)
- [ ] `prefers-reduced-motion` respecté
- [ ] Test lecteur d'écran (NVDA + Firefox, VoiceOver + Safari) sur le player et le formulaire de lead
- [ ] axe-core sans violation « serious » ou « critical » (à intégrer aux tests Playwright)

---

## 15. Finition : icônes, champs, espacements (règles obligatoires)

> Ajoutée après le retour client du 17 nov. : « les icônes doivent être de belles icônes qui correspondent à ce qu'elles représentent, les champs doivent être bien faits, attention aux margin, padding, gap ». Ces règles sont **non négociables** : un écart est un défaut de recette.

### 15.1 Icônes

- **Bibliothèque unique : [`lucide-react`](https://lucide.dev)** (licence ISC). Aucune autre source (emoji, caractères Unicode, SVG copiés d'ailleurs). Dans le player (Preact) : `lucide-preact`. Dans la popup de l'extension (vanilla) : `lucide` (ou les SVG Lucide inlinés).
- **Tailles** : **16 px** (boutons `sm`, champs, tableaux, menus), **20 px** (boutons `md`/`lg`, navigation), 24 px (états vides uniquement). Toujours `strokeWidth={1.75}`, couleur `currentColor`.
- **Import** : `import { Plus } from 'lucide-react'` puis `<Plus size={16} strokeWidth={1.75} aria-hidden />`. Recommandé : un composant `<Icon as={Plus} size="sm|md" />` dans `packages/ui` qui fixe taille et trait.
- **Accessibilité** : icône décorative → `aria-hidden`. Bouton icône seule → `aria-label` + infobulle (§1.2).
- **Interdits** : les caractères `+`, `×`, `✕`, `✖`, `▾`, `▸`, `▶`, `←`, `→`, `✓`, `●`, `⋯`, `📁` (et tout emoji) **utilisés comme icônes**. Un libellé ne commence jamais par « + » : on écrit « Ajouter une étape » avec l'icône `Plus`.
- **Alignement** : icône et libellé centrés verticalement (`display:inline-flex; align-items:center`), **gap 8 px** (6 px en `sm`). L'icône précède le libellé, sauf chevron de menu/déroulant (après, gap 4 px).

#### Table de correspondance action → icône Lucide

| Action / objet | Icône | | Action / objet | Icône |
|---|---|---|---|---|
| Ajouter (générique) | `Plus` | | Supprimer | `Trash2` |
| Modifier / ouvrir dans l'éditeur | `Pencil` | | Dépublier | `GlobeLock` |
| Nouvelle démo | `Plus` (+ libellé) | | Retirer / révoquer (membre, invitation) | `UserMinus` / `Ban` |
| Écran texte (étape texte) | `Type` | | Fermer, effacer un champ | `X` |
| Image (importer) | `ImagePlus` | | Dupliquer | `Copy` |
| Capturer (extension) | `ScreenShare` | | Copier un lien / du code | `Link` / `ClipboardCopy` |
| Démarrer l'enregistrement | `Circle` plein (`fill="currentColor"`) | | Copié (confirmation) | `Check` |
| Pause / reprendre | `Pause` / `Play` | | Partager | `Share2` |
| Hotspot | `Target` | | Publier | `Rocket` |
| Bulle (tooltip) | `MessageSquare` | | Masquer (générique) | `EyeOff` |
| Zone mise en évidence | `SquareDashedMousePointer` | | Aperçu | `Eye` |
| Flou | `EyeOff` (aligné sur l'app ; « Dépublier » prend `GlobeLock` pour lever l'ambiguïté) | | Ouvrir (nouvel onglet) | `ExternalLink` |
| Zoom sur une zone | `ZoomIn` | | Intégrer (iframe) | `Code` |
| Recadrer | `Crop` | | Analytics | `BarChart3` |
| Sélection (outil) | `MousePointer2` | | Leads | `Users` |
| Remplacer l'image | `ImageUp` | | Lead (individuel) / formulaire | `UserRound` / `ClipboardList` |
| Monter / descendre une étape | `ArrowUp` / `ArrowDown` | | Exporter CSV | `Download` |
| Poignée de glisser | `GripVertical` | | Importer | `Upload` |
| Chapitres | `ListOrdered` | | Dossier / nouveau dossier | `Folder` / `FolderPlus` |
| Variables | `Braces` | | Déplacer vers un dossier | `FolderInput` |
| Thème / design | `Palette` | | Archiver / restaurer | `Archive` / `ArchiveRestore` |
| Police | `Type` | | Réglages, paramètres | `Settings` |
| Logo (téléverser) | `ImageUp` | | Membres / inviter | `Users` / `UserPlus` |
| Lien (mise en forme) | `Link` | | Mon profil | `CircleUser` |
| Gras / italique | `Bold` / `Italic` | | Plans et facturation | `CreditCard` |
| Insérer une variable | `Braces` | | Workspace (sélecteur) | `Building2` + `ChevronsUpDown` |
| CTA (bouton d'action) | `MousePointerClick` / `ArrowRight` | | Langue | `Languages` |
| Retour | `ArrowLeft` | | Se déconnecter | `LogOut` |
| Précédent / suivant (player) | `ChevronLeft` / `ChevronRight` | | Rechercher | `Search` |
| Plein écran / quitter | `Maximize2` / `Minimize2` | | Filtrer | `ListFilter` |
| Menu d'actions | `MoreHorizontal` | | Trier | `ArrowUpDown` |
| Déroulant (chevron) | `ChevronDown` | | Calendrier / période | `CalendarDays` |
| Mot de passe / accès protégé | `Lock` | | Expiration | `Clock` |
| Sauvegarde : en cours / OK / erreur | `Loader2` (rotation) / `CheckCircle2` / `CloudOff` | | Alerte : info / attention / erreur / succès | `Info` / `TriangleAlert` / `CircleAlert` / `CircleCheck` |
| Aide | `CircleHelp` | | Notifications | `Bell` |
| Démo (lecture) | `PlayCircle` | | Démo centers | `LayoutGrid` |

Une action absente de cette table : choisir l'icône Lucide la plus littérale, l'ajouter ici (PR sur `docs/ux/composants.md`).

### 15.2 Champs : spécifications exactes

| Élément | Valeur |
|---|---|
| Hauteur | **40 px** (`md`, défaut) · **32 px** (`sm`, barres d'outils, tableaux, filtres) · 48 px (`lg`, auth) |
| Padding horizontal (`padding-inline`) | **12 px** (`md`) · 10 px (`sm`) |
| Bordure / rayon | 1 px `border-strong` · rayon **8 px** (`md`) · 6 px (`sm`) |
| Texte | `body` 14 px, interligne 1,3 ; placeholder `text-subtle` (opacité 1) |
| Libellé → champ | **6 px** · champ → aide/erreur : **6 px** · entre deux champs : **20 px** (pas plus) |
| Textarea | hauteur min. 84 px, padding 10 px 12 px |
| **Select** | `appearance: none` ; **chevron SVG `ChevronDown` 16 px, à 12 px du bord droit**, `padding-right: 36 px` (sm : 14 px à 10 px, `padding-right: 32 px`) ; texte tronqué avec ellipse, jamais sous le chevron |
| Champ avec icône à gauche (recherche) | icône 16 px à **12 px** du bord, `padding-left: 36 px` |
| Groupe champ + bouton | même hauteur (40/40 ou 32/32), **gap 8 px**, alignés au centre |
| Case à cocher / radio | 16 px, `accent-color: primary`, **gap 8 px** avec le libellé, alignée sur la première ligne ; une liste de cases : **gap 8 px** entre lignes |
| Interrupteur | 36 × 20 px, libellé à gauche, interrupteur à droite, ligne de 40 px |
| Fichier | jamais l'`input type=file` natif visible : zone de dépôt ou bouton secondaire « Choisir un fichier » (`ImageUp`) + nom du fichier ; à défaut, `::file-selector-button` stylé (fait dans `base.css`) |
| Couleur | pastille 40 × 40 rayon 8 + champ hexadécimal mono 40 px, **gap 8 px** |
| Curseur (range) | piste pleine largeur, valeur affichée à droite dans un champ `sm` de 56 px |
| Focus | bordure `primary` + `shadow-focus` (3 px Lagoon 45 %) ; erreur : bordure `danger` + `shadow-focus-danger` |
| Désactivé | fond `surface-sunken`, texte `text-disabled`, `cursor: not-allowed` |

Implémenté dans `packages/ui/src/base.css` (classes `fd-input`, `fd-select`, `fd-textarea`, `fd-input--sm`, `fd-select--sm`, `fd-check`, `fd-input-group`, `fd-input-icon`). **Ne pas redéfinir `padding` d'un `.fd-select` localement** (un garde-fou force `padding-right` à 36 px).

### 15.3 Boutons : spécifications exactes

| | `sm` | `md` | `lg` |
|---|---|---|---|
| Hauteur | 32 px | 40 px | 48 px |
| Padding horizontal | 12 px | 16 px | 20 px |
| Icône | 16 px | 18–20 px | 20 px |
| Gap icône/libellé | 6 px | **8 px** | 8 px |
| Bouton icône seule | 32 × 32 | 40 × 40 | 48 × 48 |

- Dans une même rangée, **tous les contrôles ont la même hauteur** (bouton `sm` avec champ `sm`, etc.). Gap entre boutons d'une rangée : **8 px**.
- Une seule action principale par zone ; les actions destructives en ligne sont `ghost` (icône `Trash2`) ou dans un menu, jamais un bouton rouge plein en ligne.

### 15.4 Échelle d'espacement obligatoire

Seules ces valeurs sont autorisées pour `margin`, `padding` et `gap` (tokens `--fd-space-*`) :

| Token | 0-5 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| px | 2 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 |

Exception unique : 6 px (libellé → champ, gap des boutons `sm`). **Interdits** : valeurs « au jugé » (3, 5, 7, 10, 14, 18 px…) et `<br>` pour espacer.

**Rythme vertical de référence**

| Contexte | Valeur |
|---|---|
| Entre deux champs d'un formulaire | 20 px (`space-5`) |
| Entre sections d'un panneau (avec séparateur) | 16 px au-dessus et au-dessous du trait |
| Padding d'une carte | 24 px (`space-6`) ; carte compacte : 16 px |
| Padding du panneau de propriétés de l'éditeur | 16 px |
| Entre cartes d'une grille | 20 px |
| Titre de page → contenu | 24 px |
| Padding de page (app) | 32 px desktop, 16 px mobile |
| Élément de liste (rail, menu, navigation) | padding 8 px, gap 4 px entre éléments |

### 15.5 Typographie et accents

- **Accents sur les capitales obligatoires** : « Écran », « Étape », « État », « À propos ». Jamais « Ecran ».
- Espace insécable avant `: ; ! ? »` et après `«` (français).
- Pas de texte en MAJUSCULES saisi en dur ; utiliser `text-transform` si besoin (titres de section 11 px de la maquette).
- Les nombres, dates et pluriels passent par `Intl` et i18n (« 0 vue », « 17 nov. 2026 »), jamais par concaténation.

### 15.6 Motifs proscrits (« effet IA générique »)

> Retour client du 17 nov. : le bloc arrondi avec une **barre de couleur épaisse sur le bord gauche** est jugé « trop slop IA ». Plus largement, tout ornement qui ne porte pas d'information est proscrit. Chaque motif ci-dessous est un **défaut de recette** ; l'alternative est obligatoire.

| # | Motif proscrit | Pourquoi | Alternative sobre (à utiliser) |
|---|---|---|---|
| M1 | **Barre d'accent latérale** : `border-left` (ou `inset` / `::before`) de 2 à 6 px colorée sur un bloc arrondi — callouts, alertes, toasts, cartes, citations, bandeaux | Ornement cliché, lisible seulement par la couleur | Bordure **fine 1 px uniforme** (couleur d'état à 30 % ou `border`) + **icône Lucide** d'état 18 px + fond `*-soft` si besoin. `.fd-alert` le fait déjà. |
| M2 | **Élément actif signalé par une barre à gauche** (navigation, onglet vertical, étape sélectionnée, ligne de tableau) | Même motif ; ambigu avec un statut | Fond `surface-selected` + texte/icône `primary-soft-text` + graisse 600 ; étape sélectionnée : **contour 2 px** sur tout le pourtour (`border-selected`). |
| M3 | **Dégradés décoratifs** (fonds de page, de carte « recommandée », de héros, de bouton) | Bruit visuel, effet « landing page générée » | Aplats de la palette (`bg`, `surface`, `*-soft`) ; mise en avant par **bordure `border-strong`** et badge texte. Seuls dégradés tolérés : *shimmer* fonctionnel des squelettes, masques de défilement. |
| M4 | **Titres ou textes en dégradé** (`background-clip: text`) | Illisible, cliché | Couleur `text` ; l'emphase passe par la taille et la graisse (Bricolage 700). |
| M5 | **Glassmorphism gratuit** (`backdrop-filter: blur` + transparence sur des cartes, barres, modales) | Coûteux, contraste aléatoire | Surfaces opaques `surface` / `surface-raised` + ombre `sm`/`md`. Le flou n'est autorisé que là où il **est la fonction** (outil de floutage des données). |
| M6 | **Emojis** dans l'interface (titres, boutons, toasts, dossiers, messages : 👋 🚀 ✨ 📁 ✅ 🔒…) | Ton infantilisant, rendu variable selon l'OS | Icône Lucide (§15.1) ou rien. Texte simple : « Bienvenue, Camille ». |
| M7 | **« Sparkles » ✨ (ou baguette magique) pour signaler l'IA** | Cliché du marché, n'explique pas l'action | Libellé d'action explicite (« Rédiger les textes », « Traduire ») + icône de l'action (`PenLine`, `Languages`) ; la mention « IA » éventuelle en texte dans l'aide. |
| M8 | **Cartes à icône dans un cercle/carré coloré**, répétées partout (grilles de fonctionnalités, menus, listes de choix, en-têtes de section) | Remplissage décoratif, toutes les cartes se ressemblent | Icône Lucide **nue** 20 px en `text-muted` (ou `primary` si active), alignée avec le titre ; une pastille colorée seulement pour un **statut** (badge) ou un avatar. |
| M9 | **Ombres colorées** / halos (`box-shadow` teinté de la couleur d'accent, glow au survol) | Effet néon | Ombres neutres de la palette (`shadow-xs` → `lg`, brun chaud) ; l'anneau de focus est la seule ombre colorée autorisée. |
| M10 | **Contours colorés épais** autour de cartes « mises en avant » | Lourd, concurrence les états de sélection | Bordure `border-strong` 1 px + badge « Recommandé » ; l'épaisseur 2 px est réservée à la **sélection** et au focus. |
| M11 | **Pastilles numérotées colorées décoratives** (1 · 2 · 3 dans des cercles accent) pour de simples listes | Gadget | Liste ordonnée typographique (numéro `text-subtle` tabulaire) ; les pastilles restent pour le hotspot et les étapes du rail. |
| M12 | **Majuscules espacées partout**, sur-titres colorés au-dessus de chaque titre (« ✦ NOUVEAU ✦ ») | Mise en forme marketing gratuite | Un seul niveau de titre par bloc ; sur-titre uniquement pour les groupes de navigation (11 px, `text-subtle`, sans couleur). |
| M13 | **Animations décoratives** (rebonds, flottement, confettis, gradients animés) | Distrait, ignore `prefers-reduced-motion` | Transitions d'état uniquement (`duration-fast/base`), pulsation du hotspot seulement. |
| M14 | **Arrondis excessifs** (`radius` ≥ 20 px) sur des cartes et champs d'interface | Aspect « jouet » | Échelle `radius` : 6–8 px pour les contrôles, 12 px cartes/menus, 16 px modales et bulles du player. |

**Contrôle automatique conseillé (CI)** : refuser dans `apps/**/*.css` et `packages/ui/**/*.css` : `border-left: [2-9]px`, `border-inline-start: [2-9]px`, `background-clip: text`, `linear-gradient(` hors `.skeleton`/masques, `backdrop-filter` hors classes de floutage ; et dans les `.tsx`/`.json` : les emojis (plage Unicode U+1F300–U+1FAFF, U+2728).

### 15.7 Overlays : toujours dans un portail, jamais coupés (règle obligatoire)

S'applique aux menus (⋯, compte, workspace), select personnalisés, popovers, info-bulles, toasts, modales et tiroirs, dans l'app comme dans le player.

1. **Portail obligatoire.** Tout overlay est rendu dans un conteneur unique en fin de `<body>` (`#fd-portal`), jamais dans le DOM de son déclencheur. **Équivalent accepté pour les modales** : `<dialog>` natif ouvert avec `showModal()`, qui passe dans la *top layer* du navigateur et ne peut pas être coupé. Un parent en `overflow: hidden | auto | clip`, `transform`, `filter`, `contain` ou `will-change` ne doit jamais pouvoir le couper ni le décaler. Dans le player intégré en iframe, le portail est le `<body>` de l'iframe.
2. **Positionnement avec gestion des collisions.** Ancrage au déclencheur (`position: fixed` + coordonnées calculées, ou Floating UI) avec :
   - **retournement** (`flip`) quand la place manque du côté préféré ;
   - **décalage** (`shift`) pour rester à **8 px** minimum des bords du viewport ;
   - **taille maximale** (`size`) : `max-height` = espace disponible − 16 px, avec défilement interne ;
   - recalcul au défilement, au redimensionnement et à l'ouverture du clavier virtuel.
3. **Côté préféré par type.**

   | Type | Côté préféré |
   |---|---|
   | Menu ⋯ | sous le déclencheur, aligné à droite (`bottom-end`) |
   | Menu de compte (bas de la barre latérale) | au-dessus et vers la droite (`top-start`). Il peut dépasser de la barre latérale sur le contenu |
   | Select | sous le champ, même largeur que le champ |
   | Info-bulle | au-dessus (`top`) |
   | Toast | en bas à droite (en bas au centre en mobile) |
   | Modale | centrée ; feuille du bas sous 480 px |

4. **Superposition.** Seulement les jetons `--fd-z-*` : `dropdown` 1000, `overlay` 1100, `modal` 1200, `popover` 1300, `toast` 1400, `tooltip` 1500. Aucune valeur de `z-index` au jugé. Un menu ouvert depuis une modale utilise `popover`, pour passer au-dessus de la modale.
5. **Thème.** L'overlay hérite de `data-theme` (le portail est sous `<html>`). Dans le player, il reste dans `.fd-player-scope`.
6. **Mobile (< 480 px).** Les menus de plus de 6 éléments et les modales s'affichent en feuille du bas, en pleine largeur, avec une zone sûre (`env(safe-area-inset-bottom)`).
7. **Comportement.**
   - `Échap` ferme l'overlay.
   - Un clic à l'extérieur ferme menus et popovers, jamais une modale contenant un formulaire en cours de saisie.
   - Le focus revient au déclencheur à la fermeture.
   - Le focus reste piégé dans les modales.
8. **Interdit.**
   - `position: absolute` dans une carte ou une barre latérale pour un overlay.
   - Augmenter le `z-index` du parent pour « faire passer » un menu.
   - Retirer l'`overflow` d'un conteneur pour laisser sortir un menu.
   - Coder une largeur en dur qui tronque les libellés : `min-width` 180 px, `max-width` 320 px, et retour à la ligne plutôt que des points de suspension pour les actions.

**Recette « débordements »** (à chaque livraison qui touche un overlay), en 1 440, 1 024 et 390 px, thèmes clair et sombre :
- ouvrir chaque overlay près des quatre bords et dans les conteneurs défilants (barre latérale, panneau de l'éditeur, tableau) ;
- vérifier que la boîte de chaque overlay est **entièrement dans le viewport**, à 8 px au moins des bords, et qu'aucun ancêtre en `overflow` autre que `#fd-portal` ne le contient ;
- vérifier qu'aucun libellé n'est coupé.
