# TutoClick : spécifications des composants

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
- **Tailles et trait** : voir **ICON-01** (§15.1 bis), qui remplace l'ancienne règle `strokeWidth={1.75}` partout. Couleur `currentColor`.
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
| Image (importer) | `ImagePlus` | | Dupliquer | `CopyPlus` (ICON-01) |
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

### 15.1 bis ICON-01 : un seul style d'icône (retour client du 21/11)

> Retour client : les icônes doivent être « belles et minimalistes », avec un trait franc et sans flèches inutiles. L'audit de l'app (3 033 icônes rendues sur toutes les pages, en clair) relève **deux épaisseurs** de trait (2 et 1,75, 37 icônes utilisées avec les deux), **six tailles** (12, 13, 14, 16, 18 et 20 px), des **variantes à flèche** pour plier et déplier (`PanelLeftClose` / `PanelLeftOpen`), et des **doublons** pour un même concept (`Sparkles` / `WandSparkles`, `Settings` / `Settings2`, `Key` / `KeyRound`, `Shield` / `ShieldCheck`, `ImagePlus` / `ImageUp`, `Package` / `PackageOpen`, `Bell` / `BellRing`).

**1. Source** : Lucide uniquement (`lucide-react` 0.577, `lucide-preact` dans le lecteur), plus **une** icône maison, « panneau » (point 4). Aucune autre.

**2. Trois tailles, un trait rendu fixe par taille.** Le trait est réglé pour que l'icône ait le même poids optique partout :

| Taille | Où | `stroke-width` (grille de 24) | Trait rendu |
|---|---|---|---|
| **20 px** | barres : barre latérale et rail, rail d'outils de l'éditeur, barre du haut, onglets de navigation, boutons `md`/`lg` | **2,1** | 1,75 px |
| **16 px** | boutons compacts (`sm`), menus, champs, tableaux, puces, badges, chevrons | **2,25** | 1,5 px |
| **24 px** | états vides et tuiles d'illustration uniquement | **1,75** | 1,75 px |

- Toute autre taille (12, 13, 14, 18 px…) est interdite. Un texte de 13 px prend une icône de 16 px.
- **Mise en œuvre** : un seul endroit, `packages/ui` (composant `<Icon as={…} size="sm|md|lg" />` ou règles CSS `svg.lucide[width="16"]`, `[width="20"]`, `[width="24"]`). Plus aucun `strokeWidth` local dans les composants et plus aucun `stroke-width` dans les CSS de page.

**3. Une icône fixe pour plier et déplier.** Pas de variante à flèche (`PanelLeftClose`/`Open`, `ChevronsLeft`/`Right`, `FolderOpen` pour « ouvert », `ArrowLeftToLine`…). L'icône ne change pas. L'état est porté par `aria-pressed` (épingler, afficher un panneau) ou `aria-expanded` (déplier une section), et le libellé de l'infobulle dit l'action. Seul le chevron d'une section repliable (`ChevronDown`) peut **tourner** de 180° (transition de 150 ms, désactivée en mouvement réduit).

**4. Icône maison « panneau »** pour **toutes** les bascules de colonne : barre latérale, colonne Dossiers, panneaux de l'éditeur. Elle est dessinée sur la grille Lucide (24 × 24, trait de la taille, bouts et angles arrondis) :

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="4"/>
  <path d="M9.5 3v18"/>
  <path d="M6.25 8h.01M6.25 12h.01M6.25 16h.01"/>
</svg>
```

Un rectangle aux grands arrondis (rx 4 au lieu de 2), une colonne de gauche avec trois points, sans flèche. Panneau de droite : symétrie horizontale (`transform: scaleX(-1)`). Panneau du bas (commentaires) : rotation de -90°. Classe `lucide lucide-panneau`, pour que l'e2e la contrôle comme les autres.

**5. Une icône par concept, partout la même.** Cette table complète celle du §15.1 et **prime sur elle** en cas de désaccord (par exemple, Dupliquer passe de `Copy` à `CopyPlus`). `BarChart3` et `CircleHelp` sont d'anciens alias de `ChartColumn` et de `CircleQuestionMark` : même dessin.

| Concept | Icône | Concept | Icône |
|---|---|---|---|
| Démos | `LayoutGrid` | Partager | `Share2` |
| Sandbox | `Map` | Exporter, télécharger | `Download` |
| Parcours de formation | `Route` | Importer | `Upload` |
| Suite du parcours, embranchement, variante A/B | `GitBranch` | Commentaires | `MessageSquare` |
| Analytics | `ChartColumn` | Dupliquer | `CopyPlus` |
| Apprenants | `GraduationCap` | Copier | `Copy` |
| Paramètres | `Settings` (jamais `Settings2`) | Coller / couper | `ClipboardPaste` / `Scissors` |
| Aide, centre d'aide | `CircleQuestionMark` | Remplacer (capture) | `Replace` |
| Extension | `Puzzle` | Masquer une étape | `EyeOff` |
| Notifications | `Bell` (jamais `BellRing`) | Supprimer | `Trash2` |
| IA, assistant, génération | `Sparkles` (jamais `WandSparkles`) | Plus d'actions | `Ellipsis` |
| Clé d'accès | `KeyRound` (jamais `Key`) | Sécurité | `ShieldCheck` (jamais `Shield`) |
| Ajouter une image | `ImagePlus` | Remplacer l'image | `ImageUp` |
| Paquet SCORM | `Package` | Bascule de colonne | `panneau` (maison) |
| Toutes les démos | `Layers` | Mes démos | `User` |

**6. Recette et e2e** (`icones.e2e.cjs`, sur toutes les pages de `APP_PAGES` et `PLAYER_PAGES`, en clair et en sombre) :
- chaque `svg.lucide` visible mesure 16, 20 ou 24 px ;
- son `stroke-width` calculé est celui de sa taille (2,25, 2,1 ou 1,75, à 0,01 près) ;
- aucune classe `lucide-panel-left-close`, `-open`, `lucide-chevrons-left`, `-right`, `lucide-settings-2`, `lucide-wand-sparkles`, `lucide-bell-ring`, `lucide-key` (seule), `lucide-shield` (seule) ;
- toutes les bascules de colonne (`aria-pressed` sur un bouton qui contrôle un panneau) contiennent `lucide-panneau`.

Planche avant/après, en clair et en sombre : `maquettes/refonte/icones-icon-01.html` et `img/icones-icon-01/`.

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

### 15.4 bis Loi de proximité : espacements par relation (règle obligatoire, L45)

> Retour client : des blocs collés (« Largeur de sortie » sous les boutons radio de Format ; « Importer un fichier CSV » collé à son texte) alors que d'autres sont bien espacés (Formulaire de lead).
> Règle : **plus deux éléments sont liés, plus ils sont proches**. L'écart dépend de la **relation** entre les deux éléments, jamais du composant. Chaque relation a un token sémantique (à ajouter à `tokens.css`, en alias de l'échelle §15.4).

| Relation | Token | Panneau compact (éditeur, tiroirs, ≤ 360 px) | Pages, cartes, modales |
|---|---|---|---|
| Libellé → son champ | `--fd-gap-label` | 6 px | 6 px |
| Champ → son aide, son compteur ou son erreur | `--fd-gap-help` | 4 px | 6 px |
| Option → option (radios, cases, au sein d'un groupe) | `--fd-gap-option` | 8 px | 8 px |
| Légende d'un groupe d'options → première option | `--fd-gap-label` | 6 px | 6 px |
| Texte (description, aide, état vide) → son bouton ou son lien d'action | `--fd-gap-action` | 12 px | 12 px |
| Champ → champ, dans un même groupe | `--fd-gap-field` | 16 px | 20 px |
| Ligne d'interrupteur → ligne d'interrupteur | `--fd-gap-field` | 16 px | 20 px |
| Groupe → groupe, dans une même section (ex. Format → Largeur de sortie) | `--fd-gap-group` | 20 px | 24 px |
| Titre de section → premier contenu | `--fd-gap-title` | 12 px | 16 px |
| Section → section | `--fd-gap-section` | filet 1 px `border`, avec 16 px au-dessus et au-dessous | filet, avec 24 px au-dessus et au-dessous |
| Dernier champ → boutons de validation de la carte ou de la modale | `--fd-gap-group` | 20 px | 24 px |
| Bouton → bouton (même rangée) | `--fd-space-2` | 8 px | 8 px |

- **Un groupe** est un ensemble qui se lit ensemble : un libellé, son champ et son aide ; un groupe de radios et sa légende ; un interrupteur et sa description. Un groupe est un `<div>` (ou `<fieldset>`) qui porte `gap` ; les marges des enfants sont à zéro.
- **Pas de marge sur les composants** (`margin-top` sur un bouton, `<p>` avec marge par défaut) : l'écart est porté **uniquement** par le `gap` du conteneur. Les `<p>` des panneaux ont `margin: 0`.
- **Aide sous un interrupteur** : elle fait partie de la ligne (écart `--fd-gap-help`), pas de la ligne suivante.
- **Une seule exception** de taille : un écart plus grand que `--fd-gap-group` à l'intérieur d'une section signale qu'il faut une nouvelle section.
- **Contrôle** : la recette mesure les écarts entre blocs voisins (script de l'audit L45, `docs/ux/specs/l45-espacements.md` §5). Tout écart hors de ce tableau est un défaut.

### 15.5 Typographie et accents

- **Accents sur les capitales obligatoires** : « Écran », « Étape », « État », « À propos ». Jamais « Ecran ».
- Espace insécable avant `: ; ! ? »` et après `«` (français).
- Pas de texte en MAJUSCULES saisi en dur ; utiliser `text-transform` si besoin (titres de section 11 px de la maquette).
- Les nombres, dates et pluriels passent par `Intl` et i18n (« 0 vue », « 17 nov. 2026 »), jamais par concaténation.

### 15.6 Motifs proscrits (« effet IA générique »)

> **Règle client absolue (20 nov.) : jamais de barre de couleur sur le bord gauche d'un bloc.** Elle vaut pour les toasts, les cartes, les notes, les citations, les alertes, les bandeaux, les encadrés, les éléments actifs (navigation, étape, ligne) et les e-mails, quels que soient l'épaisseur (1 px compris) et le moyen : `border-left`, `border-inline-start`, `box-shadow: inset`, `::before` ou `::after`, image de fond. Un bloc a une bordure **uniforme** sur tout son pourtour, ou pas de bordure.
> Seules exceptions, qui ne sont pas des barres d'accent : le filet neutre de séparation entre deux panneaux juxtaposés (`border`, 1 px, sur toute la hauteur) et l'axe gris d'une frise chronologique ou du rail des étapes, qui relie des points.

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

**Contrôle automatique conseillé (CI)** : refuser dans `apps/**/*.css`, `packages/ui/**/*.css` et `docs/ux/maquettes/**` : tout `border-left` ou `border-inline-start` coloré (hors `border-left: 1px solid var(--fd-color-border)` entre deux panneaux), `box-shadow: inset <n>px 0`, un `::before`/`::after` de 1 à 6 px de large collé au bord gauche, `background-clip: text`, `linear-gradient(` hors `.skeleton`/masques, `backdrop-filter` hors classes de floutage ; et dans les `.tsx`/`.json` : les emojis (plage Unicode U+1F300–U+1FAFF, U+2728).

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

## 16. Logo TutoClick

> Logo officiel du 20 novembre 2026. Charte complète, couleurs et fichiers : `identite-visuelle.md` §2. Planche de contrôle : `brand-tutoclic/production/apercu.html`.

### 16.1 Versions

| Version | Contenu | Où | Taille minimale |
|---|---|---|---|
| **Complète** (`logo-tutoclick.svg`, `-sombre.svg`) | Icône, « TutoClick », trait, signature « Porté par la DSIML », cinq points | **Barre latérale dépliée** (décision client du 21/11, LOGO-01), page de connexion et d'inscription, accueil de l'onboarding, en-tête des e-mails, documents, supports imprimés | 224 px dans la barre latérale (exception, §16.5) ; 400 px ailleurs |
| **Compacte** (`logo-tutoclick-compact.svg`, `-compact-sombre.svg`) | Icône, « TutoClick », trait, sans la signature | Barre latérale (40 px de haut), en-tête de l'extension (32 px), e-mails, connexion sous 480 px | 28 px de haut |
| **Icône seule** (`symbole-tutoclick.svg`) | Carré magenta, curseur et cible | **Rail replié de la barre latérale (32 px)**, barre mobile, barre du haut de l'éditeur (32 px), avatar d'app, écran de chargement | 24 px |
| **Icône petite** (`symbole-tutoclick-petit.svg`) | Carré et curseur, sans la cible | Favicon, icônes de 16 à 23 px | 16 px |
| **Mono** (`-mono-noir.svg`, `-mono-blanc.svg`) | Une couleur, curseur et cible évidés | Fond photo ou couleur vive (panneau de marque de la connexion), impression | comme la version d'origine |

### 16.2 Thème sombre

- Le thème choisit le **fichier**, jamais un filtre CSS (`filter: invert` interdit) :
  - `<picture>` avec `<source srcset="…-sombre.svg" media="(prefers-color-scheme: dark)">`,
  - ou deux `<img>` alternées par `[data-theme]`, comme dans les maquettes (`wm-l` et `wm-d`).
- En sombre, seules changent les couleurs du texte : « Tuto » et le trait passent en `#CF86A9`, « Click » en `#F3F5F8`, la signature en `#C9D1DA`. L'icône ne change pas.

### 16.3 Zone de protection

- **Valeur** : un quart de la hauteur de l'icône, tout autour du cadrage (compact ou icône seule).
- **Exemples** :
  - barre latérale, logo compact de 40 px : 10 px au moins jusqu'au sélecteur d'espace et aux bords ;
  - icône de 32 px dans la barre de l'éditeur : 8 px.
- Le logo complet inclut déjà sa marge dans son cadrage (28 unités sur 260) : on ne l'ajoute pas en plus.
- Aucun texte, aucun bouton, aucun bord de carte dans la zone.

### 16.4 Intégration

- `<img src="…" alt="TutoClick">`, avec `height` fixé et `width: auto`. Le logo n'est jamais recomposé en texte HTML.
- Si le logo est un lien vers l'accueil, l'`alt` reste « TutoClick » : le lien porte `aria-label="TutoClick, accueil"`.
- Le logo complet a pour `alt` « TutoClick, porté par la DSIML » : la signature est ainsi lue par les lecteurs d'écran, même là où elle est trop petite pour l'œil.
- **Plus de sous-titre en texte HTML** sous le logo (« DSI des Missions Locales » est retiré, décision client du 21/11) : la signature vient uniquement du SVG du client, intégré tel quel.
- **Interdits** :
  - recolorer ;
  - étirer ;
  - ajouter une ombre ou un contour ;
  - poser la version couleur sur du magenta, du prune ou du framboise ;
  - utiliser l'icône petite au-dessus de 23 px ou l'icône complète en dessous de 24 px.
- **Contrôle CI suggéré** : aucun fichier de l'ancien logo (dégradé `#A52B60`) dans `apps/*/public` et `packages/*` ; tous les `<img>` du logo ont `alt="TutoClick"`.

### 16.5 LOGO-01 : logo complet et lisibilité de la signature (21/11)

> Décision client : le logo complet, **tel quel** (SVG du client, signature « PORTÉ PAR LA DSIML » et cinq points compris), remplace le logo compact suivi de « DSI des Missions Locales ». Il n'est jamais recomposé en HTML.

- **Où** :
  - barre latérale dépliée, au survol ou épinglée : logo complet, 224 px de large (256 px moins 2 × 16 px) ;
  - rail replié et barre mobile : **icône seule** (32 px), jamais le logo complet ;
  - connexion et inscription, accueil de l'onboarding : logo complet, **400 px de large au moins** ;
  - en-tête des e-mails : PNG du logo complet, 400 px affichés (fichier en 800 px pour les écrans 2×) ;
  - pied du lecteur : logo complet seulement s'il dispose de 400 px, sinon logo compact.
- **Mesure de la signature** : ses capitales font 10 unités sur les 803,5 du cadrage. Hauteur affichée = largeur du logo × 0,0124.

  | Largeur du logo | Capitales de la signature | Lisible ? |
  |---|---|---|
  | 224 px (barre latérale) | 2,8 px | non : élément graphique, l'information passe par l'`alt` |
  | 400 px | 5,0 px | oui, minimum |
  | 480 px | 6,0 px | oui, confortable |

- **Exception de la barre latérale** : à 224 px, la signature n'est pas lisible. Elle est acceptée comme élément du logotype : WCAG 1.4.3 exempte les logotypes du contraste minimal, et le nom accessible porte le texte. On ne grossit pas la barre et on n'ajoute pas de texte HTML pour compenser (**décision du chef du 21/11**).
- **Thème sombre** : fichier `logo-tutoclick-sombre.svg` existant (§16.2), jamais un filtre CSS. Contrastes mesurés sur `#14161B` :
  - « Click » `#F3F5F8` : 16,6:1 ;
  - signature `#C9D1DA` : 11,7:1 ;
  - « Tuto » et trait en `#CF86A9` : 6,6:1. Garder « Tuto » en `#A3195B` sur ce fond ne donnerait que 2,5:1, sous le seuil de 3:1 des grands textes. La variante sombre éclaircit donc aussi « Tuto » et le trait, et pas seulement « Click » et la signature (**décision du chef du 21/11** : l'accessibilité prime ; le client est informé).
  - Clair : signature `#123A49` sur blanc, 12,0:1.
- **Recette** : pour chaque emplacement, largeur affichée du `<img>` (224 px dans la barre latérale, 400 px ou plus ailleurs), `alt` exact, fichier sombre chargé en thème sombre (pas de filtre), zone de protection de §16.3, et icône seule dans le rail et sur mobile.

## 17. Qualité visuelle (UI) : règles mesurables

> Retour du client du 20 novembre : les maquettes doivent être lisibles d'un coup d'œil, légères et aérées, avec une hiérarchie nette et sans « slop ». Ces règles s'appliquent à toute nouvelle maquette et à toute reprise. Les maquettes L41 à L49 ont été reprises selon elles (`specs/ui-deltas-l41-l49.md`).

### 17.1 Un écran, une intention
- **Une seule action principale visible** (`fd-btn--primary`) par écran ou par dialogue. Les autres actions sont secondaires (contour) ou en lien.
- **Emplacements connus (Jakob)** :
  - action principale de page en haut à droite ;
  - action de dialogue en bas à droite ;
  - Annuler à gauche de l'action.
- **Au plus 7 éléments de premier niveau** par écran (Miller) : au-delà, on regroupe (sections, onglets, « Plus »).
- **Au plus 5 choix visibles** dans une décision (Hick) : au-delà, on ajoute une recherche ou un regroupement.

### 17.2 Hiérarchie
- **Trois tailles de texte au plus par écran** :
  - titre de page 28/700 ;
  - titre de section 18/700 ;
  - corps 15/400 ;
  - le texte secondaire en 13/400 `text-muted` ne compte pas comme une taille.
- **Ordre de lecture** : le titre, l'essentiel (chiffre, état, action), puis le détail (repliable, infobulle ou aide).
- **Texte** :
  - une ligne d'aide au plus sous un champ ;
  - pas de paragraphe d'explication dans l'interface : il va dans l'aide (F1) ;
  - pas de phrase qui répète le titre.

### 17.3 Espace et alignement
- **Grille de 8 px** et écarts de §15.4 bis.
- **Marges** :
  - 32 px entre deux sections d'une page ;
  - 24 px de marge intérieure dans une carte ;
  - 16 px entre deux lignes d'une liste.
- **Alignement** : à gauche, sur une seule ligne de départ par colonne. Les chiffres sont alignés à droite, en `tabular-nums`.
- **Réglages** : disposition en deux colonnes, libellé et une ligne d'aide à gauche (40 %), contrôle à droite, comme Paramètres > Sécurité aujourd'hui.

### 17.4 Sobriété (anti-« slop »)
- **Cartes** :
  - une carte égale un objet ;
  - jamais de carte dans une carte ;
  - bordure **ou** ombre, pas les deux ;
  - pas de carte autour d'une liste qui est déjà dans une carte.
- **Badges** :
  - au plus un par ligne ou par carte ;
  - seulement pour un état qui change ce que l'on peut faire (Bientôt, Brouillon, Bloqué, Erreur) ;
  - pas de badge décoratif (« Admins », « Recommandé », compteurs redondants). Un état simple s'écrit en texte, `text-muted` ou couleur d'état.
- **Icônes** :
  - une par élément au plus, à 18 px ;
  - pas de pastille de fond systématique derrière les icônes ;
  - pas d'icône devant chaque ligne d'une liste de texte.
- **Couleur** :
  - neutre par défaut ;
  - couleur de marque pour l'action principale, la sélection et les liens ;
  - couleurs d'état (succès, avertissement, danger) seulement pour un état réel ;
  - jamais de grand aplat de couleur pour mettre en avant un élément ordinaire.
- **Toujours interdits** : barre colorée sur un bord (§15.6), dégradés, ombres colorées, emoji, texte en capitales au-delà des sur-titres de 11 px.

### 17.5 Cibles et confort
- **Taille des cibles (Fitts)** : 40 px de haut au moins sur ordinateur, 44 px au toucher. La zone cliquable couvre toute la ligne quand la ligne entière est une action.
- **Esthétique et utilisabilité** :
  - les états vides, les chargements et les erreurs sont dessinés avec le même soin que l'état nominal ;
  - aucun texte tronqué sans infobulle.

### 17.6 Présentation des maquettes
- Chaque maquette ouvre sur l'**après**, à la taille réelle, dans le cadre de l'app (barre latérale incluse quand c'est pertinent), avec un sélecteur **Après / Avant** (capture de l'app actuelle).
- Viennent ensuite les états utiles (3 au plus), puis le sombre et le mobile.
- Les annotations restent hors de l'écran dessiné, en une ligne chacune : le détail est dans la spec.

## 18. Bases vérifiables (retour client du 21 novembre)

> Trois défauts sont arrivés en production (c9e5925) : un bouton natif du navigateur dans « Installer l'extension », une case collée à son bloc dans « Activer l'Assistance IA ? », et des groupes de la sous-navigation des Paramètres qu'on ne distingue pas de leurs éléments. Soit la spec n'était pas assez précise, soit le code ne l'a pas suivie. Dans les deux cas, ma validation aurait dû les voir. Chaque règle ci-dessous se mesure dans le navigateur, sur des styles calculés. Un écart est un défaut bloquant.

### 18.1 Aucun bouton natif
- **Règle** : tout élément cliquable visible (`button`, `[role="button"]`, `input[type=button|submit|reset]`) utilise une classe du design system :
  - `fd-btn` avec sa variante : principale `fd-btn--primary`, secondaire (sans modificateur, contour), `fd-btn--ghost`, `fd-btn--danger` ;
  - ou un composant qui définit lui-même police, couleur, fond, bordure et focus : élément de navigation, segmenté, onglet, rail, carte cliquable ;
  - ou le lien d'action `.link-button` de `app.css` : texte `primary` souligné, police héritée, sans fond ni bordure.
- **Interdit** : un `<button>` sans classe, ou avec une classe qui n'est définie dans aucune feuille chargée sur l'écran. C'était le cas de `link-btn` dans `ExtensionDialog.tsx` : la classe existe seulement sous `.mk` et dans l'éditeur HTML, alors que `.link-button` existe dans `app.css`.
- **Mesure** (styles calculés), un bouton est natif si au moins un critère est vrai :
  - le bouton affiche du texte et sa police n'est pas celle de `<body>` (Plus Jakarta Sans) : le navigateur met Arial ou system-ui sur un `<button>` sans style ;
  - `border-style` vaut `outset` ou `inset` ;
  - `background-color` vaut `rgb(239, 239, 239)` en clair, ou `rgb(107, 107, 107)` en sombre (valeurs de Chromium).
- **Base de secours** dans `base.css`, pour qu'un oubli ne se voie jamais comme un bouton gris en relief :
  ```css
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
  ```
  Cette base ne remplace pas la règle : un bouton doit garder sa classe du design system, et le contrôle CI continue de vérifier.
- **Contrôle CI** : `docs/ux/ci/boutons-natifs.e2e.cjs`, à copier dans `apps/web/e2e/`. Il parcourt toutes les routes de l'app et les dialogues qui ont déjà eu le défaut, en clair et en sombre, et échoue au premier bouton natif. Sur dev-mvp (d33d5a1), il en trouve deux :
  - « Voir l'article d'aide » (`.link-btn`) dans « Installer l'extension » : police Arial, bordure `outset`, fond gris ;
  - « Nouveau dossier » (`.fcol__new`) dans la colonne Dossiers de Démos et de Sandbox : police Arial.
- **Pour aller plus loin, en option** : une règle ESLint (`react/forbid-elements` ou une règle locale) qui refuse un `<button>` JSX sans `className`.

### 18.2 Corps de modale : un écart entre chaque bloc
- **Règle** : le corps d'une modale (`.dialog-body`, `.modal-body`) est une colonne flex avec `gap: 16px` (`--fd-gap-title`) au moins. Les enfants directs ont `margin: 0`. Cela vaut **partout**, pour les deux systèmes de modale actuels (`.dialog` et `.mk .modal`), et pour tous les blocs : texte, encadré d'information, liste, champ, case à cocher, lien d'action.
- **Écarts plus grands** (§15.4 bis) :
  - 24 px entre deux groupes distincts (un formulaire, puis une case de consentement indépendante) ;
  - 24 px entre le dernier bloc du corps et le pied (filet compris).
- **Mesure** : pour deux enfants visibles consécutifs du corps, `next.top - prev.bottom` doit valoir 16 px au moins. Dans « Activer l'Assistance IA ? », l'écart entre l'encadré (`.ai-notice`) et « J'ai lu ces informations » (`.check`) vaut aujourd'hui **0 px** : c'est un défaut.
- **Case de consentement** : elle est un bloc à part. Il y a 16 px au-dessus, la case de 18 px est alignée sur la première ligne du libellé, et le libellé est en 14 px `text`.

### 18.3 Navigation groupée (sous-navigation des Paramètres, et toute liste à groupes)
- **Titre de groupe** : c'est une étiquette, pas un lien.
  - Texte de 11 px, graisse 600, en capitales, `letter-spacing: .06em`, couleur `text-muted` (4,5:1 au moins sur le fond).
  - Padding horizontal identique aux éléments (12 px), pour que tout s'aligne à gauche. Boîte serrée : `line-height: 16px`, aucun padding vertical. L'écart vient de la marge (ou du `gap`), pour qu'on puisse le mesurer.
  - Ni survol, ni `cursor: pointer`, ni focus. Balisage : `<h3>` (ou `<p id>`) et `aria-labelledby` sur la liste du groupe.
- **Éléments** :
  - hauteur 36 px, padding horizontal 12 px, rayon `md` ;
  - texte de 14 px 500, couleur `text` : ils sont donc plus foncés et plus grands que le titre de groupe ;
  - **écart de 2 px** entre deux éléments d'un même groupe.
- **Espacements (loi de proximité)** :
  - **24 px** entre le dernier élément d'un groupe et le titre du groupe suivant, mais pas au-dessus du premier groupe ;
  - **6 px** entre un titre de groupe et son premier élément.
  - Le titre est donc 4 fois plus près de son groupe que du groupe précédent.
- **États** (corrigé le 21 novembre : avec `surface-sunken` ou `surface-raised`, le survol ressemblait à l'actif en clair, et en sombre il était même plus clair que lui) :
  - **repos** : fond transparent, texte `text`, graisse 500 ;
  - **survol** : fond `color-mix(in srgb, var(--fd-color-text) 6%, transparent)`, c'est-à-dire un voile neutre qui fonce en clair et éclaircit en sombre. Le texte et la graisse ne changent pas, il n'y a pas de soulignement ;
  - **actif** : graisse **600**, `aria-current="page"`, et le seul élément avec un fond plein :
    - en clair, fond `surface` et ombre `0 1px 2px rgb(8 10 14 / .08)` ;
    - en sombre, fond `surface-raised` et bordure de 1 px `border`, sans ombre (§17.4 : bordure ou ombre, pas les deux ; une ombre ne se voit pas sur fond sombre).
  - L'actif se distingue du survol par **trois signaux** : la graisse, le fond plein et l'ombre ou la bordure. Jamais par la couleur seule ;
  - **focus clavier** : anneau `focus` de 2 px (`:focus-visible`), en plus de l'état ;
  - **« Bientôt »** : la mention, en 13 px `text-muted`, est alignée à droite. L'élément reste cliquable vers la page « Bientôt » (L48-A).
- **Contrôle du survol** : on capture l'élément actif et un élément survolé côte à côte, en clair et en sombre. Les deux doivent se distinguer sans hésiter ; l'actif est le seul en graisse 600.
- **Mesure** :
  - écart entre éléments du même groupe : 2 px ;
  - écart entre un groupe et le titre suivant : 24 px ;
  - écart entre un titre et son premier élément : 6 px ;
  - titre : `font-size: 11px`, `text-transform: uppercase`, `cursor: default` ;
  - élément actif : `font-weight: 600` et `aria-current="page"`.
  - Mesuré sur dev-mvp (d33d5a1), `nav.snav` :
    - les éléments font bien 36 px et sont espacés de 2 px, ce qui est conforme ;
    - le titre de groupe (`span.grp`) est une boîte de 31 px de haut, collée à 2 px de l'élément précédent : il n'y a qu'environ 15 px de vide au-dessus de son texte, contre 24 attendus ;
    - les éléments sont en `rgb(79, 89, 102)`, presque la même couleur que les titres (`rgb(95, 107, 120)`) : ils doivent passer en `text`.
    - Ce sont des défauts.

### 18.4 Fonction qui n'est pas encore publiée : l'extension
- **Condition** : `VITE_EXTENSION_URL` est vide et l'extension n'a jamais été détectée pour ce compte (`profiles.extension_seen_at` nul).
- **Modale « Extension TutoClick »**, état « Bientôt disponible » :
  - titre « Extension TutoClick », suivi de « Bientôt disponible » en 13 px `text-muted` sur la même ligne ;
  - une seule phrase : « L'extension créera une démo à partir de vos clics dans votre logiciel : chaque clic deviendra une étape. » ;
  - aucune étape d'installation, aucun lien vers l'article d'aide, aucun bouton d'action ;
  - pied : « Fermer » seul (`fd-btn`, secondaire).
- **Partout ailleurs où l'installation est proposée**, le même état s'applique :
  - l'étape « Installer l'extension » de la checklist : « Bientôt » en texte à la place du bouton « Installer » ;
  - l'étape Extension de l'accueil (L48-C) : la phrase ci-dessus, puis « Continuer sans l'extension » ;
  - la source « Capturer avec l'extension » de « Nouvelle démo » : désactivée, avec « Bientôt ».
  - Rien n'est masqué (règle « Bientôt »).
- **Quand l'URL est définie** : on affiche le titre « Installer l'extension », l'introduction et les 3 étapes, puis le lien « Voir l'article d'aide » en `.link-button`. Le pied contient « Fermer » (secondaire) et « Installer l'extension » (principal, lien externe).
- **Extension détectée** : rien ne change, avec « Extension installée » et « Lancer une capture ».
- **Textes (i18n, nouvelles clés)** :
  - `extension.soonTitle` : « Extension TutoClick » ;
  - `extension.soon` : « Bientôt disponible » ;
  - `extension.soonBody` : « L'extension créera une démo à partir de vos clics dans votre logiciel : chaque clic deviendra une étape. »

### 18.5 Validation UX : captures réelles, clair et sombre
- Je ne valide jamais un écran d'après le code ou la seule maquette. Pour chaque écran touché par un lot :
  1. je prends des captures **réelles** de l'app de dev-mvp (faux backend, données fictives) en **clair et en sombre**, à 1440 px, et à 390 px si l'écran existe sur mobile ;
  2. j'ouvre aussi **chaque dialogue, menu et état** que le lot touche : état vide, « Bientôt », erreur, chargement ;
  3. je compare chaque capture à la maquette et aux règles §15 à §18, en mesurant les écarts annoncés ici (styles calculés) ;
  4. je lance `boutons-natifs.e2e.cjs` et le contrôle des espacements (§15.4 bis) ;
  5. les captures vont sur le tracker. Un écran n'est « conforme » que si les captures en clair et en sombre ont été regardées.
- Un défaut visible sur une capture que je n'ai pas prise reste un défaut de validation : la recette doit dire quelles captures ont été regardées.

### 18.6 Espacements mesurables (retour client du 21 novembre)
Le client trouve les espacements négligés. Règle vérifiée automatiquement (e2e `espacements.e2e.cjs`, sur toutes les routes, en clair et en sombre, à 1440 px et à 390 px) :

| Cas | Écart mesuré (bord à bord) | Exemples |
|---|---|---|
| Deux éléments **frères** visibles empilés ou côte à côte, dans un même conteneur | **8 px au moins** (jamais 0) | lignes d'une liste d'éléments cliquables, boutons d'une barre, champs d'un groupe |
| Une **liste** et son **action** (« Ajouter… », « Nouveau… », « Voir tout ») | **12 à 16 px** | liste des hotspots et « Ajouter un hotspot », étapes du guide et « Ajouter une étape », dossiers et « Nouveau dossier » |
| Deux **cartes** empilées | **24 px** | Paramètres, Analytics, Démos |
| Blocs d'un corps de modale | 16 px au moins (§18.2) | |
| Aide sous son champ | 6 px (exception admise, même groupe) | |

- **Exceptions** (exclues du contrôle par attribut `data-gap-exempt`, à justifier dans le code) :
  - éléments qui se touchent volontairement : segmentés, onglets accolés, groupes de boutons soudés ;
  - lignes d'un tableau ou d'une liste à filets, où l'écart est assuré par le padding des lignes (au moins 8 px de padding vertical) ;
  - texte en ligne.
- **Mesure** : `getBoundingClientRect()` de chaque paire de frères visibles (hauteur et largeur > 0, hors `position: absolute` ou `fixed`). L'écart est la distance entre les bords qui se font face. Le test liste chaque écart sous le minimum, avec la route, le sélecteur des deux éléments et la valeur.
- **Mise en œuvre** : poser l'écart sur le **conteneur** (`display: flex` ou `grid` avec `gap`), jamais avec des marges isolées sur les enfants. Les classes de section (`.sec`, `.settings-main`, `.dialog-body`) portent leur `gap`.
- **Recette** : dans chaque recette UX, je contrôle les espacements élément par élément sur les captures, et je joins le relevé du test.

### 18.7 Aucun défilement horizontal dans un panneau (bug client du 21 novembre)
- Aucun conteneur ne défile en largeur, sauf ceux qui sont faits pour : canevas, tableaux larges avec en-tête figé, rangée de filtres qui défile (MOB-01 M3), éditeur de code. Ils portent `data-scroll-x` (justifié dans le code).
- **Mesure** (e2e global) : pour chaque élément visible sans `data-scroll-x`, `scrollWidth - clientWidth <= 1`. Le test liste la route, le sélecteur, `scrollWidth` et `clientWidth`.
- **Causes à traiter à la source** : enfant en `width: 100%` avec une marge ou une bordure (utiliser `box-sizing: border-box`) ; texte long sans `overflow-wrap: anywhere` (adresses, sélecteurs CSS, URL) ; `min-width` implicite des enfants flex (mettre `min-width: 0`) ; marges négatives.
- `overflow-x: hidden` ne remplace pas la correction : il masque le débordement au trackpad mais coupe le contenu.
- **Recette** : dans chaque panneau touché par un lot, je fais un geste horizontal au trackpad (molette horizontale) et à la molette avec Maj. Le contenu ne doit pas bouger, et `scrollLeft` reste à 0.

## 19. MODAL-01 : une seule forme de modale (retour client du 21/11)

> Le client veut des modales « minimalistes et modernes ». La règle s'applique à **toutes** les modales de l'app (création, confirmation, suppression, invitation, réglages). Maquette : `maquettes/refonte/modales-composants.html`, vues « Équipe + invitation » et « États de la modale ». Captures dans `img/modales-composants/`.

### 19.1 Gabarit

- **Largeur** : 400 px par défaut, 560 px pour une modale à deux colonnes ou à tableau, 720 px pour Partager (P1-3). Plein écran sous 480 px. Rayon de 16 px, filet de 1 px `border`, ombre `--fd-shadow-lg`, voile `rgb(8 10 14 / .45)`.
- **En-tête**, padding de 16 px 16 px 16 px 24px, filet de 1 px dessous :
  - **tuile d'icône** de 40 px : fond `surface`, filet de 1 px `border`, rayon de 10 px, icône Lucide de 18 px en `text` (en `danger` pour une suppression). Cette taille déroge à ICON-01 pour la seule tuile ;
  - titre en 18 px 500, sur une ligne ;
  - bouton Fermer (`X`, 32 px, `aria-label="Fermer"`) à droite.
- **Corps** : padding de 24 px, `gap` de **24 px** entre les champs ou les blocs.
  - Libellé au-dessus du champ, en 14 px 500 `text-muted`, 6 px au-dessus du champ.
  - Champ de 40 px, bordure `--fd-color-border-field`.
  - **Pas de texte long** : une phrase au plus avant les champs. Le détail va dans un popover d'information ou dans l'aide en ligne.
- **Erreur en ligne** : la bordure du champ passe en `danger`, avec un halo de 3 px à 15 %. Le message est en 13 px `danger`, **directement sous le champ** (6 px), sans encadré. Il est relié au champ par `aria-describedby`, et le champ porte `aria-invalid="true"`.
- **Pied** :
  - filet de 1 px au-dessus, fond **`--fd-color-nav-bg`** (#F7F7F8 en clair, #101317 en sombre), padding de 16 × 24 px ;
  - boutons **alignés à droite** : Annuler (contour), puis l'action principale. Pour une suppression, l'action principale prend `danger`.
- **Action principale indisponible** : `aria-disabled="true"`, jamais `disabled` seul. Elle reste focalisable, et un clic affiche les erreurs.
  - Elle reste **lisible** : fond `prune-200` et texte `prune-900` en clair (7,8:1), fond `prune-800` et texte `prune-100` en sombre (8,8:1).
  - Un bouton pâle aux lettres illisibles est interdit.
- **Comportement** : focus sur le premier champ à l'ouverture (sur Annuler pour une confirmation). Le focus reste piégé dans la modale. Échap ferme, et le focus revient au déclencheur. Animation MOTION-01 (200 ms). `role="dialog"`, `aria-modal="true"`, `aria-labelledby` sur le titre.

### 19.2 Confirmation après action

- Elle s'affiche dans la même modale, avec une nouvelle tuile (par exemple `MailCheck`) et un nouveau titre. Le pied n'a qu'un bouton primaire, « Terminé ».
- Les actions de secours, comme « Copier le lien », sont dans le corps, en boutons secondaires de 40 px.

### 19.3 Recette

- Sur chaque modale de l'app :
  - mesures (largeur, en-tête, tuile de 40 px, padding de 24 px, gap de 24 px, pied teinté avec ses boutons à droite) ;
  - en clair et en sombre ;
  - erreur en ligne et action indisponible lisible ;
  - focus et Échap.
- La liste des modales et leur passage à MODAL-01 sont dans la livraison du dev.

