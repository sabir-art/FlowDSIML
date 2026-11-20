# L41 : retours sur l'aide et Console propriétaire

> Besoin client, dans une démarche d'amélioration continue. Aujourd'hui, « Cet article vous a aidé ? » (L26-02) n'alimente qu'un compteur global et anonyme (`help_feedback` : article, oui, non), invisible pour tous.
>
> **Révision du 20 nov. (correction client)** : les retours ne vont **pas** dans les Paramètres de l'espace. Les admins d'espace sont des clients ; ce ne sont pas eux qui font évoluer l'outil. Les retours vont dans une **Console propriétaire** séparée, réservée aux propriétaires de TutoClick (l'équipe qui développe l'outil), hors de tout espace client. Cette version remplace la précédente (bab6260).
>
> Côté client, **seul** le champ « Qu'est-ce qui vous manquait ? » apparaît (§2). Il n'y a ni écran, ni badge, ni export dans les espaces.
> Version courte, sans maquette : composants du design system, icônes Lucide, barres de liste selon L40.
> Données fictives dans les tests : espaces « Acme » et « Globex », adresses `@example.com`.

## 0. Principes

- **Qui voit quoi** :
  - les retours de tous les espaces sont visibles dans la Console propriétaire, et seulement là ;
  - les membres et les admins d'un espace ne voient rien, hormis le champ de commentaire après leur propre « Non ».
- **Anonymat** :
  - la personne qui répond est enregistrée, pour l'anti-abus, la règle d'une réponse par article, et l'export ou la suppression de ses données ;
  - elle n'est **jamais affichée** dans la console ni exportée.
  - Seul le **nom de l'espace** est visible, et uniquement pour le filtre facultatif « Espace ».
- **Compteur global** : le compteur existant (`help_feedback`) peut rester alimenté ou être remplacé par des agrégats calculés sur les nouvelles lignes, au choix du dev. La console affiche les chiffres calculés sur les lignes (§4).
- **Information des utilisateurs** : la politique de confidentialité et le registre mentionnent ce traitement (finalité : améliorer l'aide et l'outil ; conservation des commentaires : 12 mois). Le texte sous le champ le dit en une phrase (§2).

## 1. États et codes

| Code | État | Où |
|---|---|---|
| L41-01 | Après « Non » : champ « Qu'est-ce qui vous manquait ? » | Panneau d'aide, bas d'un article (côté client) |
| L41-02 | Commentaire envoyé, erreur d'envoi, donnée personnelle détectée | Même emplacement |
| L41-03 | Console : accès et cadre | `#/console`, hors espace |
| L41-04 | Console > Retours sur l'aide, onglet Articles | Console |
| L41-05 | Console > Retours sur l'aide, onglet Commentaires | Console |
| L41-06 | Console > Backlog d'amélioration (liste et fiche d'un élément) | Console |
| L41-07 | Export CSV | Console |
| L41-08 | États vides, chargement, erreur | Console |

## 2. Côté client : après « Non » (L41-01, L41-02)

Le comportement de « Oui » ne change pas : « Merci pour votre réponse. ».

Après « Non » :

1. **Le vote est enregistré tout de suite.** Le commentaire est facultatif : si la personne ferme le panneau, le « Non » reste compté.
2. À la place des boutons, le bloc devient :
   - une ligne `role="status"` : « Merci. Qu'est-ce qui vous manquait ? » ;
   - un champ texte multiligne (`fd-input`, 3 lignes), dont le libellé est cette question ;
   - le compteur « 0 / 500 » (500 caractères au plus) ;
   - l'aide, reliée par `aria-describedby` : « Facultatif. N'indiquez aucune donnée personnelle : ni nom, ni e-mail, ni numéro, ni information sur un usager. Votre réponse est lue par l'équipe TutoClick pour améliorer l'aide, sans votre nom. » ;
   - les boutons « Envoyer » (primaire, désactivé si le champ est vide) et « Passer » (ghost), en 40 px.
3. **Focus** : il passe dans le champ juste après « Non ». « Passer » ou Échap ferment le bloc sur « Merci pour votre réponse. ».
4. **Après l'envoi** : « Merci, votre commentaire a été transmis. » (`role="status"`).
5. **Donnée personnelle détectée** :
   - une adresse e-mail ou un numéro de 9 chiffres ou plus (espaces et points ignorés) bloque l'envoi ;
   - message (`role="alert"`) : « Ce texte semble contenir une adresse e-mail ou un numéro. Retirez-le avant d'envoyer. » ;
   - la même vérification est faite côté serveur (`PERSONAL_DATA`).
6. **Erreur d'envoi** : « Votre commentaire n'a pas pu être envoyé. » avec « Réessayer ». Le texte est conservé.
7. **Une réponse par article et par personne** :
   - en revenant sur l'article, la personne voit « Vous avez répondu Non. Changer ma réponse » ;
   - un nouveau vote remplace l'ancien, et un commentaire déjà envoyé reste lié à l'ancien vote ;
   - le `localStorage` actuel est remplacé par la réponse enregistrée.
8. **Contexte enregistré avec le vote** :
   - l'article et la page de l'app où l'aide a été ouverte (`help.page.*`) ;
   - l'espace actif et la date ;
   - **rien d'autre** : pas d'URL, pas d'identifiant de démo.

## 3. Console propriétaire : accès et cadre (L41-03)

- **Qui** : les comptes marqués « propriétaire de la plateforme » (équipe TutoClick).
  - Ce droit ne dépend **d'aucun rôle d'espace**. Être propriétaire d'un espace client ne donne pas accès à la console.
  - Le droit est donné en base par l'équipe, hors de l'app (table `platform_owners`, ou claim `app_metadata`). L'app n'a aucun écran pour l'attribuer.
- **Adresse** : `#/console`, avec les sous-pages `#/console/aide` et `#/console/backlog`. Pour tout autre compte, l'adresse affiche la page « Page introuvable » existante, pour ne pas révéler l'existence de la console.
- **Entrée** :
  - un lien « Console propriétaire » (icône `shield-check`) dans le menu du profil (en bas de la barre latérale), visible seulement pour les propriétaires de la plateforme ;
  - aucune entrée dans la navigation des espaces.
- **Cadre** : un en-tête propre à la console, sans sélecteur d'espace ni barre latérale d'espace.
  - **À gauche** : le logo TutoClick et la mention « Console propriétaire ».
  - **Navigation par onglets** : « Retours sur l'aide », puis « Backlog · {{n à trier}} ».
  - **À droite** : « Retour à l'app ».
  - Fond `bg`, cartes `surface` : le même design system que l'app, pour que la console ne se confonde pas avec un espace client tout en restant dans la charte.
- **Données personnelles** : aucune adresse ni aucun nom d'utilisateur client n'apparaît dans la console, seulement le nom de l'espace.

## 4. Retours sur l'aide (L41-04, L41-05)

### 4.1 En-tête et barre

- **Titre** : « Retours sur l'aide ».
- **Sous-titre** : « Tous les espaces. Les réponses sont anonymes. »
- **Action à droite** : « Exporter (CSV) » (§6).
- **Trois indicateurs** sur la période :
  - « Réponses » ;
  - « Satisfaction », la part de Oui en %, avec « {{oui}} Oui, {{non}} Non » ;
  - « Commentaires nouveaux ».
  - Sans réponse, la valeur est « — ».
- **Barre (L40)** :
  - à gauche : période (segmenté « 30 j », « 90 j », « 12 mois », par défaut 90 j), « Espace : Tous » (facultatif, liste cherchable), « Rubrique : Toutes », Réinitialiser ;
  - à droite : le tri.
- **Onglets** : « Articles » et « Commentaires · {{n nouveaux}} ».

### 4.2 Onglet Articles

Une ligne par article ayant reçu au moins une réponse sur la période.

| Colonne | Contenu |
|---|---|
| Article | Titre (lien « Voir l'article », qui ouvre le panneau d'aide en lecture), avec la rubrique en dessous |
| Oui / Non | Nombres |
| Satisfaction | « {{x}} % », avec une barre de 80 px. La valeur est toujours écrite. |
| Commentaires | « {{n}} », dont « {{m}} nouveaux » ; un clic ouvre l'onglet Commentaires filtré sur l'article |
| Backlog | Nombre d'éléments liés à l'article qui ne sont pas encore « Fait » ou « Rejeté » ; un clic ouvre le backlog filtré |
| Dernier retour | Date relative, avec la date complète en infobulle |

- **Tri par défaut, « Moins bien notés »** :
  - satisfaction croissante, puis le plus de Non en premier ;
  - les articles qui ont **moins de 5 réponses** viennent ensuite, avec le badge « Peu de réponses ».
- **Autres tris** : « Plus de Non », « Plus de réponses », « Titre (A à Z) ».
- **Sous le tableau** : « {{n}} articles n'ont reçu aucune réponse sur la période. ».
- **Action de ligne** (menu ⋯) : « Créer un élément de backlog » (§5.3), avec l'article prérempli.

### 4.3 Onglet Commentaires

Une liste de cartes ; les « Non » sans commentaire n'y figurent pas.

- **Carte** :
  - en tête : l'article (lien), « Page : {{page}} », le nom de l'espace et la date (« 18 nov. 2026, 14:05 ») ;
  - le texte, en texte brut (aucun lien rendu cliquable) ;
  - en pied : le statut, puis les actions.
- **Statuts d'un commentaire** :

| Statut | Badge | Sens |
|---|---|---|
| Nouveau | `info-soft`, `circle-dot` | Pas encore lu |
| Rattaché | `primary-soft`, `link` | Lié à un élément du backlog (« Rattaché à : {{titre de l'élément}} », avec un lien) |
| Classé | neutre, `archive` | Lu, sans suite (doublon, hors sujet, déjà corrigé) |

- **Actions** :
  - « Créer un élément » (primaire) ;
  - « Rattacher à un élément… », qui ouvre une liste cherchable des éléments ouverts ;
  - « Classer sans suite » ;
  - dans le menu ⋯ : « Supprimer le commentaire », avec la confirmation « Supprimer ce commentaire ? Le vote Non reste compté. ». Elle sert si un commentaire contient malgré tout une donnée personnelle.
  - Toasts : « Élément créé. », « Commentaire rattaché. », « Commentaire classé. », chacun avec « Annuler ».
- **Filtres** :
  - statut (segmenté : « Nouveaux » par défaut, « Rattachés », « Classés », « Tous ») ;
  - Espace, Article, Page.
  - Tri : « Plus récents ».
- **Sélection multiple** : « Rattacher à un élément… » et « Classer sans suite » pour plusieurs commentaires (par exemple dix demandes identiques).
- **Conservation** :
  - les commentaires sont supprimés 12 mois après leur création ; les votes restent comptés ;
  - le texte « Les commentaires sont conservés 12 mois. » figure sous la liste.

## 5. Backlog d'amélioration (L41-06)

### 5.1 Liste

- **Titre** : « Backlog d'amélioration ».
- **Action à droite** : « Nouvel élément » (primaire) et « Exporter (CSV) ».
- **Barre (L40)** :
  - à gauche : statut (segmenté « À trier · n », « Planifié · n », « En cours · n », « Fait », « Rejeté », « Tous »), « Priorité : Toutes », « Article : Tous », Réinitialiser ;
  - à droite : « Tri : Priorité » (par défaut), « Plus récents », « Plus de retours liés ».
- **Tableau** :

| Colonne | Contenu |
|---|---|
| Élément | Titre (lien vers la fiche), avec l'article lié en dessous s'il existe |
| Statut | Badge (§5.4) |
| Priorité | Badge texte « Haute », « Moyenne » ou « Basse » (jamais la couleur seule) |
| Retours liés | Nombre de commentaires rattachés, et nombre de Non de l'article sur 90 j |
| Mis à jour | Date relative, et le prénom de la personne de l'équipe |

### 5.2 Fiche d'un élément

Elle s'ouvre en panneau latéral (tiroir de 560 px), avec l'adresse `#/console/backlog/{{id}}`.

- **Titre** : modifiable, 120 caractères au plus, obligatoire.
- **Description** : facultative, 2 000 caractères au plus. Elle décrit le problème ou l'amélioration, rédigée par l'équipe.
- **Statut** : liste (§5.4). Passer à « Rejeté » demande un motif court (obligatoire, 280 caractères), affiché dans la fiche.
- **Priorité** : « Haute », « Moyenne » (par défaut) ou « Basse ».
- **Article lié** : choix cherchable dans les articles d'aide (facultatif), avec le lien « Voir l'article ».
- **Note interne** : 2 000 caractères au plus, par exemple « Réécrire la section 2 ; capture à refaire ».
- **Retours liés** : la liste des commentaires rattachés (date, espace, texte).
  - Chacun a l'action « Détacher ».
  - Après la purge des 12 mois, la ligne affiche « Commentaire supprimé (conservation 12 mois) ».
  - L'élément ne **copie** jamais le texte d'un commentaire : il garde un lien, pour que la purge s'applique.
- **Historique** : création et changements de statut, avec la date et le prénom de la personne de l'équipe.
- **Enregistrement** : automatique en sortant d'un champ (« Enregistré »), comme dans l'éditeur.
- **Supprimer l'élément** : dans le menu ⋯, avec confirmation ; les commentaires rattachés repassent « Nouveau ».

### 5.3 Créer un élément

- **Points d'entrée** : un commentaire (« Créer un élément »), une ligne d'article (menu ⋯), ou « Nouvel élément ».
- **Modale courte** : Titre (prérempli « Article “{{titre}}” : à améliorer » quand on part d'un article), Priorité et Article lié (prérempli). Les commentaires d'origine sont rattachés automatiquement.
- **Création** : l'élément est créé avec le statut « À trier », puis la fiche s'ouvre.

### 5.4 Statuts

| Statut | Badge | Règle |
|---|---|---|
| À trier | neutre, `inbox` | Statut de départ |
| Planifié | `info-soft`, `calendar` | — |
| En cours | `warning-soft`, `loader` (icône fixe, sans rotation) | — |
| Fait | `success-soft`, `check` | Les commentaires rattachés restent visibles dans la fiche |
| Rejeté | neutre barré, `x` | Motif obligatoire |

- On peut passer d'un statut à n'importe quel autre ; l'historique garde la trace.
- Le compteur de l'onglet « Backlog · n » compte les éléments « À trier ».

## 6. Export CSV (L41-07)

- « Exporter (CSV) » dans Retours sur l'aide propose deux choix :
  - « Synthèse par article » : article, rubrique, oui, non, satisfaction (%), commentaires, nouveaux, éléments ouverts, dernier retour ;
  - « Commentaires » : date, espace, article, page, commentaire, statut, élément rattaché.
- « Exporter (CSV) » dans le Backlog : titre, statut, priorité, article, retours liés, motif de rejet, créé le, mis à jour le, note interne.
- La période et les filtres en cours s'appliquent, et la modale les rappelle.
- **Format** : `;`, UTF-8 avec BOM, dates ISO. Nom du fichier : `console-retours-aide-{{AAAA-MM-JJ}}.csv` ou `console-backlog-{{AAAA-MM-JJ}}.csv`.
- Jamais d'identité de la personne qui a répondu.

## 7. États (L41-08)

- **Aucune réponse sur la période** : icône `message-square-text`, « Aucun retour sur cette période », « Les utilisateurs répondent depuis le bas de chaque article d'aide. ».
- **Aucun commentaire nouveau** : « Tout est lu. », avec le lien « Voir tous les commentaires ».
- **Backlog vide** : icône `list-todo`, « Aucun élément pour l'instant », « Créez un élément depuis un commentaire ou un article mal noté. », bouton « Nouvel élément ».
- **Chargement** : squelettes (L32), même géométrie.
- **Erreur** : carte « Impossible de charger la console. » avec « Réessayer ».

## 8. Données (indications pour le dev)

- **`help_feedback_entries`** :
  - colonnes : `id`, `workspace_id`, `article`, `helpful`, `page`, `author_id`, `comment` (500 au plus, nullable), `comment_status` (`new`, `linked` ou `archived`, seulement si `comment` existe), `backlog_item_id` (nullable), `created_at` ;
  - unicité sur (`workspace_id`, `article`, `author_id`).
- **`improvement_items`** : `id`, `title`, `description`, `status` (`triage`, `planned`, `in_progress`, `done`, `rejected`), `priority` (`high`, `medium`, `low`), `article` (nullable), `note`, `reject_reason`, `created_by`, `updated_by`, `created_at`, `updated_at`. Plus une table d'historique des statuts.
- **Accès** :
  - aucune lecture pour `authenticated` ;
  - la lecture et l'écriture de la console passent par des RPC `security definer` qui vérifient `is_platform_owner()` et ne renvoient **jamais** `author_id` ;
  - l'écriture du vote et du commentaire côté client se fait par RPC (contrôles de longueur, `PERSONAL_DATA`, 20 commentaires par personne et par jour au plus).
- **« Mes données » et suppression du compte** :
  - les commentaires de la personne sont dans son export ;
  - à la suppression du compte, ses commentaires sont supprimés et `author_id` est mis à null, le vote restant compté.
- **Purge** : les commentaires de plus de 12 mois passent par la tâche planifiée existante (le commentaire est vidé, le lien vers l'élément devient « supprimé »).
- **Suppression d'un espace** : ses votes sont anonymisés (`workspace_id` mis à null, « Espace supprimé » dans la console), ses commentaires sont supprimés.

## 9. Recette

- **Côté client** :
  - « Non », puis un commentaire de 500 caractères ; le 501e est refusé ;
  - `test@example.com` est bloqué, côté client comme côté serveur ;
  - « Passer » et Échap ; changer sa réponse ;
  - un propriétaire et un admin d'espace : **aucune** entrée « Console », et `#/console` affiche « Page introuvable ».
- **Console** (compte propriétaire de la plateforme, données fictives de 2 espaces) :
  - classement « Moins bien notés » avec un article à 1 réponse, qui ne doit pas arriver en tête ;
  - filtre Espace ;
  - créer un élément depuis un commentaire, rattacher 3 commentaires en une fois, classer sans suite, Annuler ;
  - parcourir les 5 statuts ; Rejeté sans motif est refusé ;
  - les trois exports, avec les filtres appliqués ;
  - aucun nom ni aucune adresse d'utilisateur à l'écran, dans les exports ou dans les réponses réseau.
- **Contrôles** : 1 440, 1 024 et 390 px, en clair et en sombre, avec axe sans violation.
