# Fiche Chrome Web Store : TutoClick Capture

> Textes à copier tels quels dans le tableau de bord développeur. Ils reprennent `docs/ux/store/README.md` §2 et §3 (Lead UX), vérifiés dans le code. Visibilité : **Non répertoriée** (décision du chef, 21 novembre).

## 1. Fiche

| Champ | Valeur |
|---|---|
| Nom (`manifest.name`) | TutoClick Capture |
| Résumé (`manifest.description`, 117 caractères sur 132) | Créez une démo interactive en parcourant votre logiciel : chaque clic devient une étape, avec sa bulle d’explication. |
| Catégorie | Productivité, puis Outils |
| Langue | Français |
| Visibilité | Non répertoriée |

**Description détaillée** :

> TutoClick Capture enregistre votre parcours dans un logiciel web et en fait une démo interactive, prête à partager.
>
> Comment ça marche
> 1. Ouvrez votre logiciel et choisissez le type de capture : captures à chaque clic, page HTML ou vidéo de l’onglet.
> 2. Faites votre parcours. Chaque clic devient une étape, avec sa bulle d’explication.
> 3. Vérifiez la capture : les données personnelles repérées sont floutées avant l’envoi. La détection se fait dans votre navigateur, et rien n’est envoyé avant votre validation.
> 4. Retouchez la démo dans TutoClick, puis partagez-la par lien, dans votre intranet ou en paquet SCORM.
>
> Limites connues de cette version
> - Le format mobile (page en taille téléphone ou tablette) et la capture de la page entière arriveront dans une prochaine version.
> - La taille de l’onglet choisie s’obtient en redimensionnant la fenêtre : elle peut différer de quelques pixels de la taille demandée.
>
> L’extension a besoin d’un compte TutoClick. Elle ne capture que pendant l’enregistrement, sur l’onglet choisi et, si vous l’activez, sur les onglets ouverts depuis lui.

## 2. Visuels (dans ce dossier)

| Fichier | Taille | Champ |
|---|---|---|
| `icone-128.png` | 128 × 128 (icône de 96 px, marge transparente de 16 px) | Icône de la boutique |
| `capture-1-1280x800.png` à `capture-5-1280x800.png` | 1280 × 800 | Captures d’écran (données fictives : espace Acme, outil ExampleCRM) |
| `vignette-440x280.png` | 440 × 280 | Petite vignette promotionnelle |

## 3. Pratiques de confidentialité

**Objectif unique** : Créer des démos interactives à partir d’un parcours dans un logiciel web.

### Justification des autorisations

| Autorisation | Justification à saisir | Code |
|---|---|---|
| `activeTab` | Lancer la capture sur l’onglet choisi, au clic sur « Démarrer la capture ». Sans accès facultatif aux sites, c’est la seule page capturée. | `entrypoints/popup/main.ts` |
| `tabs` | Suivre les onglets ouverts depuis l’onglet capturé, si l’utilisateur l’active, retrouver l’onglet enregistré, et redimensionner sa fenêtre à la taille choisie le temps de la capture. | `entrypoints/background.ts` (`tabs.onCreated`, `tabs.onUpdated`) |
| `scripting` | Afficher la barre d’enregistrement dans la page capturée et relever les clics pendant l’enregistrement. | `background.ts` (`recorder.js`, `htmlbar.js`, `videobar.js`) |
| `storage` | Garder la session de connexion et la capture en cours jusqu’à l’envoi. | `lib/supabase.ts`, `lib/pending.ts` |
| `tabCapture`, `offscreen` | Enregistrer la vidéo de l’onglet (type « Vidéo de l’onglet ») dans un document hors écran. | `popup`, `background.ts`, `entrypoints/offscreen` |
| Accès aux sites, facultatif (`optional_host_permissions: <all_urls>`) | Demandé au premier démarrage d’une capture, avec une explication : continuer la capture après un changement de page ou dans un onglet suivi, sur le logiciel choisi par l’utilisateur, quelle que soit son adresse. Refus : la capture reste sur la page de départ. | `lib/permissions.ts`, `popup/main.ts` |

## 4. Limites connues (option B, décision du chef du 21 novembre)

- **`debugger` n’est pas dans la version de la boutique** : Chrome ne permet pas de la rendre facultative (référence `chrome.permissions`), et elle déclenche un avertissement fort à l’installation et un examen approfondi.
- **Format mobile** (émulation tactile en taille téléphone ou tablette) : visible dans le popup, désactivé, avec « Bientôt ».
- **Page entière** à chaque clic : chaque capture garde la partie visible de la page (« Page entière · Bientôt »).
- **Taille de l’onglet** : obtenue en redimensionnant la fenêtre (`windows.update`), à quelques pixels près ; la fenêtre reprend sa taille à la fin.
- Le code de l’option A reste dans l’extension : `WXT_DEBUGGER=1` au build ajoute `debugger` au manifeste et rétablit les trois fonctions. Si `debugger` revient, il faudra le dire dans l’article d’aide « Installer l’extension » (avertissement de Chrome à l’installation).

### Données à déclarer (à confirmer par le DPO avant l’envoi)

| Catégorie du formulaire | Oui / Non | Détail |
|---|---|---|
| Informations permettant d’identifier personnellement l’utilisateur | Oui | Adresse e-mail du compte TutoClick (connexion) |
| Informations d’authentification | Oui | Session de connexion au compte TutoClick |
| Contenu des sites web | Oui | Captures, pages HTML et vidéo de l’onglet enregistré, envoyées seulement après la vérification de l’utilisateur |
| Activité de l’utilisateur | Oui | Clics pendant l’enregistrement, pour créer les étapes |
| Historique de navigation, localisation, santé, finances, communications personnelles | Non | |

Cases à cocher (toutes vraies) :
- Je ne vends ni ne transfère les données des utilisateurs à des tiers, en dehors des cas d’utilisation approuvés.
- Je n’utilise ni ne transfère les données des utilisateurs à des fins sans rapport avec l’objectif unique de mon article.
- Je n’utilise ni ne transfère les données des utilisateurs pour déterminer leur solvabilité ou à des fins de prêt.

**Politique de confidentialité** : `<adresse de l’app>/extension/confidentialite.html` (publiée avec l’app sur GitHub Pages, fichier `apps/web/public/extension/confidentialite.html`).
