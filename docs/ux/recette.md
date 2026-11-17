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
| Web (lot 3) | 1 | 10 | 8 |
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

#### Compléments sur l'API réelle (clé publique fournie par le chef d'équipe)

Testé sans créer de compte (aucune adresse fictive inscrite, aucun email envoyé) : connexion avec de mauvais identifiants (`POST /auth/v1/token` → 400) et inscription avec un mot de passe trop court.

| # | Gravité | Écran | Écart | Attendu |
|---|---|---|---|---|
| W19 | Majeur | Inscription, connexion | La validation des champs repose sur les **bulles natives du navigateur** (« Please fill out this field. », « Please lengthen this text to 8 characters… ») : langue du navigateur et non de l'app, non stylées, un seul message à la fois, pas de `aria-invalid`. | `noValidate` sur le formulaire + validation applicative : messages en ligne sous chaque champ (`validation.*` de `docs/ux/i18n`), `aria-invalid` + `aria-describedby`, focus sur le premier champ en erreur (`composants.md` §2.2). |
| W20 | Mineur | Connexion | Erreur « Email ou mot de passe incorrect. » bien annoncée (`role="alert"`), mais le champ mot de passe n'est ni marqué en erreur ni refocalisé, et le message ne dit pas quoi faire. | `auth.login.invalidCredentials` (« … Vérifiez vos informations et réessayez. »), focus sur le mot de passe, vidé. |

Captures : `lot3/real-login-error.png`, `lot3/real-signup-short.png`. Le parcours complet inscription → confirmation → onboarding reste à tester avec un compte de test réel (SMTP limité aux membres de l'organisation).

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

## Lots 6, 7, 8 : publication, partage, player · analytics, leads · tableau de bord, dossiers, plans

**Branche testée** : `claude/dazzling-lamport-bu517g` (commit `f9ecf9e`, tokens réconciliés intégrés).
**Méthode** : les 4 bancs e2e du dev (`apps/web/e2e`, faux Supabase, app sur :5173 et player sur :5174) et le banc de l'extension (`apps/extension/e2e`). Captures en 1 280 et 390 px, lecture du code pour les états non couverts. Références : maquettes `partage.html`, `player.html` (desktop, mobile, `#password`, `#expired`), `analytics.html`, `dashboard.html`, `plans.html`. Captures : `docs/ux/recette/lot6-8/`.

### Parcours de bout en bout : capture → éditeur → publication → player → lead → analytics

| Étape | Résultat | Source |
|---|---|---|
| Capture (extension) : popup, démarrage, badge REC, clic → étape, WebP téléversé, mot de passe flouté, libellé du hotspot | ✅ 7/7 | `apps/extension/e2e/capture.e2e.cjs` |
| Éditeur : étapes, hotspot, flou, réordonnancement, formulaire, variables, thème | ✅ 11/11 | `editor.e2e.cjs` |
| Publication : manifeste, **flou appliqué dans les pixels** (WebP régénéré, zones retirées du manifeste), lien public, iframe, lien personnalisé | ✅ | `publish-player.e2e.cjs` |
| Player : variable `{{company}}` depuis l'URL et depuis le lien personnalisé, formulaire avant l'étape 2, lead enregistré, clavier `→`, écran final, démo introuvable, mobile | ✅ 17/17 | `publish-player.e2e.cjs` |
| Événements : `demo_view`, `step_view`, `hotspot_click`, `form_view`, `form_submit`, `demo_complete` | ✅ | idem |
| Analytics et leads : KPI, histogramme, entonnoir, CSV, analytics du workspace, période, suppression d'un lead (RGPD) | ✅ 10/10 | `analytics.e2e.cjs` |
| Tableau de bord : vignettes, usage du plan, recherche, filtre, dossiers, duplication, suppression logique, nouvelle démo | ✅ 11/11 | `dashboard.e2e.cjs` |

**Fonctionnellement, la boucle MVP est complète et testée.** Limite : chaque banc a son propre jeu de données simulé. Le chaînage réel (la démo capturée par l'extension → éditée → publiée → vue → lead visible dans les analytics de cette même démo) reste à rejouer sur Supabase avec un compte de test.

### Bilan design

| Lot | Bloquant | Majeur | Mineur |
|---|---|---|---|
| 6 (publication, partage, player) | 3 | 7 | 3 |
| 7 (analytics, leads) | 0 | 4 | 4 |
| 8 (tableau de bord, dossiers, plans) | 0 | 4 | 3 |

Points positifs : flou irréversible côté pixels (très bon pour la confidentialité), compteur d'étapes `aria-live`, barre de progression `role="progressbar"`, formulaire en `role="dialog" aria-modal`, consentement non coché par défaut, `prefers-reduced-motion` respecté dans le player, liste de sites autorisés pour l'intégration, export CSV et suppression RGPD des leads, entonnoir lisible avec pertes en rouge.

### Lot 6 : publication, partage, player

| # | Gravité | Zone | Écart | Attendu (référence) |
|---|---|---|---|---|
| P1 | **Bloquant** | Player, identité | Thème par défaut **violet provisoire** (`#5b4cf0`) sur fond **noir** `#0f0f17` : la démo publiée chez les prospects ne porte ni l'identité du client ni la nôtre. | Valeurs par défaut de `tokens.ts → player` (Lagoon 600, hotspot Ember 500, fond `player-backdrop` clair, rayon 16), surchargées par le thème de la démo. |
| P2 | **Bloquant** | Player, hotspot | Le hotspot est un **rectangle semi-transparent** autour de la cible (style « zone »), pas le point pulsant ; la bulle n'a pas de flèche vers la cible. | `composants.md` §13.3–13.4 : pastille 20 px pulsée (cible tactile 44 px), bulle avec flèche ; le style « zone » reste une option de guidage. |
| P3 | **Bloquant** | Player, mobile | À 390 px, la capture fait ~140 px de haut et la **bulle flotte par-dessus et masque la cible**. | Sous 640 px : bulle en **feuille ancrée en bas**, boutons 44 px, balayage gauche/droite (maquette `player.html`, mobile). |
| P4 | Majeur | Player, accès | Pas d'écran **mot de passe** ; un lien personnalisé **expiré** affiche le message générique « n'existe pas ». | Écrans `player.password.*` et `player.expired.*` (maquettes `player.html#password` / `#expired`) ; le mot de passe peut rester en V2 mais l'expiration doit avoir son message. |
| P5 | Majeur | Player, navigation | Pas de bouton **Précédent** dans la première bulle ni de contrôles hors bulle (précédent, suivant, plein écran) ; barre de progression collée en bas de l'écran, peu visible. | Contrôles sous le cadre (desktop), progression segmentée en haut du cadre (§13.6). |
| P6 | Majeur | Player, page publique | En-tête réduit au titre de la démo ; pas de **logo ni de CTA** du client (« Essai gratuit », « Voir les tarifs »). | Page publique de la maquette ; réglages `settings.brand.publicPage` (V2 possible, mais prévoir l'emplacement). |
| P7 | Majeur | Player, filigrane | « Créé avec FlowDSIML » en texte 11 px gris sur fond sombre (contraste insuffisant), non cliquable. | Pastille « Fait avec FlowDSIML » (logo + lien `rel="noopener"`), contraste AA, en bas à droite. |
| P8 | Majeur | Partage | Page en **cartes empilées** (lien, iframe, liens perso, versions) sur toute la hauteur ; « **Dépublier** » en bouton rouge plein juste à côté d'« Ouvrir ». | Onglets Lien · Intégrer · Liens personnalisés · Accès + aperçu à droite (maquette `partage.html`) ; « Dépublier » dans un menu avec confirmation. |
| P9 | Majeur | Partage | « Versions publiées : v1 — **Invalid Date** » ; date d'expiration en `mm/dd/yyyy` (sélecteur natif en anglais). | Dates via `Intl.DateTimeFormat(locale)` ; corriger le champ `published_at` lu. |
| P10 | Majeur | Partage | Formulaire de lien personnalisé : libellé technique « {{company}} — Entreprise » ; le lien créé n'est pas **copié automatiquement**. | Libellé « Entreprise » avec la variable en pastille mono discrète ; « Créer et copier le lien » + toast (maquette). |
| P11 | Mineur | Partage | Aide « Personnalisez avec des paramètres d'URL » : URL entière en mono gris sur une ligne qui déborde. | Bloc de code avec la partie variable mise en évidence (maquette). |
| P12 | Mineur | Partage | Pas d'**aperçu** de la démo ni d'aperçu réseaux sociaux. | Colonne d'aperçu (maquette) ; l'image OG dépend de l'hébergement (limite GitHub Pages connue). |
| P13 | Mineur | Player | Formulaire de lead sans description ni lien de confidentialité quand le texte de consentement est vide. | Description facultative + lien « Confidentialité » si fourni par le workspace. |

### Lot 7 : analytics, leads

| # | Gravité | Zone | Écart | Attendu |
|---|---|---|---|---|
| A1 | Majeur | Analytics | KPI **sans variation** par rapport à la période précédente ; pas de filtre par source (lien, embed, lien perso). | Maquette `analytics.html` : variation ▲▼ avec signe et couleur, filtre Source. |
| A2 | Majeur | Analytics | Histogramme : barres sans **libellés ni alternative textuelle** (lecteurs d'écran), axe X en ISO `2026-11-15`. | `role="img"` + `aria-label` résumant la tendance (ou tableau masqué), dates localisées « 15 nov. ». |
| A3 | Majeur | Leads | Date en **format US** « 11/17/2026, 2:15:48 PM » dans l'interface française ; colonne « **company** » (clé brute). | `Intl.DateTimeFormat('fr-FR')` ; en-têtes traduits (`analytics.leads.*`). |
| A4 | Majeur | Leads | Suppression d'un lead par un **bouton rouge plein « ✕ »** sur chaque ligne. | Menu « ⋯ » ou icône corbeille `ghost` + modale de confirmation (suppression définitive RGPD). |
| A5 | Mineur | Analytics | Libellés de l'entonnoir « 1. », « 2. » sans le **titre de l'étape**. | « 1 · Introduction » (titre de l'étape). |
| A6 | Mineur | Analytics | « Parcours par étape (drop-off) » : anglicisme. | « Parcours étape par étape » / « Abandon » (glossaire). |
| A7 | Mineur | Leads | Bouton « Exporter en CSV » désactivé sans explication quand il n'y a aucun lead. | Le masquer, ou infobulle « Aucun lead à exporter ». |
| A8 | Mineur | Leads | État vide texte seul. | État vide illustré avec action « Ajouter un formulaire » (`empty.noLeads`). |

### Lot 8 : tableau de bord, dossiers, plans

| # | Gravité | Zone | Écart | Attendu |
|---|---|---|---|---|
| D1 | Majeur | Cartes de démo | **5 contrôles visibles par carte** (Partager, Analytics, Dupliquer, select de dossier, ✕ rouge) : carte chargée, risque de suppression accidentelle. | Carte entièrement cliquable (ouvre l'éditeur) + menu « ⋯ » (Partager, Copier le lien, Dupliquer, Déplacer vers…, Archiver, Supprimer) — maquette `dashboard.html`. |
| D2 | Majeur | Tableau de bord | Pas de bascule grille/liste, pas de tri, pas d'état « Premiers pas ». | Maquette : tri, vue liste (tableau), bandeau d'onboarding. |
| D3 | Majeur | Plans | Pas de **page Plans** : seul un encart « Démos publiées : 1 / 25 (plan actuel) » et le tableau d'usage des paramètres. | Page `plans.html` (usage, plans, demande de changement manuel selon D6, factures plus tard). |
| D4 | Majeur | Dossiers | Dossiers dans une colonne séparée **dans la page**, en plus de la navigation latérale. | Dossiers dans la barre latérale (section « Dossiers »), glisser-déposer des cartes vers un dossier. |
| D5 | Mineur | Cartes | Démo sans capture : vignette grise avec ▶ : peu informatif. | Vignette de la première étape, ou illustration « sentier » + titre. |
| D6 | Mineur | Cartes | Méta « 0 vues · 0 leads (30 j) · 11/17/2026 » : pluriel « 0 vues », date US. | `dashboard.card.views_*` (« 0 vue »), date relative « il y a 2 h ». |
| D7 | Mineur | Nouveau dossier | Lien texte « + Nouveau dossier » avec emoji 📁. | Bouton `ghost sm` avec icône, nom saisi en ligne. |

### Rappels transverses (lots 3 et 5 toujours ouverts)

La barre latérale (W3), le responsive mobile de l'app (W4), les confirmations natives (W8, W11, ED9) et le rendu WYSIWYG de l'éditeur (ED2) concernent aussi ces écrans. Les dates et pluriels non localisés (P9, A3, D6) se règlent d'un coup avec un helper `formatDate` / `formatNumber` basé sur `Intl` et la langue i18n courante.

**Priorités proposées** : P1 + P2 + P3 (le player est ce que voient les prospects : il doit être irréprochable), puis P4, D1, A3/P9/D6 (helper `Intl`), P8.

---

## Finition : icônes, champs, espacements, accents (retour client du 17 nov.)

**Branche testée** : `claude/dazzling-lamport-bu517g` (`f9ecf9e`) + correctifs de base de `claude/ux-finition` (`0ccd1e6`).
**Méthode** : 19 états d'écran (auth, dashboard, analytics, leads, partage, paramètres, membres, profil, éditeur et ses 6 panneaux, player, page 404) en **1 440 et 390 px à 2x**, recadrages zoomés des composants (`docs/ux/recette/finition/`), plus un **scan automatique du DOM** : glyphes utilisés comme icônes, accents manquants, hauteur et `padding-right` des selects, champs non stylés, cibles < 24 px. Popup de l'extension et player : captures des recettes précédentes. Règles : `composants.md` §15.

### Déjà corrigé dans `packages/ui` (branche `claude/ux-finition`, à fusionner)

| # | Défaut | Correction |
|---|---|---|
| F0.1 | Chevron natif du `<select>` collé à la bordure droite (capture client n° 1) | `appearance: none` + chevron SVG `ChevronDown` 16 px à **12 px du bord**, `padding-right: 36 px` (32 px en `sm`), variante sombre ; garde-fou `!important` contre les paddings locaux (`.demo-move`, style inline du sélecteur de variables). **Vérifié : 15/15 selects à 36 px.** |
| F0.2 | `input type=file` natif « Choose File / No file chosen » non stylé | `::file-selector-button` stylé en bouton secondaire (texte natif du navigateur encore en anglais : voir F14). |
| F0.3 | `input type=color` : cadre gris natif | Pastille 40 × 40, rayon 8, bordure `border-strong`. |
| F0.4 | Cases à cocher / radios / curseurs bleus natifs | `accent-color: primary`, 16 px. |
| F0.5 | Pas de règle de taille pour les icônes dans les boutons | `.fd-btn svg` 18 px (16 en `sm`, 20 en `lg`), stroke 1,75 ; `.fd-btn--icon` carré. |
| F0.6 | Champs sans état survol / erreur au focus / désactivé cohérents | Survol `text-subtle`, focus erreur `shadow-focus-danger`, désactivé `surface-sunken`. |

### À corriger dans l'application (dev)

**Icônes et glyphes** (scan DOM : 14 occurrences) — installer `lucide-react` (web), `lucide-preact` (player), `lucide` (extension) et appliquer la table `composants.md` §15.1.

| # | Gravité | Écran | Défaut constaté | Correction |
|---|---|---|---|---|
| F1 | **Bloquant** (retour client) | Éditeur, barre et rail | « **+ Hotspot** », « **+ Flou** », « **+ Écran texte** », « **+ Image** » : « + » en caractère texte. | `MousePointerClick` « Hotspot », `Droplet` « Flou », `Type` « Écran texte », `ImagePlus` « Image » (libellés sans « + »). |
| F2 | **Bloquant** | Dashboard | « **+ Nouvelle démo** », « **+ Nouveau dossier** » ; bouton « **✕** » rouge pour supprimer ; « **▶** » en texte dans la vignette vide ; emoji « **📁** » devant les dossiers. | `Plus` « Nouvelle démo », `FolderPlus` « Nouveau dossier », `Trash2` dans le menu `MoreHorizontal`, `PlayCircle` (ou illustration), `Folder`. |
| F3 | **Bloquant** | Leads, analytics de démo | Suppression d'un lead : « **✕** » ; consentement : « **✓** » texte dans le tableau. | `Trash2` (ghost, `aria-label`), `Check` 16 px `success` + texte masqué « Oui ». |
| F4 | Majeur | Éditeur | Retour : « **←** » texte ; panneau hotspot : « **← Étape** ». | `ArrowLeft` (bouton icône 40 px, `aria-label` « Retour aux démos ») ; fil d'Ariane « Étape 1 › Hotspot » avec `ChevronRight`. |
| F5 | Majeur | Éditeur, rail | « Monter / Descendre » en boutons texte. | `ArrowUp` / `ArrowDown` (boutons icône `sm` + infobulle), poignée `GripVertical`. |
| F6 | Majeur | Éditeur, barre | Outils, Aperçu, Partager, Publier **sans icône** ; badge de sauvegarde « **—** ». | `MousePointer2` Sélection, `Eye` Aperçu, `Share2` Partager, `Rocket` Publier ; sauvegarde `CheckCircle2` « Enregistré » / `Loader2` « Enregistrement… ». |
| F7 | Majeur | Éditeur, mise en forme | « B », « I », « Lien » en lettres ; sélecteur de variable « **{{ }}** ». | `Bold`, `Italic`, `Link` (boutons icône `sm` 32 px) ; bouton `Braces` « Variable » ouvrant un menu. |
| F8 | Majeur | Navigation latérale | Aucune icône (Démos, Analytics, Leads, Paramètres, Membres, Profil, Nouveau workspace). | `PlayCircle`, `BarChart3`, `Users`, `Settings`, `UserPlus`/`Users`, `CircleUser`, `Plus` — 20 px, gap 12 px. |
| F9 | Majeur | Partage, analytics, membres | Boutons Copier / Ouvrir / Exporter CSV / Dépublier / Révoquer / Quitter / Créer l'invitation sans icône. | `ClipboardCopy`, `ExternalLink`, `Download`, `EyeOff`, `Ban`, `LogOut`, `UserPlus`. |
| F10 | Majeur | Player | Pas d'icônes (précédent/suivant, chapitres, plein écran) ; filigrane sans logo. | `ChevronLeft`/`ChevronRight`, `ListOrdered`, `Maximize2` (lucide-preact) ; logo SVG 14 px. |
| F11 | Majeur | Popup extension | « **●** Démarrer l'enregistrement » (point en texte). | `Circle` plein 10 px `aria-hidden` (ou pastille CSS), `Pause`, `Square` (terminer). |

**Champs, alignements, espacements**

| # | Gravité | Écran | Défaut constaté (capture) | Correction |
|---|---|---|---|---|
| F12 | **Bloquant** | Éditeur, barre de mise en forme | Boutons B / I / Lien en **32 px** à côté d'un select de variable en **40 px** : hauteurs mélangées dans la même rangée (`crop-editor-panel.png`). | Tous en `sm` 32 px (`fd-select fd-select--sm`), gap 4 px dans la barre. |
| F13 | Majeur | Dashboard, cartes | Rangée « Sans dossier ▾ » (select 40 px) + « ✕ » (32 px) : **hauteurs et alignements différents** ; 3 boutons texte qui débordent de la carte à 1 280 px (`crop-dash-cards.png`). | Menu `MoreHorizontal` unique (D1) ; à défaut, tous les contrôles en `sm` 32 px, gap 8 px, `flex-wrap`. |
| F14 | Majeur | Éditeur, thème | Logo : bouton natif « **Choose File / No file chosen** » (anglais, non traduisible). Couleurs : valeur hex en mono **non éditable** à côté de la pastille. | Bouton secondaire `ImageUp` « Choisir un logo » + nom du fichier + `X` ; champ hex éditable 40 px, gap 8 px (§15.2). |
| F15 | Majeur | Éditeur, panneaux | **Rythme vertical irrégulier** : ~44 px entre deux champs (au lieu de 20), ~45 px avant « Position de l'info-bulle », cases à cocher collées entre elles (~4 px) puis grand vide (`crop-form-panel.png`, `crop-theme-panel.png`). | `fd-field` seul (20 px) sans marge supplémentaire du parent ; listes de cases : `.fd-check` + gap 8 px ; sections séparées par un trait avec 16 px dessus/dessous. |
| F16 | Majeur | Éditeur, panneau hotspot | Case « Bouton d'action (CTA) » décalée de **4 px** à droite par rapport à « Animation de pulsation » ; libellé non aligné sur le centre de la case. | `.fd-check` (gap 8 px, `align-items:flex-start`, `margin-top:2px` sur la case) pour toutes les cases. |
| F17 | Majeur | Éditeur, onglets du panneau | 5 onglets sur **2 lignes** (« Chapitres » seul en dessous) : alignement cassé. | Voir ED5 : 3 onglets, ou défilement horizontal sans retour à la ligne. |
| F18 | Majeur | Éditeur, rail | Vignette **collée au bord supérieur** de la carte d'étape (pas de padding haut), numéro non aligné avec le haut de la vignette ; boutons « + Écran texte / + Image » pleine largeur empilés (`crop-rail.png`). | Carte d'étape : padding 8 px, grille `18px 1fr` gap 8, numéro aligné en haut ; menu « Ajouter une étape » unique (`Plus`). |
| F19 | Majeur | Mobile 390 px (toutes pages connectées) | La navigation (selects workspace + langue, 7 liens, déconnexion) occupe **tout le premier écran** avant le titre. | W4 : menu repliable (`Menu`), langue dans le profil. |
| F20 | Mineur | Connexion | Onglets « Mot de passe / Lien magique » : boutons **sans classe** (style navigateur résiduel possible). | Composant onglets segmentés (`composants.md` §7). |
| F21 | Mineur | Dashboard, dossiers | « Sans dossier » / « Toutes les démos » : boutons sans classe de composant (style ad hoc). | Bouton de liste `ghost` pleine largeur, compteur en `badge` aligné à droite (`margin-left:auto`). |
| F22 | Mineur | Éditeur, panneau hotspot | Aperçu du texte sous le champ (« Bienvenue {{company|chez vous}} ») **identique au champ** : redondant, fond gris collé au champ (8 px). | Supprimer, ou montrer la valeur résolue (« Bienvenue chez vous ») avec le libellé « Aperçu », 6 px sous le champ. |
| F23 | Mineur | Player | Page « démo introuvable » : une ligne de texte gris centrée, sans logo, titre ni action. | Écran système (`player.notFound`) : `CircleAlert` 24 px, titre, texte, lien vers le site du client. |

**Accents et typographie**

| # | Gravité | Écran | Défaut | Correction |
|---|---|---|---|---|
| F24 | Majeur | Bouton d'ajout d'étape | « + **Ecran** » sans accent (capture client n° 2 ; corrigé sur la branche d'intégration en « + Écran texte », à vérifier partout : extension, player, CSV, emails). | Grep `Ecran\|Etape\|Editeur\|Equipe\|Etat` sur tout le dépôt, `fr.json` inclus. |
| F25 | Mineur | Leads, dashboard, partage | Dates US « 11/17/2026, 2:15:48 PM », « Invalid Date », « 0 vues ». | Helper `Intl` (voir P9/A3/D6). |

### Synthèse

| | Bloquant | Majeur | Mineur |
|---|---|---|---|
| Finition (app, éditeur, player, extension) | 4 | 16 | 5 |
| Corrigé côté `packages/ui` | 6 correctifs (F0.1–F0.6) | | |

**Ordre conseillé** : installer Lucide + composant `Icon` (1 h), F1–F3 et F12 (bloquants), puis F6–F9, F13–F16, F24 (grep des accents). La table d'icônes complète est dans `composants.md` §15.1.

---

## Re-vérification des correctifs du dev (17 nov., `claude/dev-mvp` @ `61d8217` + `claude/ux-finition`)

Bancs e2e du dev : **4/4 sans erreur** (éditeur, publication/player, analytics, dashboard). Captures : `docs/ux/recette/reverif/`.

| Point | Statut | Constat |
|---|---|---|
| P1 thème du player | ✅ Corrigé | Fond `player-backdrop` clair, primaire Lagoon, police Instrument. |
| P2 hotspot | ✅ Corrigé | Pastille Ember pulsée + bulle fléchée vers la cible. |
| P3 mobile | ✅ Corrigé | Bulle en feuille ancrée en bas, boutons 44 px, contrôles sous la capture. |
| P4 lien expiré | ✅ Corrigé | Écran dédié avec icône de lien barré, titre et action ; (texte en anglais dans la capture car navigateur de test en `en-US` : OK). |
| P5 contrôles | ✅ Corrigé | Précédent / progression / suivant / plein écran sous le cadre, icônes chevrons. |
| P7 filigrane | ⚠️ Partiel | Lien centré, souligné, sans logo ; à passer en pastille avec logo (§13.6). |
| ED1 clavier canevas | ✅ Corrigé | Hotspot `tabindex=0`, `aria-label` « Hotspot 1 : … », flèches déplacent. |
| ED4/ED5 outils, onglets | ✅ Corrigé | 3 onglets Étape · Design · Réglages ; outils segmentés. |
| ED9 suppression | ✅ Corrigé | « Supprimer l'étape » en lien `danger` discret. |
| ED11 mobile | ✅ Corrigé | Écran « L'éditeur nécessite un écran plus large ». |
| ED14 état de sauvegarde | ✅ Corrigé | « Enregistrement… » / « Enregistré ». |
| F1 glyphes « + » / « ← » | ❌ Ouvert | Toujours « ← », « + Hotspot », « + Flou », « + Écran texte », « + Image » (scan DOM). |
| F12 hauteurs barre de mise en forme | ❌ Ouvert | B / I / Lien 32 px vs select de variable 40 px. |
| F16 alignement des cases | ❌ Ouvert | « Bouton d'action (CTA) » toujours décalée. |
| ED2 rendu WYSIWYG | ❌ Ouvert (annoncé) | Les écrans texte sont rendus ; la bulle du hotspot reste absente du canevas. |

Reste prioritaire : **Lucide + F1–F3, F12, F16**, puis ED2.

### Finition (suite) : motifs proscrits (retour client du 17 nov., §15.6)

Audit de **tout le code** (`apps/web`, `apps/player`, `apps/extension`, `packages/ui` sur `claude/dev-mvp` + `claude/dazzling-lamport-bu517g`) par recherche systématique des motifs M1–M14 (`border-left` épais, `::before` en barre, dégradés, `backdrop-filter`, `background-clip:text`, ombres colorées, emojis U+1F300–1FAFF/✨, pastilles colorées), complété par les captures de finition. Puis audit des **maquettes**.

**Application — constats**

| # | Gravité | Fichier | Motif | Correction |
|---|---|---|---|---|
| M-A1 | ✅ Corrigé (chef d'équipe, `a69e35d`) | `packages/ui/src/base.css` `.fd-alert` | M1 barre d'accent latérale sur les alertes | Bordure fine 1 px à 30 % ; **+ icône Lucide** désormais stylée (`.fd-alert > svg`, `claude/ux-finition` `e05e357`). Ajouter l'icône dans `<Alert>` : `Info`, `CircleAlert`, `CircleCheck`, `TriangleAlert`. |
| M-A2 | ✅ Corrigé (`claude/ux-finition` `e05e357`) | `packages/ui/src/tokens.ts` → `--fd-player-backdrop` | M3 dégradé décoratif (lagon → pierre → corail) en fond du player | Aplat Stone 50 `#F7F6F4`. |
| M-A3 | Majeur | `apps/player/src/player.css:28` | M3 dégradé **codé en dur** (`linear-gradient(160deg, #eefbf8 …)`) : ignore le token | `background: var(--fd-player-backdrop)` (ou `var(--p-backdrop)` alimenté par le thème). |
| M-A4 | Majeur | `apps/web/src/pages/demos/DemosPage.tsx:154` | M6 emoji **📁** devant chaque dossier | Icône Lucide `Folder` 16 px `text-muted`. |
| M-A5 | Majeur | `apps/extension/entrypoints/popup/style.css:105` (`.rec::before { content: '● ' }`) | M6/§15.1 glyphe « ● » comme indicateur d'enregistrement | Pastille CSS 8 px (`border-radius:50%`, `background: var(--fd-color-accent)`, `aria-hidden`) ou Lucide `Circle` plein. |
| M-A6 | Mineur | `apps/web/src/pages/editor/editor.css:233-237` | Contour de sélection du flou en **jaune `#ffcc00`** hors palette | `border-selected` (Lagoon) 2 px comme les autres sélections ; pointillés conservés pour l'état « en cours de tracé ». |
| — | ✅ Conforme | `app.css` `.sidebar nav a.active`, `editor.css` `.steplist li.active`, `.tabs` | M2 : élément actif sans barre latérale (fond / contour complet / soulignement d'onglet) | — |
| — | ✅ Conforme | `player.css` `.p-blur`, `editor.css` `.canvas-blur` | M5 : `backdrop-filter` = fonction de floutage, autorisé | — |
| — | ✅ Conforme | tout `apps/` | M4, M7, M9 : aucun texte en dégradé, aucun « sparkles », aucune ombre colorée | — |

**Maquettes (`docs/ux/maquettes/`) — corrigées** (branche `claude/ux-design-system`)

| Fichier | Motif retiré | Remplacement |
|---|---|---|
| `assets/mockup.css` `.nav a[aria-current]::before` | M2 barre de 3 px à gauche de l'élément de navigation actif | Fond `surface-selected` + texte `primary-soft-text` seuls |
| `assets/mockup.css` `.toast` | M1 `border-left: 3px` vert | Bordure 1 px `border` + icône d'état colorée |
| `assets/mockup.css` `.alert*` | (alignement) fond seul | Bordure fine 1 px à 30 % de la couleur d'état + icône |
| `plans.html` `.plan.reco` | M3 dégradé corail → blanc sur la carte « recommandée » | Bordure `border-strong` + badge texte |
| `index.html` `.screen .ic` | M8 icône dans un carré coloré sur chaque carte | Icône Lucide nue 20 px `text-muted` |
| `partage.html` `.icon-tile` | M8 (style mort) | Supprimé |
| `editeur.html` menu « … » | M7 icône *sparkles* « Générer les textes avec l'IA » | `PenLine` « Rédiger les textes (assistant) » |
| `editeur.html` écran de fin | M8 + glyphe : pastille lagon avec « ✓ » | Supprimée (titre + texte + boutons) |
| `editeur.html` Design | M3 interrupteur « Fond dégradé » | Champ « Fond » (couleur unie) |
| `onboarding.html`, `player.html` | M6 emojis 👋 🔒 ⏳, « ✓ » dans un toast | Texte simple ; icônes Lucide `Lock`, `Clock` |
| `parametres.html` | « ✓ » texte dans la matrice des rôles et l'aide de contraste | Icône `Check` (masque SVG, `aria-label` « Oui »), texte « conforme AA » |
| `i18n/fr.json`, `i18n/en.json` | M6 emoji 👋, « ✓ » dans 3 chaînes ; « Fond dégradé » | « Bienvenue, {{name}} », texte sans glyphe, « Couleur de fond » |
| `identite-visuelle.md`, `microcopy.md`, `composants.md` §4/§5/§7/§12 | Règles qui prescrivaient barre latérale de toast, repère de 3 px, dégradés, « un emoji au maximum » | Règles réécrites ; liste **§15.6 Motifs proscrits** (M1–M14) avec alternatives |

**Reste au dev** : M-A3, M-A4, M-A5 (majeurs), M-A6 (mineur), et l'icône dans `<Alert>` (M-A1). Contrôle CI suggéré : voir `composants.md` §15.6 (grep des motifs).

### Re-vérification finition (`claude/dev-mvp` @ `40224b7` + `claude/ux-finition` @ `c1d79a9`)

Fusion des deux branches **sans conflit**, 4 bancs e2e sans erreur, nouvel audit 2x (14 états, 1 440 et 390 px) + scan DOM. Captures : `docs/ux/recette/finition2/`.

**Résultat du scan** : **0 glyphe** utilisé comme icône, **0 emoji**, **0 barre latérale épaisse**, **0 dégradé** ; **14/14 selects** à `padding-right` 36 px avec un seul chevron (Lucide dans `.fd-select-wrap` ; le chevron de fond de `base.css` est neutralisé dans ce cas). Icônes Lucide partout (navigation, barre de l'éditeur, rail, boutons, menus ⋯), cartes de démo avec menu, navigation mobile en tiroir, dates `Intl` (« 17 nov. 2026 », « 0 vue »).

| Point | Statut |
|---|---|
| F1–F11 icônes et glyphes | ✅ Corrigés |
| F12 hauteurs de la barre de mise en forme | ✅ Corrigé (32 px partout) |
| F13 cartes de démo, D1/D2/D4 | ✅ Corrigés (menu ⋯, dossiers avec icônes) |
| F19 / W3 / W4 navigation et mobile | ✅ Corrigés (navigation avec icônes, tiroir mobile) |
| M-A4 emoji 📁 | ✅ Corrigé (`FolderOpen`) |
| P9 / A3 / D6 dates et pluriels | ✅ Corrigés |
| F16 case « Bouton d'action (CTA) » | ❌ Toujours décalée de 4 px par rapport à « Animation de pulsation » → `.fd-check` |
| F14 logo | ⚠️ Bouton natif « Choose File / No file chosen » (texte du navigateur) → bouton secondaire `ImageUp` « Choisir un logo » + nom du fichier |
| P8 page de partage | ⚠️ Toujours en cartes empilées ; « Dépublier » en **bouton rouge plein** à côté d'« Ouvrir » → menu ⋯ ou bouton `ghost` + confirmation |
| Mise en page | ❌ **Nouveau** : sur les pages longues (partage), la barre latérale blanche **s'arrête à 900 px** (hauteur de l'écran) au lieu de suivre la page → `position: sticky; top: 0; height: 100vh` sur la barre, ou `min-height: 100vh` sur le conteneur en grille |
| Hauteurs mélangées | ⚠️ Leads : champ de recherche 40 px + bouton « Exporter » 32 px sur la même rangée ; idem dans les analytics d'une démo → même taille (`md`) |
| ED2 rendu WYSIWYG | ❌ Ouvert : le hotspot reste un rectangle orangé sur le canevas, sans bulle |
| M-A3 dégradé codé en dur du player, M-A5 « ● » de la popup, M-A6 jaune du flou | à vérifier à la prochaine livraison du player / de l'extension |

**Table d'icônes alignée** avec les choix du dev (`composants.md` §15.1) : Hotspot `Target`, Modifier `Pencil`, Flou `EyeOff` ; « Dépublier » passe à `GlobeLock` pour ne plus partager `EyeOff` avec le flou.

### Recette finition, version intégrée (`claude/dazzling-lamport-bu517g` @ `b43619a`)

Base : les 20 captures du dev (`docs/tech/captures/finition/`, prises sur `40224b7`, **avant** le correctif d'alerte `a69e35d`) puis une **re-capture sur la version intégrée** avec le même script (`apps/web/e2e/screens.cjs` + faux Supabase) et des mesures DOM. Captures : `docs/ux/recette/finition3/`.

**Résolu depuis la dernière vérification**

| Point | Constat |
|---|---|
| Alertes (M1) | ✅ Bordure fine uniforme, plus de barre à gauche. La barre visible dans `03`, `04` et `09` du dev date d'avant `a69e35d` |
| Curseur « Arrondi » | ✅ Couleur de la marque (`accent-color`), plus le bleu du navigateur |
| Pastilles de couleur | ✅ 40 × 40 px, alignées sur les champs |
| M-A5 popup de l'extension | ✅ Le « ● » est remplacé par une pastille CSS de 8 px (indicateur d'enregistrement, acceptable) |
| Barre latérale « coupée à 900 px » | ✅ Sans objet : la barre est `sticky` en `100vh`, elle suit le défilement. Ce n'est qu'un effet des captures pleine page (`fullPage`). Je retire ce point de la liste précédente |

**Écarts restants (dev)**

| # | Écran | Écart | Correction attendue |
|---|---|---|---|
| FI1 | Tableau de bord, menu ⋯ d'une carte | ❌ **Bloquant** : le menu a 6 actions mais **une seule est visible** (« Modifier »). Il est coupé par `overflow: hidden` sur `.demo-card` (`demos.css:109`). Bas du menu à 712 px, bas de la carte à 488 px | Rendre le menu dans un portail (ou `position: fixed`), ou retirer `overflow: hidden` de la carte et arrondir la vignette à part |
| FI2 | Éditeur, panneau Étape (« Zoom sur une zone », « Bouton d'action (CTA) ») | ❌ Cases à cocher natives placées dans un `<legend>` de `fieldset` : décalage de **3 px** vers la droite par rapport aux champs (x = 1140 contre 1137), **3 px** seulement entre la case et le libellé (8 px attendus), case non centrée verticalement sur le texte | Sortir la case du `<legend>` et utiliser `.fd-check` (case 16 px, `gap` 8 px, `align-items: center`), alignée sur le bord gauche des champs |
| FI3 | Éditeur, panneau Hotspot | ❌ Même cause : « Bouton d'action (CTA) » (dans un `legend`, x = 1140) n'est pas alignée avec « Animation de pulsation » (x = 1137) juste en dessous | Idem FI2 ; les deux cases doivent partager la même colonne |
| FI4 | Éditeur, canevas (ED2) | ❌ Le hotspot est un **rectangle saumon/rose** (fond Ember à 18 % et bordure de 2 px) avec un numéro. La bulle n'est pas prévisualisée, alors que le player affiche une pastille et une bulle (`16-player`) | Afficher sur le canevas ce que verra le visiteur : la pastille Ember (pulsation désactivable) et la bulle avec titre, texte et « Suivant », positionnée comme dans le player. La zone cliquable reste en pointillés fins au survol et à la sélection, sans aplat coloré |
| FI5 | Panneaux de l'éditeur (Étape, Design, Hotspot) | ⚠️ **36 px** entre deux champs au lieu de 20 px (marge de `.fd-field` de 20 px **plus** le `gap` de 16 px du conteneur). Le panneau paraît « troué » (captures `05`, `06`, `08`) | Dans les conteneurs en `flex`/`grid` avec `gap`, mettre `margin-bottom: 0` sur `.fd-field` et un `gap: 20px`, ou retirer le `gap` du conteneur |
| FI6 | Design, champ Logo (F14) | ⚠️ Toujours « Choose File / No file chosen » en anglais, texte du navigateur même en `lang="fr"`, et décalé de 6 px | Masquer l'`input` natif et afficher un bouton secondaire `ImageUp` « Choisir un logo » + le nom du fichier ou « Aucun fichier » (i18n) |
| FI7 | Réglages, variables | ⚠️ `fieldset` natif : la légende `{{company}}` coupe la bordure du cadre | Carte simple (bordure 1 px, rayon `md`) avec un en-tête « `{{company}}` + Supprimer » sur une ligne, sans `legend` |
| FI8 | Partage (P8) | ⚠️ « Dépublier » reste un **bouton rouge plein** au même niveau qu'« Ouvrir ». Version publiée affichée « v1 — — en ligne » (date vide, puce native). Champ Expiration « mm/dd/yyyy » au format US | « Dépublier » en bouton `ghost` ou menu ⋯, avec confirmation. Versions : « v1 · 17 nov. 2026 · En ligne », sans puce. Date au format de la langue |
| FI9 | Leads et analytics d'une démo | ⚠️ Recherche 40 px à côté de « Exporter en CSV » à 36 px sur la même rangée | Même hauteur (`md`, 40 px) |
| FI10 | Analytics, entonnoir | ⚠️ Libellés « 90 (100 %) » en texte foncé **dans** la barre Lagoon : contraste insuffisant | Libellé hors de la barre, à droite, en `text-muted` |
| FI11 | Player (M-A3) | ❌ Dégradé codé en dur toujours présent (`apps/player/src/player.css:28`) | `background: var(--fd-player-backdrop)` (couleur unie `stone-50`) |
| FI12 | Éditeur, flou et zoom (M-A6) | ❌ `#ffcc00` codé en dur (`editor.css:233` et `:237`), hors palette | `var(--fd-color-accent)` (Ember) ou `--fd-color-focus` |

**Bilan** : 5 points résolus. 12 écarts ouverts, dont 4 bloquants pour la finition : le menu ⋯ coupé (FI1), les cases à cocher (FI2 et FI3) et le hotspot sur le canevas (FI4). Aucun de ces écarts n'est dans `packages/ui` : tous relèvent du code applicatif.

### Re-vérification FI1–FI12 (`claude/dev-mvp` @ `83c1644`)

Re-capture avec le script du dev et mesures DOM. Captures : `docs/ux/recette/finition4/`.

| # | Statut |
|---|---|
| FI1 menu ⋯ | ✅ Les 6 actions sont visibles, le menu déborde de la carte |
| FI2 / FI3 cases à cocher | ✅ Composant `Checkbox` (`label.fd-check`) partout : x = 1137 pour toutes les cases, alignées sur les champs, 8 px entre la case et le libellé |
| FI4 hotspot sur le canevas | ✅ Pastille et bulle rendues avec `player-core` ; zone cliquable en pointillés fins, sans aplat |
| FI5 rythme des panneaux | ✅ 20 px entre les champs (au lieu de 36) |
| FI6 logo | ✅ Aperçu 40 px + bouton « Choisir un logo » (`ImageUp`) |
| FI7 variables | ✅ Carte avec un en-tête `{}` `{{company}}`, sans `legend` |
| FI9 hauteurs | ✅ Recherche et « Exporter en CSV » à 40 px |
| FI11 dégradé du player | ✅ Retiré |
| FI12 `#ffcc00` | ✅ Retiré |
| Données fictives | ✅ `globex.example` dans le faux Supabase |
| FI8 partage | ⚠️ En partie : « Dépublier » a bien l'icône `GlobeLock`, mais reste un **bouton rouge plein** à côté d'« Ouvrir ». « Versions publiées » affiche toujours « v1 · — » avec une puce native. Le champ Expiration est toujours au format `mm/dd/yyyy` |
| FI10 entonnoir | ⚠️ En partie : le libellé « 90 (100 %) » est maintenant collé au bord gauche **dans** la barre, en vert foncé sur du vert. Il est encore moins lisible |
| Nouveau | ⚠️ `editor.showBranding` = « Afficher «␣␣Créé avec FlowDSIML␣␣» » : **deux espaces** de chaque côté des guillemets → une seule espace fine insécable (U+202F) |
| Nouveau (mineur) | Couleurs hexadécimales en casse mixte (`#0E7C71` / `#ffffff`) → majuscules partout |

**Bilan** : 10 écarts sur 12 sont corrigés, 2 le sont en partie (FI8, FI10), et il y a 2 petits points nouveaux. Il ne reste plus aucun bloquant de finition.

**Corrections attendues**
- **FI8** :
  - « Dépublier » en `variant="ghost"` (texte et icône rouges, sans fond), avec la modale de confirmation ;
  - versions affichées sur une ligne, sans puce : « v1 · 17 nov. 2026 · En ligne » ;
  - date d'expiration au format de la langue (sélecteur maison ou `lang` sur l'`input`).
- **FI10** : libellé **hors** de la barre, à droite de la piste, en `text-muted` et chiffres tabulaires.

## Recette finale sur le site en ligne (https://sabir-art.github.io/FlowDSIML/, dazzling @ `c848fbc`)

Tests faits sur le vrai Supabase, **sans créer de compte ni envoyer d'email** : écrans publics à 1 440 et 390 px, locales `fr-FR` et `en-US`, connexion refusée avec un compte fictif (`recette.ux@example.com`), et le player sur une démo qui n'existe pas. Captures : `docs/ux/recette/live/`.

| Contrôle | Résultat |
|---|---|
| Disponibilité de l'app et du player (`/player/`) | ✅ 200 |
| Polices chargées (Bricolage Grotesque, Instrument Sans) | ✅ |
| Glyphes ou emojis utilisés comme icônes, dégradés, barres latérales | ✅ 0 |
| Routes privées sans session | ✅ Redirection vers `#/login?redirect=…` |
| Connexion refusée | ✅ Message « Email ou mot de passe incorrect. », champ en erreur, mot de passe vidé |
| Inscription, validation | ✅ Erreurs par champ, indicateur de robustesse |
| Player, démo inexistante | ✅ État « Démo introuvable » avec icône, traduit selon la langue du navigateur (FR / EN) |
| Bascule FR / EN | ✅ |

**Écarts (dev)**

| # | Écran | Écart | Correction attendue |
|---|---|---|---|
| L1 | Connexion, inscription, mot de passe oublié (panneau gauche) | ❌ Première puce « Capturez un parcours » avec l'icône `Sparkles` (motif proscrit, §15.6) | `MousePointerClick` (une capture = des clics) ou `Camera` |
| L2 | Connexion refusée | ⚠️ Le message ne porte que sur le champ **mot de passe**, alors qu'il concerne le couple email + mot de passe. Il n'est pas annoncé aux lecteurs d'écran : aucun `role="alert"` ni `aria-live` | `Alert kind="error"` au-dessus des champs (`role="alert"`), sans mettre en erreur un champ en particulier |
| L3 | Inscription, mobile (390 px) | ⚠️ Le texte « Robustesse : Le mot de passe doit contenir au moins 8 caractères. » est décalé de 16 px et **déborde à droite** (coupé). Il répète aussi le libellé « (8 caractères min.) ». Le « L » majuscule après les deux-points est fautif | Aligner l'aide sur le champ (`padding-left: 0`, retour à la ligne). Texte : « Robustesse : faible · 8 caractères minimum » |
| L4 | Player, démo inexistante | ℹ️ La requête Storage répond **400** (et non 404), ce qui fait une erreur dans la console. L'affichage est correct | Côté dev, à confirmer : vérifier l'existence avant le fetch ou ignorer ce 400 |

**Pas encore testé sur le site réel** : les écrans connectés (tableau de bord, éditeur, partage, analytics, leads, membres) et le parcours player + `track` sur une démo publiée. Il faut un **compte de recette fictif** (créé par le chef d'équipe, sur un domaine `.example`) et l'**identifiant d'une démo publiée**. Ces écrans ont été vérifiés sur la même version avec le faux Supabase (section précédente, `finition4`).

### Re-vérification des mineurs (`claude/dev-mvp` @ `4cac555`, captures du dev)

| # | Statut |
|---|---|
| FI8 partage | ✅ « Dépublier » en bouton `ghost` danger (`GlobeLock`) avec confirmation. Versions sans puce : « v1 · 17 nov. 2026 » et badge « en ligne » aligné à droite. Expiration choisie en durée (Jamais / 7 / 30 / 90 jours), plus de `mm/dd/yyyy` |
| FI10 entonnoir | ✅ Libellé « 90 · 100 % » hors de la barre, en texte discret |
| Guillemets FR | ✅ « Créé avec FlowDSIML » avec une espace fine insécable, plus aucun double espace dans `fr.json` |
| Couleurs hexadécimales | ✅ Affichées et enregistrées en majuscules dans l'interface. Dans les fichiers `.css`, Prettier les remet en minuscules : sans effet sur le rendu, accepté |
| L1 `Sparkles` (auth) | ❌ Toujours dans `AuthLayout.tsx:30`. Le retour L1 est parti après `4cac555` |
| Nouveau (mineur) | Variations des KPI (A1) : « Taux de complétion » et « Leads » n'ont pas de variation, contrairement aux trois autres tuiles → afficher la variation partout, ou « — » quand il n'y a pas de période de référence, pour garder des tuiles homogènes |

### Arbitrages design (questions du dev, 17 nov., `ff3c5ee`)

- **W18, espacements** : on **garde 24 px et 20 px**, qui sont les valeurs du rythme de référence (`composants.md` §15.4). Pas de passage de `space-6` à `space-8`. Les seules valeurs à 32 px sont le padding de page sur ordinateur et celui des modales. La ligne W18 est close.
- **P12, aperçu sur la page de partage** : une **capture statique de la première étape**, pas d'iframe. Raisons :
  1. Une iframe chargerait le vrai player, donc compterait des vues et des événements `track` et fausserait les analytics du client.
  2. Elle est lourde à charger.
  3. Elle peut être bloquée par la liste des sites autorisés à intégrer la démo.

  Spécification :
  - image de l'étape 1 au ratio 16:10, rayon `lg`, bordure 1 px, fond `player-backdrop` ;
  - pastille du hotspot rendue avec `player-core` en mode statique, sans pulsation ;
  - titre de la démo et « N étapes » sous l'image ;
  - bouton secondaire « Ouvrir l'aperçu » (`ExternalLink`) qui ouvre le player dans un nouvel onglet **avec `?preview=1`**, pour que ces visites ne soient pas comptées ;
  - si la démo n'a pas encore d'étape : état vide avec l'icône `Image` et le texte « L'aperçu apparaîtra après la première capture ».

### Recette du player en ligne : « Nordline CRM — découverte » (17 nov.)

Démo publiée `24da9e7a…`, testée sur le site réel en deux versions :
- lien public en 1 280 px ;
- lien personnalisé `#/l/atelier-brume` en 390 px (mobile tactile).

Locale `fr-FR`. Aucun lead envoyé : le formulaire n'est pas apparu (PL1). Captures : `docs/ux/recette/live-player/`.

**Fonctionne**

| Contrôle | Résultat |
|---|---|
| Chargement (`latest.json` et images en webp) | ✅ 200, aucune erreur dans la console |
| Parcours complet 1 → 6 (boutons, flèche ← → du clavier) | ✅ Compteur, barre de progression, « Précédent » désactivé à l'étape 1 et « Suivant » à l'étape 6 |
| Suivi des vues | ✅ `POST /functions/v1/track` → **200**, regroupé en 2 envois par session, `linkToken` renseigné sur le lien personnalisé |
| Lien personnalisé | ✅ `resolve_share_link` → 200 ; variables appliquées (« Bienvenue Léa », « Atelier Brume ») |
| CTA « Réserver une démo » | ✅ S'ouvre dans un nouvel onglet (`example.com/rendez-vous`) et l'événement est suivi |
| Chapitres | ✅ Menu avec le chapitre courant mis en évidence |
| Écran de fin | ✅ « Précédent », CTA, « Recommencer » |
| Mobile 390 px | ✅ Bulle en feuille du bas, boutons de 44 px, écran de fin en colonne |
| Flou (étape 3) | ✅ Les lignes d'activité sont floutées |

**Écarts**

| # | Gravité | Écart | Correction attendue |
|---|---|---|---|
| PL1 | ❌ Bloquant (recette) | **Aucun formulaire de lead** avant l'étape 4 : `latest.json` contient `"forms": []`. Le formulaire annoncé n'a pas été publié, ou le seed ne l'a pas créé | Chef d'équipe : vérifier le seed et republier. Dev : si un formulaire est configuré mais absent de la version publiée, c'est un bug de publication |
| PL2 | ❌ Majeur | **Étape zoomée (3)** : la bulle subit aussi le zoom (texte environ 1,4 fois plus grand) et sort du cadre à droite (« Tout l'historique au même endro… », « Suiva… »). En mobile, la capture zoomée est coupée et la pastille du hotspot n'est plus visible | Appliquer la transformation de zoom **uniquement à l'image et aux hotspots**. Rendre la bulle hors du calque zoomé, à sa taille normale, en la gardant dans le cadre. Recentrer le zoom pour que le hotspot reste visible |
| PL3 | ⚠️ Contenu et produit | Valeur par défaut « vous » de `first_name` : on obtient **« Bienvenue vous »** et **« Merci vous ! »** | Contenu : valeur par défaut vide. Produit : quand une variable est vide, retirer l'espace qui la précède et éviter « mot ! » avec une espace orpheline (« Bienvenue ! », « Merci ! »). Dans l'éditeur, afficher un aperçu de la phrase avec la valeur par défaut |
| PL4 | ⚠️ Mineur | En mobile, le titre est tronqué (« Nordline CRM … ») parce que le CTA occupe l'en-tête | Sous 480 px : CTA de l'en-tête en `sm`, sans icône, ou déplacé dans la barre du bas. Titre sur 2 lignes maximum |
| PL5 | ℹ️ V2 | En mobile, la capture d'écran est trop petite pour être lue (texte d'environ 5 px) | Zoom automatique sur la zone du hotspot en mobile, ou pincer pour zoomer (à arbitrer) |

#### Re-test après la republication v2 (workspace passé en Pro, `first_name` sans valeur par défaut)

| # | Statut |
|---|---|
| PL1 formulaire | ✅ Il s'affiche avant l'étape 4 en 1 280 et 390 px. L'envoi avec `recette.player@example.com` + consentement donne `rpc/submit_lead` → **200**, puis le parcours reprend à l'étape 4. « Passer » est disponible |
| Suivi des vues (v2) | ✅ `track` → 200 avec la nouvelle `versionId` |
| PL3 contenu | ✅ « Bienvenue » sans « vous ». Le point produit reste ouvert : retirer l'espace quand une variable est vide |
| PL6 (nouveau) | ⚠️ En mobile, pendant le formulaire, la bulle de l'étape 4 (feuille du bas) reste **visible et active** sous le formulaire : « Suivant » permet de contourner le formulaire sans « Passer ». En ordinateur, la bulle n'est qu'assombrie. → Pendant un formulaire, masquer la bulle et la barre de navigation, ou les recouvrir du voile (règle §15.7 : un seul overlay modal à la fois) |
| PL7 (nouveau) | ⚠️ La case de consentement du player est la case native de 13 px, avec une cible tactile trop petite en mobile → case de 20 px avec une zone cliquable de 44 px de haut sur toute la ligne (libellé compris), comme `.fd-check` |

#### Formulaire de lead en plan Free : avertissements à ajouter (retour du chef d'équipe)

Constat dans le code (`dev-mvp`) :
- le seul signal est un `fd-alert` **d'information** dans l'onglet Réglages (`FormPanel`), avec le texte « Les formulaires de lead ne sont pas inclus dans votre plan. » Il ne dit pas que le formulaire **ne sera pas publié** ;
- rien dans le panneau Étape (sélecteur « Formulaire de lead avant cette étape ») ;
- **rien au moment de publier** : la publication retire le formulaire sans prévenir.

Spécification :

1. **Onglet Réglages, carte du formulaire** :
   - `Alert kind="warning"` (icône `TriangleAlert`) en tête de la section ;
   - FR : « **Ce formulaire ne sera pas publié.** Votre plan Free n'inclut pas les formulaires de lead : vous pouvez le préparer, mais les visiteurs ne le verront pas. » + lien « Voir les plans » ;
   - EN : « **This form won't be published.** Your Free plan doesn't include lead forms: you can set it up, but visitors won't see it. » + « See plans » ;
   - badge `warning` « Non publié » / « Not published » sur chaque formulaire de la liste.
2. **Panneau Étape** :
   - sous le sélecteur « Formulaire de lead avant cette étape », quand un formulaire est choisi, texte d'aide en couleur `warning` avec l'icône `TriangleAlert` de 16 px : « Non publié avec le plan Free » / « Not published on the Free plan ».
3. **Au moment de publier** (bouton « Publier »), si la démo contient au moins un formulaire et que le plan ne les inclut pas :
   - **modale de confirmation** avant l'appel à `publish_demo` ;
   - titre FR : « Publier sans le formulaire de lead ? » ;
   - texte FR : « Votre plan Free n'inclut pas les formulaires. La démo sera publiée **sans** le formulaire « {{name}} » (avant l'étape {{n}}) : aucun lead ne sera collecté. » ;
   - boutons FR : « Voir les plans » (secondaire) et « Publier sans formulaire » (primaire) ; `Échap` annule ;
   - EN : « Publish without the lead form? » / « Your Free plan doesn't include forms. The demo will be published **without** the "{{name}}" form (before step {{n}}): no leads will be collected. » / « See plans » / « Publish without form ».
4. **Page de partage** après une publication de ce type :
   - `Alert kind="warning"` : « Publiée sans formulaire de lead (plan Free). » / « Published without lead form (Free plan). » + « Voir les plans ».
5. **Aperçu dans l'éditeur** :
   - le formulaire reste montré, avec un bandeau en haut de la modale : « Aperçu : non publié avec votre plan ».

### Re-vérification L1–L3, A1, P12 et thème sombre (`claude/dev-mvp` @ `edf1b36`, captures du dev)

| # | Statut |
|---|---|
| L1 | ✅ `MousePointerClick` à la place de `Sparkles` |
| L2 | ✅ Alerte `role="alert"` au-dessus des champs, `aria-invalid` et `aria-describedby` (vérifié dans le code d'après la description du dev) |
| L3 | ✅ Jauge en 3 segments sur toute la largeur et texte en dessous (« Robustesse : forte »). Le libellé ne répète plus le minimum |
| A1 | ✅ Variation du taux de complétion, « — » plus un texte pour lecteur d'écran quand il n'y a pas de période de référence |
| P12 | ✅ Colonne d'aperçu de 320 px conforme à la spec (capture de l'étape 1, pastille statique, « 3 étapes », « Ouvrir l'aperçu ») |
| Thème Clair / Sombre / Système | ✅ Premier rendu correct (`21-theme-sombre-menu`) :<br>- surfaces Stone sombres hiérarchisées ;<br>- marque Lagoon éclaircie ;<br>- alerte info sombre avec bordure de 1 px ;<br>- vignettes de capture restées claires (`.fd-player-scope`) ;<br>- sélecteur segmenté `Sun` / `Moon` / `Monitor` dans le menu du compte |
| Menu du compte | ✅ Il s'ouvre au-dessus du déclencheur et n'est plus coupé dans cette capture. La passe « débordements » complète (§15.7) reste à faire sur le build intégré, dans les deux thèmes |

Points d'attention pour la passe débordements et thème sombre :
- les trois boutons du sélecteur de thème n'ont que des icônes : vérifier leur `aria-label` et leur info-bulle (« Clair », « Sombre », « Système ») ;
- vérifier dans le menu de compte, en sombre, le contraste du segment actif (fond `primary-soft`) par rapport au segment au survol ;
- vérifier l'éditeur, les tableaux et les modales en sombre : le canevas et l'aperçu doivent rester en `.fd-player-scope` (clair).

### Passe « débordements » (§15.7) — `claude/dev-mvp` @ `8c6c9b0`, faux Supabase

Écrans testés en 1 440, 1 024 et 390 px, en thème clair et sombre (6 configurations, 36 mesures automatiques) :
- tableau de bord ;
- éditeur (ordinateur uniquement) ;
- tiroir de navigation mobile ;
- page de partage d'une démo publiée.

Pour chaque overlay ouvert, je vérifie :
- que sa boîte est entièrement dans le viewport, à 8 px au moins des bords ;
- qu'il est rendu dans `#fd-portal` ou dans la *top layer*, sans ancêtre qui le coupe ;
- qu'aucun libellé n'est tronqué (`scrollWidth`) ;
- que `Échap` le ferme et rend le focus au déclencheur.

Captures : `docs/ux/recette/debordements/`.

| Overlay | 1 440 | 1 024 | 390 | Clair / sombre |
|---|---|---|---|---|
| Menu du compte (bas de la barre latérale) | ✅ au-dessus, dans le portail, focus rendu | ✅ | ✅ dans le tiroir, ouvert vers la gauche, à 8 px du bord | ✅ |
| Menus ⋯ des cartes de démo (6 actions) | ✅ en dessous, aligné à droite, complet | ✅ | ✅ retourné au-dessus du déclencheur, complet | ✅ |
| Menu « Ajouter une étape » (éditeur) | ✅ | ✅ | sans objet | ✅ |
| Modales de confirmation (supprimer, dépublier) | ✅ `<dialog>` natif en *top layer*, 440 px, centrée | ✅ | ✅ 356 px avec 17 px de marge | ✅ |
| Retour « Copié » sur le bouton Copier | ✅ retour dans le bouton, pas de toast (il n'y a pas de système de toasts) | ✅ | ✅ | ✅ |
| Libellés tronqués | ✅ aucun | ✅ | ✅ | ✅ |

**Bilan** : le correctif portail règle le problème du client. Aucun overlay n'est coupé ni ne sort du viewport, dans aucune des 6 configurations. J'ai ajouté le `<dialog>` natif en *top layer* comme équivalent accepté du portail pour les modales dans §15.7.

**Écarts trouvés pendant la passe**

| # | Gravité | Écart | Correction attendue |
|---|---|---|---|
| DB1 | ⚠️ Accessibilité | En 390 px, **`Échap` ne ferme pas le tiroir de navigation**. Le voile reste affiché et bloque la page jusqu'à un clic dessus | `Échap` ferme le tiroir et rend le focus au bouton menu. Piéger le focus dans le tiroir tant qu'il est ouvert |
| DB2 | ❌ Contraste (sombre) | Aperçu de partage vide en thème sombre : le texte « L'aperçu apparaîtra après la première capture. » est en `rgb(179,173,164)` sur le cadre clair `rgb(247,246,244)`, soit un contraste de **2,06:1** (AA demande 4,5:1). Le cadre a le fond clair du player mais pas la classe `.fd-player-scope`, donc il reçoit les couleurs de texte du thème sombre | Ajouter `.fd-player-scope` au cadre de l'aperçu (`SharePreview`), y compris pour l'état vide. Même vérification sur les vignettes du tableau de bord et le canevas de l'éditeur |
| DB3 | ⚠️ Mise en page | Éditeur en 1 024 px (largeur minimale) : la barre du haut passe sur **2 lignes** (105 px au lieu de 57). Les outils Sélection / Hotspot / Flou passent sous le titre et réduisent la hauteur du canevas | En dessous de 1 280 px : champ de titre en `flex: 1` avec `min-width: 160px`, sans largeur fixe. Outils en icônes seules avec info-bulle. « Aperçu » et « Partager » en icônes seules si besoin. Une seule ligne de 56 px |

### Re-vérification PL2–PL7 et formulaires en plan Free (`claude/dev-mvp` @ `42711b3`, captures du dev 22–24)

| # | Statut |
|---|---|
| PL2 bulle zoomée | ✅ La bulle et la pastille sont hors du calque zoomé, à taille normale, et restent dans le cadre en 1 280 et 390 px |
| PL2b (nouveau) | ⚠️ Avec le recalage de l'origine du zoom, l'image zoomée ne couvre plus tout le cadre : **bande blanche à droite** (environ 42 px en 1 280, 14 px en 390). → Borner la translation pour que l'image couvre toujours tout le cadre : l'origine reste dans `[0 ; 1 − 1/scale]`. Si le hotspot est près d'un bord, on accepte qu'il soit plus près que 12 % plutôt que de montrer un vide |
| PL3 variables vides | ✅ La variable vide disparaît avec l'espace qui la précède. « Aperçu : … » sous les champs qui contiennent une variable (code) |
| PL4 titre mobile | ✅ Titre sur 2 lignes, CTA `sm` sans icône. **Décision** : on garde le CTA dans l'en-tête, qui est l'emplacement attendu pour une action de conversion. La barre du bas reste réservée à la navigation |
| PL6 un seul overlay modal | ✅ La feuille de la bulle est retirée, l'en-tête et les contrôles sont `inert` et atténués pendant le formulaire |
| PL7 case de consentement | ✅ 20 px, ligne cliquable de 44 px |
| Avertissements en plan Free | ✅ dans le code et les libellés : les 5 points de la spec, avec les textes FR et EN repris tels quels (`notPublishedTitle`, `badge`, `stepHelp`, `confirmTitle` / `confirmLabel`, `sharePublished`, `previewBanner`). Pas encore de capture d'un workspace Free : à vérifier visuellement à la prochaine passe |
| Alertes (M-A1) | ✅ `Alert` de type `warning`, avec une icône Lucide par état (`Info`, `CircleAlert`, `CircleCheck`, `TriangleAlert`) |

### Suivi DB1–DB3 et PL2b (annoncés par le dev : `51b8df1`, `6ac3b65`, pas encore revérifiés par l'UX)

- **DB1** : sous 1 024 px, le tiroir est modal ; le focus y est piégé et Échap le ferme en rendant le focus au bouton menu (e2e `menus`).
- **DB2** : `.fd-player-scope` fixe aussi `color` et `color-scheme: light`. La classe est appliquée à l'aperçu de partage (état vide compris), aux vignettes de démo et aux vignettes d'étape, et le contraste est mesuré en e2e.
- **DB3** : la barre de l'éditeur tient sur une ligne de 57 px à 1 024, 1 280 et 1 440 px. Sous 1 280 px, les outils passent en icônes avec `aria-label` et `title`.
- **PL2b** : l'explication du dev est **juste**, et ma recommandation était erronée. Avec un `transform-origin` dans [0 ; 1] et une échelle ≥ 1, l'image agrandie couvre toujours le cadre. La bande blanche venait du manifeste de test (image de 1 100 × 750 annoncée en 1 280 × 800). Corrigé dans `6ac3b65`, avec un contrôle e2e de couverture.

À revérifier lors de la recette « Refonte » sur le build intégré.

## Recette visuelle « Refonte DSI » (`main` @ `e22d750`)

Tests :
- **build intégré** avec le faux Supabase : dashboard, analytics d'une démo et éditeur, en 1 440, 1 024 et 390 px, thèmes clair et sombre (18 captures et mesures DOM), comparés aux maquettes `maquettes/refonte/` ;
- **site réel** : écran de connexion et player Nordline.

Captures : `docs/ux/recette/refonte/`.

**Conforme aux maquettes**

| Contrôle | Résultat |
|---|---|
| Police | ✅ Plus Jakarta Sans partout, y compris dans le player en ligne |
| Fond / cartes | ✅ `#EEF2F6` en clair, `#0B0D10` en sombre. Cartes de 24 px sans bordure avec ombre douce en clair, bordure de 1 px en sombre |
| Navigation | ✅ Pilule active noire avec texte blanc (claire avec texte noir en sombre), éléments de 44 px. Logo DSI avec « DSI des Missions Locales » |
| Titres | ✅ `h1` de 32 px en 800 |
| KPI | ✅ Carte héro verte avec texte noir, valeurs de 40 px, puces d'icône, badges de tendance pilules (hausse en vert, baisse en framboise, « — » neutre) |
| Boutons | ✅ Pilules ; segmentés pour les périodes et les statuts ; bouton prune « Nouvelle démo » |
| Dashboard | ✅ Filtres en segmenté, dossiers en pilules, carte « Nouvelle démo » en pointillés, vignettes claires en sombre, cloche absente |
| Graphiques | ✅ Barres orange arrondies sur piste pâle, valeurs écrites au-dessus, pic en noir (en clair en sombre). Donut SVG sur 3 sources réelles (52 / 28 / 20 %). Entonnoir en barres horizontales |
| Éditeur | ✅ Barre sur une ligne à 1 024 et 1 440 px (DB3 ✅), outils en segmenté noir (en icônes à 1 024 px), rail en cartes avec étape courante prune, canevas et vignettes clairs en sombre (DB2 ✅), panneau avec onglets pilules et interrupteurs |
| Motifs proscrits | ✅ 0 dégradé, 0 emoji, aucun défilement horizontal de la page, dans les 18 configurations |
| Player en ligne | ✅ Thème DSI par défaut : bouton « Réserver une démo » et « Suivant » en prune, pastille framboise, progression orange, Plus Jakarta Sans |

**Écarts**

| # | Gravité | Écran | Écart | Correction attendue |
|---|---|---|---|---|
| RF1 | ⚠️ | Dashboard et analytics, 390 px | Les 4 ou 5 KPI s'empilent sur **une colonne** (environ 160 px chacun) : il faut presque 2 écrans avant d'atteindre les démos. C'est ma spec (« 1 colonne sous 480 px ») qui était trop prudente | Sous 480 px : **grille de 2 colonnes**, la carte héro en pleine largeur (`grid-column: 1 / -1`), valeur en 28 px, pied réduit au seul badge de tendance (« vs 30 jours précédents » en texte `sr-only`). Je mets `refonte.md` §2 à jour |
| RF2 | ⚠️ | Analytics, 1 024–1 279 px | 5 KPI sur 2 colonnes : la carte « Leads » reste seule sur sa ligne | Entre 1 024 et 1 279 px : **3 colonnes** (3 + 2). Au-delà de 1 280 px : 5 colonnes, comme aujourd'hui |
| RF3 | ⚠️ | Analytics, 1 440 px | Avec 5 KPI, « Visiteurs uniques » et « Taux de complétion » passent sur 2 lignes, et le pied de la carte héro passe sous le badge. Les rangées sont irrégulières | `white-space: nowrap` + ellipse sur `.fd-kpi__label` (libellé complet dans `title`), pied sur une ligne (« vs 30 j préc. » si la largeur est inférieure à 220 px) |
| RF4 | ⚠️ | Analytics, 390 px | Les titres de carte passent sur 2 ou 3 lignes à côté de leur action (« Vues par jour » + segmenté, « Parcours étape par étape » + Exporter). Les barres de l'entonnoir sont très courtes | Sous 480 px : `.fd-card__head { flex-wrap: wrap }`, action sur sa propre ligne. Entonnoir sur 2 lignes par étape (libellé au-dessus, puis barre, nombre et perte) |
| RF5 | ℹ️ | Analytics, 390 px | Le tableau des leads défile horizontalement (`overflow-x: auto`, 576 px dans 308 px), mais rien ne l'indique | Ombre de bord droite quand il reste du contenu (`mask-image` ou ombre interne), ou affichage en liste sous 480 px (e-mail en titre, puis entreprise · date) |
| RF6 | ⚠️ | Analytics d'une démo | **Aucune entrée de navigation n'est active** (`aria-current` absent). On ne sait plus où l'on est | Mettre en actif « Démos » sur toutes les routes `/demos/:id/*` (analytics, partage, éditeur), puisque ces écrans sont atteints depuis une démo. Le retour ← reste en place |
| RF7 | ℹ️ | Donut | La légende affiche les % mais pas le nombre de vues (`text-subtle`) prévu par la spec | Ajouter le nombre de vues à droite du pourcentage, comme dans la maquette |
| RF8 | — | Connexion (site réel) | Pas encore refondue : panneau gauche gris, pas de logo DSI blanc sur prune | Prévu au §7 (« Authentification »), en cours chez le dev. À revoir à la prochaine passe |

**Bilan** : la refonte est **fidèle aux maquettes** sur les trois écrans, dans les deux thèmes, et DB2 et DB3 sont confirmés corrigés. 7 écarts, aucun bloquant : 5 d'ajustement responsive (RF1 à RF5, surtout en mobile), 1 de navigation (RF6) et 1 de détail (RF7). La connexion (RF8) reste à refondre au §7.

### Refonte §7 (`claude/dev-mvp` @ `16f9d34`, inclus dans `main`) : captures du dev en clair et en sombre + site réel

| Écran | Statut |
|---|---|
| Connexion / inscription | ✅ Panneau prune (identique en sombre) avec le logo DSI blanc officiel nettoyé, titre et arguments en blanc, champs pilules de 48 px, bouton prune pleine largeur. **En ligne sur le site réel** : RF8 est résolu |
| Partage | ✅ Cartes avec puces d'icône (`Globe`, `Code`, `Link`, `History`), URL en pilule `readonly` avec « Copier » accolé, aperçu P12 dans une carte, « Dépublier » en `ghost` danger |
| Paramètres | ✅ Formulaire en carte. Carte « Plan » avec jauges prune. **Zone de danger** : puce `TriangleAlert` sur `danger-soft` et bouton danger plein, conforme en sombre |
| Plans | ✅ Plan actuel en carte **héro** verte avec texte noir et badge « Plan actuel » en pilule noire, les autres en blanc. Alerte info « Paiement en ligne bientôt disponible… » |
| Leads, membres, profil | ✅ Même grammaire : tableaux en carte, actions en pilules |
| Thème sombre | ✅ 22 captures `sombre/` cohérentes avec les maquettes |

Points ouverts : RF6 (pas d'entrée de navigation active sur `/demos/:id/*`, visible aussi sur le partage) et RF1 à RF5, RF7.

**Décision « Plans » (question du dev)** : pas de bouton « Choisir » tant que le changement de plan est manuel (D6). À la place, un **bouton secondaire « Nous contacter »** (`Mail`) dans l'alerte info et sous chaque plan non actuel :
- `mailto:` vers l'adresse de support **configurable** (`VITE_SUPPORT_EMAIL`, jamais en dur dans le code, puisque le dépôt est public) ;
- objet pré-rempli : « Changement de plan : {{workspace}} → {{plan}} » / « Plan change: {{workspace}} → {{plan}} » ;
- si la variable n'est pas définie, le bouton est masqué et le texte actuel reste affiché.

### Panneau Commentaires (`claude/dev-mvp` @ `5981de9`, captures du dev 25, clair et sombre)

Le dev a livré **sans avoir vu `commentaires.md`**. Il a pourtant bien suivi la grammaire de la refonte : carte de rayon 24 px sous le canevas, poignée accessible au clavier et repli au double-clic, saisie avec Entrée et Maj+Entrée et consigne en `sr-only`, compteur dans le rail, rendu correct en sombre. Écarts par rapport à la spec :

| # | Gravité | Écart | Attendu (`commentaires.md`) |
|---|---|---|---|
| CM1 | ⚠️ | Hauteur par défaut trop basse : on ne voit qu'un commentaire et demi, et le premier est coupé sous l'en-tête (« Résoudre » tranché) | Hauteur par défaut de **280 px** (220 px entre 1 024 et 1 280 px). À l'ouverture d'une étape, liste positionnée sur le dernier commentaire. Bord haut de la liste net (padding-top de 4 px, pas d'élément sous l'en-tête) |
| CM2 | ⚠️ | Le champ de saisie a le **focus au chargement** (double anneau bleu et prune) | Pas de focus automatique au chargement : seulement quand l'utilisateur ouvre ou déplie le panneau. Un seul anneau de focus (`--fd-shadow-focus`), pas de bordure prune en plus |
| CM3 | ⚠️ | Compteur de l'en-tête en pastille noire avec le chiffre seul (« 2 » : 2 quoi ?) | Badge « **2 ouverts** » en `accent-soft` / `accent-soft-text` (clé `openCount_*`), masqué à 0 |
| CM4 | ⚠️ | Badge du rail en pilule noire **sous** le titre | Pilule **framboise** (`accent`) en haut à droite de la vignette, avec `MessageSquare` de 12 px et le nombre (99+ au-delà), ajoutée au nom accessible de l'étape. Le framboise signale « à traiter », le noir est réservé à la navigation active |
| CM5 | ⚠️ | Crayon, corbeille et « Résoudre » visibles en permanence sur chaque commentaire : la liste est chargée | Actions visibles au survol et au focus (toujours visibles en tactile, `@media (hover: none)`). « Modifier » et « Supprimer » dans un menu ⋯ en portail (§15.7), réservé à l'auteur (et aux admins pour « Supprimer ») |
| CM6 | ℹ️ | L'auteur courant s'affiche « Vous », et tous les avatars sont prune | « Alice Martin **(vous)** ». Couleur d'avatar stable par membre, choisie parmi `chart-1` à `chart-5` (texte noir sur orange, vert et bleu ; blanc sur prune et framboise) |
| CM7 | ℹ️ | Mention « Internes à l'équipe, jamais publiés », sans icône | Clé `private` : « Interne à l'équipe · jamais publié », avec l'icône `Lock` de 14 px, **sous** le titre. Utiliser les **49 clés `editor.comments.*`** de `docs/ux/i18n` |
| CM8 | ℹ️ | Poignée de 40 × 4 px, hauteur minimale de 120 px, icône d'envoi `Send` | Accepté tel quel : écarts mineurs sans effet sur l'usage |
| CM9 | ? | États non visibles sur les captures : vide, tout résolu, filtre « résolus », modification, replié, chargement, erreur d'envoi, lecture seule, **mobile** (lire et répondre depuis l'écran « écran plus large ») | Ajouter des captures `25b` à `25h` pour ces états. Je les vérifierai contre `maquettes/refonte/editeur.html` (barre d'états) et `commentaires-mobile.html` |

## Recette commentaires (79267c3 / e360960) et RF1–RF7

Captures `docs/tech/captures/finition/25*.png` (clair et sombre), relues le 17/11.
- **CM1–CM9 : conformes.** En-tête avec badge « n ouverts », mention « Interne à l'équipe · jamais publié », avatars de couleur stable avec texte lisible, liens cliquables, saisie en pilule, vue mobile (25i) avec sélecteur d'étape et actions sous le texte.
- **Arbitrage lecteur** (chef d'équipe) : le lecteur lit et ajoute des commentaires. Il agit seulement sur les siens. `commentaires.md` §3 est mis à jour.
- Point mineur (non bloquant) : sur 25, le badge annonce « 2 ouverts » et un seul commentaire est visible sans défiler. Vérifier que la liste s'ouvre sur le **plus ancien commentaire non lu**, pas tout en bas. Sinon, afficher la pilule « n autres ↑ ».
- **RF1–RF7 : conformes** à la lecture des captures 10 et 11 (KPI sans troncature à 1 440 px avec 4 KPI, héro vert avec texte noir, « Analytics » actif). RF3 (ellipse avec 5 KPI) est accepté tel que décrit par le dev.

## Recette F1 : parcours guidés (main @ 15b0a14)

**Périmètre** : `a2-editeur.md` §1 (Spotlight), §2 (pop-up), §3 (checklist), §5 (menu de choix), plus la lecture automatique.
- **Éditeur** : faux Supabase, 1 440 et 1 024 px, en clair et en sombre.
- **Player** : `apps/player` en local, avec un manifeste de test (Spotlight, pop-up « Consigne » avec 3 choix, 2 chapitres, checklist), à 1 280 et 390 px.

Le player en production n'a aucune démo F1 publiée, et je ne crée pas de contenu en production : la recette du player sur le site réel reste à faire sur une démo de recette publiée par le chef d'équipe.

Exclus, reportés par le dev : le cadre Navigateur / Mobile et le fond Image.

**Conforme :**
- **Mode de lecture (éditeur)** : cartes illustrées Visite guidée / Spotlight avec `aria-pressed`, aide « valent pour toute la démo ». L'aperçu du canevas passe en Spotlight : voile, trou et anneau framboise, bulle au-dessus du voile.
- **Player Spotlight** : voile en SVG avec la zone éclairée, anneau framboise, bulle lisible.
- **Pop-up** : choix Plein écran / Pop-up, variante, icône, fond « Capture floutée / Couleur », libellé du bouton (« Vide = Suivant »). Dans le player : carte centrée sur la capture floutée, badge Information / Consigne, `role="dialog"`.
- **Menu de choix** :
  - éditeur : bloc par choix (libellé, puis destination et corbeille), « Ajouter un choix », icône `GitBranch` sur la vignette du rail ;
  - player : boutons pleine largeur avec chevron, **focus sur le premier choix**, « Précédent », navigation vers l'étape cible vérifiée.
- **Checklist** :
  - réglages : interrupteur, titre, position Gauche / Droite / Repliée, aide « un élément par chapitre » ;
  - player : carte « n sur N terminées », barre orange sur piste pâle, élément terminé avec `CircleCheck` et texte barré ;
  - mobile : pilule « Votre progression 1/2 ».
- **Lecture automatique** : interrupteur avec l'aide « s'arrête sur un formulaire, un menu de choix ou la dernière étape ».
- **Mobile 390 px** : bulle en feuille du bas, pop-up pleine largeur. Aucune erreur JS dans tous les scénarios.

**Écarts :**

| N° | Écart | Gravité | Correction attendue |
|---|---|---|---|
| F1-1 | Dans le **canevas de l'éditeur en sombre**, la pop-up prend le thème sombre de l'app, alors que le player reste au thème de la démo | Moyenne | Envelopper le rendu de l'étape dans `.fd-player-scope`, comme pour les captures |
| F1-2 | **Fond « Capture floutée »** : le canevas de l'éditeur montre un fond uni sombre. Le player, lui, floute bien l'étape précédente | Mineure | Afficher la capture précédente floutée dans le canevas aussi (WYSIWYG, §0) |
| F1-3 | **Checklist à 1 280 px** : la carte déborde d'environ 100 px sur la capture, en bas à droite, et peut cacher un hotspot | Moyenne | La placer **hors du cadre** quand la place le permet (largeur de la carte + 16 px de chaque côté). Sinon, la replier en pilule comme en mobile. Elle ne doit jamais recouvrir le hotspot courant |
| F1-4 | **Checklist** : le chapitre est coché « terminé » dès l'**affichage** de sa dernière étape (élément à la fois barré et « en cours ») | Mineure | Le cocher quand on **quitte** la dernière étape (Suivant ou choix), comme dit la spec |
| F1-5 | **Titre de la checklist** vide dans l'éditeur, sans placeholder, alors que le player affiche « Votre progression » | Mineure | Placeholder « Votre progression » dans le champ |
| F1-6 | **Commentaires à 1 024 px** : l'état vide déborde sur la saisie (texte superposé au champ) | Mineure | Hauteur minimale du panneau pour l'état vide, ou texte sur une seule ligne avec ellipse |

**Hors F1, à noter :** le pied du player affiche encore « Créé avec FlowDSIML ». Le nom choisi est **Tutoclic** : à changer quand le chef d'équipe lance le renommage.
