# L27 : marque et styles de l'espace, règles de partage

> Fonctions du tracker : **120 Theme management** et **123 Flexible & secure rules (Enterprise)**.
> S'appuie sur :
> - L18 §4 (styles prédéfinis, « Enregistrer le style actuel ») ;
> - L11 (modes d'accès d'une démo) ;
> - L14 §4 (invitation et domaine e-mail en « Bientôt » tant que l'envoi d'e-mails n'est pas branché).
>
> Composants : ceux du design system (`fd-card`, `fd-field`, `fd-btn`, `fd-badge`, `fd-modal`, `fd-toast`), icônes Lucide. Aucune nouvelle couleur.
> Données des captures : workspace « Acme », membres « Camille Fictive » et « Alice Exemple », domaines `.example`.

## 1. États et codes

| Code | État |
|---|---|
| L27-01 | Paramètres > Marque, propriétaire ou admin : logo, couleurs, style par défaut, styles de l'espace |
| L27-02 | Modale « Modifier le style » (création, duplication, modification) |
| L27-03 | Changer le style par défaut : confirmation |
| L27-04 | Supprimer un style : confirmation, et refus pour le style par défaut |
| L27-05 | Paramètres > Marque, éditeur : lecture seule, avec création de style |
| L27-06 | Paramètres > Sécurité > « Règles de partage » (Enterprise) |
| L27-07 | Enregistrer une règle plus stricte : liens existants non conformes |
| L27-08 | Partager, avec une règle active : mode interdit désactivé et expliqué |
| L27-09 | Dossier > « Accès » : dossier restreint à des membres choisis |
| L27-10 | Règles de partage, plan inférieur à Enterprise |

## 2. Droits

| Action | Propriétaire, admin | Éditeur | Lecteur |
|---|---|---|---|
| Logo, couleurs de la marque | Oui | Lecture | Pas d'accès à Paramètres |
| Choisir le style par défaut | Oui | Lecture | — |
| Créer un style (« Nouveau style », « Dupliquer », L18 « Enregistrer le style actuel ») | Oui | Oui | — |
| Renommer ou modifier un style | Oui, tous | Seulement les styles qu'il a créés | — |
| Supprimer un style | Oui | Non | — |
| Règles de partage, accès aux dossiers | Oui | Lecture des règles, dans Partager | — |

Les droits sont vérifiés côté serveur, comme pour l'écriture du logo dans le bucket `branding`. Masquer un bouton ne suffit pas.

## 3. Paramètres > Marque (L27-01)

La page a trois cartes, dans cet ordre.

### 3.1 Logo
- L'aperçu du logo est affiché sur deux fonds côte à côte, clair et sombre (64 px de haut), suivi de « Remplacer » et « Retirer ».
- Formats : PNG, JPEG, WebP ou SVG, 2 Mo au plus. Ce sont les limites du bucket `branding`.
- Erreurs, sous le champ, en `role="alert"` :
  - « Ce format n'est pas accepté. Choisissez un fichier PNG, JPEG, WebP ou SVG. » ;
  - « Le fichier dépasse 2 Mo. ».
- Sans logo, l'état vide affiche l'icône Lucide `image` et le texte « Aucun logo. Le nom de l'espace est affiché à la place. ».

### 3.2 Couleurs de la marque
- Deux champs couleur, chacun avec une pastille et une saisie hexadécimale :
  - « Couleur principale » ;
  - « Couleur d'accent ».
- Sous chaque champ, le contraste est calculé en direct : contraste de la couleur avec le blanc, et du texte choisi sur la couleur.
  - Si un contraste passe sous 4,5:1, l'alerte existante de L18 s'affiche, avec la couleur proposée et « Utiliser cette couleur ».
- Ces couleurs servent au centre de formation, aux pages publiques et au logo de l'en-tête. Elles ne changent pas les styles des démos : ceux-ci ont leurs propres couleurs (§3.3).

### 3.3 Styles des démos
- **En-tête de la carte** : « Styles des démos », puis le texte « Le style par défaut s'applique aux démos qui n'ont pas choisi de style dans l'onglet Design. ».
- **Grille** : les mêmes cartes que dans l'onglet Design (L18 §4), sur 3 colonnes à 1 440 px, 2 à 1 024 px et 1 à 390 px.
  - **Section « Styles livrés »** : les 6 styles. Ils ne sont ni modifiables ni supprimables. Leur menu ⋯ contient « Dupliquer » et « Définir par défaut ».
  - **Section « Styles de l'espace »** : les styles créés, avec leur auteur en petit (« Créé par Camille Fictive »). Leur menu ⋯ contient « Modifier », « Renommer », « Dupliquer », « Définir par défaut » et « Supprimer ».
  - **État vide de la section** : « Aucun style de l'espace. Dupliquez un style livré ou enregistrez le style d'une démo depuis l'onglet Design. »
- **Style par défaut** :
  - il porte le badge « Par défaut » ;
  - sa bordure fait 2 px, dans la couleur principale de l'interface ;
  - il a `aria-current="true"`.
- **Bouton « Nouveau style »** (`fd-btn--secondary`, icône `plus`) : il ouvre la modale L27-02, préremplie avec le style par défaut.
- **Renommer** : édition en place du nom, 40 caractères au plus.
  - « Entrée » valide, « Échap » annule.
  - Un nom déjà pris donne l'erreur « Un style porte déjà ce nom. ».

### 3.4 Modale « Modifier le style » (L27-02)
- **Titre** : « Nouveau style », « Dupliquer « {{nom}} » » ou « Modifier « {{nom}} » ».
- **Disposition** :
  - à gauche, les champs ;
  - à droite, un aperçu en direct : une étape d'exemple avec sa bulle, son bouton, sa pastille de hotspot et son fond. Les données sont fictives.
- **Champs** : ce sont exactement ceux de l'onglet Design, sans en ajouter.
  - Nom (obligatoire, 40 caractères).
  - Couleur principale.
  - Fond de la bulle et texte de la bulle.
  - Fond du bouton et texte du bouton.
  - Pastille du hotspot.
  - Arrondi.
  - Police.
- **Contrastes** : bulle et bouton à 4,5:1 au moins, pastille à 3:1 au moins sur le fond.
  - Tant qu'un seuil n'est pas atteint, « Enregistrer » reste actif, mais l'alerte s'affiche avec la couleur proposée.
  - Un style sous le seuil reçoit le badge « Contraste insuffisant » dans la grille.
- **Pied** : « Annuler » et « Enregistrer » (`fd-btn--primary`).
- **Toast** : « Style « {{nom}} » enregistré. ».
- **Modifier un style déjà appliqué à des démos** :
  - **Comportement par défaut** (L18) : appliquer un style copie ses valeurs dans la démo. Le texte d'aide de la modale est alors : « Les démos qui ont appliqué ce style gardent leur apparence. Le style modifié s'appliquera aux prochaines démos qui le choisissent. ».
  - **Si le développeur relie les démos à leur style** : le texte devient « {{n}} démos utilisent ce style et changeront d'apparence. ».
  - Le texte affiché doit décrire le comportement réel (règle « pas de texte faux »).

### 3.5 Changer le style par défaut (L27-03)
- **Déclencheur** : « Définir par défaut ». Une modale de confirmation s'ouvre :
  - **Titre** : « Utiliser « {{nom}} » par défaut ? »
  - **Texte** : « Les démos sans style choisi dans l'onglet Design prendront ce style. Les démos publiées changent d'apparence à leur prochaine publication. »
    - Adapter la deuxième phrase si la version publiée lit le style en direct : « Les démos publiées changent d'apparence tout de suite. »
  - **Compteur**, s'il est disponible : « {{n}} démos sont concernées. » Si le nombre n'est pas connu, la ligne est omise.
  - **Boutons** : « Annuler » et « Utiliser par défaut ».
- **Toast** : « « {{nom}} » est le style par défaut. »

### 3.6 Supprimer un style (L27-04)
- **Style par défaut** : « Supprimer » est désactivé (`aria-disabled`) et porte l'infobulle « Choisissez d'abord un autre style par défaut. »
- **Autre style** : une modale de confirmation s'ouvre.
  - **Titre** : « Supprimer « {{nom}} » ? »
  - **Texte** : « Les démos qui l'ont appliqué gardent leur apparence. Le style disparaît de la liste pour tout l'espace. »
  - **Bouton** : « Supprimer » (`fd-btn--danger`).
- **Toast** : « Style supprimé. », avec « Annuler » pendant 8 s.

### 3.7 Éditeur (L27-05)
- **Bandeau d'information** en tête de page : « Seuls les propriétaires et administrateurs modifient la marque et le style par défaut. »
- **Logo et couleurs** : affichés en lecture seule. Aucun champ actif.
- **Styles** :
  - « Nouveau style » et « Dupliquer » restent actifs ;
  - le menu ⋯ d'un style créé par l'éditeur contient « Modifier » et « Renommer » ;
  - les styles des autres membres n'ont que « Dupliquer » ;
  - « Définir par défaut » et « Supprimer » sont absents de ce menu, parce qu'ils relèvent du rôle et non d'une fonction indisponible.

## 4. Règles de partage (Enterprise)

### 4.1 Où
- **Paramètres > Sécurité** : nouvelle carte « Règles de partage », placée au-dessus de la carte « Connexion unique », qui reste en « Bientôt » (VB-03).
- **Dossier, menu ⋯ > « Accès »** : accès restreint par dossier (§4.5).

### 4.2 Contenu de la carte (L27-06)
Chaque règle est une ligne composée de :
- un libellé ;
- une phrase d'explication ;
- un contrôle.

« Enregistrer les règles » s'active dès qu'une valeur change. Les règles sont les suivantes :

1. **Modes d'accès autorisés** : cases à cocher.
   - **« Lien public »** et **« Mot de passe »** : cochés par défaut.
   - **« Invitation »** et **« Domaine e-mail »** : visibles, désactivés, avec le badge « Bientôt » tant que l'envoi d'e-mails n'est pas branché (L14 §4).
   - **Garde-fou** : il doit rester au moins un mode coché. Sinon, l'erreur « Gardez au moins un mode d'accès. » s'affiche.
2. **Durée maximale des liens** : liste avec « Aucune limite », « 7 jours », « 30 jours » et « 90 jours ».
   - Avec une limite, tout nouveau lien ou lien personnalisé reçoit une expiration au plus égale à cette durée.
   - Le choix « Jamais » de Partager est désactivé.
3. **Qui peut publier et diffuser** : boutons radio, avec « Éditeurs, administrateurs et propriétaires » (par défaut) ou « Administrateurs et propriétaires seulement ».
   - « Diffuser » regroupe le paquet SCORM, l'intégration dans l'intranet, la page publique et les exports HTML et MP4.
4. **Téléchargement des exports** : interrupteur « Autoriser les exports hors de TutoClick (SCORM, HTML, MP4, PDF) », activé par défaut.
   - Désactivé, il désactive ces exports pour tous les rôles. Les diffusions existantes restent en ligne.

**Pied de la carte** : « Ces règles s'appliquent à tout l'espace. Les administrateurs et propriétaires les voient ici ; les éditeurs les voient dans Partager. »

### 4.3 Règle plus stricte et liens existants (L27-07)
- **Déclencheur** : à l'enregistrement, des liens actifs ne respectent plus une règle. Par exemple, « Lien public » est décoché alors que des démos sont publiques, ou une durée maximale est choisie alors que des liens n'expirent jamais.
- **Modale** :
  - **Titre** : « {{n}} liens ne respectent pas ces règles »
  - **Liste** : 5 liens au plus (démo et type de lien), puis « et {{m}} autres ».
  - **Choix** (radio) :
    - « Les mettre en conformité maintenant ». Effet : passage en mot de passe obligatoire avant le prochain accès, ou expiration ramenée à la limite.
    - « Garder les liens existants, appliquer les règles aux nouveaux liens ».
  - **Boutons** : « Annuler » et « Enregistrer les règles ».
- **Cas particulier** : si le passage au mot de passe exige un mot de passe que la démo n'a pas, la démo devient non accessible jusqu'à ce qu'un mot de passe soit défini.
  - L'explication l'annonce : « Ces démos ne seront plus accessibles tant qu'un mot de passe n'est pas défini. »
  - Ces démos apparaissent dans la liste Démos avec le badge « Accès à régler ».

### 4.4 Effet dans Partager (L27-08)
- **Mode interdit** : il reste visible mais désactivé, avec la mention « Désactivé par les règles de l'espace. » et le lien « Voir les règles » (vers Paramètres > Sécurité, pour les administrateurs seulement).
  - Ne pas le masquer : l'utilisateur doit comprendre pourquoi il ne peut pas le choisir.
- **Durée limitée** : l'expiration est préremplie à la limite, avec le texte « Durée maximale fixée par l'espace : {{n}} jours. ».
- **Publication réservée** : pour un éditeur, si la publication est réservée, « Publier » est désactivé avec l'infobulle « Seuls les administrateurs et propriétaires publient dans cet espace. ».
  - « Demander la publication » n'existe pas : rien n'est proposé à la place.

### 4.5 Accès par dossier (L27-09)
- **Menu ⋯ d'un dossier > « Accès »**, réservé aux administrateurs et propriétaires. La modale « Accès au dossier « {{nom}} » » propose deux choix (radio) :
  - « Tout l'espace » (par défaut) ;
  - « Membres choisis » : une liste des membres avec cases à cocher, recherche, avatar, nom et rôle.
    - Les administrateurs et propriétaires sont toujours cochés, et désactivés : « Accès toujours ouvert aux administrateurs. ».
- **Signalement d'un dossier restreint** :
  - l'icône Lucide `lock` à côté du nom ;
  - le libellé accessible « Dossier restreint » ;
  - l'infobulle « Visible par {{n}} membres. ».
- **Membre sans accès** : il ne voit ni le dossier ni ses démos, nulle part (liste, recherche, Analytics, Apprenants). Le filtrage se fait côté serveur.
- **Liens déjà partagés** : ils restent valables pour les visiteurs. La restriction porte sur l'espace de travail, pas sur la diffusion.
  - La modale le précise : « Les liens déjà partagés restent valables. Pour les couper, changez l'accès de chaque démo dans Partager. »
- **Démo déplacée vers un dossier restreint** : avant le déplacement, une confirmation affiche « Cette démo ne sera plus visible pour {{n}} membres. »

### 4.6 Plan inférieur à Enterprise (L27-10)
- **Carte « Règles de partage »** : elle reste visible. Ses contrôles affichent les valeurs actuelles, désactivées.
  - Badge « Enterprise » à côté du titre.
  - Lien « Voir les plans ».
  - Ce n'est pas un badge « Bientôt » : la fonction existe, elle dépend du plan.
- **Menu ⋯ d'un dossier** : « Accès » est désactivé, avec le badge « Enterprise ».

## 5. Accessibilité
- Chaque groupe de cases ou de radios est un `fieldset` avec sa `legend`.
- Les contrôles désactivés par une règle ou un plan sont en `aria-disabled="true"`, focalisables, avec leur explication reliée par `aria-describedby`.
- Les erreurs de champ sont en `role="alert"`. Les toasts sont en `role="status"`.
- Dans la modale de style, l'aperçu est en `aria-hidden="true"`. Les valeurs de contraste sont annoncées en texte (« Contraste 5,2:1, conforme »).
- Contrôles : 1 440, 1 024 et 390 px, en clair et en sombre, puis passe clavier complète (Tab, Entrée, Échap dans les modales).

## 6. Hors périmètre
- Rôles personnalisés et droits par démo (en dehors des dossiers).
- Invitation et domaine e-mail actifs : ils dépendent de l'envoi d'e-mails (« Bientôt »).
- Connexion unique et provisionnement des comptes : VB-03, « Bientôt ».
- Journal d'audit des changements de règles.
