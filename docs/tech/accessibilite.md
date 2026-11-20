# Accessibilité (lot L24, RGAA)

Ce rapport présente l'état de l'accessibilité de TutoClick avant et après le lot L24, ainsi que les contrôles automatisés qui empêchent les régressions. Le référentiel est le RGAA 4.1, qui reprend les critères WCAG 2.1 de niveaux A et AA.

> Périmètre : l'app web (éditeur, tableau de bord, partage, analytics, apprenants, réglages), le lecteur de démo et le centre de formation public. Le PDF balisé reste une dette connue (voir § 5).

## 1. Méthode

Deux scripts tournent en intégration continue, dans le job « Accessibilité (axe-core, RGAA) » de `.github/workflows/ci.yml`. Ils bloquent la fusion en cas de régression.

| Script | Ce qu'il vérifie |
|---|---|
| `apps/web/e2e/a11y.e2e.cjs` | Audit axe-core sur toutes les routes de l'app et du lecteur, en clair et en sombre : règles WCAG 2.1 A et AA (L24), puis WCAG 2.2 AA depuis L34 (§ 7). Il échoue dès qu'une violation « serious » ou « critical » apparaît. L'option `--report` écrit le détail en JSON, qui est conservé comme artefact de la CI. |
| `apps/web/e2e/a11y-clavier.e2e.cjs` | Les points qu'axe ne voit pas : lien d'évitement, focus visible sur 9 pages au clavier, focus enfermé dans les modales puis rendu au bouton d'origine, zone des messages, animations réduites, zoom 200 % sans défilement horizontal, lecteur utilisable au clavier et annoncé. 35 contrôles. |

Pages auditées :
- **App** : connexion, inscription, mot de passe oublié, démos, modale « Nouvelle démo », modale d'export, éditeur, quiz, partage, accès, analytics d'une démo, analytics, leads, apprenants, réglages du centre, profil, membres, workspace, plans, marque, variables.
- **Lecteur** : démo, mot de passe, lien expiré.
- **Centre** : accueil identifié, accueil anonyme, formation terminée, mot de passe.

Pour lancer les scripts en local : démarrer l'app web et le lecteur avec `VITE_SUPABASE_ANON_KEY=test` (voir le README), puis lancer `pnpm --filter @flowdsiml/web a11y` et `node apps/web/e2e/a11y-clavier.e2e.cjs`.

## 2. Avant / après (audit axe-core)

| | Avant L24 | Après L24 |
|---|---|---|
| Audits avec au moins une violation bloquante | 29 sur 56 | **0 sur 56** |
| Violations « critical » | 6 | **0** |
| Violations « serious » | 35 | **0** |
| Violations « moderate » et « minor » | 0 | 0 |

Le lecteur et le centre de formation n'avaient déjà aucune violation axe avant L24. Les corrections portent sur l'app web, plus quelques points du lecteur que seuls les contrôles manuels font ressortir (§ 3).

Détail des violations corrigées (un même problème compte une fois par page et par thème) :

| Règle axe | Critère RGAA | Nb | Cause | Correction |
|---|---|---|---|---|
| `color-contrast` | 3.2 | 19 | Le texte secondaire `#66727F` sur le fond `#EEF2F6` ne donnait que 4,36:1 (barre latérale, sous-titres, mentions légales). Autres cas : vert sur fond sombre dans les réglages du centre, blanc sur l'orange de l'entonnoir, blanc sur le bleu du badge « Plan actuel », vignette texte de l'éditeur en sombre. | Le jeton `text-subtle` passe à `#5F6B78` (4,83:1 sur le fond de page, valeur retenue par la Lead UX, A11Y-11). Le vert utilise le jeton `success` et le badge une encre foncée. L'entonnoir passe en texte `#080808` (9,6:1) et la vignette sur fond clair. |
| `link-in-text-block` | 10.6 | 8 | Liens placés dans du texte, distingués seulement par la couleur. | Ces liens sont soulignés. « Parlons Enterprise » est maintenant un bouton : il ouvre une fenêtre et ne mène pas à une page. |
| `label-content-name-mismatch` | 6.1 / 11.2 | 6 | Sélecteur de langue nommé « Changer de langue » alors qu'il affiche « Français ». Périodes « 7 j » nommées « 7 jours ». | Le nom accessible contient le texte visible : « Changer de langue : Français ». Le texte court est visible et le libellé complet est réservé aux lecteurs d'écran. |
| `aria-allowed-attr` | 7.1 | 4 | `aria-pressed` sur des boutons `role="radio"` (formats d'export), `aria-selected` sur les boutons du rail de l'éditeur. | Les boutons radio utilisent `aria-checked` et les étapes du rail `aria-current="step"`. Le style suit ces attributs. |
| `aria-valid-attr-value` | 7.1 | 2 | `aria-controls` visait un bloc absent quand l'expiration du lien est coupée. | `aria-controls` n'est posé que quand le bloc existe. |
| `scrollable-region-focusable` | 7.3 | 2 | Bloc de code défilant (paramètres d'URL) inatteignable au clavier. | Le bloc devient une région nommée et focalisable (`tabindex="0"`). |

## 3. Contrôles manuels et corrections

| Thème | Avant | Après |
|---|---|---|
| **Navigation clavier** | Le lien d'évitement et l'ordre de tabulation étaient déjà en place. Dans les modales natives, la tabulation sortait vers le navigateur après le dernier élément. | Dans toute fenêtre modale, la tabulation boucle sur les éléments de la fenêtre (`lib/dialogFocus.ts`), dans les deux sens. Échap ferme la fenêtre et rend le focus au bouton d'origine, y compris quand la fenêtre a été ouverte depuis un menu « … ». |
| **Focus visible** | Indicateur global déjà présent. Il était effacé sur les boutons de contrôle du lecteur (« Étape suivante », langue, plein écran) par une règle `box-shadow: none`. | Anneau de focus rétabli sur ces boutons. Le test parcourt 45 arrêts de tabulation sur 7 pages de l'app et 30 sur le lecteur et le centre : chaque arrêt a un indicateur visible. |
| **Libellés des champs et boutons-icônes** | Couverts par axe (`label`, `button-name`, `link-name`), sans violation. | Inchangé. Les noms accessibles reprennent maintenant aussi le texte visible (voir § 2). |
| **Messages (toasts)** | Zone `role="status"` et `aria-live="polite"` déjà présente dès le chargement. | Vérifié par le test. Même principe pour l'aide « nom non renseigné » de l'attestation (L15-07) : la zone d'état existe avant le message et reçoit le focus quand le bouton disparaît. |
| **Contrastes** | 19 défauts (voir § 2). | 0. Jetons corrigés par la Lead UX (05a7621) et repris : `text-subtle` #5F6B78, `border-strong` #768294, anneau de focus #1F7FB6. |
| **Animations réduites** | Seules certaines animations étaient coupées (pastille pulsée, zoom). | Avec `prefers-reduced-motion: reduce`, toutes les animations et transitions sont coupées dans l'app (`packages/ui/src/base.css`), le lecteur et le centre (`apps/player/src/player.css`). Le test vérifie qu'aucune animation ne reste active. L'aperçu GIF de l'export était déjà en pause par défaut. |
| **Zoom 200 %** | Le tableau des apprenants faisait déborder la page : les textes masqués des en-têtes, positionnés en absolu, sortaient de la zone défilante. Le menu « … » pouvait être coupé avec un défilement interne. | Les tableaux défilants servent de bloc conteneur à ces éléments positionnés. Quand aucun côté du bouton ne suffit, le menu est décalé pour tenir entier dans la fenêtre. Le test vérifie 10 pages en 720 × 450 px (200 % d'un écran de 1440 × 900) : aucune ne défile horizontalement. |
| **Lecteur** | Navigation au clavier déjà possible (flèches gauche et droite, boutons). Le changement d'étape n'était pas annoncé. | Une zone `aria-live="polite"`, toujours présente, annonce « Étape n sur N », le titre puis le texte de la bulle. Le test vérifie la navigation par flèches et par « Suivant » au clavier, et l'annonce de chaque étape. |

## 3 bis. Audit manuel de la Lead UX (A11Y-01 à 14)

L'audit manuel (`docs/ux/a11y/audit-rgaa-l24.md`, sur 821e4b4) a relevé 14 écarts. Ils sont corrigés et vérifiés par `a11y-clavier.e2e.cjs`, sauf A11Y-10, qui reste une dette connue.

| Code | Gravité | Correction | Contrôle automatique |
|---|---|---|---|
| A11Y-01 | Majeur | Le titre de la page suit le h1 de l'écran : « Démos · TutoClick », « Éditeur : {{démo}} · TutoClick »… Il se met à jour quand le h1 change (`lib/routeFocus.tsx`). | Titre du tableau de bord, d'Analytics et de l'éditeur |
| A11Y-02 | Majeur | Au changement d'écran, le focus passe sur le h1 (`tabindex=-1`, sans anneau). Cela ne se fait qu'après une action du visiteur, pas pour une redirection ni pour un filtre ou un onglet de la même page. Le lien d'évitement reste le premier arrêt. | Focus sur le h1 après un clic dans la navigation |
| A11Y-03 | Bloquant | Une zone `aria-live`, présente dès l'affichage, annonce « Étape n sur N. Titre. Texte ». Si le focus était dans l'ancienne bulle, il passe sur le titre de la nouvelle étape (bulle ou écran texte). S'il est sur la barre du bas, il y reste. Les flèches et Échap suivent le même chemin. | Annonce, flèches, « Suivant » au clavier, focus sur le titre de la bulle |
| A11Y-04 | Majeur | L'anneau de focus de la barre du lecteur est rétabli, en #1F7FB6 au lieu de la couleur de marque. | Focus visible sur 30 arrêts du lecteur |
| A11Y-05 | Majeur | Le titre de la démo devient le h1, les écrans texte passent en h2 et la scène est dans `main`. | Présence du h1 et de `main` |
| A11Y-06 | Majeur | Alternative : « Capture de l'écran, étape n sur N : {{titre}} ». | Texte de l'alternative |
| A11Y-07 | Mineur | Partager : les titres des cartes passent en h2. Formation du centre : un h2 « Modules », visuellement masqué, précède la liste. | audit axe |
| A11Y-08 | Mineur | Le titre de la fenêtre de confirmation a un identifiant unique (`useId`). | Aucun identifiant en double sur 6 pages |
| A11Y-09 | Mineur | `aria-controls` n'est posé que si la cible est montée : menu ouvert, popover d'étiquettes, onglet actif, panneau des commentaires. | Aucune référence ARIA cassée sur 6 pages |
| A11Y-10 | Majeur | **Dette connue** : PDF exportés non balisés (jsPDF). À mentionner dans la déclaration. | — |
| A11Y-11 à 13 | Mineur / Majeur | Jetons de la Lead UX repris. Les champs de recherche (tableau de bord, centre) ont un contour à 3:1 au moins. Le focus du centre et du lecteur n'est plus codé en dur. | audit axe, focus visible |
| A11Y-14 | Mineur | Les valeurs sont déjà écrites dans l'entonnoir, les apprenants, le donut et l'export. Pour les barres denses de 90 jours, dont les valeurs n'apparaissent qu'au survol, un liseré foncé est ajouté (les valeurs restent dans la table pour lecteur d'écran). | — |

Autre amélioration demandée par le chef : sur l'attestation (L15-07), le centre sait dès le chargement si le nom de l'apprenant est connu (`visitor.hasName`, migration `20261118140000`, booléen sans donnée nominative). Sans nom connu, l'aide remplace le bouton d'emblée.

## 4. Composants ajoutés

- `@axe-core/playwright` 4.14 (avec axe-core) et Playwright 1.63 : dépendances de développement, utilisées seulement en test. Leurs licences sont dans `THIRD_PARTY.md`. axe-core est sous MPL-2.0, copyleft limité à ses propres fichiers, sans modification et sans livraison.
- Aucune migration de base de données.

## 5. Limites et suites

- **PDF balisé (exports L15)** : jsPDF ne produit ni la structure de titres ni les textes alternatifs des captures. C'est une dette connue, à reprendre si l'on change de moteur PDF.
- **Ce que l'automatisation ne couvre pas** : il manque un audit RGAA complet par une personne qualifiée, avec lecteurs d'écran réels (NVDA, VoiceOver) et grille officielle. Ce rapport ne vaut pas déclaration de conformité. Le statut affiché dans le pied du centre reste celui que choisit l'administrateur (« non évalué » par défaut).
- **Contenus créés par les clients** : les contrastes et les textes des démos (couleurs de marque, bulles) dépendent de leurs auteurs. L'éditeur contrôle déjà le contraste de la couleur de marque (4,5:1).

## 6. Passe L27 (écrans ajoutés depuis L24)

- **Audit axe** (`apps/web/e2e/a11y.e2e.cjs`), étendu aux écrans des lots L18 à L26 :
  - onglet Design (styles prédéfinis), test A/B, zone de flou et ses réglages, médiathèque ;
  - vue présentateur et modale de lancement, télécommande sur téléphone ;
  - Analytics : sessions, « Mesure des visites » ;
  - aide (tiroir, recherche, article), « Partir d'un modèle », « Enregistrer comme modèle » ;
  - lecteur : page publique d'une démo.

  Résultat : **0 violation sérieuse ou critique** sur l'ensemble des écrans, en clair et en sombre.
- **Correction** : l'aperçu de la vue présentateur (iframe du lecteur, piloté par la vue) était en `tabindex="-1"` avec un contenu focalisable (`frame-focusable-content`). Il est maintenant `inert` : hors du clavier et de l'arbre d'accessibilité, puisque les commandes sont celles de la vue présentateur.
- **Clavier**, vérifié par les e2e de chaque lot :
  - tiroir d'aide : F1, focus dans la recherche, Échap, retour du focus ;
  - « Partir d'un modèle » : flèches dans la grille, Entrée pour utiliser ;
  - télécommande : code lu chiffre par chiffre, cibles de 64 px ;
  - « Prise en main » : Réduire avec `aria-expanded` ;
  - suite `a11y-clavier.e2e.cjs` sans échec.
- **Paramètres > Marque (L27-01 à 05)**, ajoutés à l'audit : page (administrateur et éditeur), modale « Modifier le style », confirmation du style par défaut. 0 violation sérieuse ou critique.
  - L'aperçu de la modale de style (`aria-hidden`) montre volontairement les couleurs choisies, même sous le seuil : il est exclu de la règle de contraste pour cet état seulement. Le contraste est annoncé en texte sous chaque champ (« Bulle : contraste 1,6:1, insuffisant. ») avec la couleur proposée.
  - Une action indisponible d'un menu (« Supprimer » sur le style par défaut) reste focalisable en `aria-disabled`, avec son explication reliée par `aria-describedby`.
  - Les deux contrôles d'une couleur ont des noms distincts : « Couleur principale » (saisie) et « Nuancier : Couleur principale ».

## 7. Audit WCAG 2.2 AA (lot L34)

Référentiel : WCAG 2.2 niveaux A et AA (le RGAA 4.1 reprend la version 2.1 ; les critères ajoutés par 2.2
sont vérifiés en plus).

### 7.1 Audit automatique (axe-core)

- Règles `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` et `wcag22aa` (taille des cibles, 2.5.8).
- Routes ajoutées depuis L27 : pages légales, nouveau mot de passe, invitation, écran public du
  présentateur, vue mobile de l'éditeur, squelette de chargement, cartes d'erreur (démos, éditeur, lecture
  des espaces), panneau d'une zone sélectionnée, recadrage, formulaire de contact du lecteur.
- Résultat : __AUDIT__
- Le script échoue maintenant si une page connectée retombe sur l'écran de connexion (session fictive mal
  configurée) : sans ce garde-fou, la page de connexion était auditée à la place, sans erreur.

### 7.2 Critères ajoutés par WCAG 2.2

| Critère | Constat | Correction | Contrôle |
|---|---|---|---|
| 2.4.11 Focus non masqué (minimum) | Aucun élément focalisé entièrement caché par la barre du haut, les panneaux ou les commentaires. | — | `a11y-clavier` : 5 points de chaque élément focalisé testés sur 7 pages de l'app, le lecteur et le centre |
| 2.5.7 Mouvements de glisser | Déplacer ou redimensionner une zone (hotspot, flou), placer le recadrage, réordonner les formations du centre et régler la hauteur des commentaires demandaient un glisser (ou le clavier, qui ne compte pas comme alternative de pointeur). | Section « Position et taille » (gauche, haut, largeur, hauteur en %) dans les panneaux hotspot et flou ; champs « Gauche » et « Haut » du recadrage ; boutons Monter et Descendre des formations du centre ; un clic sur la poignée des commentaires passe à la taille suivante. Les étapes du rail, les champs du formulaire et les questions du quiz avaient déjà des boutons. Le curseur avant/après du lecteur est un `input type=range` natif (un clic suffit). | audit axe des panneaux ; `a11y-clavier` (position réglée dans le panneau) |
| 2.5.8 Taille des cibles (minimum) | Aucune cible sous 24 × 24 px sans espacement suffisant. | Nouveaux boutons à 32 px. | axe (`target-size`) |
| 3.2.6 Aide cohérente | Le bouton Aide (F1) est au même endroit dans toutes les barres du haut. | — | revue |
| 3.3.7 Saisie redondante | Aucun parcours ne redemande une information déjà donnée. | — | revue |
| 3.3.8 Authentification accessible | Champs `autocomplete` (`email`, `current-password`, `new-password`), collage permis, lien de connexion par e-mail, aucun test cognitif. | — | revue |

### 7.3 Clavier, modales et annonces

- **Onglets du panneau de l'éditeur** (Étape, Design, Réglages) : les onglets inactifs étaient en
  `tabindex=-1` sans gestion des flèches, donc inatteignables au clavier (échec 2.1.1). Flèches, Début et
  Fin les activent maintenant, comme dans les autres listes d'onglets de l'app (toutes vérifiées).
- **Fenêtres modales en `role="dialog" aria-modal="true"`** (raccourcis, styles, assistance IA,
  glossaire, plans, variables, mesure des visites…) : la tabulation pouvait sortir vers la page et le
  focus n'était pas toujours placé dans la fenêtre. `lib/dialogFocus.ts` les traite maintenant comme les
  `<dialog>` natifs : focus dans la fenêtre à l'ouverture, tabulation enfermée dans les deux sens, focus
  rendu à l'élément d'origine à la fermeture.
- **Lecteur** : fenêtre de fin, formulaire de contact et reprise du parcours gèrent leur focus de la même
  façon (`apps/player/src/modalFocus.tsx`).
- **Parcours complet au clavier**, ajouté à `a11y-clavier.e2e.cjs` :
  - éditeur : rail atteint, changement d'étape aux flèches, déplacement d'une étape (Espace, flèche,
    Espace) annoncé, zone du canevas sélectionnée et déplacée aux flèches, position réglée dans le
    panneau, onglets aux flèches, fenêtre des raccourcis (« ? ») avec focus enfermé puis rendu ;
  - lecteur : navigation aux flèches jusqu'au formulaire de contact, focus dans la fenêtre et tabulation
    enfermée dans les deux sens.
- **Annonces `aria-live`** : changement d'étape du lecteur, déplacement d'une étape du rail, sélection et
  déplacement d'une zone du canevas, dimensions du recadrage, chargements (squelettes L32) et messages ;
  toutes présentes dans le DOM avant le message.

### 7.4 Limites

- Le PDF balisé (A11Y-10) reste une dette connue.
- Aucun test avec lecteurs d'écran réels (NVDA, VoiceOver) dans ce lot : ce rapport ne vaut pas
  déclaration de conformité.
