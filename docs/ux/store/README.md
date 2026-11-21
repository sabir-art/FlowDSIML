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
| `debugger` | Afficher la page en taille téléphone ou tablette pour le type « Format mobile » (émulation d'écran). | `background.ts` (`Emulation.setDeviceMetricsOverride`) |
| Accès aux sites (`<all_urls>`) | Capturer le logiciel web choisi par l'utilisateur, quelle que soit son adresse. | `host_permissions` |

**Recommandation avant l'envoi en revue** : passer `debugger` en `optional_permissions`, demandée seulement au premier choix de « Format mobile ». À l'installation, Chrome affiche un avertissement fort pour cette permission, et la revue de Google la regarde de près. Les autres types de capture n'en ont pas besoin.

**Données déclarées** (à confirmer par le dev et le DPO avant l'envoi) :
- informations d'authentification (adresse e-mail du compte TutoClick) ;
- contenu des sites web : captures et pages HTML, envoyées à TutoClick seulement après la validation de l'utilisateur ;
- activité de l'utilisateur : clics pendant l'enregistrement, qui servent à créer les étapes.
- Aucune vente ni transmission à des tiers en dehors du traitement prévu, aucune utilisation sans rapport avec l'objectif unique.
- Lien de la politique de confidentialité : celui des mentions de l'app (`/legal/`).

## 4. À corriger dans l'extension avant de reprendre les captures

1. Le popup dit « **Workspace** » (capture 1). Il faut « **Espace** », comme dans l'app depuis L48-A.
2. Une fois le point 1 corrigé, je reprends la capture 1 : `render.cjs` suffit après le remplacement de `src/s1-popup.png`.

## 5. Visibilité (décision du chef)

L'outil sert à une centaine d'agents de la DSI. La visibilité **« Non répertoriée »** semble la plus adaptée : on installe l'extension par son lien, et elle n'apparaît pas dans les recherches. La fiche et les visuels restent les mêmes.
