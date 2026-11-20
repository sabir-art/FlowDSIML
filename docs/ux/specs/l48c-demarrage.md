# L48-C, Assistant de démarrage

> Paquet L48-C du benchmark (`benchmark-structure.md`, rang 4). Maquette : `docs/ux/maquettes/refonte/l48c-demarrage.html`.
> Remplace l'onboarding en 3 étapes (`apps/web/src/pages/Onboarding.tsx`, ONB-01 à 03). Règles visuelles : `composants.md` §17 (une action principale, trois tailles de texte, lois de Hick et de Miller).
> Données fictives uniquement (acme, example.com).

## 1. Principe

- Plein écran, sans barre latérale. Deux colonnes : **formulaire à gauche** (480 px de contenu, marge gauche 96 px) et **aperçu à droite** (fond `surface-sunken`). L'aperçu montre ce que la réponse change dans l'app. Il est décoratif (`aria-hidden="true"`).
- **5 étapes** au lieu des 6 du benchmark : « Installer l'extension » et « L'épingler » forment une seule étape (deux sous-étapes numérotées), parce qu'elles se font dans la même fenêtre du navigateur. Avec 6 écrans, l'utilisateur fait un aller-retour de plus pour une action de 3 secondes.
- **Une question par écran**, **une action principale** : « Continuer ».
- En haut :
  - le logo compact ;
  - au centre, une barre de progression en 5 segments de 4 px (fait : `text`, à venir : `border`) et « Étape n sur 5 » en 13 px `text-muted` ;
  - à droite, « Passer » en bouton `ghost`, sur toutes les étapes.
- En bas du formulaire : « Retour » (`ghost`, absent à l'étape 1) à gauche, « Continuer » (`primary`, `lg`) à droite.
- Sur mobile (moins de 900 px), l'aperçu disparaît et le formulaire occupe toute la largeur (gouttière de 20 px). Les étapes 3 et 4 restent faisables sur ordinateur seulement ; sur mobile, l'étape 3 propose « Importer des captures » (voir §3.3).

## 2. Étapes

| # | Titre (24 px, 700) | Contenu | Aperçu à droite |
|---|---|---|---|
| 1 | Bienvenue, Camille | Prénom (prérempli depuis `profile.full_name`), Fonction (menu) | Carte de profil : avatar, prénom, fonction |
| 2 | Nommez votre espace | Nom de l'espace (obligatoire) | Barre latérale de l'app avec le nom de l'espace en haut |
| 3 | À quoi servira TutoClick ? | 4 choix, plusieurs possibles | Les 3 modèles de démo qui seront proposés en premier |
| 4 | Installez l'extension | 2 sous-étapes : Ajouter à Chrome, puis épingler | La barre du navigateur, avec l'icône épinglée et entourée |
| 5 | Lancez votre première capture | Un rappel en 3 lignes, puis l'action | Le panneau de l'extension, avec « Démarrer la capture » |

### 2.1 Étape 1 : Profil
- Sous-titre : « Deux informations pour adapter les exemples. »
- **Prénom** : champ de 40 px, prérempli.
- **Fonction** : `select` natif avec Formateur ou formatrice, Conseiller ou conseillère, Chargé ou chargée de communication, DSI, Autre. Facultatif.
- Enregistré dans `auth.users.user_metadata` : `first_name`, `job` (`trainer`, `advisor`, `comms`, `it`, `other`). Aucun changement de schéma.

### 2.2 Étape 2 : Espace
- Sous-titre : « En général, le nom de votre structure ou de votre service. »
- **Nom de l'espace**, seul champ. Le benchmark proposait aussi la structure et le nombre de personnes. Je les retire : l'outil est interne (environ 100 personnes, une seule organisation), ces réponses ne changeraient rien dans l'app.
- Si la personne a déjà un espace (invitée), l'étape 2 est sautée : « Étape n sur 4 ».
- La création de l'espace se fait **à la sortie de l'étape 2**, comme aujourd'hui (`createWorkspace`). Erreur : message sous le champ, focus dans le champ.

### 2.3 Étape 3 : Usage
- Sous-titre : « Plusieurs réponses possibles. »
- 4 cartes de choix en grille de 2 × 2 (hauteur 96 px). Chaque carte contient une icône Lucide de 20 px `text-muted`, sans pastille de fond, un nom en 15 px 600 et une phrase en 13 px `text-muted`. Aucune liste de points forts.
  - **Former les conseillers** (`graduation-cap`) : « Prise en main d'un logiciel métier, nouveaux arrivants. »
  - **Accompagner les jeunes** (`users`) : « Démarches en ligne, pas à pas. »
  - **Documenter un logiciel** (`file-text`) : « Une démo par procédure, toujours à jour. »
  - **Communication interne** (`megaphone`) : « Annoncer un changement de version. »
- Case à cocher dans la carte (`role="checkbox"` sur la carte entière, ou `input type="checkbox"` visible en haut à droite). Sélection : contour 2 px `text` (T5). Aucune réponse n'est obligatoire.
- Enregistré dans `user_metadata.use_cases` (tableau) ; `use_case` (valeur unique actuelle) est lu pour compatibilité.
- **Effets** :
  - **Nouvelle démo › Modèles** : la catégorie correspondante passe en premier (former → `accueil`, accompagner → `procedure`, documenter → `logiciel`, communication → `logiciel`). Aucun modèle n'est masqué.
  - **Checklist « Prise en main »** : ordre inchangé. Seul l'exemple de texte de l'étape « Capturer » change (« Ex. : Créer une fiche dans votre logiciel métier »).
  - L'aperçu de droite montre les 3 premiers modèles de l'ordre obtenu, en cartes blanches avec le nom seul.

### 2.4 Étape 4 : Extension
- Sous-titre : « Elle enregistre une capture à chaque clic. Rien n'est envoyé avant « Terminer ». »
- Deux lignes numérotées (cercle de 28 px, contour `border`, chiffre en 13 px 600 ; coché : icône `check` `text`) :
  1. « Ajoutez l'extension à Chrome » avec le bouton `secondary` « Ajouter à Chrome » (lien externe, icône `external-link`).
  2. « Épinglez-la : cliquez sur l'icône puzzle, puis sur l'épingle à côté de TutoClick. »
- Détection : la checklist s'appuie déjà sur `profiles.extension_seen_at`, rempli par la RPC `extension_seen()` quand l'extension connectée s'ouvre. À l'étape 4, l'app relit ce champ toutes les 2 s, avec arrêt en quittant l'étape. Quand il est rempli, la ligne 1 passe en coché et « Extension détectée » apparaît sous la ligne, en texte `success`. L'épinglage ne peut pas être détecté : la ligne 2 reste une consigne.
- Liens texte sous les lignes : « Importer des captures à la place » (ouvre le sélecteur de fichiers, comportement actuel) et « Continuer sans l'extension ». Le bouton principal reste « Continuer ».
- Aperçu : barre d'adresse et barre d'outils du navigateur (gris neutres). Le menu des extensions s'ouvre, puis l'épingle se met en surbrillance (animation de 2,4 s en boucle, une pause de 1 s entre deux cycles). Avec `prefers-reduced-motion: reduce`, on montre l'état final, fixe.
- « Chrome, Edge, Brave et Arc » en 13 px `text-muted` en pied de colonne.

### 2.5 Étape 5 : Première capture
- Titre : « Lancez votre première capture ». Sous-titre : « Choisissez une tâche courte, de 5 à 10 clics. »
- Trois lignes numérotées, sans bouton : « Ouvrez votre logiciel dans un onglet », « Cliquez sur l'icône TutoClick, puis sur Démarrer », « Faites la tâche, puis cliquez sur Terminer ».
- Action principale : **« Ouvrir mon espace »** (`primary`, `lg`), qui mène à Démos. La capture se lance depuis le navigateur ; un bouton « Lancer une capture » dans l'app ne pourrait que répéter la consigne.
- Lien secondaire : « Voir une démo d'exemple » (démo d'exemple actuelle).
- La checklist « Prise en main » de la page Démos est **repliée** à l'arrivée (une ligne, L48-B), avec les étapes déjà faites cochées.

## 3. Comportements

### 3.1 Passer
- « Passer » est présent sur toutes les étapes.
- Avant la création de l'espace, il crée l'espace avec le nom saisi ou « Espace de Camille » (comportement actuel `skip()`), puis ouvre Démos.
- Les réponses déjà données sont gardées.

### 3.2 Reprise
- L'étape atteinte est gardée dans `sessionStorage` (`fd.onb.step`) : un rechargement revient à la même étape.
- L'assistant ne s'affiche plus une fois terminé ou passé (règle actuelle : présence d'un espace).

### 3.3 Mobile
- À l'étape 4 sur un écran de moins de 900 px : « L'extension s'installe sur ordinateur. » et l'action principale « Continuer ».
- À l'étape 5 : l'action principale reste « Ouvrir mon espace ».

### 3.4 Accessibilité
- Chaque étape est un `form` avec un `h1` qui prend le focus à l'arrivée (comme aujourd'hui `heading.current.focus()`).
- La progression a `role="progressbar"` avec `aria-valuenow`, `aria-valuemax` et `aria-valuetext="Étape 2 sur 5"`.
- Cartes d'usage : `fieldset` et `legend` (le titre), une case à cocher par carte, libellé = nom et phrase.
- Entrée valide « Continuer » ; Échap ne ferme rien (plein écran).

## 4. Textes (i18n `onboarding.*`, nouvelles clés)

| Clé | Texte |
|---|---|
| `stepOf` | Étape {{n}} sur {{total}} (existe) |
| `profileTitle` | Bienvenue, {{name}} |
| `profileSub` | Deux informations pour adapter les exemples. |
| `firstName` | Prénom |
| `job` | Fonction (facultatif) |
| `jobs.trainer` … `jobs.other` | Formateur ou formatrice, Conseiller ou conseillère, Chargé ou chargée de communication, DSI, Autre |
| `wsTitle` | Nommez votre espace |
| `useTitle` | À quoi servira TutoClick ? |
| `useSub` | Plusieurs réponses possibles. |
| `uses.train`, `uses.youth`, `uses.document`, `uses.comms` (+ `Help`) | Voir §2.3 |
| `extTitle` | Installez l'extension (modifié) |
| `pinHelp` | Épinglez-la : cliquez sur l'icône puzzle, puis sur l'épingle à côté de TutoClick. |
| `extDetected` | Extension détectée |
| `extDesktop` | L'extension s'installe sur ordinateur. |
| `captureTitle` | Lancez votre première capture |
| `captureSub` | Choisissez une tâche courte, de 5 à 10 clics. |
| `capture1` à `capture3` | Voir §2.5 |
| `openSpace` | Ouvrir mon espace |
| `seeSample` | Voir une démo d'exemple |

## 5. Mesures (§17)

- Titres 24 px 700, sous-titres 15 px `text-muted`, libellés 14 px 600 : 3 tailles par écran, plus le 13 px des aides.
- Formulaire : 32 px entre le titre et le premier champ, 24 px entre deux champs, 40 px avant les boutons.
- Colonne de gauche : contenu centré verticalement, plus haut que le centre de 8 % (`margin-block: auto` avec `padding-bottom: 8vh`).
- Aperçu : un seul objet à la fois, centré, ombre `0 16px 48px rgb(8 10 14 / .12)`. Aucune légende.
- Aucun badge. Aucune icône devant le titre.

## 6. Recette

1. Nouveau compte : 5 étapes, « Étape 1 sur 5 » ; compte invité dans un espace : 4 étapes, l'étape Espace est sautée.
2. « Passer » à l'étape 1 : un espace « Espace de Camille » est créé, Démos s'ouvre.
3. Usage « Former les conseillers » : Nouvelle démo › Modèles affiche « Accueil » en premier ; les autres catégories restent visibles.
4. Extension ouverte et connectée : « Extension détectée » apparaît sans recharger, en 2 s au plus.
5. `prefers-reduced-motion` : l'aperçu de l'étape 4 est fixe.
6. 390 px : pas d'aperçu, pas de défilement horizontal ; étape 4 en version « sur ordinateur ».
7. Rechargement à l'étape 3 : retour à l'étape 3 avec les réponses de l'étape 1.
8. Clavier seul : tout l'assistant se fait au clavier, le focus arrive sur le titre de chaque étape.
9. Sombre : contrastes de l'aperçu ≥ 3:1 pour les contours, ≥ 4,5:1 pour les textes.
