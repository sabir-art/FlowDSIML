# L28 : compléments (adresse personnalisée, voix off, format après capture, remplacer une image dans une capture HTML, notifications, compte)

> Version courte : écrans existants plus deltas, sans maquette. Composants du design system, icônes Lucide.
> Données des captures : espace « Acme », membres « Camille Fictive » et « Alice Exemple », domaines `.example`.
> Règles transverses :
> - une fonction indisponible reste visible avec le badge « Bientôt » ;
> - aucun texte ne décrit un comportement qui n'existe pas ;
> - aucun e-mail n'est envoyé tant que l'envoi n'est pas arbitré (canal e-mail en « Bientôt »).

## 1. États et codes

| Code | État | Où |
|---|---|---|
| L28-01 | Adresse personnalisée : saisie, disponibilité, erreur | Partager > Lien |
| L28-02 | Voix off d'une étape : enregistrer, importer, transcription | Éditeur > Étape > « Voix off » |
| L28-03 | Voix off dans le lecteur : activer le son, sous-titres | Lecteur |
| L28-04 | Format de la démo après capture | Éditeur > Réglages > « Format des écrans » |
| L28-05 | Remplacer une image dans une capture HTML | Éditeur, étape HTML, image sélectionnée |
| L28-06 | Notifications : réponse et résolution, préférences | Cloche, panneau Préférences |
| L28-07 | Exporter mes données | Paramètres > Mon profil > « Mes données » |
| L28-08 | Supprimer mon compte : blocage, confirmation | Paramètres > Mon profil > « Mes données » |

## 2. Adresse personnalisée d'un lien (L28-01)

Fonction 082. Elle active le champ « Adresse personnalisée » de Partager > Lien, aujourd'hui en « Bientôt », à la même place. Le format a été arrêté par le chef d'équipe et remplace A1 §2.

- **Forme** : `https://demos.<domaine>/#/l/<partie-lisible>-<suffixe>`.
  - L'utilisateur choisit la partie lisible.
  - Le serveur tire le suffixe : 6 caractères aléatoires en base62.
  - L'adresse est unique sur toute la plateforme et ne contient aucun nom d'espace.
- **Champ** :
  - le préfixe `https://demos.<domaine>/#/l/` est affiché en mono, non modifiable ;
  - la partie lisible est saisie à droite ;
  - elle est suivie de `-xxxxxx` en mono grisé, ou du suffixe réel une fois l'adresse enregistrée.
  - Aide permanente : « Un suffixe de 6 caractères est ajouté à l'enregistrement, pour que l'adresse reste unique. »
- **Valeur proposée** : le titre de la démo converti en adresse, par exemple « Prise en main d'un logiciel » devient `prise-en-main-d-un-logiciel`, tronqué à 48 caractères. Elle n'est enregistrée qu'à la validation.
- **Validation** : à la frappe, sans appel au serveur, avec les règles et les textes de L14.
  - De 3 à 48 caractères : lettres minuscules, chiffres et tirets, sans tiret au début ni à la fin.
  - Les mots réservés sont refusés.
  - Pas de contrôle de disponibilité, et aucun message « déjà prise » : un slug pris ne révèle rien, puisque le suffixe rend l'adresse unique.
  - Les erreurs sont en `role="alert"`.
- **Enregistrer** :
  - bouton « Enregistrer l'adresse », actif dès que le format est valide ;
  - toast : « Adresse enregistrée. » ;
  - « Lien public » et « Copier » prennent l'adresse complète.
- **Changer l'adresse** : un nouveau suffixe est tiré. L'ancienne adresse redirige vers la démo pendant 90 jours. L'aide affiche « L'ancienne adresse redirige vers la démo pendant 90 jours. ».
- **Liens `#/d/<id>`** : ils restent toujours valables. Les liens personnalisés, les intégrations et les paquets SCORM gardent l'identifiant.
- **Droits** : éditeur et plus. Un lecteur voit l'adresse, sans champ.

## 3. Voix off après coup (L28-02, L28-03)

Fonction 035. Il s'agit d'ajouter une voix enregistrée sur une étape déjà capturée : les étapes image, HTML et texte (pop-up). Les étapes vidéo gardent leur voix L21 ; pour elles, la section « Voix off » remplace la piste son de la vidéo. La voix de synthèse et la transcription automatique restent en « Bientôt » (L21).

### 3.1 Éditeur
- **Emplacement** : onglet Étape, nouvelle section « Voix off », placée après « Animation de l'étape ».
- **Section vide** :
  - deux boutons, « Enregistrer » (icône `mic`) et « Importer un fichier » (icône `upload`) ;
  - l'aide « Une piste par étape, 2 minutes au plus. MP3, M4A, WAV ou WebM, 5 Mo au plus. » ;
  - le bouton « Générer à partir du texte », avec le badge « Bientôt ».
- **Enregistrement** :
  - il demande l'accès au micro. En cas de refus : « Le micro est bloqué. Autorisez-le dans les réglages du navigateur, ou importez un fichier. » ;
  - pendant l'enregistrement : pastille rouge, minuteur `0:12 / 2:00`, « Pause », « Terminer » ;
  - à 2:00, l'enregistrement s'arrête seul.
- **Piste présente** :
  - mini-lecteur avec lecture, position et durée ;
  - boutons « Réenregistrer », « Remplacer », et « Supprimer » (avec confirmation) ;
  - option « Lancer la voix à l'arrivée sur l'étape » (activée par défaut).
- **Transcription** (obligatoire pour publier) :
  - champ texte, prérempli avec le texte de la bulle ;
  - aide : « Le texte affiché en sous-titre. Corrigez-le pour qu'il suive la voix. » ;
  - sans transcription, la publication est bloquée par le message de l'infobulle de « Publier » : « Étape {{n}} : la voix off n'a pas de transcription. Aller à l'étape {{n}} ».
- **Liste des étapes** : l'icône `audio-lines` signale les étapes qui ont une voix off.

### 3.2 Lecteur
- **Son coupé au départ** (règle des navigateurs). Au premier écran avec voix, un bouton « Activer le son » (icône `volume-2`) s'affiche dans la barre du lecteur. Il ne bloque rien.
  - Une fois activé, le son reste actif pour la session.
- **Sous-titres** : la transcription s'affiche par défaut sous le canevas, au-dessus de la barre. Le bouton « Sous-titres » (touche C) les masque.
- **Passage à l'étape suivante** : la voix s'arrête. Elle ne bloque jamais le bouton « Suivant ».
- **Hors ligne (SCORM, HTML)** : les pistes sont incluses dans le paquet. Le poids affiché du paquet en tient compte.

## 4. Format de la démo après capture (L28-04)

Fonction 021. Elle s'applique à toute la démo. Le recadrage d'une seule étape existe déjà (L25-02).

- **Emplacement** : onglet Réglages, section « Format des écrans ».
- **Constat** : la section liste les tailles trouvées, par exemple « 1 920 × 1 080 · 6 étapes » et « 1 440 × 900 · 2 étapes ».
- **Format** (boutons radio) :
  - « D'origine » (par défaut) ;
  - « 16:9 » ;
  - « 16:10 » ;
  - « 4:3 » ;
  - « Personnalisé », avec deux champs, largeur et hauteur en pixels, de 640 à 3 840.
- **Ajustement** (boutons radio), si le format choisi n'est pas « D'origine » :
  - « Adapter » : l'image entière est conservée, avec des bandes de la couleur de fond de la démo ;
  - « Recadrer » : l'image remplit le cadre et est recadrée. Le recadrage est centré sur le repère de l'étape s'il y en a un, au centre sinon.
- **Largeur de sortie** : « 1 280 », « 1 440 » ou « 1 920 px ». Par défaut, la plus fréquente parmi les captures.
- **Aperçu** : avant d'appliquer, deux vignettes avant/après de l'étape sélectionnée, avec les flèches pour passer d'une étape à l'autre.
- **Repères, bulles, flous, zooms** :
  - ils sont recalculés pour rester sur le même pixel de l'image ;
  - en « Adapter », ils ne sortent jamais du cadre ;
  - en « Recadrer », un élément qui sort du cadre est listé avant d'appliquer : « Étape {{n}} : le repère sort du cadre. » ou « Étape {{n}} : une zone de flou est coupée. ».
  - Une zone de flou coupée reste appliquée sur la partie visible. Elle n'est jamais supprimée sans le dire.
- **Appliquer** :
  - « Appliquer à toutes les étapes » ouvre une confirmation : « {{n}} étapes passent en {{format}}. Les repères et les flous suivent l'image. Les images d'origine sont conservées. » ;
  - toast : « Format appliqué à {{n}} étapes. », avec « Annuler ».
- **Retour** : le lien « Revenir aux images d'origine » reste disponible dans la section.
- **Étapes HTML** : elles sont rendues dans le nouveau format, sans recadrage (A8).
- **Étapes vidéo** : « Adapter » seulement. L'option « Recadrer » est désactivée pour elles, avec l'aide « Les vidéos ne sont pas recadrées. ».

## 5. Remplacer une image dans une capture HTML (L28-05)

Fonction 051, aujourd'hui en « Bientôt ». Dans une étape HTML (A8), on remplace une image de la page capturée, par exemple un logo réel, une photo ou un graphique, par une autre image.

- **Éléments concernés** : `<img>`, `<picture>`, `<svg>` et tout élément qui a une image de fond (`background-image`).
- **Déclencheur** : on sélectionne l'élément sur le canevas (contour existant). Le panneau de l'élément affiche alors « Remplacer l'image » (icône `image-up`).
  - Sur un autre élément, l'action n'apparaît pas.
- **Choix de la nouvelle image** : fenêtre en deux onglets.
  - « Importer » : PNG, JPEG, WebP ou SVG, 5 Mo au plus.
  - « Médiathèque » : la médiathèque existante (L18-03).
- **Ajustement** : l'image prend la taille de l'élément d'origine. Choix « Ajuster » (par défaut, `object-fit: contain`) ou « Remplir » (`cover`).
- **Résultat** :
  - l'image est remplacée dans le DOM stocké de l'étape. L'image d'origine n'est plus publiée ;
  - toast : « Image remplacée. », avec « Annuler » ;
  - le panneau propose ensuite « Revenir à l'image d'origine ».
- **Données personnelles** :
  - l'image importée compte dans « n images importées non vérifiées » du bilan de publication (REV-07), et l'avertissement d'import s'affiche ;
  - une image de la médiathèque compte de la même façon, sauf si elle y a déjà été vérifiée.
- **Supprimer sans remplacer** : l'action secondaire « Masquer l'image » remplace l'image par un aplat de la couleur de fond, à la même taille.

## 6. Notifications de commentaires (L28-06)

Fonction 122. La cloche, la table `notifications` (mention, comment, reply, resolved) et les préférences existent (A6, L22). Ce qui manque ou est à revoir :

- **Types** : « Mention », « Réponse » (un fil où j'ai écrit), « Commentaire » (sur une démo que j'ai créée) et « Résolu » (mon commentaire est résolu), avec les textes `k_*` existants.
  - Un même événement ne crée qu'une notification par personne. Si je suis mentionné dans une réponse, je reçois seulement « Mention ».
  - Je ne suis jamais notifié de mes propres actions.
- **Réouverture** : la réouverture d'un fil résolu ne notifie personne.
- **Clic** : il ouvre l'éditeur sur l'étape, panneau Commentaires ouvert, fil déplié et mis en évidence 2 s. La notification passe en lue.
  - Commentaire supprimé : « Ce commentaire a été supprimé. », et la notification reste lisible.
- **Filtres** : « Toutes », « Mentions », « Non lues ». Les réponses et résolutions sont dans « Toutes ».
- **Préférences** (panneau existant) :
  - **Interrupteurs** : un par type, activés par défaut. La ligne « Mention » est toujours activée et désactivée (`aria-disabled`), avec l'aide « Les mentions sont toujours signalées. ».
  - **E-mail** : « Recevoir aussi par e-mail » reste visible avec le badge « Bientôt » tant que l'envoi d'e-mails n'est pas arbitré. Le résumé quotidien suit la même règle.
  - **Par démo** : le menu ⋯ d'une notification contient « Couper les notifications de cette démo ». Une démo coupée est listée dans les préférences, avec « Réactiver ».
- **Accessibilité** : une nouvelle notification est annoncée en `aria-live="polite"`, au plus une fois par minute, avec un regroupement (« 2 nouvelles notifications »).

## 7. Mes données (L28-07, L28-08)

Fonctions 171 et 172.

- **Emplacement** : Paramètres > Mon profil, nouvelle carte « Mes données », en bas de la page.

### 7.1 Exporter mes données (L28-07)
- **Contenu du texte** : « Un fichier .zip avec vos données personnelles : profil, espaces et rôles, commentaires, notifications, préférences et confirmations de publication. Les démos appartiennent à l'espace : elles ne sont pas incluses. »
  - Le texte liste exactement ce que contient le fichier, rien de plus.
- **Export** (arbitrage du chef d'équipe : aucune copie conservée sur le serveur) :
  - bouton « Télécharger mes données (.zip) » (icône `download`) ;
  - pendant la génération : le bouton passe en « Préparation du fichier… », désactivé, avec une barre indéterminée ;
  - le fichier `mes-donnees-{{date}}.zip` est ensuite téléchargé directement dans le navigateur ;
  - message en `role="status"` : « Fichier téléchargé. Il n'est pas conservé sur nos serveurs. » ;
  - en cas d'échec : « Le fichier n'a pas pu être préparé. Réessayez. », en `role="alert"` ;
  - aucun e-mail n'est envoyé.
- **Format** : un fichier ZIP qui contient un fichier JSON par catégorie (`profil.json`, `espaces.json`, `commentaires.json`, `notifications.json`, `preferences.json`, `confirmations.json`), plus un `LISEZMOI.txt` qui décrit chaque fichier en français.

### 7.2 Supprimer mon compte (L28-08)
- **Bouton** : « Supprimer mon compte » (`fd-btn--danger`, secondaire), sous l'export.
- **Blocage** : si l'utilisateur est le seul propriétaire d'un espace qui a d'autres membres, la modale le bloque.
  - Titre : « Transférez d'abord vos espaces ».
  - Liste des espaces concernés, chacun avec le lien « Changer le propriétaire » vers Paramètres > Membres de cet espace.
  - Bouton : « Fermer ».
- **Espace dont il est le seul membre** : il est supprimé avec le compte. La modale le dit : « L'espace « {{nom}} » et ses {{n}} démos seront supprimés. »
- **Confirmation** :
  - **Titre** : « Supprimer votre compte ? »
  - **Texte** : « Votre profil et vos préférences sont supprimés. Vos commentaires restent dans les démos, signés « Ancien membre ». Les démos que vous avez créées restent dans leur espace. Cette action est définitive. »
  - **Connexion récente** : la suppression exige une connexion de moins de 5 minutes. Sinon, la modale affiche « Pour votre sécurité, reconnectez-vous avant de supprimer votre compte. » et le bouton « Me reconnecter ». Après la reconnexion, l'utilisateur revient sur cette modale.
  - **Champs** :
    - « Saisissez votre adresse e-mail pour confirmer », avec l'aide « {{email}} » affichée en clair. La valeur doit être identique, sans tenir compte de la casse ;
    - « Mot de passe actuel », seulement si le compte en a un. Les comptes par lien magique n'ont pas ce champ ;
    - la case « Je comprends que cette action est définitive. ».
  - **Bouton** : « Supprimer mon compte » (`fd-btn--danger`), actif quand tous les champs affichés sont remplis et la case cochée.
  - **Erreurs** : « L'adresse ne correspond pas à votre compte. » ; « Mot de passe incorrect. »
- **Après** : déconnexion, puis la page de connexion avec le message « Votre compte a été supprimé. ».
- Si la suppression est différée côté serveur (purge après un délai), le texte doit le dire avec le délai réel. Il ne doit jamais affirmer une suppression immédiate qui n'a pas lieu.

## 8. Accessibilité (commun)
- Les champs ont un libellé visible. Les erreurs sont en `role="alert"`, les états en `role="status"`.
- Enregistrement audio : le minuteur est annoncé toutes les 30 s, sans plus. « Pause » et « Terminer » sont atteignables au clavier.
- Lecteur : « Activer le son » et « Sous-titres » ont un nom accessible. Les sous-titres ont un contraste d'au moins 4,5:1 sur leur fond.
- Contrôles : 1 440, 1 024 et 390 px, en clair et en sombre, puis une passe clavier complète.

## 9. Hors périmètre
- Voix de synthèse, transcription automatique, musique (« Bientôt »).
- Envoi d'e-mails (notifications, résumé, export).
- Domaine personnalisé pour les adresses de démo.
- Format différent pour une seule étape.
- Génération d'une image à partir d'un élément HTML.
