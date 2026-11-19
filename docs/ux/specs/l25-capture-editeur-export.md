# L25 : capture avancée, éditeur de données, export MP4, page personnalisée, vague B

> **Maquettes** :
> - `refonte/l25-capture.html` (`?view=suivi|taille`) : popup de l'extension, multi-onglets et taille de l'onglet, avec la 4e carte « Capture HTML » (L20 §2) ;
> - `reference/editeur-capture.html` (`?etat=recadrer|cadre|saisie|defilement|onglets`) : capture avancée dans l'éditeur ;
> - `reference/editeur-donnees.html` (`?etat=masse|graphique|donnees|conditions`) : styles en masse, graphiques, jeux de données, embranchements ;
> - `refonte/l25-export-mp4.html` (`?view=mp4|mp4-en-cours|mp4-termine`) : export vidéo ;
> - `reference/liens-perso.html` (`?etat=liste|lien`) : Partager > Liens personnalisés ;
> - `reference/page-perso.html` (`?etat=perso|expire`) : la page vue par le destinataire, en 1 440 et 390 px ;
> - `refonte/vague-b.html` (`?view=ia|crm|sso`) : cartes « Bientôt » (VB-01 à VB-03).
>
> **Base** :
> - `specs/l20-html.md` : étape HTML, sélection d'éléments ;
> - `specs/l21-video-mobile.md` : popup de l'extension ;
> - `specs/l15-exports.md` : modale d'export ;
> - `specs/l19b-page-publique.md` : page publique ;
> - `specs/a1-partage.md` : liens personnalisés ;
> - L22-09 : règles de suite.
>
> **Données** : fictives (Acme, Globex, `.example`). Les jeux de données ne contiennent jamais de données personnelles.

## 1. États et codes

| Code | État | Maquette |
|---|---|---|
| L25-01 | Extension : capture multi-onglets et taille de l'onglet | `refonte/l25-capture.html?view=suivi|taille` |
| L25-02 | Éditeur : recadrage d'une capture | `editeur-capture.html?etat=recadrer` |
| L25-03 | Éditeur : cadre du navigateur (onglet Design) | `editeur-capture.html?etat=cadre` |
| L25-04 | Éditeur : animation de saisie | `editeur-capture.html?etat=saisie` |
| L25-05 | Éditeur : animation de défilement | `editeur-capture.html?etat=defilement` |
| L25-06 | Éditeur : étape capturée dans un autre onglet | `editeur-capture.html?etat=onglets` |
| L25-07 | Éditeur : styles en masse | `editeur-donnees.html?etat=masse` |
| L25-08 | Éditeur : graphique modifiable (étape HTML) | `editeur-donnees.html?etat=graphique` |
| L25-09 | Éditeur : jeu de données CSV | `editeur-donnees.html?etat=donnees` |
| L25-10 | Éditeur : embranchement conditionnel | `editeur-donnees.html?etat=conditions` |
| L25-11 | Export : format Vidéo MP4 | `l25-export-mp4.html?view=mp4` |
| L25-12 | Export MP4 en cours, puis prêt | `l25-export-mp4.html?view=mp4-en-cours`, `mp4-termine` |
| L25-13 | Partager > Liens personnalisés : liste et création avec page | `liens-perso.html?etat=liste`, `lien` |
| L25-14 | Page personnalisée (ordinateur et mobile) | `page-perso.html?etat=perso` |
| L25-15 | Lien personnalisé inactif | `page-perso.html?etat=expire` |
| VB-01 à VB-03 | Cartes « Bientôt » : IA, CRM et e-mailing, SSO | `refonte/vague-b.html` + §8 |

**Ce que L25 rend obsolète** :
- les « Hors périmètre » de L20 §7 (graphiques, jeux de données, style par élément) ;
- les « Hors périmètre » de L21 §7 (multi-onglets, animations de saisie et de défilement, recadrage des captures d'écran). Le recadrage d'une **vidéo** reste hors périmètre ;
- la carte « Vidéo MP4 · Bientôt » de L15, qui devient active.

## 2. Capture (extension, L25-01)

Ces options s'ajoutent à la popup de L21-01, sous le type de capture. Elles valent pour les captures d'écran et HTML, pas pour la vidéo.

- **« Suivre les nouveaux onglets »** :
  - interrupteur, **désactivé par défaut**, avec l'aide « Les onglets ouverts depuis la page capturée sont capturés aussi. Les autres onglets ne le sont jamais. » ;
  - activé, l'extension suit seulement les onglets ouverts **par** l'onglet capturé (`openerTabId`). Elle ne capture jamais un onglet ouvert à la main ;
  - chaque étape mémorise son onglet (numéro et titre). La barre d'enregistrement affiche « Onglet 2 » pendant que l'utilisateur y est.
- **« Taille de l'onglet »** :
  - select : Taille actuelle (par défaut), 1 280 × 720, 1 440 × 900, 1 920 × 1 080, Taille personnalisée (largeur et hauteur, de 800 à 2 560 px) ;
  - aide : « L'onglet est redimensionné le temps de la capture, puis remis à sa taille. » ;
  - c'est le même mécanisme que le format mobile (L21-01), en mode bureau. Si le format mobile est choisi, ce select est masqué.
- **Capture pleine page** : chaque capture garde la hauteur totale de la page (défilement). C'est elle qui sert à l'animation de défilement (§3.4).
- **Vérification des données** (F1 §1) : inchangée, sur chaque onglet.

## 3. Éditeur : capture avancée (L25-02 à L25-06)

### 3.1 Recadrage (L25-02)
- **Entrée** : outil « Recadrer » (icône `crop`) dans la barre flottante, à côté de hotspot, flou et zoom.
- **Canevas** :
  - voile sombre hors du cadre et 8 poignées de 12 px avec contour blanc ;
  - étiquette des dimensions en haut (« 1 280 × 720 · 16:9 ») ;
  - les poignées se pilotent au clavier : flèches 1 px, Maj + flèches 10 px.
- **Panneau « Recadrer la capture »** :
  - format (`radiogroup`) : Libre, 16:9, 4:3, 1:1 ;
  - largeur et hauteur en px ;
  - « Appliquer à » : Cette étape / Toutes (n). « Toutes » recadre à la même zone toutes les captures de même taille ; les autres ne changent pas et un toast le dit ;
  - « Réinitialiser », « Annuler », « Recadrer ».
- **Règles** :
  - le recadrage est **non destructif** : la capture d'origine est conservée ;
  - le hotspot, les flous et le zoom suivent le recadrage ;
  - un hotspot qui sort du cadre passe en alerte warning dans la liste des étapes (« Hotspot hors du cadre »). La publication n'est pas bloquée.

### 3.2 Cadre du navigateur (L25-03)
- **Où** : onglet Design, section « Cadre du navigateur ». Elle remplace la bascule « Barre de navigateur » d'A2-01. Le cadre vaut pour toute la démo.
- **Style** (`radiogroup`) : Clair, Sombre, Minimal, Aucun.
- **Barre d'adresse** :
  - interrupteur ;
  - « Adresse affichée » : par défaut, l'adresse de la capture. Le texte sert seulement à l'affichage et n'est jamais un lien.
- **Onglets** : interrupteur, « Titre de l'onglet » (par défaut, celui de la capture), interrupteur « Boutons de fenêtre ».
- **Fond autour du cadre** : couleur, avec la règle de contraste existante.
- **Mobile** : une démo `device: mobile` (L21) a le cadre téléphone. Cette section est alors remplacée par « Cadre du téléphone : Afficher / Masquer ».

### 3.3 Animation de saisie (L25-04)
- **Où** : panneau Étape, section « Animation de l'étape », `radiogroup` Aucune / Saisie / Défilement. Une seule animation par étape.
- **Saisie** :
  - **Texte saisi** : les variables sont acceptées (`{{company}}`) ;
  - **Champ** : celui repéré à la capture (« Champ « Nom du rapport », repéré à la capture »), avec « Choisir un autre champ », qui fait cliquer sur le canevas ;
  - **Vitesse** : Lente (90 ms par caractère), Normale (50 ms), Rapide (25 ms) ;
  - « Prévisualiser l'animation ».
- **Lecture** :
  - le texte apparaît caractère par caractère avec un curseur clignotant, puis la bulle s'affiche ;
  - le texte doit déjà figurer en entier dans le DOM pour les lecteurs d'écran (`aria-hidden` sur l'animation, texte final en `sr-only`).
- **Animations réduites** (`prefers-reduced-motion`) : le texte final s'affiche tout de suite, sans animation.
- **Données** : le texte saisi passe par la vérification des données à l'enregistrement de l'étape. Une adresse e-mail ou un numéro détecté est signalé comme sur une capture.

### 3.4 Animation de défilement (L25-05)
- **Réglages** : Direction (Vers le bas / Vers le haut), Distance en px (calculée depuis la capture pleine page, modifiable), Durée (0,6 s, 1,2 s, 2 s), « Prévisualiser l'animation ».
- **Canevas** : flèche de défilement et repère de la position d'arrivée.
- **Lecture** : la capture pleine page défile, puis la bulle s'affiche sur la position d'arrivée.
- **Animations réduites** : saut direct à la position d'arrivée.
- **Sans capture pleine page** (anciennes captures) : l'option Défilement est désactivée, avec l'aide « Recapturez l'étape pour animer le défilement ».

### 3.5 Étape capturée dans un autre onglet (L25-06)
- **Canevas** : la barre du navigateur montre les onglets. L'onglet de l'étape est actif (« Aide »), le précédent est visible à côté.
- **Panneau** :
  - section « Onglet de la capture » : radios Onglet 1 et Onglet 2, avec leurs titres ;
  - aide « Capturée dans un deuxième onglet : la barre du navigateur montre le passage d'un onglet à l'autre. » ;
  - interrupteur « Afficher les onglets dans le cadre ».
- **Liste des étapes** : une étape qui change d'onglet porte une puce « Onglet 2 » sous son titre.
- **Lecture** : le changement d'onglet est animé (l'onglet s'active), puis la capture change. Un `aria-live` annonce « Nouvel onglet : {{titre}} ».

## 4. Éditeur : données et styles (L25-07 à L25-10)

### 4.1 Styles en masse (L25-07)
- **Sélection multiple** (étape HTML) :
  - Maj + clic ajoute ou retire un élément. Chaque élément sélectionné a le contour de 2 px #2897D5 ;
  - « Sélectionner les semblables (n) » prend tous les éléments du même sélecteur court sur la page ;
  - le fil du sélecteur affiche « n éléments {{sélecteur}} ».
- **Panneau « n éléments sélectionnés »** :
  - Couleur du texte : la nuance de contraste est calculée sur le fond de chaque élément. On affiche la plus faible (« Contraste sur le fond : 7,1:1 »), avec l'alerte existante sous 4,5:1 ;
  - Taille, Graisse, Fond : valeur « Inchangée » par défaut ;
  - « Appliquer » : Cette étape / Toutes les étapes (n).
- **Règles** :
  - seules les propriétés modifiées sont appliquées ;
  - c'est **une seule ligne** dans « Modifications de l'étape », annulable en une fois (« Style · 3 éléments b.value ») ;
  - sur une étape capture (image), la sélection multiple ne s'applique pas : seuls les hotspots, flous et bulles se sélectionnent ensemble pour l'alignement.

### 4.2 Graphique modifiable (L25-08)
- **Reconnaissance** : graphiques en barres, en courbe ou en anneau rendus en HTML ou en SVG simple (`rect`, `path`, `circle` avec texte de valeur). Un graphique en canvas reste non modifiable (règle L20 §3).
- **Panneau « Graphique · {{titre}} »** :
  - Type : Barres / Courbe / Anneau ;
  - tableau de valeurs (Libellé, Valeur, bouton nommé « Supprimer la ligne n ») ;
  - « Ajouter une ligne », jusqu'à 12 lignes ;
  - « Depuis un jeu de données » (§4.3).
- **Rendu** :
  - le graphique est redessiné avec les couleurs détectées dans la capture ;
  - **les valeurs sont toujours écrites** sur le graphique ;
  - `role="img"` et `aria-label` qui énumère les valeurs.
- **Erreurs** : une valeur non numérique est signalée sur la cellule (« Saisissez un nombre »). La ligne n'est pas appliquée.

### 4.3 Jeu de données CSV (L25-09)
- **Modale « Jeu de données »** (`modal-lg`), ouverte depuis le graphique ou depuis Réglages > « Jeu de données » :
  - fichier : nom, nombre de lignes et de colonnes, séparateur et encodage détectés, bouton « Remplacer » ;
  - aperçu des 3 premières lignes ;
  - **« Relier les colonnes »** : une ligne par colonne, vers un élément de l'étape (`b.value`), un graphique ou une variable (`{{team}}`) ;
  - **« Ligne utilisée »** : « Selon le lien personnalisé (colonne = {{variable}}) » ou « Toujours la ligne 1 ». Sans correspondance, les valeurs de la capture restent ;
  - alerte info : « Données fictives ou agrégées uniquement : un jeu de données ne doit contenir ni nom, ni e-mail, ni identifiant de personne. 1 000 lignes et 500 Ko au plus. »
- **Contrôle à l'import** :
  - une colonne dont les valeurs ressemblent à des e-mails, des téléphones ou des identifiants est **refusée** (même détection que F1 §1), avec l'erreur « La colonne « {{nom}} » contient des données personnelles : retirez-la du fichier. » ;
  - CSV seulement (UTF-8 ou Windows-1252, séparateur virgule ou point-virgule détecté).
- **Lien avec L25-13** : chaque lien personnalisé peut choisir sa ligne (§6.1).

### 4.4 Embranchement conditionnel (L25-10)
- **Panneau Étape, section « Suite de l'étape »**. Elle étend les règles de suite de L22-09 aux variables.
- **Règle** :
  - « Si » : critère (Variable `{{…}}`, Réponse à l'étape n, Score du quiz, Variante A/B), opérateur (est, n'est pas, contient, moins de, plus de), valeur ;
  - « Alors aller à » : étape ou chapitre ;
  - bouton nommé « Supprimer la règle n ».
- **« Sinon, aller à »** : toujours présent, « Étape suivante (n) » par défaut.
- **« Ajouter une règle »** : jusqu'à 8 règles.
- **Lecture** : les règles sont lues dans l'ordre, la première qui correspond s'applique. Une variable absente compte comme vide.
- **Contrôles dans l'éditeur** :
  - une règle sans destination est signalée en erreur et bloque la publication ;
  - une boucle sans sortie (A → B → A sans autre chemin) affiche une alerte warning « Ce parcours peut tourner en rond ». La publication n'est pas bloquée ;
  - le plan des étapes (rail) montre une flèche secondaire vers chaque destination.

## 5. Export MP4 (L25-11, L25-12)

- **La carte « Vidéo MP4 »** de la modale L15 devient active. « Hors ligne (.zip) » reste « Bientôt ».
- **Options** :
  - **Vitesse** : les mêmes que le GIF ;
  - **Format de l'image** : 16:9 1 920 × 1 080 (recommandé), 16:9 1 280 × 720, 1:1 1 080 × 1 080, 9:16 1 080 × 1 920 (proposé par défaut pour une démo mobile) ;
  - **Étapes** ;
  - **Contenu** : Bulle de l'étape, Curseur et animation de clic, Zooms de l'éditeur, Écran de titre (titre et logo, 3 s) ;
  - **Sous-titres** : Fichier .vtt à part (recommandé, par défaut), Incrustés dans l'image, Aucun. L'aide rappelle qu'une vidéo sans son ni sous-titres n'est pas accessible.
- **Ligne d'aide** : la durée **calculée** (étapes × vitesse, plus l'écran de titre), jamais estimée, et « son des étapes vidéo seulement ».
- **Production** :
  - rendu dans le navigateur (WebCodecs, H.264 et AAC dans un conteneur MP4), comme le PDF et le GIF ;
  - les animations de L25-04 et L25-05 sont jouées ;
  - les étapes vidéo (L21) gardent leur son et leurs coupes ;
  - **sans WebCodecs** : la carte reste visible, désactivée, avec l'aide « Votre navigateur ne permet pas de créer une vidéo. Utilisez une version récente de Chrome, Edge ou Firefox. »
- **En cours (L25-12)** : étapes « Préparation des captures », « Rendu des images (étape n / N) », « Encodage de la vidéo », « Sous-titres (.vtt) », barre `progressbar` et « Annuler l'export ».
- **Prêt** : deux lignes de fichier, `.mp4` (durée, taille de l'image, poids réel) et `.fr.vtt` (nombre de répliques), avec l'aide « Joignez toujours le fichier .vtt à la vidéo. »
- **Règles** : zones floutées conservées ; commentaires internes et étapes formulaire jamais exportés ; 10 minutes au plus. Au-delà, l'erreur L15-05 propose de réduire les étapes.

## 6. Page personnalisée par lien (L25-13 à L25-15)

### 6.1 Création (L25-13)
- **Liste** : nouvelle colonne « Page », avec le badge « Personnalisée » (succès) ou « Démo seule ».
- **Modale « Nouveau lien personnalisé »** (`modal-lg`), avec une section « Page personnalisée » sur fond `surface-sunken` :
  - interrupteur, **activé par défaut si la page publique (L19b) est active**. Sinon il est désactivé, avec le lien « Activer la page publique » ;
  - **Titre** (90 caractères) : variables acceptées. L'aperçu calculé est écrit sous le champ. Une variable vide est retirée avec ses mots de liaison ; si le titre devient vide, le titre de la démo s'affiche ;
  - **Message** (400 caractères, compteur), facultatif ;
  - **Signé par** : un membre du workspace (nom et initiales, ou photo de profil), ou « Sans signature ». **Jamais l'e-mail** ;
  - **Ligne du jeu de données** : si la démo en a un (§4.3) ;
  - **Texte du bouton** et **Lien du bouton** : par défaut ceux de la page publique. `https://` obligatoire ;
  - l'adresse est créée à l'enregistrement : `/p/{{slug}}/{{code}}`, avec un code aléatoire de 12 caractères, non devinable.
- **Champ `{{email}}`** : l'aide dit « Sert à relier les vues et le lead à ce contact. Jamais affichée sur la page ni dans la démo. »

### 6.2 La page (L25-14)
- **Même gabarit que L19b**. Changements :
  - badge « Préparée pour {{company}} » (icône `users`), sans le badge si la variable est vide ;
  - `h1` : le titre calculé ;
  - carte message : avatar (initiales sur #2F5DB8, texte blanc 6,2:1), message, « {{nom}} · {{workspace}} » ;
  - carte d'action : titre et bouton du lien ;
  - mention sous le pied : « Page préparée pour vous, non référencée. Votre visite est visible par {{workspace}}. » (icône `lock`). Elle informe le destinataire, conformément au RGPD.
- **Lecteur** : variables du lien préremplies, ligne du jeu de données appliquée.
- **SEO** : `noindex, nofollow` toujours. `Referrer-Policy: no-referrer`, pour ne pas faire fuiter le code. Pas d'Open Graph personnalisé : l'aperçu reste celui de la démo.
- **Mobile** : comme L19b-04. Le titre passe à 30 px.

### 6.3 Lien inactif (L25-15)
- **Cas** : lien expiré ou désactivé.
- **Contenu** : icône `clock`, `h1` « Ce lien n'est plus actif », puis « Il a expiré ou a été désactivé. Demandez une nouvelle adresse à la personne qui vous l'a envoyé. »
- **Bouton « Voir la démo publique »** : seulement si la page publique est active. Sinon, pas de bouton.
- **Code inconnu** : la page L19b-05 « Cette page n'est pas disponible », pour ne pas révéler qu'un lien a existé.

## 7. Accessibilité

- **Animations** (saisie, défilement, onglet) : respect de `prefers-reduced-motion`. Le texte final est toujours présent pour les lecteurs d'écran.
- **Recadrage** : poignées focalisables, nommées (« Poignée haut gauche »), pilotables aux flèches. Les dimensions sont annoncées en `aria-live="polite"`.
- **Sélection multiple** : Maj + Entrée ajoute l'élément focalisé à la sélection. Le nombre d'éléments est annoncé.
- **Tableaux** (valeurs, aperçu CSV, correspondances) : `caption`, en-têtes `th scope`, champs nommés ligne par ligne.
- **Règles** : chaque règle est un `group` nommé (« Règle n »), et ses selects sont nommés.
- **MP4** : sous-titres `.vtt` par défaut.
- **Page personnalisée** : un seul `h1` ; avatar décoratif (`aria-hidden`), le nom étant écrit à côté.

## 8. Vague B : cartes « Bientôt » (VB-01 à VB-03)

**Règle commune** : une fonction indisponible garde son entrée avec le badge « Bientôt », jamais « V2 » et jamais supprimée. La carte à venir suit `refonte/vague-b.html` :
- bordure pointillée ;
- badge `clock` « Bientôt disponible » ;
- liste de ce que fera la fonction ;
- bouton désactivé ;
- encadré « Pourquoi et en attendant ».

- **VB-01 · Assistance IA** :
  - dans l'éditeur, une entrée « Assistance IA » (icône `wand`) dans le menu ⋯ de l'étape et dans le panneau du texte de bulle. Elle porte le badge « Bientôt » et ouvre la page « Fonctions à venir » à l'onglet IA. L'entrée existante « Rédiger les textes (assistant) » prend le badge « Bientôt » à la place de « V2 » ;
  - page « Fonctions à venir » (Paramètres > Fonctions à venir, et lien depuis chaque entrée « Bientôt ») : onglets Assistance IA, CRM et e-mailing, Connexion unique ;
  - bandeau en tête de l'onglet IA : « Aucune donnée n'est envoyée à un service d'IA. »
- **VB-02 · CRM et e-mailing** : la carte CRM existe déjà (L23-01). Il faut ajouter :
  - la carte « Outils d'e-mailing » dans Intégrations, avec l'encadré « En attendant : webhooks » et le lien vers Webhooks ;
  - le même onglet sur la page « Fonctions à venir ».
- **VB-03 · Connexion unique** : carte « Connexion unique (SSO / SAML) » dans Paramètres > Sécurité :
  - liste « SAML 2.0, provisionnement des comptes (SCIM), connexion obligatoire par SSO » ;
  - champ « URL des métadonnées du fournisseur » désactivé ;
  - encadré « En attendant : invitation par e-mail et domaines autorisés ».
- **Gabarit des maquettes** : le badge « V2 » de « Démo centers » est retiré de la barre latérale (fonction livrée, L14 et L20-03).

## 9. Hors périmètre

- Recadrage d'une vidéo, ou résolution au-delà des tailles prédéfinies.
- Capture d'onglets non ouverts par l'onglet capturé.
- Graphiques en canvas ; jeux de données au-delà de 1 000 lignes ; connexion à une source en direct (API, tableur en ligne).
- Conditions imbriquées (ET dans OU) dans les règles de suite.
- Export MP4 côté serveur ; musique ; voix de synthèse (« Bientôt », L21).
- Pages personnalisées sans page publique active ; domaine personnalisé (« Bientôt », L19b).
