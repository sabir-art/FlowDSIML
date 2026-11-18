# Accessibilité (lot L24, RGAA)

Ce rapport présente l'état de l'accessibilité de TutoClick avant et après le lot L24, ainsi que les contrôles automatisés qui empêchent les régressions. Le référentiel est le RGAA 4.1, qui reprend les critères WCAG 2.1 de niveaux A et AA.

> Périmètre : l'app web (éditeur, tableau de bord, partage, analytics, apprenants, réglages), le lecteur de démo et le centre de formation public. Le PDF balisé reste une dette connue (voir § 5).

## 1. Méthode

Deux scripts tournent en intégration continue, dans le job « Accessibilité (axe-core, RGAA) » de `.github/workflows/ci.yml`. Ils bloquent la fusion en cas de régression.

| Script | Ce qu'il vérifie |
|---|---|
| `apps/web/e2e/a11y.e2e.cjs` | Audit axe-core (règles WCAG 2.1 A et AA) sur 28 pages, en clair et en sombre, soit 56 audits. Il échoue dès qu'une violation « serious » ou « critical » apparaît. L'option `--report` écrit le détail en JSON, qui est conservé comme artefact de la CI. |
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
| `color-contrast` | 3.2 | 19 | Le texte secondaire `#66727F` sur le fond `#EEF2F6` ne donnait que 4,36:1 (barre latérale, sous-titres, mentions légales). Autres cas : vert sur fond sombre dans les réglages du centre, blanc sur l'orange de l'entonnoir, blanc sur le bleu du badge « Plan actuel », vignette texte de l'éditeur en sombre. | Le jeton `text-subtle` passe à `#5C6774` : 5,1:1 sur le fond de page et au moins 4,6:1 sur tous les fonds clairs. Le vert utilise le jeton `success` et le badge une encre foncée. L'entonnoir passe en texte `#080808` (9,6:1) et la vignette sur fond clair. |
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
| **Contrastes** | 19 défauts (voir § 2). | 0. Le nouveau jeton `text-subtle` est à faire valider par la Lead UX dans le design system. |
| **Animations réduites** | Seules certaines animations étaient coupées (pastille pulsée, zoom). | Avec `prefers-reduced-motion: reduce`, toutes les animations et transitions sont coupées dans l'app (`packages/ui/src/base.css`), le lecteur et le centre (`apps/player/src/player.css`). Le test vérifie qu'aucune animation ne reste active. L'aperçu GIF de l'export était déjà en pause par défaut. |
| **Zoom 200 %** | Le tableau des apprenants faisait déborder la page : les textes masqués des en-têtes, positionnés en absolu, sortaient de la zone défilante. Le menu « … » pouvait être coupé avec un défilement interne. | Les tableaux défilants servent de bloc conteneur à ces éléments positionnés. Quand aucun côté du bouton ne suffit, le menu est décalé pour tenir entier dans la fenêtre. Le test vérifie 10 pages en 720 × 450 px (200 % d'un écran de 1440 × 900) : aucune ne défile horizontalement. |
| **Lecteur** | Navigation au clavier déjà possible (flèches gauche et droite, boutons). Le changement d'étape n'était pas annoncé. | Une zone `aria-live="polite"`, toujours présente, annonce « Étape n sur N », le titre puis le texte de la bulle. Le test vérifie la navigation par flèches et par « Suivant » au clavier, et l'annonce de chaque étape. |

## 4. Composants ajoutés

- `@axe-core/playwright` 4.14 (avec axe-core) et Playwright 1.63 : dépendances de développement, utilisées seulement en test. Leurs licences sont dans `THIRD_PARTY.md`. axe-core est sous MPL-2.0, copyleft limité à ses propres fichiers, sans modification et sans livraison.
- Aucune migration de base de données.

## 5. Limites et suites

- **PDF balisé (exports L15)** : jsPDF ne produit ni la structure de titres ni les textes alternatifs des captures. C'est une dette connue, à reprendre si l'on change de moteur PDF.
- **Ce que l'automatisation ne couvre pas** : il manque un audit RGAA complet par une personne qualifiée, avec lecteurs d'écran réels (NVDA, VoiceOver) et grille officielle. Ce rapport ne vaut pas déclaration de conformité. Le statut affiché dans le pied du centre reste celui que choisit l'administrateur (« non évalué » par défaut).
- **Contenus créés par les clients** : les contrastes et les textes des démos (couleurs de marque, bulles) dépendent de leurs auteurs. L'éditeur contrôle déjà le contraste de la couleur de marque (4,5:1).
