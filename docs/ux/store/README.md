# EXT-STORE : fiche Chrome Web Store de l'extension

> Visuels et textes de la fiche, préparés le 21 novembre sur `main` = `d33d5a1`. Les captures montrent seulement des données fictives : l'espace Acme, l'outil ExampleCRM, des adresses en `example`, et une page de test pour le floutage.
> Règles du logo : `composants.md` §16. Exigences de Google : [Supplying Images](https://developer.chrome.com/docs/webstore/images) et [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing).

## 1. Visuels (à téléverser tels quels)

| Fichier | Taille | Usage dans la fiche | Contrôle |
|---|---|---|---|
| `icone-128.png` | 128 × 128, PNG transparent | Icône de la boutique | Icône seule officielle (`symbole-tutoclick.svg`) dessinée sur **96 × 96**, avec **16 px de marge transparente** de chaque côté, comme le demande Google. Le manifeste garde `icon-128.png`, qui va jusqu'aux bords. |
| `capture-1-1280x800.png` | 1280 × 800 | Capture 1 : le popup et la page en cours de capture | pleine page, sans marge extérieure |
| `capture-2-1280x800.png` | 1280 × 800 | Capture 2 : l'éditeur, une étape et sa bulle | idem |
| `capture-3-1280x800.png` | 1280 × 800 | Capture 3 : vérification des données personnelles avant l'envoi | idem |
| `capture-4-1280x800.png` | 1280 × 800 | Capture 4 : la démo vue par un visiteur | idem |
| `capture-5-1280x800.png` | 1280 × 800 | Capture 5 : les 3 types de contenu | idem |
| `vignette-440x280.png` | 440 × 280 | Petite vignette promotionnelle | Logo compact officiel sur fond clair, sans autre texte (conseil de Google), lisible à demi-taille ; zone de protection respectée (§16.3) |

- **Source** : `fiche-store.html`, avec un rendu par `render.cjs` (`node render.cjs` depuis ce dossier, avec Playwright). Les écrans viennent de l'app et de l'extension servies en local sur `d33d5a1`, avec le faux backend des e2e. Ils sont dans `src/`.
- **Mise en page** :
  - un titre de 40 px et une phrase de 20 px ;
  - le logo compact en haut à droite ;
  - l'écran réel dans un seul cadre fin, sans ombre ni dégradé.
- Ce sont toutes des captures d'écrans réels : aucun écran n'est inventé.
- **Grande vignette** (1400 × 560, carrousel de l'accueil) : facultative, non fournie. Elle ne sert que si Google met l'extension en avant, ce qui est peu probable pour un outil interne.

## 2. Textes de la fiche (proposés, à reprendre tels quels)

| Champ | Texte | Limite |
|---|---|---|
| **Nom** (`manifest.name`) | TutoClick Capture | 45 caractères. Il faut retirer le tiret long du nom actuel (« TutoClick — Capture ») : le nom se lit mieux sans signe. |
| **Résumé** (`manifest.description`) | Créez une démo interactive en parcourant votre logiciel : chaque clic devient une étape, avec sa bulle d'explication. | 132 caractères au plus (ce texte en fait 117) |
| **Catégorie** | Productivité, puis Outils | |
| **Langue** | Français | |

**Description détaillée** :

> TutoClick Capture enregistre votre parcours dans un logiciel web et en fait une démo interactive, prête à partager.
>
> Comment ça marche
> 1. Ouvrez votre logiciel et choisissez le type de capture : captures à chaque clic, page HTML, vidéo de l'onglet ou format mobile.
> 2. Faites votre parcours. Chaque clic devient une étape, avec sa bulle d'explication.
> 3. Vérifiez la capture : les données personnelles repérées sont floutées avant l'envoi. La détection se fait dans votre navigateur, et rien n'est envoyé avant votre validation.
> 4. Retouchez la démo dans TutoClick, puis partagez-la par lien, dans votre intranet ou en paquet SCORM.
>
> L'extension a besoin d'un compte TutoClick. Elle ne capture que pendant l'enregistrement, sur l'onglet choisi et, si vous l'activez, sur les onglets ouverts depuis lui.

- Chaque phrase correspond à une fonction présente sur `d33d5a1` : les 4 types de capture du popup, la vérification des données personnelles avant l'envoi (écran `review`), le partage par lien, l'intégration et le paquet SCORM.
- Pas de superlatif, pas d'emoji, pas de nom de structure réelle.

## 3. Confidentialité et permissions (onglet « Pratiques de confidentialité »)

**Objectif unique** : « Créer des démos interactives à partir d'un parcours dans un logiciel web. »

| Permission | Justification à saisir | Vérifié dans le code |
|---|---|---|
| `activeTab`, `tabs` | Lancer la capture sur l'onglet choisi et suivre les nouveaux onglets ouverts depuis lui, si l'utilisateur l'active. | `entrypoints/popup`, `entrypoints/background.ts` |
| `scripting` | Afficher la barre d'enregistrement dans la page capturée. | `background.ts` (`recorder.js`, `htmlbar.js`, `videobar.js`) |
| `storage` | Garder la session de connexion et la capture en cours jusqu'à l'envoi. | `lib/supabase.ts`, écrans de vérification |
| `tabCapture`, `offscreen` | Enregistrer la vidéo de l'onglet (type « Vidéo de l'onglet »). | `popup`, `background.ts`, `offscreen` |
| `debugger` (obligatoire si on la garde : Chrome ne l'accepte pas en facultative, voir §6.0) | Pendant l'enregistrement et sur les onglets capturés seulement : afficher la page en taille téléphone ou tablette (« Format mobile »), mettre l'onglet à la taille choisie, et garder la page entière à chaque capture pour animer le défilement. | `background.ts` : `Emulation.setDeviceMetricsOverride`, `Page.captureScreenshot` (`captureBeyondViewport`) |
| Accès aux sites (`<all_urls>`) | Capturer le logiciel web choisi par l'utilisateur, quelle que soit son adresse. | `host_permissions` |

**`debugger` ne peut pas être facultative** : correction du 21 novembre, signalée par le dev et vérifiée dans la [référence chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions), qui la range parmi les permissions jamais facultatives. Elle sert à 3 fonctions : le « Format mobile », la taille d'onglet imposée et la page entière en « Captures à chaque clic ». Sans elle, la capture à chaque clic marche quand même, en gardant seulement la partie visible de la page (`captureVisibleTab`). Arbitrage : §6.0.

**Données déclarées** (à confirmer par le dev et le DPO avant l'envoi) :
- informations d'authentification (adresse e-mail du compte TutoClick) ;
- contenu des sites web : captures et pages HTML, envoyées à TutoClick seulement après la validation de l'utilisateur ;
- activité de l'utilisateur : clics pendant l'enregistrement, qui servent à créer les étapes.
- Aucune vente ni transmission à des tiers en dehors du traitement prévu, aucune utilisation sans rapport avec l'objectif unique.
- Lien de la politique de confidentialité : celui des mentions de l'app (`/legal/`).

## 4. À corriger dans l'extension avant de reprendre les captures

1. Le popup dit « **Workspace** » (capture 1). Il faut « **Espace** », comme dans l'app depuis L48-A.
2. Une fois le point 1 corrigé, je reprends la capture 1 : `render.cjs` suffit après le remplacement de `src/s1-popup.png`.

## 5. Visibilité

**Décision du chef (21 novembre) : « Non répertoriée ».** On installe l'extension par son lien, et elle n'apparaît pas dans les recherches. La fiche et les visuels restent les mêmes.

## 6. Autorisations demandées à l'usage

### 6.0 `debugger` : ma spec du §6 d'origine était infaisable, arbitrage demandé au chef
Chrome refuse `debugger` dans `optional_permissions` : on ne peut pas la demander au moment de l'usage. Il reste deux options.

| Option | Effet sur l'utilisateur | Effet sur la fiche |
|---|---|---|
| **A. Garder `debugger` obligatoire** | Les 3 fonctions marchent comme aujourd'hui. À l'installation, Chrome affiche un avertissement fort sur l'accès au débogueur et à la lecture des données des sites. | Justification du §3 à saisir. Revue de Google plus attentive. |
| **B. Retirer `debugger` du build de la boutique** (proposition du dev) | « Format mobile » et « Taille de l'onglet » passent en « Bientôt », visibles et désactivés, pas masqués. « Captures à chaque clic » garde seulement la partie visible : le défilement animé dans l'éditeur n'est plus possible pour ces captures. | Plus d'avertissement fort, revue plus simple. |

**Ma recommandation : B pour la première publication.**
- L'extension est « Non répertoriée » et sert à des agents qui l'installent sur le poste de travail. Un avertissement « lire et modifier les données de tous les sites, débogueur » risque de bloquer l'installation (refus des agents, ou de la politique du poste), au moment même où l'on veut qu'ils l'adoptent.
- Le cœur du service ne dépend pas de `debugger` : captures à chaque clic, capture HTML, vidéo de l'onglet et vérification des données personnelles.
- On rouvrira « Format mobile » et la page entière dans une version 2 de l'extension, si les agents les demandent. Elle portera l'avertissement, expliqué dans l'article d'aide.

**Textes en option B** :
- sous « Format mobile » et « Taille de l'onglet » : « Bientôt » en texte gris à droite, et une aide de 13 px : « Pas encore disponible dans la version de la boutique. » ;
- l'aide de « Captures à chaque clic » ne promet plus la page entière. Elle devient « Chaque clic donne une capture de la partie visible de la page. » à la place de `fullPageHelp` ;
- la fiche (§2) ne cite plus le « format mobile » : la liste de l'étape 1 devient « captures à chaque clic, page HTML ou vidéo de l'onglet ».

**Si le chef choisit A** : aucun encart n'est utile pour `debugger`. On ajoute une ligne à l'article d'aide « Installer l'extension » pour expliquer l'avertissement de Chrome.

Les §6.1 à §6.5 ci-dessous gardent l'encart pour une **autorisation réellement facultative** : l'accès aux sites (§6.6). Leurs textes `debugger` ne s'appliquent pas, quelle que soit l'option.

### 6.0 bis Ancienne spec (sans effet pour `debugger`)

Chrome affiche sa propre fenêtre d'autorisation, que l'on ne peut pas modifier. Avant elle, le popup montre un **encart d'explication**, pour que la personne sache pourquoi on lui demande l'autorisation et ce qui se passe si elle refuse.

### 6.1 Quand la demander
- Au clic sur « Démarrer la capture », si l'autorisation n'est pas accordée (`chrome.permissions.contains`) et que la capture en a besoin :
  - **Format mobile** : toujours ;
  - **Taille de l'onglet** différente de « Taille actuelle » : toujours ;
  - **Captures à chaque clic** (page entière) : à la première capture seulement. Après un « Pas maintenant », on ne la redemande plus à chaque démarrage (choix gardé dans `storage`). Le lien « Autoriser la page entière » reste sous l'aide du type.
- Jamais à l'installation, ni à l'ouverture du popup.

### 6.2 Encart dans le popup (à la place du bouton « Démarrer », même largeur)
- **Titre** (15 px 600) : « Une autorisation de Chrome est nécessaire »
- **Phrase**, selon le cas :
  - Format mobile : « Pour afficher la page en taille téléphone ou tablette, TutoClick utilise l'outil de débogage de Chrome sur l'onglet capturé. »
  - Taille de l'onglet : « Pour mettre l'onglet à la taille choisie, TutoClick utilise l'outil de débogage de Chrome sur l'onglet capturé. »
  - Page entière : « Pour garder la page entière à chaque capture (défilement animé dans l'éditeur), TutoClick utilise l'outil de débogage de Chrome sur l'onglet capturé. »
- **Ce que ça fait** (13 px `text-muted`, liste de 3 lignes) :
  1. « Seulement pendant l'enregistrement, et seulement sur les onglets capturés. »
  2. « Il sert à régler la taille d'affichage et à prendre les captures. À la fin, l'onglet reprend son état normal. »
  3. « Pendant la capture, Chrome affiche un bandeau qui signale le débogage : c'est normal. »
- **Actions** : « Autoriser » (principale, lance `chrome.permissions.request`, puis la capture si c'est accepté) et « Pas maintenant » (lien).
- **Pied** (12 px `text-muted`) : « Vous pouvez retirer cette autorisation à tout moment dans les détails de l'extension. »

### 6.3 En cas de refus (dans la fenêtre de Chrome, ou « Pas maintenant »)
| Cas | Ce qui se passe | Texte affiché sous le type (13 px) |
|---|---|---|
| Format mobile | La capture ne démarre pas. « Format mobile » reste choisi : on ne change pas le choix de la personne à sa place. | « Format mobile indisponible sans cette autorisation. » puis le lien « Autoriser » |
| Taille de l'onglet | La capture démarre à la taille actuelle. | « La capture garde la taille actuelle de l'onglet. » |
| Page entière | La capture démarre ; chaque capture garde la partie visible. | « Les captures gardent seulement la partie visible de la page. » puis le lien « Autoriser la page entière » |

- Rien n'est masqué : « Format mobile » et « Taille de l'onglet » restent visibles et utilisables, avec ces explications.
- Le lien « Autoriser » relance la demande : Chrome accepte une nouvelle demande après un clic.

### 6.4 Textes (i18n de l'extension, `lib/i18n.ts`)
| Clé | Texte |
|---|---|
| `dbgTitle` | Une autorisation de Chrome est nécessaire |
| `dbgWhyMobile` / `dbgWhySize` / `dbgWhyFull` | les 3 phrases du §6.2 |
| `dbgWhat1` / `dbgWhat2` / `dbgWhat3` | les 3 lignes « Ce que ça fait » |
| `dbgAllow` / `dbgLater` | Autoriser / Pas maintenant |
| `dbgRevoke` | Vous pouvez retirer cette autorisation à tout moment dans les détails de l'extension. |
| `dbgDeniedMobile` | Format mobile indisponible sans cette autorisation. |
| `dbgDeniedSize` | La capture garde la taille actuelle de l'onglet. |
| `dbgDeniedFull` | Les captures gardent seulement la partie visible de la page. |
| `dbgAllowFull` | Autoriser la page entière |

### 6.5 Recette
- Première capture « à chaque clic » : l'encart s'affiche. « Pas maintenant » : la capture démarre et les images gardent seulement la partie visible ; au démarrage suivant, l'encart ne revient pas.
- « Format mobile » sans autorisation : l'encart s'affiche. Un refus dans la fenêtre de Chrome : pas de capture, le message et le lien « Autoriser » sont là, et « Format mobile » reste choisi.
- Autorisation accordée : plus aucun encart, et l'émulation fonctionne comme aujourd'hui.
- §18 : l'encart utilise `fd-btn` et `.link-button` (aucun bouton natif) et met 16 px entre ses blocs ; captures en clair et en sombre.

### 6.6 Accès aux sites (`<all_urls>` en facultatif), textes du dev validés
Le même encart sert à demander l'accès aux sites, au moment où la capture doit suivre une autre page ou un autre onglet (`activeTab` suffit pour la page ouverte au démarrage).

| Clé | Texte validé |
|---|---|
| `dbgWhySites` | Pour continuer la capture quand vous changez de page ou ouvrez un onglet depuis la page capturée, TutoClick doit pouvoir accéder aux pages que vous parcourez. |
| `dbgWhatSites` | Rien n'est lu en dehors d'un enregistrement, et rien n'est envoyé avant votre vérification. |
| `dbgDeniedSites` | La capture reste sur la page ouverte au démarrage. |

- Les 3 textes sont exacts : les scripts de capture ne sont injectés qu'au démarrage (`content_scripts` vide dans le manifeste, `scripting` au lancement), et les écrans de vérification (`review`, `html-review`, `video-review`) précèdent tout envoi.
- Le titre de l'encart et le lien « Autoriser » restent ceux du §6.2.
- La ligne 3 du §6.2 (le bandeau de débogage) ne s'affiche pas pour l'accès aux sites, puisqu'elle ne concerne que `debugger`.
