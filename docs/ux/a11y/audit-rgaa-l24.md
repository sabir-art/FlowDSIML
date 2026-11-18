# Audit manuel RGAA 4.1 (lot L24)

> **Objet** : audit manuel, par le Lead UX, d'un échantillon représentatif. Il complète l'audit automatique axe-core du dev. On y vérifie ce qu'un outil ne voit pas :
> - pertinence des alternatives ;
> - titres et structure ;
> - ordre de lecture et de tabulation ;
> - focus ;
> - compréhension des messages ;
> - cohérence de la navigation.
>
> **Version auditée** : branche `claude/dev-mvp`, commit 821e4b4, avec les données fictives des tests (`apps/web/e2e`).
>
> **Méthode** :
> - parcours au clavier seul (Tab, Maj+Tab, Entrée, Échap, flèches) ;
> - inspection des noms accessibles, des rôles et des régions ;
> - captures du focus ;
> - relevé scripté dans le navigateur (titres de page, régions, hiérarchie des titres, références ARIA, identifiants) ;
> - contrastes calculés sur les jetons (`contrastes-dsi.md`).
>
> Les restitutions vocales réelles (NVDA, VoiceOver) restent à faire lors de l'audit complet (§5).

## 1. Échantillon

| Page | Adresse (app de test) | Pourquoi |
|---|---|---|
| Connexion | `/#/login` | Formulaire, erreurs, première page |
| Tableau de bord | `/#/` | Navigation principale, cartes, filtres |
| Éditeur | `/#/demos/:id/edit` | Écran le plus complexe (rail, canevas, panneaux) |
| Partager | `/#/demos/:id/share` | Onglets, copie, réglages d'accès |
| Apprenants | `/#/learners` | Tableau de données, filtres, tiroir |
| Centre de formation (réglages) | `/#/center` | Long formulaire, couleurs |
| Lecteur | `player /#/d/:id` | Page publique la plus vue |
| Centre de formation (public) | `player /#/c/:slug` et `/f/:id` | Page publique, recherche, cartes |

## 2. Ce qui est conforme

- **Langue** : `lang="fr"` partout (critère 8.3). Le sélecteur « Changer de langue » est présent.
- **Connexion**, très bon niveau :
  - étiquettes visibles reliées aux champs (11.1, 11.2) ;
  - `autocomplete` renseigné (11.13) ;
  - les erreurs passent par `aria-invalid` et un message relié par `aria-describedby` (11.10) ;
  - le focus va sur le premier champ en erreur ;
  - l'échec de connexion est annoncé en `role="alert"`.
- **Lien d'évitement** « Aller au contenu » en tête de l'app (12.7). Navigation principale nommée et cohérente d'une page à l'autre (12.1, 12.2).
- **Apprenants** :
  - tableau de données avec un titre et des en-têtes `th scope` (5.4, 5.6, 5.7) ;
  - cases de sélection nommées (« Sélectionner Léa Exemple ») et menus nommés (« Actions pour … ») (11.9).
- **Noms accessibles** : aucun contrôle sans nom sur les pages auditées. Les icônes SVG sont masquées (`aria-hidden`) (1.1, 1.2).
- **Centre de formation (public)** :
  - régions `header`, `main`, `search` et `footer` ;
  - fil d'Ariane en `nav` nommée ;
  - nombre de résultats en `role="status"` (7.5) ;
  - focus visible sur la recherche et sur les cartes.
- **Vignettes des démos** : `alt=""` est justifié, car le titre de la démo suit en `h3` dans le même lien (1.2).

## 3. Non-conformités et écarts

Gravité : **Bloquant** = empêche une tâche ; **Majeur** = la gêne fortement ; **Mineur** = la complique ou ne respecte pas la règle sans bloquer.

| Code | Gravité | Critère RGAA | Page | Constat | Correction attendue |
|---|---|---|---|---|---|
| A11Y-01 | Majeur | 8.6 | Toute l'app | Le titre de la page est toujours « TutoClick ». Il ne change pas avec l'écran (Démos, Éditeur, Apprenants…). | Titre « {{écran}} · TutoClick », par exemple « Démos · TutoClick », « Éditeur : Créer une fiche usager · TutoClick », « Apprenants · TutoClick ». Mis à jour à chaque changement de route et de démo. |
| A11Y-02 | Majeur | 12.8, 7.1 | Toute l'app | Au changement d'écran, le focus reste sur `body` et rien n'est annoncé. Un lecteur d'écran ne sait pas que la page a changé. | Au changement de route, placer le focus sur le `h1` de l'écran (`tabindex="-1"`, sans anneau au clic) en plus du nouveau titre (A11Y-01). Garder le focus là où il est quand le changement vient d'un filtre de la même page. |
| A11Y-03 | Bloquant | 7.1, 7.5, 12.8 | Lecteur | Après « Suivant » (bulle ou barre), le focus se perd sur `body` et la nouvelle étape n'est pas annoncée. Au clavier, il faut retraverser toute la page. | Après un changement d'étape, mettre le focus sur le titre de la bulle (`tabindex="-1"`). La bulle est déjà un `dialog` nommé par son titre. À défaut, ajouter une zone `aria-live="polite"` qui lit « Étape n sur N : {{titre}} ». Vérifier aussi les flèches du clavier et Échap. |
| A11Y-04 | Majeur | 10.7 | Lecteur | Les boutons de la barre du bas (Étape précédente, Étape suivante, Langue, Plein écran) n'ont pas de focus visible : `outline: none`, seul un fond assombri de 5 %. | Appliquer le double anneau de focus DSI (`--fd-shadow-focus`), comme partout ailleurs. |
| A11Y-05 | Majeur | 9.1, 12.6 | Lecteur | Pas de région `main` ni de titre `h1`. Le titre de la démo est un texte simple dans l'en-tête. | Mettre le titre de la démo en `h1` (style inchangé) et la scène dans `main`. Les écrans système (mot de passe, lien expiré, reprise) ont déjà leur titre. |
| A11Y-06 | Majeur | 1.3 | Lecteur | La capture a l'alternative « Étape 1 », qui n'apprend rien. | Alternative : « Capture de l'écran, étape n sur N : {{titre de l'étape}} ». Le texte de la bulle porte l'action ; la capture situe l'écran. Pour une capture sans titre d'étape : « Capture de l'écran, étape n sur N ». |
| A11Y-07 | Mineur | 9.1 | Partager ; Centre (page d'une formation) | Saut de niveau de titre : `h1` puis directement des `h3` (Partager : « Personnaliser par paramètres d'URL »… ; formation : la liste des modules). | Partager : titres de cartes en `h2`. Formation : ajouter un `h2` « Modules » (il peut être visuellement masqué) au-dessus de la liste. |
| A11Y-08 | Mineur | 8.2 | Tableau de bord, Éditeur, Partager | L'identifiant `dlg-title` est présent deux fois dans la page (modales montées en double). | Identifiants uniques (`useId`) pour les titres de modales. |
| A11Y-09 | Mineur | 8.2 | Toute l'app | `aria-controls` pointe vers des éléments absents : menus fermés, panneaux d'onglets non montés (`_r_0_`, `tg-pop`, `sh-panel-embed`, `l13-panel-formation`…). | Ne poser `aria-controls` que lorsque l'élément existe (menu ouvert), ou garder les panneaux d'onglets montés avec `hidden`. |
| A11Y-10 | Majeur | 13.3 | Exports L15 | Les PDF exportés ne sont pas balisés : pas de titres structurés ni d'alternatives aux captures (limite de jsPDF, dette connue de L15). Le texte réel, le titre et la langue sont présents. | Changer de moteur de génération, ou produire une version HTML accessible du même contenu. À mentionner dans la déclaration (§ Contenus non accessibles). |
| A11Y-11 | Mineur | 3.2 | Thème clair | Le texte discret (`text-subtle` #66727F) sur le fond #EEF2F6 n'atteint que 4,36:1. | Jeton `text-subtle` à **#5F6B78** (4,83:1). |
| A11Y-12 | Majeur | 3.3 | Thème clair | Bordure des champs (`border-strong` #8793A3) sur le fond #EEF2F6 : 2,77:1. Elle touche les champs posés sur le fond, comme la recherche du tableau de bord. | Jeton `border-strong` à **#768294** (3,46:1 sur le fond). |
| A11Y-13 | Majeur | 10.7, 3.3 | Thème clair | Anneau de focus bleu #2897D5 sur le fond #EEF2F6 : 2,88:1. | Couleur de l'anneau extérieur à **#1F7FB6** (3,91:1). #2897D5 reste la couleur de marque. |
| A11Y-14 | Mineur | 3.3 | Analytics, Apprenants, Exports | Barres orange (2,35:1) et vertes (2,12:1) sur blanc, sous 3:1. C'est conforme seulement si la valeur est écrite. | Vérifier que chaque barre et chaque segment a sa valeur ou sa légende écrite. Sinon, ajouter un liseré foncé ou la valeur. |

## 4. Points à confirmer pendant l'audit complet

- **Éditeur** :
  - le canevas se pilote au clavier : flèches pour déplacer le zoom (L12-02), raccourcis inactifs pendant la saisie ;
  - restitution au lecteur d'écran du rail d'étapes et des panneaux à onglets ;
  - le hotspot se place-t-il sans souris ? Une alternative existe-t-elle (coordonnées saisies) ? Critère 7.3.
- **Modales et tiroirs** : piège du focus, Échap, retour du focus sur le déclencheur. Vérifié en surface sur la fiche apprenant (L13-02) ; à confirmer partout.
- **Zoom à 200 % et redimensionnement du texte** (10.4, 10.11) sur l'éditeur et les tableaux.
- **Contenus cachés** et ordre de lecture des cartes du tableau de bord (10.8, 10.3).
- **Restitution vocale réelle** : NVDA + Firefox, JAWS + Chrome, VoiceOver + Safari (macOS et iOS).
- **Lecteur intégré en iframe** : titre de l'iframe donné par le code d'intégration (2.1, 2.2).

## 5. Pour atteindre une déclaration fondée

1. Corriger A11Y-03 (bloquant), puis les majeurs A11Y-01, 02, 04, 05, 06, 10, 12 et 13.
2. Mener l'audit complet des 106 critères sur l'échantillon du §1, complété de la page Paramètres, de l'inscription et d'un écran d'erreur, avec les restitutions vocales réelles. Calculer le taux de conformité.
3. Publier la déclaration (`declaration-accessibilite.md`) avec le taux mesuré.
