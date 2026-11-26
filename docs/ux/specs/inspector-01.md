# INSPECTOR-01 — Langage commun des panneaux de droite de l'éditeur

> **Version 3 (26/11, retour du client : appliquer les lois de l'UX).** Le client valide l'esprit de la direction B. En v2, « Régénérer la voix » avait le même fond gris et le même écart de 4 px que les champs Français et Antoine : il se lisait comme un troisième champ. La v3 corrige ce défaut. Elle fixe une règle par loi (§V3.1), des jetons de hiérarchie (§V3.2) et l'application à **tous** les panneaux (§V3.3), puis donne une grille d'auto-contrôle (§V3.4). Les planches sont dans `docs/ux/propositions/inspector-01/` :
> - `v3-planche-voix-off-corrigee.png` : le défaut v1 annoté, la v3 (voix en place, nouvelle voix), l'échelle d'écarts et les familles de contrôles, en clair et en sombre ;
> - `v3-planche-contenu.png` : Étape, Bouton d'action, Points d'intérêt, Hotspot sélectionné, Suite du parcours ;
> - `v3-planche-ecran.png` : Flou, Zoom, Projecteur, Recadrage, Image ;
> - `v3-planche-apparence-demo.png` : Design, Assistant, Réglages de la démo ;
> - `v3-grille-auto-controle.png` : la grille panneau × loi, avec les mesures.
>
> Sur chaque planche, l'avant est une capture de l'app actuelle et l'après est la maquette v3, en clair et en sombre. **La v3 remplace les §4 et §5** ; les jetons du §1 restent valables, et le §V3.2 les complète.

## V3. Lois appliquées

Source : lawsofux.com/fr. Pour chaque loi, la règle concrète dans nos panneaux. Une règle se vérifie sur la maquette ou dans le code, jamais « à l'œil ».

### V3.1 Une règle par loi

| Loi | Ce qu'elle dit | Règle dans nos panneaux |
| --- | --- | --- |
| **Proximité** | Les éléments proches sont perçus comme liés. | L'écart dit le lien, sur une échelle stricte : **4 px** entre deux contrôles d'un même groupe, **8 px** du titre de groupe à son contenu, **12 px** d'un groupe à l'action qui en dépend, **20 px** entre deux groupes, **33 px** entre deux sections (16 + filet de 1 px + 16). Une action n'est jamais à 4 px d'un champ dont elle ne fait pas partie. |
| **Similarité** | Ce qui se ressemble est perçu comme de même nature. | Trois familles, qui ne se mélangent jamais. **Champ** : fond rempli, sans contour. **Action** : jamais remplie de gris ; secondaire = contour de 1 px sur fond transparent, primaire = fond de marque, tertiaire = lien de marque. **Valeur cliquable** (puce) : rempli, avec chevron. Un bouton qui ressemble à un champ est un défaut. |
| **Région commune** | Des éléments dans une même zone délimitée forment un groupe. | Les réglages qui n'ont de sens qu'ensemble sont posés sur une **région** (fond `--region`, filet `--region-line`, 8 px de marge interne, titre en 11 px dans la région). Exemples : « Synthèse » (Français et Antoine), chaque règle de Suite du parcours, la proposition de l'Assistant, la « Nouvelle voix ». L'action qui agit sur la région reste **hors** de la région, 12 px dessous, sauf les choix de la région elle-même (Garder ou Utiliser). |
| **Connexité** | Des éléments reliés visuellement sont perçus comme liés. | Le lien entre deux objets se dessine. Suite du parcours : « Si … est … » → flèche → « Alors aller à ». Points d'intérêt : la pastille numérotée du panneau est celle du canevas, à la même couleur. Zoom, Projecteur, Recadrage : le cadre, le halo ou le cadrage est montré sur la vignette de la capture, au-dessus des réglages. |
| **Prägnanz** | L'œil lit la forme la plus simple possible. | Un panneau = une colonne, des blocs rectangulaires alignés sur 16 px de marge, un seul rayon par niveau (8 px pour les contrôles, 12 px pour les surfaces). Pas de cadre dans un cadre dans un cadre : 2 niveaux d'imbrication au plus. Aucun paragraphe visible : les aides sont derrière « ? ». |
| **Hick** | Le temps de décision croît avec le nombre de choix. | 5 options au plus dans un segmenté ; au-delà, une liste. Les choix rares ou valables pour toute la démo sont repliés en **lignes résumé**. Les tuiles visuelles (styles du Design) font exception, car on les reconnaît sans les lire. |
| **Fitts** | Le temps pour atteindre une cible dépend de sa taille et de sa distance. | Cible de **28 px au moins**, 32 px pour les champs et les actions. L'interrupteur (36 × 20) est toujours sur une ligne entière cliquable de 32 px. Les icônes seules (corbeille, ⋯) font 28 px. L'action principale est près de ce qu'elle modifie, pas au pied du panneau. |
| **Miller** | On garde environ 7 éléments en mémoire de travail. | 7 blocs au plus par panneau ouvert, en comptant l'objet et les lignes résumé. Les listes de plus de 7 éléments (zones, règles, variables) défilent dans leur groupe, avec un compteur dans le titre (« 1 / 8 »). |
| **Jakob** | Les utilisateurs attendent ce qu'ils connaissent ailleurs. | Inspecteur à droite, de 320 px, titre en haut, croix pour fermer. Saisie de l'assistant au pied, comme une messagerie. Retour (‹) en tête quand on entre dans un sous-objet (Hotspot 1). Action destructive au pied, en rouge, jamais à côté de l'action primaire. |
| **Tesler** | La complexité irréductible doit être absorbée par le système, pas par l'utilisateur. | L'utilisateur agit par verbes, pas par concepts. Voix off : plus de « source » à choisir ; Régénérer, Enregistrer et Importer créent une nouvelle voix, sans rien écraser. Hotspot : la voix n'est plus recopiée ici, une ligne mène au panneau Voix off. Recadrage : « Appliquer à » propose « Cette étape » ou « Toutes (2) », sans calcul à faire. |
| **Position sérielle** | On retient mieux le premier et le dernier élément. | En tête, **l'objet** (ce qu'on vient voir ou modifier). Au pied, ce qui conclut ou ce qui vaut pour toute la démo : action destructive, ligne résumé « Lecteur », saisie de l'Assistant, Annuler / Recadrer. Au milieu, les réglages. |
| **Von Restorff** | L'élément qui se distingue est le mieux retenu. | **Une action primaire au plus par panneau** (fond de marque). La couleur de marque est réservée à l'action primaire, à la sélection et aux liens. L'erreur se signale par une ligne rouge sous le champ fautif, pas par un bandeau. |
| **Doherty** | Sous 400 ms de réponse, on reste dans le flux. | Tout réglage local s'applique tout de suite sur le canevas. Ce qui prend plus de 400 ms montre un état **dès le clic** : synthèse vocale (« Génération… » et onde en squelette), réponse de l'Assistant (message de l'utilisateur affiché aussitôt, indicateur de saisie), envoi d'image (vignette locale tout de suite). |
| **Esthétique-utilisabilité** | Une interface soignée est perçue comme plus facile. | Typographie de la charte sur 3 tailles (14 / 13 / 11 px), icônes Lucide de 14 à 16 px et de trait 2, alignement sur la grille de 4 px. Contraste du texte ≥ 4,5:1 en clair et en sombre (mesure : 4,63 au plus bas). |
| **Pareto** | 20 % des fonctions servent 80 % du temps. | Ce qui sert le plus est ouvert et en haut (le texte de la bulle, la voix, le niveau de zoom) ; le reste est replié en lignes résumé (Réglages de la démo : Lecture, Variables, Jeu de données, Collaboration, Notes de la démo). |

### V3.2 Jetons et composants de la v3

À ajouter aux jetons du §1 :

| Jeton | Valeur | Rôle |
| --- | --- | --- |
| `--fd-insp-in-gap` | 4 px | entre deux contrôles d'un même groupe |
| `--fd-insp-title-gap` | 8 px | titre de groupe → contenu |
| `--fd-insp-act-gap` | 12 px | groupe → action qui en dépend |
| `--fd-insp-grp-gap` | 20 px | entre deux groupes d'une section |
| `--fd-insp-sec-pad` | 16 px | haut et bas d'une section (avec le filet : 33 px entre sections) |
| `--fd-insp-action-line` | #8a94a2 (clair) / #5e6978 (sombre) | contour du bouton secondaire (≥ 3:1 sur le fond) |
| `--fd-insp-region` | #f6f8fa / #1b2027 | fond d'une région commune |
| `--fd-insp-region-line` | #e2e8ef / #2a313b | filet d'une région commune |

Composants :
- `InspectorGroup` : titre en 11 px (capitales espacées, gris méta), puis contenu à 4 px ;
- `InspectorUnit` : un groupe suivi de son action à 12 px ;
- `InspectorRegion` : une surface de région commune, avec un titre facultatif ;
- `ActionButton` : variantes `primary` (fond de marque), `secondary` (contour, fond transparent) et `link` ; il n'existe **pas** de variante grise remplie ;
- `SummaryRow` : ligne résumé de 32 px au moins (icône, nom, valeur en gris, chevron), qui ouvre une surcouche ou déplie le groupe ;
- `ObjectPreview` : la vignette de la capture avec le cadre, le halo ou le cadrage dessinés dessus.

### V3.3 Tous les panneaux

| Panneau | Objet en tête | Groupes | Actions |
| --- | --- | --- | --- |
| Étape | vignette, nom éditable, page | Organisation (Chapitre, Lead en puces), Animation d'arrivée, Texte alternatif, Test A/B, Notes de l'étape | « Créer une variante B » (secondaire, sous Test A/B) ; Supprimer l'étape au pied |
| Bouton d'action | aperçu du bouton, interrupteur dessous | Bouton (libellé, lien) | — |
| Points d'intérêt | — | liste numérotée « Sur cette étape », sélection en région de marque | « Ajouter un hotspot » (secondaire, 12 px sous la liste) |
| Hotspot sélectionné | ‹ Hotspot 1, aperçu de la bulle éditable | Guidage, Position (X, Y, L, H) | ligne résumé Voix off ; Supprimer le hotspot au pied |
| Voix off | la voix : avatar, nom, lecture, onde, durée | Texte lu ; région Synthèse (Français, Antoine) | Régénérer (secondaire, 12 px sous la région) ou carte Nouvelle voix (Garder l'actuelle, Utiliser cette voix) ; liens Enregistrer et Importer ; ligne résumé Lecteur au pied |
| Suite du parcours | — | Règles (une région par règle : Si → Alors aller à), Sinon | « Ajouter une règle » (secondaire) |
| Flou | — | liste des zones, réglages de la zone choisie (Flou, Pixels, Masque ; intensité) | Annuler / Appliquer le flou restent ceux de la fenêtre (voir l'écart en §V3.4) |
| Zoom | cadre de zoom sur la vignette, interrupteur | Niveau, Centre, Mouvement | « Centrer sur le hotspot » (secondaire) |
| Projecteur | halo sur la vignette, interrupteur | Halo (taille, assombrissement) ; Fixe si moins d'animations | — |
| Recadrage | cadrage sur la vignette | Format, Zone (L, H, X, Y), Appliquer à | pied : Réinitialiser (lien), Annuler (secondaire), Recadrer (primaire) |
| Image | la capture en vignette | Capture de l'étape, Par-dessus la capture | « Remplacer la capture », « Ajouter une image » (secondaires) |
| Design | styles en tuiles | Couleurs (pastilles nommées), Forme, adresse et police (puces) | « Enregistrer le style actuel » (lien) |
| Assistant | contexte en jetons (Étape 1, Modèle auto) | fil de messages ; proposition en région | Ignorer (secondaire), Appliquer (primaire) ; saisie au pied |
| Réglages de la démo | — | Langue et étiquettes, Format des écrans ; lignes résumé Lecture, Variables, Jeu de données, Collaboration, Notes de la démo | « Appliquer à toutes les étapes » (secondaire) |

Libellés : « Notes du présentateur » existait à deux niveaux. Il devient « Notes de l'étape » dans Étape et « Notes de la démo » dans Réglages. Aucun nom de fournisseur dans l'interface : le jeton de l'Assistant dit « Modèle auto ».

### V3.4 Grille d'auto-contrôle

Contrôle panneau par panneau, sur les maquettes v3 rendues, en clair et en sombre. Les écarts entre éléments, le nombre d'actions primaires, les actions remplies, la plus petite cible et le plus petit contraste sont **mesurés** par script (planche `v3-grille-auto-controle.png`, colonne de droite).

Mesures communes aux 14 panneaux :
- écarts observés dans {4, 8, 12, 20} px seulement ;
- 1 action primaire au plus ;
- 0 action remplie de gris ;
- 0 champ à contour ;
- plus petite cible : 28 px, ou 20 px pour un interrupteur sur une ligne cliquable de 32 px ;
- plus petit contraste de texte : 4,83:1 en clair et 4,63:1 en sombre.

| Panneau | Proximité | Similarité | Région commune | Connexité | Prägnanz | Hick | Fitts | Miller | Jakob | Tesler | Position sérielle | Von Restorff | Doherty | Esthétique-utilisabilité | Pareto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Étape | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Bouton d’action | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Points d’intérêt | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Hotspot sélectionné | OK | OK | OK | OK | OK | Écart | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Voix off | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | À tenir | OK | OK |
| Suite du parcours | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Flou | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | Écart | OK | OK | OK | OK |
| Zoom | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Projecteur | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Recadrage | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Image | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | À tenir | OK | OK |
| Design | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Assistant | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | À tenir | OK | OK |
| Réglages de la démo | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |

Légende : OK = loi respectée ; — = sans objet ; À tenir = règle posée dans la maquette, à vérifier dans le code ; Écart = écart connu.

Écarts et points à tenir :
- **Hotspot sélectionné · Hick (écart)** : « Libre · Bientôt » ajoute une option qu'on ne peut pas choisir. Je la garde pour la règle « Bientôt » : elle reste grisée et non cliquable.
- **Flou · Position sérielle (écart)** : Annuler et Appliquer le flou sont en tête de la fenêtre, alors que le Recadrage les met au pied. Je propose de les mettre au pied de la fenêtre ; c'est au chef de décider.
- **Voix off · Doherty (à tenir)** : « Génération… » et onde en squelette dès le clic.
- **Assistant · Doherty (à tenir)** : le message s'affiche aussitôt, puis l'indicateur de saisie en moins de 400 ms.
- **Image · Doherty (à tenir)** : la vignette locale s'affiche tout de suite, et le téléversement se fait en fond.

e2e à ajouter, sur chaque panneau ouvert en clair et en sombre :
1. aucun bouton d'action n'a de fond gris rempli ;
2. 1 action primaire au plus ;
3. les écarts entre frères d'un groupe valent 4 px, et 12 px entre un groupe et son action ;
4. toute cible fait 28 px au moins, interrupteurs exceptés (sur une ligne de 32 px) ;
5. contraste du texte ≥ 4,5:1.


> **Version 2 (26/11, après la précision du client).** La structure « libellé à gauche, contrôle à droite » n'était qu'une piste. Je propose ma propre structure, partie de ce que l'utilisateur vient faire dans chaque panneau, en **deux directions** :
> - planche `docs/ux/propositions/inspector-01/v2-planche-voix-off-2-directions.png` : avant, direction A et direction B, en clair et en sombre, avec un tableau comparatif ;
> - planche `docs/ux/propositions/inspector-01/v2-planche-systeme-direction-b.png` : la direction B sur Étape et bulle, Thème et Recadrage.
>
> Les jetons du §1 (fonds remplis, contrôles de 32 px sans contour, séparateurs, typographie, contrastes) valent pour les deux directions. Les §4 et §5 plus bas décrivent la version 1, qui est la base de la direction A.

## 0. Version 2 : deux directions

**Ce que l'utilisateur vient faire dans Voix off** : écouter la voix de l'étape, la changer, corriger ce qu'elle dit. Tout le reste est secondaire : la langue et la voix de synthèse ne se règlent qu'une fois, et le lecteur de la démo vaut pour toute la démo, pas pour cette étape.

### Direction A : sections d'inspecteur

C'est une grammaire d'outil de design.
- Les sections sont titrées (12 px demi-gras), avec leur action ou leur résumé à droite du titre.
- Les contrôles n'ont **pas de libellé** quand leur valeur parle d'elle-même : le drapeau et « Français », l'avatar et « Antoine ».
- La source est un mini-segmenté à icônes de 24 px dans le titre « Voix ».
- Le lecteur de la démo est une section repliée, avec son résumé (« Bulle · auto · sous-titres »).

### Direction B : l'objet d'abord (recommandée)

Chaque panneau a trois couches, toujours dans le même ordre :

1. **L'objet**, en haut, dans une carte de 12 px de rayon au fond rempli :
   - Voix off : qui parle (avatar de 32 px, nom en 14 px, « Voix IA · français »), l'onde (32 px), la lecture ronde de 36 px et la durée ;
   - Étape : la bulle telle que le visiteur la verra ;
   - Recadrage : le cadrage sur une vignette de la capture ;
   - Thème : les styles en tuiles.
2. **Les actions sur l'objet, en verbes** : une barre de 3 outils de 32 px sous l'objet (Régénérer, Enregistrer, Importer).
   - La « source » n'est plus un concept à comprendre : l'action crée une nouvelle voix, qui arrive dans la carte « Nouvelle voix » (Garder l'actuelle, Utiliser cette voix).
   - Rien n'est remplacé d'office, et la règle « sans perte » de L62 §6 est tenue.
3. **Le contenu et ses réglages en valeurs cliquables** :
   - le texte se lit comme un texte, éditable sur place (fond rempli au survol et au focus seulement) ;
   - sous lui, des **puces de valeur** de 28 px (`ValueChip` : icône ou avatar, valeur, chevron) qui ouvrent leur liste : Français, Antoine, Position auto, Suivant, Sans chapitre, Coins arrondis…
   - les titres secondaires sont en 11 px demi-gras, en gris, en capitales espacées (« TEXTE LU », « ACCESSIBILITÉ »).
4. **Ce qui vaut pour toute la démo** sort du panneau de l'étape : une **ligne résumé** de 44 px au pied (« Lecteur · Bulle · lecture auto · sous-titres »). Elle ouvre une surcouche de 288 px (segmenté Bulle, Orbe, Barre ; Lecture auto ; Sous-titres).
5. **L'action destructive** (Retirer la voix, Supprimer l'étape) passe dans le menu ⋯ de l'objet ou dans le pied.

**Pourquoi B** :
- C'est la réponse directe à « n'afficher que l'essentiel, aller droit au but ». On voit et on entend la voix en entrant, on agit avec des verbes, et les réglages de la démo quittent l'étape.
- Le rendu est plus moderne : un objet présent, du texte qui respire, des valeurs plutôt qu'un formulaire.
- La grammaire reste commune : objet, valeurs, secondaire, pied.
- A coûte moins cher à développer et reste un bon repli si le client préfère un rendu « outil de design ».

**Composants en plus pour B** : `InspectorObject` (la carte de l'objet, avec sa barre d'outils), `ValueChip` (28 px), `InlineText` (texte éditable sur place), `SummaryRow` (ligne résumé, avec sa surcouche).

**Mesures vérifiées sur la maquette B, en clair et en sombre** :
- panneau de 320 px, en-tête de 48 px ;
- outils de 32 px, puces de 28 px, lecture de 36 px, ligne résumé de 44 px ;
- contrastes : 4,8:1 au moins (infos secondaires), 5,4:1 pour les titres secondaires et le texte d'aide en clair, 12:1 et plus pour les puces et les outils.

---


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
