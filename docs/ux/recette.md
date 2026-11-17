# Recette design

> Contrôle de ce qui est codé par rapport aux maquettes (`docs/ux/maquettes/`), aux spécifications (`docs/ux/composants.md`) et à la microcopie (`docs/ux/microcopy.md`, `docs/ux/i18n/*.json`).
> **Gravité** : **Bloquant** = empêche la bêta (accessibilité AA non respectée, parcours cassé, exigence D5 non tenue). **Majeur** = écart visible qui dégrade l'expérience ou la cohérence, à corriger avant la bêta. **Mineur** = finition.

---

## Lot 3 : authentification, onboarding, paramètres, membres · Lot 4 : popup de l'extension

**Branche testée** : `claude/dev-mvp` (commit `83574f7`), **avec les tokens réconciliés** de `claude/ux-tokens-merge` (commit `05ea640`), c'est-à-dire le rendu après fusion.
**Méthode** : `pnpm --filter web dev`, captures Playwright en 1 440 × 900 et 390 × 844, clair et sombre. Faute de clé Supabase dans l'environnement de recette, la session et les réponses Supabase sont simulées par interception réseau (même forme que les types générés). Un script vérifie automatiquement les libellés de champs, les noms des boutons, les landmarks et le focus clavier. La popup de l'extension est rendue à partir de son HTML et de sa CSS (300 px), états affichés à la main.
**Captures** : `docs/ux/recette/lot3/`.

### Bilan

| | Bloquant | Majeur | Mineur |
|---|---|---|---|
| Web (lot 3) | 1 | 9 | 7 |
| Extension (lot 4) | 2 | 2 | 2 |

Points positifs : i18n FR/EN en place (116 clés, aucune manquante), `lang` correct, libellés de champs reliés, rôles D8 respectés, liens de navigation avec `aria-current` (NavLink), confirmation avant suppression, mode sombre fonctionnel grâce aux tokens.

### Web : application (lot 3)

| # | Gravité | Écran | Écart | Attendu (référence) |
|---|---|---|---|---|
| W1 | **Bloquant** | Tous | Les boutons `primary` et `danger` n'avaient **pas d'anneau de focus clavier** (`box-shadow: none` de la variante écrasait `:focus-visible`). | **Corrigé dans `packages/ui`** (commit `05ea640` sur `claude/ux-tokens-merge`). Rien à faire côté app. |
| W2 | Majeur | Toutes les pages connectées | Pas de **lien d'évitement** « Aller au contenu ». `AuthLayout` (connexion, inscription, onboarding, invitation) n'a **pas de landmark `<main>`** (le `Layout` connecté en a un). | `composants.md` §0.2 : lien d'évitement en première tabulation, `<main id="contenu">` sur chaque page. |
| W3 | Majeur | Layout | Barre latérale **sans icônes, sans compteur ni sélecteur de workspace dans un bouton de menu** ; sélecteur de langue et « Nouveau workspace » dans la navigation principale ; pas de barre du haut (fil d'Ariane, recherche). | Maquette `dashboard.html` : sélecteur de workspace en tête (menu), sections Démos / Analytics / Leads / Dossiers / Workspace, jauge d'usage et profil en pied ; « Nouveau workspace » dans le menu du workspace ; langue dans **Mon profil**. |
| W4 | Majeur | Mobile 390 px | La barre latérale s'empile **au-dessus** du contenu (tout le menu avant le titre de page). Tableau des membres coupé, boutons hors écran à droite. | Sous 1 024 px : barre latérale masquée, bouton menu dans la barre du haut (`composants.md` §12). Tableaux → cartes sous 768 px (§6). |
| W5 | Majeur | Connexion, inscription, onboarding | Carte centrée sans **logo ni identité** ; pas de panneau visuel ; sélecteur de langue en gros champ dans le formulaire. | Maquettes `connexion.html` / `inscription.html` : logo en tête, panneau latéral Lagoon 950 (masqué < 900 px), langue en bouton discret en pied. |
| W6 | Majeur | Inscription | Pas de **case CGU / confidentialité** ; pas d'**indicateur de robustesse**. (8 caractères minimum : conforme, décision du chef d'équipe, recommandation NIST.) | `i18n/fr.json` → `auth.signup.terms`, `passwordHelp`, `strength.*`. |
| W7 | Majeur | Onboarding | Une seule étape (nom du workspace) ; pas d'**installation de l'extension** ni de **checklist** « premiers pas ». | Maquette `onboarding.html` (3 étapes) + bandeau « Premiers pas 3 sur 5 » du dashboard. Le parcours d'activation est la clé du MVP marketing/sales. |
| W8 | Majeur | Membres | Boutons **Retirer / Quitter / Révoquer en rouge plein** sur chaque ligne : lourd visuellement, risque d'erreur. Confirmation par `window.confirm()` natif. | `composants.md` §6 et §3 : menu « ⋯ » par ligne, action destructive en `danger` dans le menu ; confirmation dans une **modale** (titre « Retirer Thomas Bernard ? », conséquences, bouton « Retirer le membre »). |
| W9 | Majeur | Membres | Invitation : un seul email à la fois ; lien à copier affiché après coup. | Maquette `parametres.html` : modale « Inviter des membres » (plusieurs emails, rôle avec description, sièges restants). Le lien à copier reste nécessaire tant que le SMTP n'est pas en place (D7) → le garder dans la ligne « En attente » (« Copier le lien »). |
| W10 | Majeur | Paramètres du workspace | Le plan est affiché comme badge technique **« free »** ; limite membres **« 4 / 1 »** (dépassement affiché sans alerte). | Nom du plan traduit (« Free », « Solo »…) ; jauges (`composants.md` §12 « Jauge d'usage ») avec état `warning` à 80 % et `danger` à 100 %, et message d'action (`billing.limitReached`). |
| W11 | Majeur | Zone de danger | « Supprimer le workspace » en bouton rouge plein ; la confirmation passe par `window.prompt()` natif (saisie du slug) : non stylable, peu lisible, mal annoncé. | Bouton secondaire au texte rouge + modale avec **saisie du nom** (`settings.general.deleteConfirmLabel`). |
| W12 | Mineur | Connexion | Liens « Mot de passe oublié ? » et « Pas encore de compte ? S'inscrire » soulignés, très petits, alignés côte à côte. | « Mot de passe oublié ? » à droite du libellé du champ ; « Pas encore de compte ? Créer un compte gratuit » sous le formulaire. |
| W13 | Mineur | Connexion | Onglets « Mot de passe / Lien magique » : bonne idée mais le lien magique peut être un lien secondaire sous le bouton. | Maquette : « Ou recevez un lien de connexion par email. » |
| W14 | Mineur | Libellés | « Email » au lieu de « Email professionnel » ; « Créer un compte » vs « Créez votre compte » ; « Zone dangereuse » vs « Zone de danger » ; « Identifiant (URL) » peu clair. | Reprendre les formulations de `docs/ux/i18n/fr.json` / `en.json` (voir § i18n ci-dessous). |
| W15 | Mineur | Membres | Membre sans nom affiché « — ». | Afficher l'email en titre et masquer la ligne secondaire, avatar à initiales. |
| W16 | Mineur | Profil | Champ email désactivé sans libellé associé (`<label>` sans `for`). | `htmlFor` + `id`, ou champ en lecture seule avec `aria-describedby` « Contactez le support pour changer d'email ». |
| W17 | Mineur | Typo | `h1` des pages de paramètres : OK (Bricolage). Les titres de cartes (`h2`) sont en display 22 px : un peu lourds empilés. | `h3` (Instrument 600, 18 px) pour les titres de cartes, `h2` réservé aux sections de page. |
| W18 | Mineur | Valeurs d'espacement | `app.css` utilise `--fd-space-6` (désormais 24 px) et `--fd-space-5` (20 px) : légère réduction des marges. | Si les anciennes valeurs sont voulues : `--fd-space-5` → `--fd-space-6`, `--fd-space-6` → `--fd-space-8`. |

### Extension : popup (lot 4)

| # | Gravité | Écart | Attendu |
|---|---|---|---|
| E1 | **Bloquant** | Popup **uniquement en français**, textes en dur dans le HTML (D5 : FR + EN dès le départ). | Chaînes `extension.*` de `docs/ux/i18n/*.json` (via `browser.i18n` / `_locales` ou le même i18next). |
| E2 | **Bloquant** | Contours de champs `#e2e2ec` sur blanc : **contraste 1,3:1** (< 3:1 requis pour un composant d'interface) ; pas de style de focus. | Importer `@flowdsiml/ui/tokens.css` (ou ses valeurs) : contour `--fd-color-border-strong` (3,7:1), anneau `--fd-shadow-focus`. |
| E3 | Majeur | Couleurs **provisoires** (violet `#5b4cf0`, rouge `#d93f4c`) et police système en dur : la popup ne suit pas l'identité. | Tokens : bouton « Démarrer la capture » en **accent** (Ember 600), primaire Lagoon, police Instrument Sans ; logo 18 px dans l'en-tête (voir l'aperçu de popup dans `onboarding.html`). |
| E4 | Majeur | État « enregistrement » : texte « 0 étape(s) capturée(s) » et pas de bouton **Pause / Annuler**. | `extension.stepsCaptured_one/_other` (pluriel géré), boutons Pause et Annuler la capture, indicateur rouge animé (statique en mouvement réduit). |
| E5 | Mineur | Libellé « Démarrer l'enregistrement » précédé d'un « ● » textuel (lu par les lecteurs d'écran). | Pastille en CSS ou SVG `aria-hidden`, libellé « Démarrer la capture ». |
| E6 | Mineur | Lien « Se déconnecter » souligné dans le flux principal. | En pied de popup, `btn ghost sm`, avec l'email du compte connecté. |

### i18n

Le dev a déjà ses fichiers `apps/web/src/locales/fr.json` et `en.json` (116 clés, cohérents). Les formulations de référence sont dans **`docs/ux/i18n/fr.json`** et **`docs/ux/i18n/en.json`** (branche `claude/ux-design-system`, fusionnée dans `claude/dazzling-lamport-bu517g`). Pas besoin de changer la structure des clés de l'app : reprendre les **textes** écran par écran (correspondance indicative : `auth.loginTitle` ↔ `auth.login.title`, `members.*` ↔ `settings.members.*`, `onboarding.*` ↔ `onboarding.workspace.*`). Vérifier la cohérence FR/EN avec `docs/ux/tools/i18n-check.py`.

---

## Lot 5 : éditeur

**Branche testée** : `claude/dev-mvp` (commit `18459bd`) fusionnée localement avec `claude/ux-tokens-merge` (`05ea640`).
**Méthode** : banc e2e du dev (`apps/web/e2e`, faux Supabase) : ses 11 vérifications passent. Captures supplémentaires de chaque état (hotspot sélectionné, thème, formulaire, sombre, 1 024 px, 390 px), parcours de 30 tabulations au clavier et audit automatique (libellés, noms, sémantique). Référence : `docs/ux/maquettes/editeur.html`, `composants.md` §13. Captures : `docs/ux/recette/lot5/`.

### Bilan

| Bloquant | Majeur | Mineur |
|---|---|---|
| 3 | 9 | 6 |

Points positifs : structure à trois colonnes conforme (rail, canevas, panneau), sauvegarde automatique annoncée (`role="status"`), barre d'outils `role="toolbar"`, réordonnancement accessible au clavier (boutons Monter/Descendre), libellés de champs reliés, déplacement à la souris fluide, variables avec valeur par défaut (`{{company|chez vous}}`), chapitres présents, mode sombre correct, le canevas reste clair.

| # | Gravité | Zone | Écart | Attendu (référence) |
|---|---|---|---|---|
| ED1 | **Bloquant** | Canevas, accessibilité | Le hotspot est un `div role="button"` **sans `tabindex`** : impossible de le sélectionner, déplacer ou supprimer au clavier. Les zones de flou non plus. | `composants.md` §0.3 et §13.2 : élément focusable, `Entrée` pour sélectionner, flèches pour déplacer de 1 % (`Maj` = 5 %), `Suppr` pour supprimer, annonce `aria-live`. |
| ED2 | **Bloquant** | Canevas | La **bulle (info-bulle) n'apparaît pas sur le canevas** : on édite le texte à l'aveugle, sans voir le rendu, le placement ni le thème. Le hotspot est rendu comme un **rectangle violet numéroté**, pas comme le point pulsant que verra le prospect. | Maquette `editeur.html` : rendu WYSIWYG dans `.fd-player-scope` (hotspot `player-hotspot` pulsé et bulle avec compteur, texte, variables résolues, boutons). Réutiliser `player-core` pour éviter les écarts éditeur ↔ player. |
| ED3 | **Bloquant** | Barre du haut | **Pas de bouton « Publier »** (`PublishButton` renvoie `null` jusqu'au lot 6). Statut « Brouillon » seul. | Bouton `accent` « Publier » (unique accent de l'écran) + badge « Modifications non publiées ». À livrer avec le lot 6, mais à signaler car la boucle éditer → publier → partager est le cœur du MVP. |
| ED4 | Majeur | Outils | « Sélection / + Hotspot / + Flou » sont dans la barre du haut, et l'outil actif est rendu en **bouton primaire plein** : il ressemble à l'action principale de l'écran. | Groupe segmenté (`role="radiogroup"`), ou barre flottante en bas du canevas (§13.2) avec icônes, libellés en infobulle et état `aria-pressed`. |
| ED5 | Majeur | Panneau | **5 onglets sur 2 lignes** (« Chapitres » passe à la ligne) dans 320 px. | 3 onglets maximum (Étape · Design · Réglages, comme la maquette) : Formulaire dans Étape (contexte), Variables et Chapitres dans Réglages ; ou un défilement horizontal sans retour à la ligne (§7). |
| ED6 | Majeur | Panneau Hotspot | Le texte de la bulle montre la **syntaxe brute** `{{company|chez vous}}` dans un `textarea` ; la barre de mise en forme mélange B, I, Lien et un `select` natif « {{ }} ». | Pastilles de variable atomiques (`composants.md` §2.5) et bouton « { } Variable » ouvrant un menu ; compteur de caractères (280 conseillés). |
| ED7 | Majeur | Thème | Couleur principale par défaut **`#5b4cf0` (violet provisoire)** et fond `#0f0f17` ; aucun **avertissement de contraste** ; champ logo en `input file` natif (« Choose File », non traduit) ; le thème ne se voit pas sur le canevas (cf. ED2). | Valeurs par défaut issues de `tokens.ts → player` (Lagoon 600, hotspot Ember 500, rayon 16) ; avertissement §11.1 avec proposition de couleur accessible ; zone de dépôt du logo stylée et traduite. |
| ED8 | Majeur | Formulaire | Créer le formulaire **ne montre rien sur le canevas** ; le rattachement à une étape se fait dans un autre onglet (« Choisissez l'étape concernée dans l'onglet Étape ») ; 5 cases à cocher sans réordonnancement. | Maquette : le formulaire est une étape (ou une pop-up d'étape) visible dans le rail et sur le canevas ; champs réordonnables avec Obligatoire/Facultatif ; consentement non coché par défaut. |
| ED9 | Majeur | Actions destructives | « Supprimer l'étape » et « Supprimer le hotspot » en **gros boutons rouges pleins** en bas du panneau ; suppression d'étape par `confirm()` natif. | Icône corbeille `ghost` dans l'en-tête de section ou entrée `danger` du menu « ⋯ » du rail ; suppression **annulable** (toast « Annuler » + `⌘Z`) plutôt qu'une confirmation bloquante. |
| ED10 | Majeur | Rail | Pas de repère visuel des hotspots/flous/formulaires sur les vignettes, pas de connecteur « sentier », pas de glisser-déposer au clavier ; ajout limité à « + Écran texte » et « + Image ». | §13.1 : icônes d'état, connecteur, `Espace` pour saisir puis flèches ; menu « Ajouter une étape » (capturer, image, pop-up, formulaire). |
| ED11 | Majeur | Responsive | À 390 px, l'éditeur s'empile (rail horizontal, canevas minuscule, panneau en dessous) : inutilisable. | Sous 1 024 px : écran « L'éditeur s'utilise sur ordinateur » avec liens Aperçu/Partager (maquette, `editor.narrow.*`). |
| ED12 | Majeur | Aperçu | « Aperçu » ouvre un **nouvel onglet** (player) : rupture de contexte, et rien ne se passe si le player n'est pas lancé (`PLAYER_URL`). | Bascule Édition/Aperçu dans l'éditeur (maquette), le player en `iframe` dans `.fd-player-scope`, ou au minimum message d'erreur si la fenêtre ne répond pas. |
| ED13 | Mineur | Sémantique | Pas de `<main>` ni de `<h1>` (le titre est un champ). Image d'étape sans `alt`. | `<main>` autour du canevas, `<h1 class="sr-only">` « Éditeur : Démo CRM », `alt` = titre de l'étape. |
| ED14 | Mineur | Barre du haut | Badge d'état de sauvegarde « — » au repos (illisible) à côté de « Brouillon ». | Icône + « Enregistré » (ou rien au repos), libellés de `editor.saveState.*`. |
| ED15 | Mineur | Panneau Étape | Cases « Zoom sur une zone » et « Bouton d'action (CTA) » en cases à cocher. | Interrupteurs (réglage immédiat, §2.4). |
| ED16 | Mineur | Panneau | « ← Étape » en lien texte pour revenir du hotspot à l'étape. | Fil d'Ariane du panneau (« Étape 1 › Hotspot ») ou bouton `ghost` avec icône. |
| ED17 | Mineur | Libellés | « Info-bulle » (vs « bulle »), « Écran texte », « Au clic ». | Glossaire `microcopy.md` §3 : « bulle », « Action au clic » ; « info-bulle » réservé aux infobulles de l'app. |
| ED18 | Mineur | Rail | Étape texte : vignette « Aa » grise peu lisible. | Vignette avec le titre de l'étape sur fond `player-backdrop`. |

**Priorités proposées au dev** : ED1, ED2 (le rendu WYSIWYG via `player-core` règle aussi ED7 et ED8 côté visuel), ED5, ED4, puis ED11 (simple écran de garde).

## Lot 6 : player

À faire dès sa livraison, avec la même méthode.
