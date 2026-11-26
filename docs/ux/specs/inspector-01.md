# INSPECTOR-01 — Langage commun des panneaux de droite de l'éditeur

> **Version 1.1 (26/11, décision du client) : c'est la version à retenir.**
>
> Le client garde la **v1** (d0ce330) comme base : couleurs, formes, style des contrôles, Source « IA · Micro · Fichier », Thème, Format et Zone du Recadrage.
>
> Il reprend de la v2 seulement les **aperçus en tête des panneaux Étape et Recadrage**, et ne demande de corriger que ce qui enfreint les lois de l'UX.
>
> Les directions A et B (v2, §0) et la refonte v3 (7e1dc24) ne sont **pas retenues**. Leurs planches restent dans le dossier pour l'historique, mais ne servent plus de référence.
>
> Planches v1.1 dans `docs/ux/propositions/inspector-01/`, en clair et en sombre :
> - `v1-1-planche-voix-off.png` : le défaut de la v1, annoté, à côté de la v1.1 (voix en place, nouvelle voix) ;
> - `v1-1-planche-contenu.png` : Étape, Bouton d'action, Points d'intérêt, Hotspot sélectionné, Suite du parcours ;
> - `v1-1-planche-ecran.png` : Flou, Zoom, Projecteur, Recadrage, Image ;
> - `v1-1-planche-apparence-demo.png` : Design, Assistant, Réglages de la démo ;
> - `v1-1-grille-auto-controle.png` : la grille panneau × loi, avec les mesures.
>
> Sur chaque planche, l'avant est une capture de l'app actuelle. Les §1 à §5 (v1) restent la référence ; la section V1.1 ci-dessous les complète.

## V1.1. Lois appliquées (corrections à la marge de la v1)

Source : lawsofux.com/fr. La v1 est gardée telle quelle ; chaque loi ne change que ce qui l'enfreignait.

### V1.1.1 Une règle par loi

| Loi | Règle dans nos panneaux | Ce que la v1.1 corrige |
| --- | --- | --- |
| **Proximité** | L'écart dit le lien : **4 px** entre deux lignes d'un groupe, **8 px** du titre de section au contenu, **12 px** d'un groupe à l'action qui en dépend, **25 px** entre deux sections (12 + filet + 12). | Titre → contenu passe de 6 à 8 px ; l'action passe de 4 à 12 px sous son groupe (« Régénérer la voix », « Ajouter un hotspot », « Ajouter une règle », « Centrer sur le hotspot », « Remplacer la capture »…). |
| **Similarité** | Un champ est gris rempli, sans contour (v1). Une action ne l'est **jamais** : secondaire = contour de 1 px sur fond transparent (`.btn.line`), primaire = fond de marque, destructive = texte rouge au pied. | « Régénérer la voix », « Garder l'actuelle », « Annuler » et « Ignorer » perdent leur fond gris et prennent un contour. Tous les réglages oui / non sont des interrupteurs (la case « Animation de pulsation » du Hotspot en devient un). |
| **Région commune** | Ce qui forme un tout est posé sur une même surface : carte de la voix, carte « Nouvelle voix », chaque règle de Suite du parcours, la proposition de l'Assistant. | Voix off : Langue et Voix forment la région « Synthèse », et « Régénérer la voix » est posé 12 px dessous, hors de la région. Les règles de Suite du parcours ont chacune leur surface encadrée. |
| **Connexité** | Le lien entre deux objets se dessine : flèche « Alors aller à » entre condition et destination ; pastille numérotée identique au canevas ; cadre de zoom, halo et cadrage montrés sur la vignette de la capture. | Aperçus en tête de Recadrage (repris de la v2), de Zoom et de Projecteur. |
| **Prägnanz** | Une colonne, des lignes « libellé \| contrôle » de 36 px, un seul rayon par niveau ; pas de paragraphe visible, les aides sont derrière « ? ». | Les paragraphes de Zoom, Projecteur et Hotspot passent derrière « ? ». |
| **Hick** | 5 options au plus dans un segmenté ; au-delà, une liste. Les réglages rares sont repliés. | Réglages de la démo : 5 sections repliées avec leur résumé (Lecture, Variables, Jeu de données, Collaboration, Notes de la démo). |
| **Fitts** | Cible de 28 px au moins ; un interrupteur est sur une ligne entière cliquable de 32 px. | Les boutons icône passent de 24 à 28 px (⋯ de la carte de voix, Régénérer de la carte « Nouvelle voix », « + » du Style). Les libellés d'interrupteur prennent toute la ligne (avant : « Zoom sur une zone » sur 2 lignes). |
| **Miller** | 7 blocs au plus par panneau ouvert ; au-delà, on replie. | Réglages de la démo : de 1 720 px à 2 sections ouvertes et 5 repliées. |
| **Jakob** | Inspecteur de 320 px à droite, titre et croix en haut, retour ‹ pour un sous-objet, action destructive au pied, saisie de l'Assistant au pied. Le nom du panneau est celui du rail. | Le panneau « Thème » de la v1 reprend le nom du rail, « Design ». Le Hotspot sélectionné a son retour ‹ dans l'en-tête. |
| **Tesler** | Le système absorbe la complexité : sources sans perte (la carte « Nouvelle voix » ne remplace rien d'office), « Appliquer à » sans calcul. | Ce qui vaut pour toute la démo le dit : la section Lecteur de Voix off porte « Toute la démo ». |
| **Position sérielle** | En tête l'objet (aperçu de la bulle, carte de la voix, vignette) ; au pied ce qui conclut (supprimer, Annuler / Recadrer, saisie). | Aperçu de la bulle en tête d'Étape et du Hotspot (repris de la v2). |
| **Von Restorff** | Une action primaire au plus par panneau. | « Envoyer » de l'Assistant passe en couleur douce, pour laisser « Appliquer » seule primaire. |
| **Doherty** | Un réglage local s'applique tout de suite sur le canevas ; au-delà de 400 ms, un état s'affiche dès le clic. | À tenir en code : synthèse de la voix, réponse de l'Assistant, envoi d'une image. |
| **Esthétique-utilisabilité** | Jetons, typographie et icônes de la v1 ; contraste du texte ≥ 4,5:1. | Mesuré : 4,83:1 au plus bas en clair, 4,88:1 en sombre. |
| **Pareto** | Ce qui sert le plus est ouvert et en haut ; le reste est replié ou plus bas. | Étape : la bulle et ses réglages en haut ; Test A/B et notes plus bas (le panneau défile). |

### V1.1.2 Jetons et classes ajoutés à la v1

Les jetons du §1 ne changent pas. Les ajouts sont dans `docs/ux/propositions/inspector-01/v1-1.css` :
- `--fd-insp-action-line` : #8a94a2 en clair, #5e6978 en sombre. C'est le contour de l'action secondaire, à 3:1 au moins sur le fond.
- `.btn.line` : action secondaire à contour. **Il n'existe plus d'action grise remplie** : `.btn.alt` est retiré des actions.
- Écart titre → contenu de 8 px (`.st` : 4 px de marge plus les 4 px de la section). Action à 12 px sous son groupe (`.act` : 8 px plus 4).
- Boutons icône de 28 px. Ligne d'interrupteur au libellé pleine largeur.
- Classes utilitaires :
  - `.scope` : portée « Toute la démo », « Privées », compteur ;
  - `.li` : ligne de liste de 36 px ;
  - `.rule` + `.flow` : règle et flèche ;
  - `.slide` : curseur avec sa valeur ;
  - `.fold` : section repliée avec son résumé ;
  - `.cropbox` avec `.zf` (cadre de zoom) et `.halo`.

### V1.1.3 Tous les panneaux

| Panneau | Ce qui vient de la v1 | Ajouté ou corrigé |
| --- | --- | --- |
| Étape | Lignes Position (5 icônes), Bouton ; Nom, Animation, Chapitre, Lead, Page ; Texte alt. | Aperçu de la bulle en tête, modifiable sur place ; « Créer une variante B » à contour ; « Notes de l'étape » (Privées). |
| Bouton d'action | Lignes Libellé, Lien | Interrupteur sur sa ligne et aperçu du bouton. |
| Points d'intérêt | — | Liste de lignes de 36 px, avec la pastille du canevas ; « Ajouter un hotspot » à contour, 12 px dessous. |
| Hotspot sélectionné | Segmenté Guidage ; X / Y / L / H en 2 × 2, comme la Zone du Recadrage | Retour ‹ ; aperçu de la bulle ; Pulsation en interrupteur. |
| Voix off | **Inchangée** : Source IA · Micro · Fichier et point vert, carte « Voix en place », Texte lu, Langue, Voix, Lecteur | Langue et Voix dans la région « Synthèse » ; Régénérer à contour, 12 px sous la région ; « Garder l'actuelle » à contour ; ⋯ à 28 px ; « Toute la démo » sur Lecteur. |
| Suite du parcours | Listes déroulantes v1 | Règle sur sa surface, flèche, erreur sous le champ ; « Ajouter une règle » à contour. |
| Flou | Segmenté Flou / Pixels / Masque ; liste des zones, réglages de la zone choisie | Annuler et Appliquer le flou passent au pied de la fenêtre, comme le Recadrage (décision du chef) ; Annuler à contour. |
| Zoom | Segmentés Niveau et Transition ; H / V | Interrupteur pleine ligne ; cadre sur la vignette ; « Centrer sur le hotspot » à contour. |
| Projecteur | — | Halo sur la vignette ; Taille et Assombrir en curseurs ; aides derrière « ? ». |
| Recadrage | **Inchangé** : Format, Zone L / H / X / Y avec lien, Appliquer à, pied Réinitialiser / Annuler / Recadrer | Aperçu du cadrage en tête ; Annuler à contour. |
| Image | — | Vignette ; « Remplacer la capture » et « Ajouter une image » à contour. |
| Design | **Inchangé** (Thème de la v1) : Style en tuiles, Couleurs « pastille + code + 100 % », Coins, Cadre, Police | Nom du rail ; « + » à 28 px. |
| Assistant | — | Proposition en carte (Ignorer à contour, Appliquer en primaire) ; Envoyer en couleur douce. |
| Réglages de la démo | Lignes et segmentés v1 | 2 sections ouvertes, 5 repliées avec leur résumé. |

### V1.1.4 Grille d'auto-contrôle

Contrôle de chaque panneau v1.1, rendu en clair et en sombre. Le script mesure 4 points (planche `v1-1-grille-auto-controle.png`) :
- écarts observés : uniquement 4, 8 et 12 px dans une section, et 25 px entre sections ;
- 1 action primaire au plus, et 0 action grise remplie ;
- plus petite cible : 28 px ;
- plus petit contraste de texte : 4,83:1 en clair, 4,88:1 en sombre.

| Panneau | Proximité | Similarité | Région commune | Connexité | Prägnanz | Hick | Fitts | Miller | Jakob | Tesler | Position sérielle | Von Restorff | Doherty | Esthétique-utilisabilité | Pareto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Étape | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Bouton d’action | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Points d’intérêt | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Hotspot sélectionné | OK | OK | OK | OK | OK | Écart | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Voix off | OK | OK | OK | — | OK | OK | OK | OK | OK | Écart | OK | OK | À tenir | OK | OK |
| Suite du parcours | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Flou | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Zoom | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Projecteur | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Recadrage | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Image | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | À tenir | OK | OK |
| Design | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| Assistant | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | À tenir | OK | OK |
| Réglages de la démo | OK | OK | OK | — | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |

Légende :
- OK : loi respectée ;
- — : sans objet pour ce panneau ;
- À tenir : à vérifier dans le code ;
- Écart : écart connu, motivé ci-dessous.

Écarts et points à tenir :
- **Hotspot sélectionné · Hick (écart)** : « Libre · Bientôt » ajoute une option qu'on ne peut pas choisir. Je la garde pour la règle « Bientôt » : grisée, non cliquable.
- **Voix off · Tesler (écart)** : le Lecteur vaut pour toute la démo mais reste dans Voix off, comme dans la v1 retenue par le client. La section porte « Toute la démo ».
- **Voix off, Assistant, Image · Doherty (à tenir)** : un état dès le clic au-delà de 400 ms.

e2e à ajouter, sur chaque panneau ouvert, en clair et en sombre :
1. aucun bouton d'action n'a le fond des champs (`--fd-insp-fill`) ;
2. 1 action primaire au plus ;
3. 12 px entre un groupe et son action, 8 px entre un titre de section et son contenu ;
4. toute cible fait 28 px au moins, interrupteurs exceptés (ligne de 32 px) ;
5. contraste du texte ≥ 4,5:1.


### V1.1.5 Compléments à la marge (26/11, sans changer l'aspect présenté au client)

Relecture de la v1.1 pendant l'attente du client. Rien ne change sur les planches : ce sont des règles de code et de test qui protègent ce qui est déjà dessiné.

1. **Contraste des composants (WCAG 1.4.11).** Mesures :
   - contour `.btn.line` : 3,07:1 sur le fond du panneau en clair, 3,16:1 en sombre. Conforme, mais **seulement sur le fond du panneau** ;
   - sur le fond d'un champ (`--fd-insp-fill`), il tombe à 2,73:1.

   Un seul cas dans la v1.1 : « Ignorer » dans la carte de proposition de l'Assistant (carte remplie), à 2,73:1 en clair et 2,66:1 en sombre.

   Règle : sur une carte remplie (`.card`, `.li`), le contour d'une action prend `--fd-insp-action-line-on-fill` (#7b8594 en clair, #6b7684 en sombre), soit **3,32:1 et 3,21:1**. L'écart de teinte est imperceptible sur les planches, qui ne changent pas. La règle est ajoutée dans `v1-1.css`.
2. **Champ rempli sans contour.** Fond du champ contre fond du panneau : 1,12:1 en clair et 1,19:1 en sombre. C'est l'aspect de la v1, validé ; il est acceptable parce que chaque champ a **toujours** un libellé visible à gauche (ligne « libellé | contrôle »). Règles pour le tenir :
   - jamais de champ identifié par son seul texte indicatif ;
   - au survol, `--fd-insp-fill-hover` ;
   - au focus, le trait intérieur prune de 2 px de FIELD-01 ;
   - en erreur, le trait rouge de 1 px et le message sous le champ.
3. **États d'attente (Doherty, « à tenir »).** Ils sont repris de la grille (`v1-1-grille-auto-controle.png`) et précisés pour le code :
   - **Voix off** : dès le clic, le bouton garde sa largeur et devient « Génération… » avec un indicateur de 16 px, et l'onde de la carte passe en squelette. La zone d'annonce dit une fois « Génération de la voix en cours ».
   - **Image** : la vignette locale s'affiche tout de suite, et le téléversement se fait en fond, avec une barre fine sous la vignette.
   - **Assistant** : le message de l'utilisateur s'affiche aussitôt, puis l'indicateur de saisie arrive en moins de 400 ms.
   - Pour les trois : `aria-busy="true"` sur la zone qui change. À la fin, le résultat remplace l'état sans saut de mise en page. En cas d'échec, le message s'affiche sous l'action, avec « Réessayer » à contour.
4. **Clavier.**
   - L'ordre du focus suit l'ordre visuel : en-tête (retour ‹, titre, croix), aperçu en tête, sections de haut en bas, pied.
   - Une section repliée (`.fold`) est un bouton avec `aria-expanded`, qui s'ouvre avec Entrée ou Espace et rend le focus à son titre.
   - Une liste `.li` se parcourt avec les flèches, et Suppr retire la ligne avec une confirmation douce (toast « Annuler »).
5. **Mouvement réduit.** Le glissement du segmenté, l'ouverture des sections repliées et l'apparition de l'aperçu passent à 0 ms avec `prefers-reduced-motion: reduce`.

e2e à ajouter à la liste ci-dessus :
6. le contour d'un `.btn.line` atteint 3:1 contre le premier fond opaque de ses parents, carte remplie comprise ;
7. tout champ a un libellé visible relié par `for` ou `aria-labelledby` ;
8. une action longue (voix, image, Assistant) passe à `aria-busy="true"` en moins de 100 ms après le clic ;
9. les sections repliées ont `aria-expanded`, et le focus reste sur leur titre après l'ouverture.


> **Version 3 (7e1dc24), non retenue** : refonte complète des panneaux selon les lois de l'UX. Le client l'écarte : il voulait des corrections à la marge de la v1. Ses planches `v3-*` restent pour l'historique.

> **Version 2 (26/11), non retenue par le client (directions A et B).** La structure « libellé à gauche, contrôle à droite » n'était qu'une piste. Je propose ma propre structure, partie de ce que l'utilisateur vient faire dans chaque panneau, en **deux directions** :
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
