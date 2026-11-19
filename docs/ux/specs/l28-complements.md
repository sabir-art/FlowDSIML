# L28 : compléments (adresse personnalisée, voix off, redimensionnement, image d'un élément HTML, notifications, compte)

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
| L28-04 | Redimensionner les écrans après capture | Éditeur > Réglages > « Taille des écrans » |
| L28-05 | Image d'un élément HTML | Éditeur, étape HTML, élément sélectionné |
| L28-06 | Notifications : réponse et résolution, préférences | Cloche, panneau Préférences |
| L28-07 | Exporter mes données | Paramètres > Mon profil > « Mes données » |
| L28-08 | Supprimer mon compte : blocage, confirmation | Paramètres > Mon profil > « Mes données » |

## 2. Adresse personnalisée d'un lien (L28-01)

Ce lot active le champ, aujourd'hui en « Bientôt ». Il reprend A1 §2, adapté aux adresses actuelles.

- **Forme** : `https://demos.<domaine>/#/d/<adresse>`. Le préfixe est affiché en mono, non modifiable. L'adresse est saisie à droite.
- **Valeur par défaut** : l'identifiant de la démo, qui reste valable dans tous les cas : `#/d/<id>` fonctionne toujours.
- **Règles de saisie** : les mêmes que pour le centre de formation (L14), avec les mêmes textes.
  - De 3 à 48 caractères : lettres minuscules, chiffres et tirets, sans tiret au début ni à la fin.
  - L'adresse doit être unique sur tout le domaine.
  - Les mots réservés sont refusés : `d`, `e`, `p`, `t`, `embed`, `api`, `admin`.
- **Vérification** :
  - elle se lance à la frappe, après 400 ms de pause ;
  - pendant la vérification : « Vérification de l'adresse… » ;
  - si elle réussit : « Adresse disponible. » ;
  - sinon : « Cette adresse est déjà prise. » ou le message de format.
  - Les messages sont annoncés en `role="status"`. Une erreur passe en `role="alert"`.
- **Enregistrer** : bouton « Enregistrer l'adresse », actif seulement si l'adresse est valide et disponible.
  - Toast : « Adresse enregistrée. ».
  - Le champ « Lien public » et le bouton « Copier » prennent la nouvelle adresse.
- **Changer une adresse déjà enregistrée** : l'ancienne redirige vers la démo pendant 90 jours. Le texte d'aide permanent devient « L'ancienne adresse redirige vers la démo pendant 90 jours. ». Il remplace « Changer l'adresse casse les anciens liens. ».
  - Si la redirection n'est pas faite, garder l'ancien texte : la règle « pas de texte faux » s'applique.
- **Droits** : éditeur et plus. Un lecteur voit l'adresse, sans champ.
- **Liens existants** : les liens personnalisés, les intégrations et les paquets SCORM utilisent l'identifiant. Ils ne changent pas.

## 3. Voix off après coup (L28-02, L28-03)

Il s'agit d'ajouter une voix enregistrée sur une étape déjà capturée : image ou HTML, pas seulement vidéo. La voix de synthèse et la transcription automatique restent en « Bientôt » (L21).

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

## 4. Redimensionner les écrans après capture (L28-04)

Le cas visé : des captures faites à des tailles différentes, ou trop grandes pour la diffusion.

- **Emplacement** : onglet Réglages, section « Taille des écrans ».
- **État initial** :
  - la section liste les tailles trouvées dans la démo, par exemple « 1 920 × 1 080 · 6 étapes » et « 1 440 × 900 · 2 étapes » ;
  - si une seule taille est trouvée : « Toutes les étapes font 1 440 × 900. ».
- **Réglage** :
  - « Largeur cible », avec les choix « Garder la taille d'origine » (par défaut), « 1 280 px », « 1 440 px » et « 1 920 px » ;
  - « Ajustement », avec deux boutons radio : « Adapter (bandes de la couleur de fond) » et « Remplir (recadrer au centre) ».
- **Aperçu** : avant d'appliquer, deux vignettes côte à côte, avant et après, sur l'étape sélectionnée.
- **Appliquer** :
  - bouton « Appliquer à toutes les étapes » ;
  - une modale de confirmation affiche « {{n}} étapes seront redimensionnées. Les points, bulles et zones de flou gardent leur place. Les images d'origine sont conservées. » ;
  - toast : « {{n}} étapes redimensionnées. », avec « Annuler » ;
  - puis le lien « Revenir aux tailles d'origine » reste disponible dans la section.
- **Positions** : les hotspots, flous et zooms sont en coordonnées relatives. En mode « Remplir », un élément qui sort du cadre est signalé avant d'appliquer : « Étape {{n}} : le point sort du cadre. ».
- **Étapes HTML** : elles sont rendues à la largeur cible (A8), sans recadrage.
- **Hors périmètre** : le recadrage d'une seule étape existe déjà (outil Recadrer, L25).

## 5. Image d'un élément HTML (L28-05)

Dans une étape HTML (A8), on peut produire une image d'un seul élément : un tableau, une carte ou un formulaire.

- **Déclencheur** : élément sélectionné sur le canevas (contour existant), puis menu contextuel ou bouton « Image de l'élément » (icône `image-down`) dans la barre d'outils. Le bouton est désactivé tant qu'aucun élément n'est sélectionné.
- **Panneau** :
  - aperçu de l'image ;
  - « Marge autour » : 0, 8, 16 ou 24 px (par défaut 16) ;
  - « Fond » : celui de la page ou transparent ;
  - échelle « 1× » ou « 2× » (par défaut 2×).
- **Actions** :
  - « Créer une étape image » insère une étape image après l'étape courante, dans le même chapitre. Toast : « Étape image créée après l'étape {{n}}. » ;
  - « Télécharger en PNG » produit le fichier `{{demo}}-etape-{{n}}-element.png`.
- **Données personnelles** : l'image est produite à partir du DOM stocké. Les textes floutés y sont donc déjà remplacés (A8). L'étape créée compte comme capture vérifiée, pas comme image importée.
- **Limite** : l'élément doit faire au moins 24 × 24 px. Sinon : « Élément trop petit pour une image. ».

## 6. Notifications de commentaires (L28-06)

La cloche, les mentions et les préférences existent (A6). Ce lot ajoute ou fixe les points suivants :

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

- **Emplacement** : Paramètres > Mon profil, nouvelle carte « Mes données », en bas de la page.

### 7.1 Exporter mes données (L28-07)
- **Contenu du texte** : « Un fichier .zip avec vos données personnelles : profil, espaces et rôles, commentaires, notifications, préférences et confirmations de publication. Les démos appartiennent à l'espace : elles ne sont pas incluses. »
  - Le texte liste exactement ce que contient le fichier, rien de plus.
- **Préparation** :
  - bouton « Préparer l'export » ;
  - pendant la préparation : « Préparation en cours… », avec une barre indéterminée ;
  - la page reste utilisable.
- **Prêt** :
  - carte fichier avec le nom `mes-donnees-{{date}}.zip`, le poids et « Télécharger » ;
  - aide : « Disponible 7 jours, ici seulement. » ;
  - aucun e-mail n'est envoyé.
- **Format** : un fichier JSON par catégorie, plus un `LISEZMOI.txt` qui décrit chaque fichier en français.

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
  - **Champs** : mot de passe actuel, plus une case « Je comprends que cette action est définitive. »
  - **Bouton** : « Supprimer mon compte » (`fd-btn--danger`), actif quand les deux sont remplis.
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
- Redimensionnement d'une seule étape à une taille différente des autres.
