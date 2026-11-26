# INSPECTOR-01 — Langage commun des panneaux de droite de l'éditeur

Retour du client du 26/11 : les panneaux de réglages font « formulaire de navigateur », avec des contours épais, du gros texte, beaucoup de blancs et trop de phrases. Il veut un inspecteur d'outil pro : simple, compact, moderne, qui va droit à l'essentiel.

**Planches** (`docs/ux/propositions/inspector-01/`) :
- `planche-inspector-voix-off.png` : Voix off avant et après, à 1440, en clair et en sombre. Quatre états : voix IA en place, nouvelle voix à écouter, Micro, sélecteur ouvert.
- `planche-inspector-systeme.png` : la même grammaire appliquée à Étape et bulle, Thème et Recadrage.
- `inspector.css` : la feuille de la maquette, qui sert de référence de mesure.

La règle vaut pour **tous** les panneaux de droite de l'éditeur : Étape, Voix off, Thème, Zoom, Recadrage, Flou, Hotspot, Assistance IA, Traduire, Commentaires, Branches, etc. Elle ne change aucune fonction validée : L62 §6 (source sans perte), §8 (sélecteur de voix), CHOIX-01, RADIUS-01, COMP-01.

## 1. Jetons (à ajouter dans `packages/ui/src/tokens.css`)

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--fd-insp-bg` | `#ffffff` (surface) | `#15191f` (surface) | fond du panneau |
| `--fd-insp-fill` | `#eef2f6` (ardoise-100) | `#222831` (surface-hover) | fond des champs, listes, segmentés, cartes |
| `--fd-insp-fill-hover` | `#e2e8ef` (ardoise-200) | `#2a313b` | survol d'un champ ou d'une option |
| `--fd-insp-fill-on` | `#ffffff` + ombre `0 1px 2px rgba(16,24,40,.10)` | `#3a424d` (ardoise-700) | option choisie d'un segmenté |
| `--fd-insp-sep` | `#e2e8ef` (border) | `#272e37` (border) | séparateurs de 1 px |
| `--fd-insp-label` | `#4f5966` (text-muted) | `#a9b3bf` | libellés de ligne |
| `--fd-insp-meta` | `#5f6b78` (text-subtle) | `#8a95a3` | infos secondaires, durées, compteurs |

| Mesure | Valeur |
|---|---|
| Largeur du panneau | 320 px (comme aujourd'hui) |
| Retrait gauche et droite | 16 px |
| En-tête | 48 px ; titre en 14 px demi-gras (650) ; boutons icône de 28 px |
| Section | 12 px en haut et en bas ; séparateur de 1 px `--fd-insp-sep` entre deux sections |
| Titre de section | 24 px de haut, 12 px demi-gras (650), en couleur de texte ; **pas de capitales** ; action éventuelle (+, lien) à droite |
| Ligne | contrôle de **32 px** ; **4 px** entre deux lignes, soit un pas de 36 px |
| Libellé | colonne de **92 px**, 12 px moyen (500), `--fd-insp-label` |
| Écart libellé et contrôle | 8 px |
| Valeur dans un contrôle | 13 px moyen (500) ; chiffres tabulaires pour les nombres |
| Info secondaire | 12 px, `--fd-insp-meta` |
| Rayons | RADIUS-01 : contrôle de 32 px = `--fd-radius-control-sm` (8 px) ; option de segmenté = 6 px (8 − 2 de retrait) ; carte = `--fd-radius-surface` (12 px) ; bouton de lecture, interrupteur, avatar = Rond |

**Contrastes mesurés sur la maquette** :

| Élément | Clair | Sombre |
|---|---|---|
| Libellés | 7,1:1 | 8,3:1 |
| Infos secondaires (le plus faible, sur fond rempli) | 4,8:1 | 4,9:1 |
| Option non choisie d'un segmenté | 6,3:1 | 7,0:1 |
| Action destructive | 5,7:1 | 6,3:1 |

Tous les textes dépassent 4,5:1.

## 2. Composants (dans `apps/web/src/components/inspector/`)

1. **`Inspector`** : le panneau.
   - En-tête : titre, actions éventuelles (⋯), Fermer.
   - Corps défilant.
   - **Pied** facultatif, collé en bas, séparé par un filet. Il porte l'action discrète : « Retirer la voix », « Supprimer l'étape », ou « Réinitialiser » avec Annuler et Valider.
2. **`InspectorSection`** (`title`, `help?`, `action?`).
3. **`InspectorRow`** (`label`, `help?`) : le libellé à gauche dans 92 px, le contrôle à droite, qui prend toute la place restante.
   - Variante **pleine largeur** : sans libellé (texte long, segmenté de source), le titre de section servant de libellé.
   - Variante **à droite** : un interrupteur ou un segmenté à icônes, aligné sur le bord droit.
   - Le libellé est un vrai `<label for>`. Le nom accessible du contrôle reprend le libellé.
4. **Champ rempli** (`FilledInput`, `FilledTextarea`) :
   - 32 px, ou 3 à 4 lignes pour une zone de texte ;
   - fond `--fd-insp-fill`, **sans contour** ; survol `--fd-insp-fill-hover` ;
   - **focus** : contour intérieur de 1 px `--fd-color-border-selected`, plus l'anneau de focus de l'app ;
   - préfixe facultatif (L, H, X, Y, `#`), suffixe facultatif (`100 %`, `{ }` pour insérer une variable) ;
   - erreur : contour intérieur de 1 px `--fd-color-danger`, et message d'une ligne sous le champ, avec une icône.
5. **`CompactSelect`** : comme le champ rempli, avec un chevron de 14 px.
   - Il ne montre que l'**essentiel** : le drapeau et la langue, l'avatar et le prénom de la voix, la pastille et le code d'une couleur.
   - Le détail (accent, style, genre) est dans la liste qui s'ouvre, et en infobulle au survol.
6. **`SegmentedIcons`** :
   - conteneur de 32 px, retrait de 2 px, options de 28 px ;
   - icône Lucide de 16 px, plus un libellé court (12 px demi-gras) si l'icône ne suffit pas ;
   - icône seule : option de 32 px de large, **infobulle obligatoire** avec le nom complet, et `aria-label` ;
   - option choisie : `--fd-insp-fill-on` ; non choisie : `--fd-insp-label` ;
   - point d'état facultatif (6 px, vert) : par exemple la voix en place, sur la source.
7. **`Switch`** compact : 32 × 18 px, aligné à droite de la ligne.
8. **Lecture audio** :
   - bouton rond de 28 px (24 px dans une ligne de 36 px), puis une onde compacte de 20 px, puis la durée en 12 px ;
   - jamais de lecteur natif.
9. **Carte compacte** (voix en place, nouvelle voix) :
   - rayon de 12 px, fond rempli, retrait de 8 à 10 px ;
   - ligne d'en-tête de 24 px : icône, **nom en gras** · info secondaire, action ⋯ ;
   - ligne de lecture de 28 px ;
   - actions éventuelles de 28 px, à parts égales.
   - La carte « Nouvelle voix » a un contour de marque de 1 px, et l'étiquette « À écouter ».
10. **Aide** : une icône `CircleQuestionMark` de 13 px, après le libellé ou le titre de section. Elle ouvre une infobulle (survol et focus, Échap la ferme) de 220 px au plus.
11. **Avertissement** : **une ligne** de 12 px, avec `TriangleAlert` de 14 px, en couleur d'avertissement, sous le contrôle concerné. Un deuxième avertissement ou une explication longue va dans l'infobulle.

## 3. Règles de rédaction des aides

1. **Une phrase visible au plus par section.** Tout le reste passe en « ? ».
2. **Pas d'aide qui répète le libellé**, ni d'aide sur ce qui se voit. Par exemple, « Langue de la démo : français » devient la ligne `Langue · [drapeau] Français`, avec le drapeau en SVG et jamais en emoji.
3. **Les contraintes passent dans le contrôle**, pas dans une phrase : « 2 min au plus » à droite du bouton d'enregistrement ; « 53 car. · ≈ 5 s » sous le texte, à droite.
4. **Les mentions légales et de confidentialité** (« Le texte est envoyé à notre service de synthèse vocale… ») vont dans l'infobulle « ? » du titre ou de l'action. Elles ne nomment pas de fournisseur dans le panneau (L64).
5. **Les bandeaux d'information** (bloc bleu « Les navigateurs bloquent le son… ») deviennent l'aide « ? » de la ligne concernée (« Lecture auto »).
6. **Les avertissements** tiennent en 6 mots environ : « Transcription requise pour publier ».
7. **Libellés de ligne** : 1 ou 2 mots (Langue, Voix, Style, Lecture auto, Sous-titres, Position, Bouton, Animation, Chapitre, Lead, Page, Texte alt.). Les mots longs sont abrégés seulement s'ils restent clairs (« Défil. » avec l'infobulle « Défilement »).

## 4. Voix off, après (planche 1)

| Section | Contenu |
|---|---|
| Source | Segmenté pleine largeur : `Sparkles` IA · `Mic` Micro · `Upload` Fichier, avec le point vert sur la source en place. Changer d'onglet ne supprime rien (L62 §6). |
| Voix en place | Dans son onglet : carte compacte (icône de la source, « Voix en place · Antoine », ⋯, lecture et durée). Dans un autre onglet : ligne de 36 px (Lecture, « Voix en place », source, durée). |
| Texte lu | Zone de texte remplie, avec les variables en pastille. « ? » : « Sert aussi de transcription. Les variables sont lues avec leur valeur par défaut. ». Sous le texte, à droite : « 53 car. · ≈ 5 s ». |
| Langue, Voix | Lignes `CompactSelect` : le drapeau et la langue ; l'avatar et le prénom. La voix ouvre le sélecteur validé (L62 §8, CHOIX-01), habillé de la même grammaire : recherche remplie, puces Langue et Genre de 28 px. |
| Action | « Générer la voix » (principal, 32 px) ou « Régénérer la voix » (secondaire rempli) quand une voix IA est en place. La nouvelle voix arrive dans la carte « Nouvelle voix » (Régénérer en icône, « À écouter », Garder l'actuelle, Utiliser cette voix). |
| Micro | Ligne « Enregistrer · 2 min au plus », puis Transcription (zone remplie, lien « Transcrire » dans le titre, avertissement en une ligne). |
| Lecteur | Style : segmenté à icônes Bulle (`MessageCircle`), Orbe (`CircleDot`), Barre (`PanelBottom`). Lecture auto et Sous-titres en interrupteurs. |
| Pied | « Retirer la voix » (`Trash2`, 28 px, couleur danger, sans fond). |

## 5. Autres panneaux (planche 2)

- **Étape et bulle** :
  - Bulle : Titre (avec `{ }`), texte, « Généré par IA, à vérifier » en info secondaire, Position (segmenté à 5 icônes), Bouton.
  - Étape : Nom, Animation (Aucune, Saisie, Défil.), Chapitre, Lead (avec « ? »), Page (lien).
  - Accessibilité : Texte alt.
  - Pied : Supprimer l'étape.
- **Thème** :
  - Style : tuiles compactes de 2 colonnes, avec « + Enregistrer le style » en icône dans le titre.
  - Couleurs : pastille, code et opacité dans un champ rempli.
  - Forme : Coins (3 icônes), Cadre (Adresse ou Aucun), Police.
- **Recadrage** :
  - Format : segmenté.
  - Zone : 4 nombres à préfixe L, H, X, Y en 2 colonnes, un bouton « Lier » et l'aide des poignées en « ? ».
  - Appliquer à : segmenté.
  - Pied : Réinitialiser, Annuler, Recadrer, en 28 px.

## 6. e2e (à ajouter)

`inspecteur.e2e.cjs` ouvre chaque panneau de l'éditeur, en clair et en sombre, à 1440. Il vérifie :
- le panneau fait 320 px, et l'en-tête 48 px ;
- tous les champs, listes et segmentés font 32 px, et les options des segmentés 28 px ;
- un champ n'a pas de contour (sa bordure est transparente ou nulle) **hors focus**, et un contour au focus ;
- toutes les colonnes de libellé font 92 px, et l'écart entre deux lignes est de 4 px ;
- aucun paragraphe de plus de 90 caractères n'est visible dans le corps d'un panneau ; les aides sont dans des infobulles ;
- chaque option à icône seule a un `aria-label` et une infobulle ;
- les contrastes sont d'au moins 4,5:1 (libellés, infos secondaires, options non choisies) ;
- les fonctions de L62 §6 et §8 restent en place : source sans perte, carte « Nouvelle voix », sélecteur de voix (les e2e existants restent verts).

## 7. Ordre de livraison proposé

1. Jetons et composants (§1 et §2), sans toucher aux panneaux.
2. Voix off (référence client).
3. Étape, Thème, Recadrage.
4. Les autres panneaux, un par commit, chacun avec ses captures avant et après en clair et en sombre.
