# FlowDSIML : analyse fonctionnelle et UX de Guideflow (phase 1)

> **Auteur** : Lead Designer UX, équipe FlowDSIML
> **Date** : 17 novembre 2026
> **Objet** : comprendre Guideflow de A à Z côté utilisateur, pour cadrer un produit équivalent en fonctionnalités. On ne reprend ni la marque, ni les visuels, ni les textes.
> **Méthode** : lecture des pages produit et fonctionnalités du site, de la page tarifs (HTML brut et FAQ), des pages Enterprise et Download, et des **147 articles** du centre d'aide (`docs.guideflow.com/help`, index `llms.txt`). Compléments : avis G2 et un blog tiers. Aucun compte n'a été créé : les écrans sont reconstitués d'après la documentation, pas observés.

---

## 0. Conventions de lecture

### 0.1 Ce qui a été vu et ce qui est déduit

| Marqueur | Sens |
|---|---|
| **[VU-DOC]** | Lu dans le centre d'aide. C'est la source la plus fiable : elle décrit l'interface réelle (libellés, menus, options). |
| **[VU-SITE]** | Lu sur une page marketing (`/product/*`, `/features/*`, `/enterprise`, `/download`). Le discours commercial peut exagérer ou annoncer des fonctions pas encore disponibles. |
| **[VU-PRIX]** | Lu sur la page `/pricing`, dans les cartes de plans, la grille comparative ou la FAQ. |
| **[VU-AVIS]** | Lu dans des avis G2 ou sur un blog tiers. Ces blogs sont souvent écrits par des concurrents. |
| **[DÉDUIT]** | Notre hypothèse, à partir de recoupements ou des conventions du marché. À valider. |

### 0.2 Priorités

| Tag | Sens proposé |
|---|---|
| **[MVP]** | Indispensable pour qu'un créateur capture, édite, partage une démo guidée et mesure son usage, sur son propre compte. |
| **[V2]** | Différenciant commercial : personnalisation avancée, HTML, IA, démo center, intégrations CRM, équipe avancée. |
| **[V3]** | Enterprise ou très coûteux techniquement : sandbox complet, live demo par proxy, desktop et mobile, SSO/SCIM, avatars, MCP. |

### 0.3 Vocabulaire

- **Guideflow** désigne chez eux une démo interactive. Nous l'appelons **« flow »** ou **« démo »**.
- **Step** (étape) : un écran capturé, plus ses éléments interactifs.
- **CTA (Call-to-action)** : l'élément qui fait passer d'une étape à la suivante (hotspot, walkthrough, spotlight).
- **Pop-up** : une surcouche d'étape (bouton, formulaire, sondage, widget embarqué). Elle sert notamment d'écran de début et de fin.
- **Player** : la page publique de lecture (`/player/:id`), et sa variante intégrable `/embed/:id` **[VU-DOC]**.

---

## 1. Personas et jobs-to-be-done

### 1.1 Persona A : le créateur (« Maker »)

**Profils** [VU-SITE, VU-DOC] : avant-vente et sales (SE), marketing et product marketing, customer success, support, produit, partenariats, formation et enablement.

**Contexte** : non-développeur, pressé. Il connaît très bien son produit et veut un résultat présentable en moins de 10 minutes.

| # | Job-to-be-done (« Quand…, je veux…, pour… ») | Source |
|---|---|---|
| A1 | Quand je dois montrer une fonctionnalité, je veux **capturer** mon parcours en cliquant normalement dans mon appli, pour ne pas faire de montage. | VU-DOC |
| A2 | Je veux **corriger** la capture (réordonner, supprimer, ajouter des étapes, flouter des données client), pour diffuser sans risque. | VU-DOC |
| A3 | Je veux **guider** le spectateur (hotspot, texte, zoom, voix off), pour qu'il comprenne la valeur sans moi. | VU-DOC |
| A4 | Je veux **adapter** la démo à chaque prospect (prénom, logo, chiffres), pour augmenter l'engagement à grande échelle. | VU-DOC |
| A5 | Je veux **partager** partout (lien, site, email, CRM, réseaux sociaux), pour l'insérer dans mes campagnes existantes. | VU-DOC |
| A6 | Je veux **savoir qui a regardé quoi** et être alerté, pour relancer au bon moment. | VU-DOC |
| A7 | Je veux **collecter des leads** dans la démo (formulaire en début ou en fin), pour alimenter le pipe. | VU-DOC |
| A8 | Je veux **maintenir** les démos à jour quand le produit change, sans tout refaire (bibliothèque d'étapes liées, thèmes centralisés). | VU-DOC |
| A9 | Je veux **traduire** et **narrer** automatiquement (IA), pour couvrir plusieurs marchés sans studio. | VU-DOC |
| A10 | Pendant un appel, je veux **présenter** avec mes notes privées, pour garder un discours homogène dans l'équipe. | VU-DOC |

**Sous-persona A' : le SE ou le PMM avancé** : il veut un **sandbox** explorable librement, des données factices réalistes et un mode hors ligne pour les salons [VU-DOC, VU-SITE].

### 1.2 Persona B : le prospect ou spectateur (« Viewer »)

**Profils** : acheteur B2B, membre d'un comité d'achat, client en onboarding, utilisateur du support, collaborateur en formation, partenaire.

**Contexte** : il n'a **pas de compte** [VU-DOC : « Anyone with the link can open it without signing up »]. Il arrive par un lien, un iframe, un email ou un QR code. Son attention est faible et il est souvent sur mobile.

| # | Job-to-be-done | Source |
|---|---|---|
| B1 | Je veux **voir le produit en action sans parler à un commercial**, pour me faire un avis rapidement. | VU-SITE |
| B2 | Je veux **choisir mon chemin** (persona ou fonctionnalité), pour ne voir que ce qui me concerne. | VU-SITE, VU-DOC (boutons « Navigate to a step/flow », checklist) |
| B3 | Je veux avancer à mon rythme : clic, flèches, lecture automatique, voix off avec sous-titres. | VU-DOC |
| B4 | Je veux **passer à l'action** (prendre rendez-vous, essai, doc) sans quitter la démo. | VU-DOC (widget embarqué Calendly ou Chili Piper) |
| B5 | Je veux lire la démo **dans ma langue**. | VU-DOC (sélecteur de langue du Localization Center) |
| B6 | Je veux une démo **fluide sur mobile** et accessible (clavier, WCAG). | VU-PRIX (grille « Accessibility ») |

**Sous-persona B' : le visiteur d'un démo center** : il parcourt un hub de plusieurs démos et ressources, se qualifie (questions) et reçoit des contenus adaptés [VU-SITE].

### 1.3 Persona C : l'administrateur d'équipe (« Admin »)

**Profils** : head of sales, PMM lead, ops, IT et sécurité. Rôle « Billing » pour la finance.

| # | Job-to-be-done | Source |
|---|---|---|
| C1 | Je veux **inviter** l'équipe et attribuer des rôles (Admin, User, Viewer, Guest, Billing), pour contrôler qui crée, publie et voit les leads. | VU-DOC |
| C2 | Je veux **organiser** les démos (dossiers, sections, sous-dossiers, droits par dossier, tags). | VU-DOC |
| C3 | Je veux **imposer la marque** (thèmes par défaut, polices, page publique, domaine personnalisé, retrait du filigrane). | VU-DOC |
| C4 | Je veux **connecter la stack** (CRM, Slack, Zapier, analytics, webhooks, clés API). | VU-DOC |
| C5 | Je veux **gérer l'abonnement** (plan, sièges, factures, limites). | VU-DOC |
| C6 | Je veux la **sécurité** : SSO, SCIM, mots de passe, domaines autorisés, expiration des liens, résidence des données UE/US, SOC 2. | VU-DOC, VU-SITE |
| C7 | Je veux **plusieurs workspaces** indépendants (agence, BU), chacun avec sa facturation. | VU-DOC |

---

## 2. Inventaire des fonctionnalités par module

Format : **Fonctionnalité** : description courte. *Source* · **Priorité**.

### 2.1 Compte, authentification, onboarding

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Inscription et connexion par email et mot de passe (`/auth/sign-up` vu dans une URL) | VU-DOC | MVP |
| Connexion Google ou Microsoft OAuth | VU-DOC (liste SSO) / DÉDUIT pour la connexion grand public | MVP (Google) |
| Profil : photo, prénom, nom, email, **langue**, mot de passe, suppression irréversible du compte | VU-DOC | MVP |
| Préférences de notification (newsletter, mises à jour produit) | VU-DOC | V2 |
| Paramètres personnels « Privacy » et « Labs » (fonctions expérimentales) | VU-DOC (matrice des rôles) | V2 |
| Onboarding guidé : installation de l'extension, puis première capture | DÉDUIT (la doc commence par « Install Chrome extension ») | MVP |
| Promesse « première démo en moins de 30 s » | VU-SITE | objectif UX |

### 2.2 Workspace et tableau de bord

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Workspace : nom, avatar, site web, secteur (« General » / « Company ») | VU-DOC | MVP |
| Plusieurs workspaces par utilisateur, chacun avec son tableau de bord, sa facturation et ses membres ; bascule par le menu profil | VU-DOC | V2 |
| Tableau de bord « Home » : liste des flows, recherche par nom, tri (date de création, nom A-Z) | VU-DOC | MVP |
| Dossiers : création (avec emoji), renommage, suppression, réordonnancement par glisser-déposer | VU-DOC | MVP |
| Dossiers **publics, partagés ou privés**, déplaçables d'un type à l'autre | VU-DOC | V2 |
| **Sections** et sous-dossiers | VU-DOC | V2 |
| Droits par dossier (activation ou retrait par membre) | VU-DOC | V2 |
| Déplacer un flow par glisser-déposer | VU-DOC | MVP |
| Menu « ... » d'un flow : partager, traduire par IA, dupliquer, archiver | VU-DOC (partager, traduire) / DÉDUIT (dupliquer) | MVP |
| **Archive** et restauration dans un dossier au choix | VU-DOC | MVP |
| Tags (par flow ; gestion dans Settings > Tags ; filtre dans le tableau de bord) | VU-DOC | V2 |
| « Offline guideflows » dans la barre gauche | VU-DOC | V3 |
| Analytics à l'échelle du workspace (« Workspace analytics ») | VU-DOC (matrice des rôles) | V2 |
| Raccourcis clavier (« Hotkeys & shortcuts ») | VU-PRIX | V2 |

### 2.3 Outils de capture (clients)

| Fonctionnalité | Source | Priorité |
|---|---|---|
| **Extension Chrome** : choix du type de capture, Start, Pause, Cancel, Finish ; widget flottant en bas à gauche pendant l'enregistrement | VU-DOC | MVP |
| Réglages de l'extension : CTA générés par IA, capture multi-onglets, vidéo auto sur glisser-déposer, défilement ou saisie | VU-DOC | MVP (multi-onglets) / V2 (le reste) |
| Raccourcis clavier Chrome : « Start/Stop recording video » et « Start/Stop recording new video step » | VU-DOC | V2 |
| **Plugin Gmail**, injecté par l'extension : insère un GIF et un lien, ou un lien seul, depuis la bibliothèque | VU-DOC | V3 |
| **App desktop** Windows et macOS (M1 et x86) : capture d'écran d'applications natives, vidéo par ⇧⌥V | VU-DOC | V3 |
| Capture d'app **mobile** via app desktop et logiciel de recopie d'écran (iPhone Mirroring, Apowersoft, LetsView, AirDroid) | VU-DOC | V3 |
| **Plugin Figma** : export de frames vers des démos | VU-DOC | V3 |
| Import manuel d'images (téléversement d'une étape) | VU-DOC | MVP |

### 2.4 Types de capture

| Fonctionnalité | Source | Priorité |
|---|---|---|
| **Capture par screenshots** : une image à chaque clic, avec la position du clic | VU-DOC | **MVP** |
| Capture multi-onglets | VU-DOC | MVP |
| **Vidéo automatique** au défilement, à la saisie ou au glisser-déposer (option « Video Transition » pour afficher l'étape en statique) | VU-DOC | V2 |
| **Vidéo manuelle** par raccourci (clip, ou nouvelle étape vidéo multi-clics) | VU-DOC | V2 |
| **Capture HTML guidée** : DOM et CSS capturés à chaque clic, éditables ensuite | VU-DOC | V2 |
| Mélange screenshots et HTML dans un même flow | VU-DOC | V2 |
| **Capture sandbox** : snapshots HTML assemblés automatiquement, avec liens auto entre écrans | VU-DOC | V3 |
| Résolution prédéfinie et redimensionnement automatique (« Screen resizer ») | VU-SITE, VU-PRIX | V2 |

### 2.5 Éditeur : structure et étapes

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Panneau gauche : liste des étapes (miniatures), sélection, glisser-déposer, avertissement « l'ordre peut casser la logique » | VU-DOC | MVP |
| Menu d'étape : modifier (titre, description avec variables, lien), dupliquer, **remplacer par une image**, supprimer (définitif) | VU-DOC | MVP |
| « Add steps » : capturer de nouvelles étapes depuis un onglet ouvert, ou téléverser une image | VU-DOC | MVP |
| **Steps Library** : importer des étapes d'un autre flow, **liées** (synchronisées) ou **non liées** (copies) | VU-DOC | V2 |
| **Step information** : titre, description, liens externes affichés **sous** la démo sur le lien public ; lecture automatique par étape | VU-DOC | MVP (titre) / V2 (le reste) |
| **Resize** : Crop (poignées, rotation, miroir, réinitialisation) et Fit (Cover ou Contain, avec couleur de fond) | VU-DOC | V2 |
| Éditeur vidéo d'étape : découpe et vitesse ×1 à ×4 | VU-DOC | V2 |
| **Preview** (onglet), retour par « Edit my guideflow » | VU-DOC | MVP |
| **Historique des versions** (sauvegardes automatiques, « Restore this version ») | VU-DOC | V2 |
| Sauvegarde automatique | DÉDUIT (versions « auto-saved ») | MVP |
| Édition collaborative en temps réel (présence, curseurs) | VU-SITE | V3 |
| Commentaires en fil sur une étape, mentions, notifications | VU-SITE | V3 |
| Journal d'activité, suivi des changements HTML | VU-SITE | V3 |
| Workflow d'approbation avant publication | VU-SITE (Enterprise) | V3 |
| Tests A/B | VU-PRIX (grille) | V3 |

### 2.6 Éditeur : CTA, guidage et mise en valeur

| Fonctionnalité | Source | Priorité |
|---|---|---|
| **Hotspot** : point pulsant à l'endroit du clic, déplaçable, avec texte en bulle (tooltip) et position de la bulle | VU-DOC | **MVP** |
| **Walkthrough** : zone mise en évidence par un overlay, boutons « Next » et « Back » renommables | VU-DOC | **MVP** |
| **Spotlight** : carte libre, flèches précédent et suivant, sans zone ciblée | VU-DOC | MVP |
| Chaque étape a un CTA, sauf la dernière | VU-DOC | MVP (règle) |
| Apparence personnalisée par étape (« Custom appearance ») ou au niveau du thème | VU-DOC | MVP |
| **Pan & zoom** : fenêtre de zoom redimensionnable (screenshots uniquement) ; « Auto Pan & Zoom » par IA | VU-DOC / VU-SITE | V2 |
| **Blur** : rectangles de flou multiples par étape (screenshots) | VU-DOC | **MVP** |
| Flou et masquage d'éléments HTML, application en lot sur toutes les étapes | VU-DOC, VU-SITE | V2 |
| « Hide screen part » (masquer une zone) | VU-PRIX | V2 |
| **Checklist** : lanceur (titre, position), titre, description, éléments réordonnables (ouvrir une URL ou aller à une étape), compteur, barre de progression, recherche, numérotation | VU-DOC | V2 |
| **Chapitres** : sauter à une étape, suivi de progression (via la checklist et les pop-ups) | VU-SITE + VU-DOC | V2 |
| **Branches** : chemins par persona, via les boutons de pop-up « Navigate to a step » et « Navigate to a guideflow » | VU-DOC | V2 |
| Branchement **conditionnel** avancé | VU-PRIX (« Conditional branching », « Advanced branching » à partir de Growth) | V3 |
| **Autoplay** global (durée entre étapes, boucle) ou par étape | VU-DOC | MVP |
| Cadre **navigateur** simulé : clair ou sombre, titre, forme (carré, arrondi, légèrement arrondi), ombre, fond (couleur, dégradé, image) | VU-DOC | MVP |

### 2.7 Éditeur : pop-ups, formulaires, CTA de conversion

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Pop-up sur **n'importe quelle étape** (début, milieu, fin) | VU-DOC | **MVP** (début et fin) |
| Styles **Classic** (centré : logo, bannière image ou vidéo, fond, alignement) et **Modern** (plein écran scindé avec image de couverture) | VU-DOC | MVP (Classic) / V2 (Modern) |
| Type **Button** : 1 ou 2 boutons ; actions Next, Back, Open a URL, Navigate to a step, Navigate to a guideflow | VU-DOC | **MVP** |
| Type **Form** : champs (prénom, nom, email, entreprise, texte, zone de texte, date, téléphone), obligatoires, réordonnables, case CGU avec URL, libellé du bouton, **URL de webhook** | VU-DOC | **MVP** |
| Type **Survey** : choix unique ou multiple, échelle | VU-DOC | V2 |
| Type **Embed Widget** : codes HubSpot, Pardot, Eloqua, Marketo ou autre, enregistrés dans Settings > Embed Forms | VU-DOC | V2 |
| Popups custom, plein écran, cachées ou en pop-in (« Fullscreen, hidden or in a popup ») | VU-SITE | V2 |

### 2.8 Éditeur : médias et narration

| Fonctionnalité | Source | Priorité |
|---|---|---|
| **Voix off humaine** : enregistrement au micro, lanceur repositionnable, lecture automatique | VU-DOC | V2 |
| **Voix off synthétique** (moteur TTS tiers) : 29 langues détectées automatiquement, voix et accents, aperçu | VU-DOC | V2 |
| Contrôles TTS : rythme (ponctuation), pauses (`<break time="1.5s"/>`, de 0,5 à 3 s), prononciation (`<phoneme>` IPA ou CMU, anglais seulement), ton | VU-DOC | V3 |
| Clonage de voix (clé API du fournisseur TTS de l'utilisateur) | VU-DOC | V3 |
| **Sous-titres** générés par IA et éditables, pour les deux types de voix off | VU-DOC | V2 |
| **Bulle vidéo** : enregistrement webcam, téléversement (MP4, OGG, WEBM) ou avatar IA ; position (4 choix), taille S, M ou L, lecture automatique | VU-DOC | V2 |
| Règle : **une bulle vidéo et une voix off ne peuvent pas coexister sur la même étape** | VU-DOC | règle |
| **Notes du présentateur** par étape et **mode présentateur** (fenêtre séparée visible du seul présentateur) | VU-DOC | V2 |

### 2.9 Éditeur HTML (captures HTML et sandbox)

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Sélection et modification de tout élément : texte, nombre, image, bouton, graphique | VU-DOC | V2 |
| Masquer, flouter, dupliquer ou supprimer des éléments | VU-DOC, VU-SITE | V2 |
| **Appliquer à toutes les étapes** et rechercher-remplacer | VU-DOC, VU-SITE | V2 |
| Variables dans le HTML (texte, image comme fond ou logo, **date dynamique** avec format et décalage) | VU-DOC | V2 |
| IA : valeurs aléatoires réalistes, édition de tableaux et de graphiques, générateur de jeux de données | VU-DOC, VU-SITE | V3 |
| Import de jeux de données (CSV) | VU-SITE | V3 |
| **Sandbox** : liens auto entre écrans ; lien manuel élément → écran ; « Apply to all steps » ; mise en évidence des zones cliquables (Ctrl, ou clic dans le vide) | VU-DOC | V3 |
| Plugins JS ou iframe dans la démo (« API connection, Javascript & iframe integration ») | VU-SITE | V3 |

### 2.10 Design, thèmes, marque

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Onglet **Design** : couleur principale, type de CTA par défaut, styles hotspot (couleur, style, forme) et walkthrough (couleur, forme, avatar, numéros d'étape, bordure, overlay), pop-ups (couleurs et dégradés, forme, overlay, flou, marges), checklist | VU-DOC | MVP (couleur et type) / V2 (le reste) |
| **Thèmes** : enregistrer le design du flow comme thème ; appliquer ; thème par défaut du workspace ; la modification d'un thème se répercute sur tous les flows qui l'utilisent | VU-DOC | V2 |
| Éditeur de thème du workspace avec aperçu en direct (Hotspot, Walkthrough, Spotlight, popup Classic et Modern, Checklist) | VU-DOC | V2 |
| **Polices** : bibliothèque, téléversement (OTF, TTF, WOFF, WOFF2), URL CSS | VU-DOC | V2 |
| **Filigrane** (watermark) imposé en Free, retirable sur les plans payants | VU-DOC, VU-PRIX | **MVP** (logique de plan) |
| **Page publique** (habillage du lien `/player`) : logo en haut à gauche, 1 ou 2 boutons CTA en haut à droite (texte, URL, couleur ou dégradé) | VU-DOC | MVP |
| Mode sombre ou clair | VU-PRIX | V2 |

### 2.11 Personnalisation et variables

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Variables de type **texte, nombre ou URL d'image**, syntaxe `{{clé}}` | VU-DOC | **MVP** (texte) / V2 (image, nombre) |
| Variables par défaut : `first_name`, `last_name`, `email`, `company`, `website`, `phone`, `logo_url`, `avatar_url` | VU-DOC | MVP |
| Variables personnalisées : nom, type, exemple, **valeur par défaut** ; gestion dans Settings > Variables ou création à la volée dans l'éditeur | VU-DOC | MVP |
| Emplacements : textes de CTA, pop-ups, descriptions d'étape, HTML | VU-DOC | MVP |
| Alimentation n° 1 : **paramètres d'URL** (`?first_name=John&company=Acme`) | VU-DOC | **MVP** |
| Alimentation n° 2 : **liens personnalisés** avec valeurs pré-remplies (« forward parameters ») | VU-DOC | MVP |
| Alimentation n° 3 : **formulaire** de pop-up (les champs alimentent les variables) | VU-DOC | V2 |
| Tokens de fusion des outils d'emailing (HubSpot `{{contact.firstname}}`, Mailchimp `*|FNAME|*`, etc.) injectés dans l'URL | VU-DOC | MVP (gratuit : ce ne sont que des paramètres d'URL) |
| Variable de date dynamique avec décalage | VU-DOC | V2 |
| Personnalisation par IA en langage naturel (« adapt content for specific leads ») | VU-SITE | V3 |
| Contenu par segment, routage par UTM ou cookie, logique conditionnelle (démo center ou demo page) | VU-SITE | V3 |

### 2.12 Partage et diffusion

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Modale **Share** avec interrupteur global « **Public access** », prérequis de presque tous les modes | VU-DOC | **MVP** |
| **Lien public** (`/player/:id`), copie ; aperçus téléchargeables (GIF, vidéo, image) | VU-DOC | **MVP** |
| **Liens personnalisés** (nombre illimité) : nom, slug, valeurs de variables, mot de passe, expiration, activation individuelle, recherche, modifier, dupliquer, supprimer ; analytics dédiées | VU-DOC | MVP |
| **Embed widget** (code iframe ; URL `/embed/:id`) ; guides pour plus de 60 outils (Webflow, WordPress, Framer, Zendesk, Notion, G2…) | VU-DOC | **MVP** |
| Réseaux sociaux (LinkedIn, X, Facebook) : boutons de partage | VU-DOC | MVP |
| Plateformes email : marketing et prospection commerciale, avec tokens | VU-DOC | MVP (documentation) |
| **Invitation par email** à un flow précis | VU-DOC | V2 |
| **Export GIF ou vidéo** : préréglage par usage, type, résolution, images par seconde, secondes entre étapes | VU-DOC | V2 |
| **Export PDF** (sans interactivité) | VU-DOC | V2 |
| Sécurité : **mot de passe**, **protection par domaine** (liste de domaines email, avec ou sans vérification par code envoyé par email), **expiration** (date, heure, fuseau, page « lien expiré ») | VU-DOC | V2 (mot de passe et expiration) / V3 (domaine) |
| Jeton d'authentification (« Authentification token ») | VU-PRIX | V3 |
| **Démo hors ligne** (« Save for offline », stockée localement, visible du seul utilisateur, plan Growth ou supérieur) | VU-DOC | V3 |
| **Domaine personnalisé** (CNAME vers le domaine du service ; activation finale par l'équipe) | VU-DOC | V2 |
| QR code (démo mobile) | VU-SITE | V2 |
| **Remote Navigator** : l'hôte pilote l'iframe par postMessage (aller à l'étape N, suivante, précédente) | VU-DOC | V3 |
| **Événements cross-frame** : la démo émet ses événements vers la page hôte | VU-DOC | V2 |

### 2.13 Demo Page et Demo Center (hubs multi-démos)

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Hub regroupant plusieurs démos derrière **un seul lien** | VU-SITE | V2 |
| Mises en page : playlist (chapitres et progression), grille, liste, cartes, carrousel, dossiers par catégorie | VU-SITE | V2 (playlist et grille) |
| Contenus mixtes : démos, vidéos, PDF, formulaires, études de cas, CTA | VU-SITE | V2 |
| Marque : logo, couleurs, favicon, fond, police, bannière | VU-SITE | V2 |
| Accès public, conditionné (formulaire ou CRM) ou privé ; contrôle par rôle ou paramètre d'URL | VU-SITE | V2 |
| Questions de qualification (choix unique ou multiple, matrices), routage vers les bonnes démos | VU-SITE | V3 |
| Segments, filtres intelligents, logique conditionnelle, bibliothèques par compte (ABM) | VU-SITE | V3 |
| Bibliothèque de ressources réutilisable entre démo centers | VU-SITE | V3 |
| Analytics au niveau du hub : entrées et sorties, multi-session, **comités d'achat** (plusieurs interlocuteurs d'un même compte) | VU-SITE | V3 |
| Source d'analytics « Demo Center » distincte | VU-DOC | V2 |
| Demo Center vendu en **add-on** sur Advanced, inclus en Enterprise | VU-PRIX | — |

### 2.14 Analytics

| Fonctionnalité | Source | Priorité |
|---|---|---|
| **Analytics générales** (onglet de l'éditeur) : vues totales, utilisateurs uniques, taux de complétion, leads, courbe des vues (jour ou heure), carte de localisation, navigateurs, appareils, OS, vues par étape, temps moyen par étape | VU-DOC | **MVP** |
| Période : All, Today, This Week, This Month, This Year, Custom | VU-DOC | MVP |
| Filtres : **source** (lien public, embed, lien personnalisé, demo center, preview), **type de spectateur** (interne ou externe), dates | VU-DOC | MVP |
| **Sessions** : liste (nom si connu, IP, dernière vue, temps passé, conversion, complétion) | VU-DOC | MVP |
| Détail de session : ville, pays, navigateur, OS, appareil, source, **attributs utilisateur** (variables), complétion par étape | VU-DOC | V2 |
| **Onglet Leads** : leads de début ou de fin, liste, export CSV | VU-DOC | **MVP** |
| Export CSV : général (téléchargement direct), sessions (envoi par email) | VU-DOC | V2 |
| Rétention limitée à **7 jours** en Free | VU-PRIX | MVP (règle de plan) |
| **Révélation de compte par IA** (enrichissement de l'entreprise par adresse IP via un fournisseur de données B2B) | VU-DOC | V3 |
| Script **JS d'identification** sur le site client (`identify({email…})`), pour relier un visiteur à sa session | VU-DOC | V3 |
| Suivi des visiteurs récurrents, segmentation d'audience, analyse des parcours et des abandons | VU-SITE, VU-PRIX | V2 |
| Scoring des leads, assignation aux commerciaux, alertes temps réel (Slack, email) | VU-SITE | V3 (scoring) / V2 (alertes) |
| Heatmaps et replay de session (démo mobile) | VU-SITE | V3 |

### 2.15 IA

| Fonctionnalité | Source | Priorité |
|---|---|---|
| **CTA générés par IA** à la capture (réglage de l'extension) | VU-DOC | V2 |
| **AI Content** (« Improve with AI ») : langue, style, prompt ; génère les textes des pop-ups, des CTA et des notes du présentateur ; ajoute pop-ups de début et de fin et pan & zoom | VU-DOC | V2 |
| **AI Translate** : crée une **copie** du flow dans une autre langue | VU-DOC | V2 |
| **AI Localization Center** : plusieurs langues **dans un même flow**, retraduction après modification, retouche manuelle, **sélecteur de langue côté spectateur** | VU-DOC | V2 |
| **Dictionary** : termes verrouillés (jamais traduits) ou traductions imposées par langue (33 langues) | VU-DOC | V2 |
| Voix off TTS, sous-titres, clonage de voix | VU-DOC | V2/V3 |
| **Avatar IA** (bulle vidéo) : avatar, script, langue détectée, voix, aperçu, génération ; plus de 150 avatars annoncés | VU-DOC, VU-SITE | V3 |
| Clone vidéo IA (synchronisation des lèvres) | VU-SITE | V3 |
| Texte, images et graphiques générés par IA ; réglage du ton | VU-SITE | V3 |
| Copilote conversationnel (« AI-chat assistant ») | VU-SITE | V3 |
| Générateur de jeux de données IA (Enterprise) | VU-PRIX | V3 |
| **Serveur MCP** : 80 outils (lister, créer et modifier des flows, étapes, CTA, thèmes, variables, liens, démo center, analytics, leads, traduction) pour piloter le workspace depuis un assistant IA ; autorisation OAuth par workspace | VU-DOC | V3 |

### 2.16 Équipe et collaboration

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Invitation par email avec un rôle ; suppression ; recherche de membre | VU-DOC | **MVP** |
| 5 rôles : **Admin**, **User**, **Viewer** (lecture et analytics), **Guest** (contenu assigné, sans analytics ni leads), **Billing** (finance et membres seulement) | VU-DOC | MVP (Admin, User, Viewer) / V2 (Guest, Billing) |
| Matrice de permissions détaillée (flows, workspace, settings, équipe, administration, facturation, dossiers privés) | VU-DOC | MVP |
| La page Enterprise parle de 4 rôles « admin, manager, editor, viewer », ce qui **contredit la doc** | VU-SITE | voir les questions ouvertes |
| SSO (SAML ou OIDC via un fournisseur d'identité fédérée ; Okta, Azure AD, Google…), activé avec l'équipe ; SCIM ; provisioning JIT | VU-DOC, VU-SITE | V3 |
| Bibliothèque d'assets partagée, modèles par équipe | VU-SITE | V2 |

### 2.17 Intégrations et API

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Page **Integrations** : connecter, gérer, « Make a request » | VU-DOC | V2 |
| Deux familles de données : **User Data** (formulaires) et **Event Data** (étapes vues, complétion, checklist, clics) | VU-DOC | V2 |
| **Webhook** de formulaire (URL dans la pop-up) | VU-DOC | **MVP** |
| **Resthooks API** (clé `Api-Authorization`) : CRUD de hooks par flow sur 6 événements : `first-interaction`, `lead-created`, `slide-viewed`, `external-link-clicked`, `completed`, `end-session` | VU-DOC | V2 |
| **Clés API** (Settings > API Keys) ; API Analytics et API Workflow annoncées | VU-DOC, VU-PRIX | V2 |
| **Slack** : canal et flows choisis, notification à chaque vue | VU-DOC | V2 |
| **Zapier** : 6 déclencheurs, identiques aux événements des hooks | VU-DOC | V2 |
| CRM : **HubSpot** (contacts, influence sur les deals, propriétés), **Salesforce** (leads, rapports), Pipedrive, Zoho, Marketo ; dédoublonnage par **email** | VU-DOC | V2 (HubSpot) / V3 (le reste) |
| Analytics : GA4 (front et back), Mixpanel, Amplitude, Segment ; consentement OneTrust | VU-DOC | V3 |
| Enablement : Highspot, Outreach ; plugin Gmail | VU-DOC | V3 |
| Plateformes d'avis : G2, TrustRadius, Product Hunt (par embed) | VU-DOC | V2 (c'est un embed) |

### 2.18 Facturation

| Fonctionnalité | Source | Priorité |
|---|---|---|
| Settings > Billing : plan actuel, passage à un plan payant, bascule **mensuel ou annuel** | VU-DOC | **MVP** |
| « **Your limits** » : jauges d'usage, montant de la prochaine facture, « Manage your plan » | VU-DOC | MVP |
| Facturation **par siège et par workspace** ; siège facturé dès l'arrivée d'un membre ; renouvellement sur les sièges occupés | VU-PRIX (FAQ) | MVP |
| Factures : liste, recherche, téléchargement PDF unitaire ou global | VU-DOC | MVP |
| Moyens de paiement : carte, virement, PayPal, via un *merchant of record* | VU-PRIX | MVP (choix du prestataire à faire) |
| Add-ons (Demo Center, Live Demo) | VU-PRIX | V3 |

### 2.19 Sécurité et conformité (transverse)

SOC 2 Type II, RGPD, CCPA, DPA sur demande, hébergement **US ou UE**, SLA de 99,9 %, chiffrement [VU-SITE]. Accessibilité : responsive, navigation clavier, WCAG, ARIA [VU-PRIX]. → **V3** pour la certification, **MVP** pour le RGPD de base et l'hébergement UE (voir les questions ouvertes).

### 2.20 Produits « haut de gamme »

| Produit | Ce que c'est | Source | Priorité |
|---|---|---|---|
| **Sandbox** | Environnement HTML cliquable librement, sans CTA imposé | VU-DOC | V3 |
| **Live demo** | Clone de l'interface et de la logique, **backend simulé par proxy**, données CSV ou API, réinitialisation à chaque visite | VU-SITE | **V3+** (hors périmètre initial) |
| **Mobile demo** | Capture par recopie d'écran, cadres d'appareil, gestes, QR code | VU-DOC, VU-SITE | V3 |

---

## 3. Parcours clés, étape par étape

> Les écrans et libellés viennent de la doc. Les transitions entre écrans (ce qui s'ouvre après quoi) sont parfois **[DÉDUIT]**.

### 3.1 Onboarding (premier usage)

1. Le visiteur arrive sur le site, puis « Get started / Start for free » → inscription [VU-DOC : `/auth/sign-up`].
2. Il crée son compte (email et mot de passe, ou Google) [DÉDUIT pour Google].
3. Un **workspace** est créé (nom, puis site et secteur plus tard dans Settings > General) [DÉDUIT pour la création automatique].
4. L'app l'invite à **installer l'extension Chrome** : boutique, « Add to Chrome », « Add extension » [VU-DOC].
5. Sur la page à capturer, il ouvre l'extension et lance sa **première capture** (voir 3.4).
6. À la fin, **l'éditeur s'ouvre automatiquement** [VU-DOC].
7. Il prévisualise, partage et voit ses premières vues dans Analytics.
8. Plan Free : 5 flows, filigrane, analytics sur 7 jours. Les incitations à passer au plan supérieur apparaissent quand il atteint une limite [DÉDUIT].

**Recommandation UX FlowDSIML** : checklist d'onboarding en 4 points (extension, 1re capture, 1er partage, 1re vue) et **démo d'exemple** pré-chargée dans le workspace [DÉDUIT].

### 3.2 Workspace et organisation

1. Le tableau de bord « Home » liste les flows, avec recherche et tri [VU-DOC].
2. « + » à côté de « Workspace » : nouveau dossier (nom et emoji) ; « + » au-dessus des dossiers : « Add section » ; « + » dans une section : sous-dossier [VU-DOC].
3. Il range les flows par glisser-déposer [VU-DOC].
4. Sur un dossier, le bouton « + » en haut à droite donne les **droits par membre** [VU-DOC].
5. Il ajoute des **tags** dans l'éditeur (Settings du flow) et filtre par tag dans le tableau de bord [VU-DOC].
6. Pour archiver : menu « ... » → Archived ; pour restaurer : « Restore » et choix du dossier [VU-DOC].
7. Multi-workspace : avatar en bas à gauche → « New workspace » ou bascule [VU-DOC].

### 3.3 Extension (installation et réglages)

1. Installation depuis la boutique Chrome [VU-DOC].
2. Connexion au compte depuis l'extension [DÉDUIT ; l'app desktop demande explicitement de se connecter].
3. Roue crantée : CTA IA, multi-onglets, vidéo auto (glisser-déposer, défilement, saisie) [VU-DOC].
4. Raccourcis dans `chrome://extensions/shortcuts` : vidéo clip et nouvelle étape vidéo [VU-DOC].
5. Gmail : bouton dans la barre de rédaction, choix d'une démo, format (GIF et lien, ou lien seul) [VU-DOC].

### 3.4 Capture

**Variante A, screenshots** [VU-DOC]
1. Il ouvre l'onglet cible, puis l'extension.
2. Il choisit le type « Screenshot capture » et clique « Start ».
3. Chaque clic produit une étape (image et coordonnées du clic). Les défilements, saisies et glisser-déposer peuvent produire des **clips vidéo** si l'option est active.
4. Raccourci : enregistre un clip, ou une **étape vidéo** multi-clics.
5. Pause, Cancel, puis « Finish recording ».
6. L'éditeur s'ouvre (les étapes vidéo portent une icône).

**Variante B, HTML guidée** [VU-DOC]
1. Il choisit « HTML capture ».
2. À chaque clic, le DOM et le CSS sont figés.
3. Le widget en bas à gauche (logo) permet Pause, Cancel et **Complete**.
4. Génération de quelques secondes, selon le poids de la page, puis l'éditeur s'ouvre.

**Variante C, sandbox** [VU-DOC]
1. Il choisit « Sandbox capture ».
2. Il clique sur tous les écrans à couvrir. Les éléments cliqués sont **liés automatiquement** à l'écran suivant.
3. L'éditeur de sandbox s'ouvre.

**Variante D, desktop et mobile** [VU-DOC]
1. Il lance l'app desktop, se connecte, choisit le dossier de destination, puis « start capture ».
2. Il choisit l'écran ou la fenêtre (par exemple la fenêtre de recopie de l'iPhone), puis « Select ».
3. Les clics sont capturés, et la capture s'ouvre dans l'éditeur.

**États d'erreur à prévoir** [DÉDUIT] : extension déconnectée, page protégée (`chrome://`, PDF), capture vide, échec de téléversement, page HTML trop lourde.

### 3.5 Édition

Layout de l'éditeur [VU-DOC + DÉDUIT pour la disposition exacte] : **en-tête** (Edit, Preview, Analytics, Leads ; menu avec l'historique des versions ; Share ; Save for offline ; Presenter mode ; AI Localization Center ; Improve with AI), **panneau gauche** (étapes et « Add steps »), **canevas central** (écran, CTA, avec sous le canevas « Add blur » et « Resize »), **panneau droit** à onglets.

1. **Réviser la structure** : réordonner, supprimer, dupliquer, remplacer par une image, ajouter (capture ou téléversement), importer depuis la Steps Library (liée ou non) [VU-DOC].
2. **Types d'étapes** (synthèse [VU-DOC]) :
   - étape **image** (screenshot ou image téléversée) ;
   - étape **vidéo**, automatique (avec bascule « Video Transition ») ou manuelle ;
   - étape **HTML** ;
   - **pop-up** posée sur une étape (Button, Form, Survey, Embed) ;
   - écran **sandbox** lié.
3. **CTA de chaque étape** (onglet « Call-to-action ») : choix Hotspot, Walkthrough ou Spotlight ; glisser pour positionner ; texte de la bulle (**tooltip**) ; position de la bulle ; « Add variables » ; libellés Next et Back (walkthrough) ; apparence propre à l'étape ou au thème [VU-DOC].
4. **Zoom** : bascule Pan & Zoom, puis fenêtre redimensionnable et déplaçable. Vérifier que le CTA reste dans la fenêtre. Prévisualiser [VU-DOC].
5. **Flou** : « Add blur », un ou plusieurs rectangles redimensionnables. En HTML : sélection d'éléments, flouter ou masquer, appliquer à toutes les étapes [VU-DOC].
6. **Recadrage** : Resize, puis Crop ou Fit [VU-DOC].
7. **Pop-ups** : icône ⚡, « + Add a pop-up », style, titre et description (avec variables), médias, type, puis réglages du type [VU-DOC].
8. **Formulaire** : « + Add a new field », champs obligatoires, ordre, case « I agree to... » avec URL, libellé du bouton, webhook [VU-DOC].
9. **CTA de fin** : pop-up Button avec deux boutons, par exemple « Réserver une démo » (URL ou embed de calendrier) et « Voir une autre démo » (Navigate to a guideflow) [VU-DOC].
10. **Chapitres et branches** : il n'existe pas d'objet « chapitre » documenté. Le chapitrage passe par la **checklist** (éléments « Navigate to a step », progression) et le branchement par les **boutons de pop-up** (« Navigate to a step / guideflow »). Le site annonce « Create chapters », « Jump to specific steps » et « Branching per persona » [VU-DOC + VU-SITE]. **FlowDSIML** devrait modéliser explicitement des **chapitres** (groupes d'étapes nommés) et des **nœuds de choix** (pop-up à N boutons, chacun pointant vers un chapitre) [DÉDUIT, recommandation].
11. **Checklist** : onglet Checklist, Enabled, titre du lanceur, position, titre et description, éléments (URL ou étape) [VU-DOC].
12. **Voix off** : onglet Voiceover, « Add Voiceover », puis Record (micro) ou AI based (script, langue détectée, voix, accent) ; aperçu ; repositionner le lanceur ; lecture automatique ; sous-titres (« Generate with AI », puis Edit Subtitles) [VU-DOC].
13. **Bulle vidéo** (exclusive avec la voix off) : Record, Upload ou AI Avatar ; position, taille, lecture automatique [VU-DOC].
14. **Step information** : titre, description, URL, lecture automatique de l'étape [VU-DOC].
15. **Browser et Design** : cadre navigateur, fond, autoplay et boucle ; couleur principale, styles, thème (baguette magique, puis « Save as new theme ») [VU-DOC].
16. **Notes du présentateur** par étape [VU-DOC].
17. **IA** : « Improve with AI » (langue, style, prompt, « Generate AI Content ») [VU-DOC].
18. **Preview**, puis retour en édition, puis **Share** [VU-DOC].
19. En cas d'erreur : historique des versions, puis « Restore this version » [VU-DOC].

### 3.6 Personnalisation et variables

1. Settings > Variables > « Add variable » : type (texte, nombre, image), nom, exemple, valeur par défaut [VU-DOC].
2. Ou, dans l'éditeur, sur un CTA, une pop-up ou du HTML : « Add variables », puis « Create new variables » [VU-DOC].
3. Insertion de `{{first_name}}` dans un texte (laisser un espace avant), ou d'une variable image en fond d'un élément HTML (logo) [VU-DOC].
4. Alimentation des valeurs :
   - **URL** : `…/player/ID?first_name=John&company=Acme` ;
   - **Lien personnalisé** : valeurs saisies une fois, slug `/player/296/tesla` ;
   - **Formulaire** : les réponses alimentent les variables pour la suite du flow ;
   - **Email** : token de l'outil d'emailing dans l'URL (`?first_name={{contact.firstname}}`) [VU-DOC].
5. Rendu : la valeur, sinon la valeur par défaut [VU-DOC]. Une variable vide sans valeur par défaut : comportement non documenté [DÉDUIT : afficher une chaîne vide ; à trancher].
6. Côté analytics, les variables deviennent les **attributs utilisateur** de la session et identifient le lead [VU-DOC].

### 3.7 Partage et embed

1. Bouton **Share** (éditeur ou menu « ... » du tableau de bord), puis la modale « Share Options » [VU-DOC].
2. **Public access** activé (prérequis) [VU-DOC].
3. Onglets ou boutons : Public link, Custom links, Embed widget, Social platforms, Email platforms, Invite people, GIF & video, PDF, **Security** [VU-DOC].
4. **Public link** : copie ; téléchargement d'un aperçu GIF, vidéo ou image [VU-DOC].
5. **Custom link** : « New custom link », nom, slug, variables, mot de passe, expiration, « Create new link », puis activation et copie [VU-DOC].
6. **Embed** : copie du code iframe, collé dans le CMS ; ou URL `/embed/…` pour les outils qui attendent une URL [VU-DOC].
7. **Security** : mot de passe, domaines autorisés (avec ou sans code envoyé par email), expiration (date, heure, fuseau) [VU-DOC].
8. **Exports** : GIF ou MP4 (préréglage, résolution, images par seconde, durée par étape) ; PDF [VU-DOC].
9. **Hors ligne** : « Save for offline », un onglet prépare la démo, qui apparaît ensuite dans « Offline guideflows » [VU-DOC].
10. **Domaine personnalisé** (Admin) : Settings > Custom domain, sous-domaine, CNAME, « Ready: Go Live » [VU-DOC].

**Côté spectateur** [VU-DOC + DÉDUIT pour l'agencement] : page player habillée (logo, 1 ou 2 CTA en haut), cadre navigateur, démo, filigrane en Free ; Step information sous la démo ; sélecteur de langue ; checklist ; voix off et sous-titres ; contrôles (Next, Back, flèches de spotlight) ; formulaires bloquants ; écran « lien expiré » ; écran mot de passe ; écran « domaine non autorisé » ; écran de vérification par code email.

### 3.8 Demo Center et Demo Page

> Aucun article de la doc ne couvre la création d'un démo center : le parcours ci-dessous est **[DÉDUIT]** des pages produit [VU-SITE] et des outils MCP (`add_demo_center_item`, `update_demo_center_settings`) [VU-DOC].

1. Créer un démo center : nom, mise en page (playlist, grille…), marque [DÉDUIT].
2. Ajouter des éléments : flows, vidéos, PDF, formulaires, liens ; grouper par section ou chapitre ; ordonner [VU-SITE].
3. Configurer la qualification (questions) et les règles d'affichage par segment, UTM ou variables [VU-SITE].
4. Régler l'accès : public, conditionné par formulaire, privé ou sur invitation [VU-SITE].
5. Publier : lien unique, embed, email [VU-SITE].
6. Analyser au niveau du hub : démos consultées, ordre, comités d'achat [VU-SITE].

### 3.9 Analytics et leads

1. Éditeur, onglet **Analytics**, vue **générale** : KPI (vues, uniques, complétion, leads), graphiques, période [VU-DOC].
2. Filtres : source, interne ou externe, dates [VU-DOC].
3. Onglet **Sessions** : liste, puis « Details » : contexte, attributs, complétion par étape [VU-DOC].
4. « Download » : rapport envoyé par email (sessions) ou CSV (général) [VU-DOC].
5. Onglet **Leads** : Start Leads ou End Leads, liste, « Download » CSV [VU-DOC].
6. Activer la révélation de compte (Integrations), qui enrichit les sessions avec des données entreprise [VU-DOC].
7. Alertes : Slack à chaque vue (paramétrable par flow) ; workflows via Zapier ou hooks [VU-DOC].

### 3.10 Équipe

1. Settings > **Team** > « Add member » : email et rôle, puis « Invite member » [VU-DOC].
2. L'invité reçoit un email, clique sur le lien, crée son compte ou se connecte, puis rejoint le workspace [VU-DOC + DÉDUIT].
3. L'Admin modifie le rôle ou supprime le membre (« ... » → Delete) [VU-DOC].
4. Il ouvre les droits d'un dossier privé aux Viewers et Guests concernés [VU-DOC].
5. Enterprise : SSO configuré via un portail d'identité fédérée, sur demande au support [VU-DOC].

### 3.11 Facturation

1. Settings > **Billing** : plans, bascule mensuel ou annuel, passage à un plan payant [VU-DOC].
2. Paiement chez le prestataire (carte, PayPal, virement) [VU-PRIX].
3. Retour dans « Your limits » : usage et prochaine facture [VU-DOC].
4. Ajout d'un membre : nouveau siège facturé au prorata [VU-PRIX ; le prorata est DÉDUIT].
5. Settings > **Invoices** : téléchargement des PDF [VU-DOC].
6. Rétrogradation ou résiliation : non documentées [DÉDUIT : via « Manage your plan »].

---

## 4. Sitemap de l'application (écran par écran)

> **[VU-DOC]** sauf mention contraire. Les URL sont des **propositions FlowDSIML**, pas celles de Guideflow.

```
PUBLIC / AUTH
├── /signup                          Inscription                               [MVP]
├── /login                           Connexion (email, Google ; SSO plus tard)  [MVP]
├── /forgot-password, /reset         Mot de passe oublié                        [MVP] (DÉDUIT)
├── /invite/:token                   Accepter une invitation au workspace       [MVP]
└── /onboarding                      Création du workspace + installation de l'extension [MVP] (DÉDUIT)

APP (workspace courant)
├── /home                            Tableau de bord : tous les flows (recherche, tri, filtre par tags)  [MVP]
│   ├── /folders/:id                 Contenu d'un dossier (droits, sous-dossiers)          [MVP/V2]
│   ├── /archived                    Flows archivés, restauration                           [MVP]
│   └── /offline                     Flows hors ligne (local)                               [V3]
├── /demo-centers                    Liste des démo centers                                 [V2]
│   └── /demo-centers/:id/edit       Éditeur de hub (éléments, mise en page, accès, analytics) [V2]
├── /analytics                       Analytics du workspace (tous flows)                    [V2]
├── /leads                           Leads du workspace (DÉDUIT : en doc, les leads sont par flow) [V2]
├── /integrations                    Catalogue, connexion, « Faire une demande »            [V2]
│
├── /flows/:id/edit                  ÉDITEUR                                                [MVP]
│   ├── panneau gauche               Étapes, Add steps (capture, téléversement, bibliothèque)
│   ├── canevas                      Écran, CTA, flou, zoom, recadrage
│   ├── panneau droit (onglets)      Call-to-action · Pop-up ⚡ · Design (+thème) · Browser ·
│   │                                Checklist · Voiceover · Video bubble · Step information ·
│   │                                Presenter notes · HTML editor · Settings (tags)
│   ├── menu de l'en-tête            Historique des versions · Save for offline · Presenter mode ·
│   │                                AI Localization Center · Improve with AI
│   └── modale Share                 Public link · Custom links · Embed · Social · Email platforms ·
│                                    Invite people · GIF & video · PDF · Security
├── /flows/:id/preview               Prévisualisation                                       [MVP]
├── /flows/:id/analytics             Général · Sessions (+ détail) · export                  [MVP]
├── /flows/:id/leads                 Start Leads · End Leads · CSV                           [MVP]
├── /flows/:id/present               Mode présentateur (fenêtre des notes)                   [V2]
│
└── /settings
    ├── /account                     Mon compte (profil, langue, mot de passe, suppression)  [MVP]
    ├── /notifications               Préférences                                            [V2]
    ├── /privacy, /labs              Confidentialité, fonctions expérimentales               [V2]
    ├── /general                     Workspace (nom, avatar, site, secteur)                  [MVP]
    ├── /team                        Membres et rôles                                        [MVP]
    ├── /billing                     Plan, mensuel/annuel, limites, gestion                  [MVP]
    ├── /invoices                    Factures                                                [MVP]
    ├── /variables                   Variables                                               [MVP]
    ├── /tags                        Tags                                                    [V2]
    ├── /embed-forms                 Codes de formulaires externes                           [V2]
    ├── /branding/theme              Thèmes (aperçu en direct, défaut)                       [V2]
    ├── /branding/fonts              Polices                                                 [V2]
    ├── /branding/public-page        Page publique (logo, CTA)                               [MVP]
    ├── /branding/watermark          Filigrane                                               [MVP]
    ├── /custom-domain               Domaine personnalisé (Admin)                            [V2]
    ├── /dictionary                  Glossaire de traduction                                 [V2]
    ├── /ai-avatar                   Avatars                                                 [V3]
    ├── /api-keys                    Clés API                                                [V2]
    └── /sso                         SSO/SCIM (Admin)                                        [V3]

SPECTATEUR (sans compte)
├── /p/:flowId                       Player public (habillé, filigrane selon le plan)        [MVP]
├── /p/:flowId/:slug                 Lien personnalisé                                       [MVP]
├── /embed/:flowId                   Player sans habillage pour iframe                       [MVP]
├── /c/:centerId                     Démo center public                                      [V2]
└── écrans système                   Mot de passe · Lien expiré · Domaine non autorisé ·
                                     Code de vérification email · Flow introuvable ou privé  [V2]

CLIENTS
├── Extension Chrome                 Popup (choix du mode, Start), réglages, widget de capture, bouton Gmail [MVP] (Gmail : V3)
├── App desktop (Win/macOS)          Connexion, choix du dossier, choix de fenêtre, capture  [V3]
└── Plugin Figma                     Sélection de frames, export                             [V3]
```

---

## 5. Plans tarifaires et limites

### 5.1 Grille observée (novembre 2026)

La page affiche deux blocs, Monthly et Yearly. Le premier bloc correspond au **mensuel** et le second à l'**annuel** (prix par mois). C'est **[DÉDUIT]** de la bascule « Monthly | Yearly » et de l'écart d'environ 15 à 17 % entre les deux.

| Plan | Mensuel | Annuel ($/mois) | Sièges | Contenu clé | Source |
|---|---|---|---|---|---|
| **Free** | 0 $ | 0 $ | 1 membre (carte) ; « jusqu'à 3 membres » (FAQ) ⚠️ | Démo screenshots et mobile, **5 flows**, spectateurs illimités, **analytics sur 7 jours**, **filigrane** | VU-PRIX |
| **Solo** | 40 $ | 35 $ | 1 inclus, puis +35 $ par utilisateur | Demo Page ; **flows illimités** ; analytics avancées ; contenu IA ; export vidéo et GIF ; traduction IA ; flou ; formulaires de leads et sondages ; identification des visiteurs ; MCP (bloc annuel) | VU-PRIX |
| **Startup / Growth** (le nom change selon le bloc) | 599 $ | 499 $ | 10 inclus, puis +50 $ par utilisateur | Tout Solo, plus **démo et capture HTML** ; personnalisation IA ; édition texte, image et graphique ; bibliothèque de démos ; **branchement avancé** ; canal Slack/Teams ; CSM dédié ; **hors ligne** (doc : « Growth et plus ») | VU-PRIX, VU-DOC |
| **Advanced** | 1 799 $ | 1 499 $ | Sur mesure | Tout Growth, plus **sandbox** ; environnement cliquable ; liens auto ; hors ligne ; **notes du présentateur** ; **domaine personnalisé** ; formation ; **Demo Center en add-on** | VU-PRIX |
| **Enterprise** | Sur devis (« Contact us ») | « 2 999 $/mois » affiché dans le récapitulatif | Sur mesure | Tout Advanced, plus **Demo Center** inclus ; **Live Demo en add-on** ; générateur de jeux de données IA ; services pro ; ligne dédiée ; expert dédié ; **création de démos** ; SSO, SCIM et SAML ; SLA ; hébergement UE/US | VU-PRIX, VU-SITE |

**Règles commerciales** [VU-PRIX, FAQ]
- Flows **illimités** sur tous les plans payants.
- Abonnement **par workspace**, renouvelé automatiquement, mensuel ou annuel.
- Les sièges sont facturés dès l'arrivée d'un membre. Un siège libéré peut être réattribué gratuitement. Au renouvellement, seuls les sièges occupés sont facturés.
- Paiement via un *merchant of record* : carte, débit, virement, PayPal.
- Le retrait du filigrane exige un plan payant (« Pro » dans la doc et la FAQ, qui désigne vraisemblablement Solo et plus) [VU-DOC / DÉDUIT].
- Le plan « Corporate » de la FAQ est sur mesure (SAML SSO, conformité, CSM, support prioritaire). C'est probablement l'ancien nom d'Enterprise [DÉDUIT].
- Le support varie selon le plan : email, chat, puis Slack/Teams, CSM, ligne dédiée [VU-PRIX].

### 5.2 Limites non publiées (à définir pour FlowDSIML)

Ces limites ne sont pas publiées : rétention des analytics par plan au-delà des 7 jours du Free, quotas IA (minutes de voix off, traductions, avatars), nombre de workspaces, nombre de démo centers, taille et durée des vidéos, stockage, nombre de liens personnalisés (« illimité » selon la doc), langues par flow. Les cases de la grille comparative sont des icônes que l'extraction ne restitue pas : **la répartition ligne par ligne de la grille reste à confirmer** (une capture d'écran manuelle de la page suffirait).

### 5.3 Proposition de « feature gating » FlowDSIML [DÉDUIT, à valider]

| Capacité | Free | Solo | Team (≈ Growth) | Business (≈ Advanced) | Enterprise |
|---|---|---|---|---|---|
| Flows | 5 | ∞ | ∞ | ∞ | ∞ |
| Rétention des analytics | 7 j | 12 mois | 24 mois | ∞ | ∞ |
| Filigrane | oui | non | non | non | non |
| Capture screenshots et vidéo | ✔ | ✔ | ✔ | ✔ | ✔ |
| Capture HTML | – | – | ✔ | ✔ | ✔ |
| Sandbox | – | – | – | ✔ | ✔ |
| Formulaires et leads | – | ✔ | ✔ | ✔ | ✔ |
| Exports | – | ✔ | ✔ | ✔ | ✔ |
| IA (crédits par mois) | – | quota S | quota M | quota L | sur mesure |
| Domaine personnalisé | – | – | – | ✔ | ✔ |
| Demo center | – | – | – | add-on | ✔ |
| SSO et SCIM | – | – | – | – | ✔ |

---

## 6. Questions ouvertes à trancher avec le client

### Périmètre et positionnement
1. **Cible prioritaire** : vente B2B (démos, leads, CRM) ou formation et support (où les avis notent que Guideflow est faible : pas de suivi par apprenant, pas de quiz) [VU-AVIS] ? Ce choix change le MVP.
2. **Live demo par proxy** (clone du backend) : la sortir du périmètre ? Elle est très coûteuse et sensible du point de vue sécurité. Nous recommandons de l'exclure jusqu'en V3+.
3. **Clients de capture** : Chrome seul au MVP, ou aussi Edge et Firefox (WebExtension commune) ? L'app desktop, le mobile et Figma attendent-ils la V3 ?
4. **Capture HTML** dès le MVP ? Elle est très différenciante mais complexe : CSS, polices, iframes, shadow DOM, sécurité des scripts. Nous recommandons screenshots et vidéo au MVP, puis HTML en V2.

### Produit et UX
5. **Chapitres et branches** : faut-il des **objets de premier niveau** (chapitres nommés, nœuds de choix, éditeur de graphe), ou suffit-il de reproduire l'approche Guideflow (boutons « aller à l'étape » et checklist) ?
6. **Rôles** : la doc (Admin, User, Viewer, Guest, Billing) et la page Enterprise (admin, manager, editor, viewer) se contredisent. Quel modèle retenir ? Faut-il des rôles par dossier ?
7. **Variables vides** sans valeur par défaut : afficher une chaîne vide, le nom de la variable, ou bloquer la publication ?
8. **Sauvegarde** : sauvegarde continue et brouillons, ou « Publish » explicite (le MCP expose `publish_guideflow`) ? Les spectateurs voient-ils les modifications en direct ou seulement après publication ?
9. **Langues de l'interface** : FR et EN dès le MVP ? Le profil Guideflow propose un choix de langue.
10. **Accessibilité** visée pour le player : WCAG 2.1 AA ?

### Données, sécurité, conformité
11. **Hébergement** : UE uniquement (RGPD natif) ou choix UE/US par workspace ?
12. **Révélation de compte** (enrichissement par IP) et identification des visiteurs : quel fournisseur ? Quel cadre de consentement (bandeau cookies et CMP dans les iframes) ?
13. **Données sensibles capturées** : faut-il un flou automatique (détection d'emails, de numéros) dès la capture, ou un flou manuel seulement ?
14. **SSO et SCIM** : prestataire tiers ou développement maison ? À quelle échéance ?

### IA
15. **Fournisseurs** : LLM, TTS, avatar. **Modèle de coût** : crédits par plan ou usage illimité plafonné ?
16. **MCP / API publique** dès la V2 ? Elle profite au client et à l'automatisation interne.

### Business
17. **Tarification** : reprendre une grille par siège et par workspace ? Mêmes paliers ? Devise (€) ? Essai gratuit des plans payants (non mentionné par Guideflow) ?
18. **Prestataire de paiement** : *merchant of record* (TVA gérée) ou Stripe Billing ?
19. **Intégrations du MVP** : webhook et Zapier seulement, ou HubSpot natif dès la V2 ?
20. **Marque** : nom définitif « FlowDSIML » ? Domaine du player (sous-domaine dédié pour isoler les cookies) ?

---

## 7. Annexes

### 7.1 Événements du player (modèle de référence) [VU-DOC]

| Événement | Déclencheur | Données utiles |
|---|---|---|
| `first-interaction` | ouverture dans le player | session, flow, étape 0, source (`embed`, `player`, `customLink`, `publicPage`, `preview`), variables |
| `slide-viewed` | étape vue | session, étape (id, index, nom), temps |
| `lead-created` | formulaire envoyé, ou lien personnalisé avec variables | variables (email, prénom…), URL, dossier |
| `external-link-clicked` | clic sur un lien externe | URL, emplacement (`start_popup`, `slide_popup`, `end_popup`) |
| `completed` | dernière étape atteinte | complétion à 100 % |
| `end-session` | fermeture ou départ | temps total, complétion, liens cliqués, OS, variables |

Événements cross-frame supplémentaires : Start Session, Start Step, End Step (avec `timeSpent`), entre autres [VU-DOC]. → Ces événements fondent **à la fois** les analytics, les webhooks, Zapier et les CRM. Nous recommandons un **schéma d'événements unique** dès le MVP.

### 7.2 Règles métier relevées [VU-DOC]
- Chaque étape porte un CTA, sauf la dernière.
- Pan & zoom et flou par rectangle ne s'appliquent qu'aux **screenshots**. En HTML, on passe par l'éditeur HTML.
- Une bulle vidéo et une voix off sont **exclusives** sur une même étape.
- L'éditeur vidéo (découpe et vitesse) ne s'applique pas aux étapes vidéo enregistrées manuellement.
- Les modes de partage exigent « Public access » activé.
- La suppression d'une étape est **définitive** (hors historique des versions).
- Les démos hors ligne sont locales à l'utilisateur et à l'appareil.
- Une étape de bibliothèque **liée** se met à jour partout ; une étape **non liée** est une copie.
- La modification d'un thème se propage à tous les flows qui l'utilisent.
- Le dédoublonnage CRM se fait sur l'**email**.

### 7.3 Retours utilisateurs [VU-AVIS]
- **Points forts** : rapidité de création, facilité d'édition, support réactif, prix d'entrée bas, hubs multi-démos (G2 : 5,0/5 sur environ 141 avis selon la page produit ; un blog tiers cite 4,7/5).
- **Points faibles** : la capture HTML est réservée au plan à 499 $ ; la mise en forme de marque prend du temps au départ ; l'outil devient limité sur les **parcours complexes avec branches** ; il faut retoucher l'affichage mobile des tours complexes ; il n'offre pas d'analytics par apprenant pour la formation.
- **Opportunités FlowDSIML** : branchement de premier niveau, onboarding de marque guidé (import du logo et des couleurs depuis l'URL du site), HTML accessible plus tôt dans la grille, mode formation (suivi par apprenant).

### 7.4 Sources consultées
- Site : `guideflow.com/product/{interactive-demo, sandbox, live-demo, mobile-demo, demo-page, demo-center}`, `/features/{capture, edit, personalize, share, analyze, ai, collaborate, integrate}`, `/pricing` (HTML intégral et FAQ), `/enterprise`, `/download`.
- Centre d'aide : `docs.guideflow.com/help/llms.txt` et les 147 articles listés (Get started, Capture, Capture settings, Edit, Sandbox, Sharing, Analytics, Leads, Variables, Dashboard, Integrations, Tracking, Branding, Workspace, Account, SSO, AI).
- Avis : G2 (page produit, synthèse des avis), blog Trainn « Guideflow reviews » (concurrent), blog HowdyGo « Guideflow alternatives » (concurrent, cité indirectement).
