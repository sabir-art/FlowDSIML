# L41 : retours sur l'aide et Console propriétaire

> Besoin client, dans une démarche d'amélioration continue. Aujourd'hui, « Cet article vous a aidé ? » (L26-02) n'alimente qu'un compteur global et anonyme (`help_feedback` : article, oui, non), invisible pour tous.
>
> **Révision 3 (20 nov.)** : le client valide la Console et l'étend. Elle comprend désormais : plusieurs comptes avec des rôles, un journal d'audit, le regroupement des retours en éléments, un lien vers un ticket GitHub, une page « Nouveautés » côté clients, et 5 onglets.
> Maquette cliquable du parcours complet : `docs/ux/maquettes/refonte/l41-console.html`. Captures commentées : `docs/ux/captures/l41-console/` (13 étapes, clair et sombre).
>
> **Révision 2 (20 nov., correction client)** : les retours ne vont **pas** dans les Paramètres de l'espace. Les admins d'espace sont des clients ; ce ne sont pas eux qui font évoluer l'outil. Les retours vont dans une **Console propriétaire** séparée, réservée aux propriétaires de TutoClick (l'équipe qui développe l'outil), hors de tout espace client. Cette version remplace la précédente (bab6260).
>
> Côté client, deux éléments seulement : le champ « Qu'est-ce qui vous manquait ? » (§2) et la page « Nouveautés » (§7). Il n'y a ni écran de retours, ni export dans les espaces.
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
| L41-01 | Après « Non » : champ « Qu'est-ce qui vous manquait ? » | Panneau d'aide (client) |
| L41-02 | Commentaire envoyé, erreur, donnée personnelle détectée | Panneau d'aide (client) |
| L41-03 | Accès à la console, cadre et onglets | Menu du compte, puis `#/console` |
| L41-04 | Vue d'ensemble | Console |
| L41-05 | Retours (Articles, Commentaires), Créer un élément, Rattacher à… | Console |
| L41-06 | Backlog en colonnes, fiche d'un élément, passage à Fait | Console |
| L41-07 | Nouveautés : « Annoncer cette amélioration ? », rédaction, publication | Console |
| L41-08 | Équipe (rôles) et journal d'audit | Console |
| L41-09 | Page « Nouveautés » et point de nouveauté | App client |
| L41-10 | Export CSV, états vides, chargement, erreur, lecture seule | Console |

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

## 3. Console propriétaire : accès, rôles et cadre (L41-03)

- **Qui** : les comptes enregistrés comme **propriétaires de la plateforme** (équipe TutoClick).
  - Ce droit ne dépend d'aucun rôle d'espace.
  - Le premier compte est créé en base. Les suivants sont ajoutés depuis l'onglet Équipe (§8).
- **Rôles** :

| Rôle | Peut |
|---|---|
| Admin | Tout : traiter les retours, gérer le backlog, publier ou retirer une nouveauté, gérer l'équipe, exporter |
| Lecture seule | Consulter tous les onglets et exporter. Les actions sont visibles mais désactivées (`aria-disabled`, infobulle « Lecture seule : action réservée aux admins »), et un bandeau neutre le rappelle en haut de page. |

- **Règles** :
  - il reste toujours au moins un admin ;
  - personne ne peut modifier son propre rôle ;
  - toute modification passe au journal (§8).
- **Entrée** :
  - dans le menu du compte, un groupe « Équipe TutoClick » contient « Console propriétaire » (`shield-check`) ;
  - ce groupe est visible des propriétaires de la plateforme seulement, et absent pour tous les autres comptes ;
  - aucune entrée dans la navigation des espaces.
  - Pour un autre compte, `#/console` affiche « Page introuvable ».
- **Connexion** : l'écran habituel ; il n'y a pas de connexion séparée. La double authentification sera exigée pour les comptes propriétaires dès qu'elle existera dans l'app (elle n'existe pas aujourd'hui ; on n'affiche rien).
- **Cadre** (maquette, étape 3) :
  - en-tête de 72 px : logo et « Console propriétaire · Équipe TutoClick · tous les espaces » ;
  - **5 onglets** : Vue d'ensemble, Retours · n nouveaux, Backlog · n à trier, Nouveautés, Équipe et journal ;
  - à droite : le badge du rôle (« Admin » ou « Lecture seule ») et « Retour à l'app ».
- **Adresses** : `#/console`, `#/console/retours`, `#/console/backlog`, `#/console/backlog/{{id}}`, `#/console/nouveautes`, `#/console/equipe`.

## 4. Vue d'ensemble (L41-04)

- **4 chiffres sur 90 jours, tous espaces** :
  - « Satisfaction » (« {{x}} % », avec « {{oui}} Oui, {{non}} Non ») ;
  - « Réponses » (« sur {{n}} articles notés ») ;
  - « Commentaires nouveaux » ;
  - « Éléments à trier ».
  - Sans données : « — ».
- **« 3 articles à surveiller »** :
  - les 3 moins bien notés parmi ceux qui ont au moins 5 réponses ;
  - pour chacun : titre, rubrique, nombre de Non et de commentaires, satisfaction (valeur écrite et barre), bouton « Voir les retours » (ouvre Retours filtré sur l'article).
- **« Activité de l'équipe »** : les 4 dernières entrées du journal, avec les initiales, l'action, l'objet, la personne et la date.

## 5. Retours (L41-05)

### 5.1 Articles
- Tableau : Article (et sa rubrique), Oui, Non, Satisfaction, Commentaires, Backlog (éléments ouverts liés).
- Tri par défaut « Moins bien notés » : les articles de moins de 5 réponses viennent après, avec le badge « Peu de réponses ».
- Barre L40 : période (30 j, 90 j, 12 mois), « Espace : Tous », « Rubrique : Toutes » | Tri.

### 5.2 Commentaires
- **Carte** : article (lien), « Page : … », espace, date ; texte brut ; statut ; actions.
- **Statuts** : « Nouveau » (`circle-dot`), « Rattaché à : {{titre}} » (`link`, primary-soft) et « Classé » (`archive`).
- **Actions** d'un commentaire nouveau :
  - « Créer un élément » (primaire) ;
  - « Rattacher à… » ;
  - « Classer sans suite » ;
  - dans le menu ⋯ : « Supprimer le commentaire ».
- **« Créer un élément »** (maquette, étape 5) :
  - une modale avec Titre (prérempli, modifiable), Priorité (Moyenne par défaut), Article lié (prérempli), Ticket GitHub (facultatif) ;
  - le rappel du commentaire rattaché ;
  - « Créer l'élément » le crée dans « À trier » ; toast « Élément créé dans « À trier ». Le commentaire y est rattaché. ».
- **« Rattacher à… »** (maquette, étape 6) :
  - un popover (dialogue non modal) avec une recherche, qui liste les éléments **ouverts**, ceux du même article en premier, avec leur statut et leur nombre de retours ;
  - le choix incrémente le compteur ; toast « Commentaire rattaché à « … » (n retours). » avec « Annuler ».
  - Plusieurs commentaires peuvent être rattachés en une fois (sélection multiple).
- **Regroupement** : un élément compte ses retours rattachés, affichés « n retours » sur la carte du backlog et listés dans la fiche. Détacher un retour le remet à « Nouveau ».
- **Conservation** : 12 mois pour les commentaires, rappelée sous la liste.

## 6. Backlog (L41-06)

- **Vue en colonnes** (maquette, étape 7) :
  - 4 colonnes : À trier, Planifié, En cours, Fait, chacune avec son compteur ;
  - « Rejetés (n) » est un bloc repliable sous les colonnes, avec le titre et le motif.
  - Fond de colonne `surface-sunken`, cartes `surface` avec une bordure uniforme (jamais de barre de couleur, §15.6).
  - Un élément créé à l'instant a une bordure `primary` jusqu'au prochain chargement.
- **Carte** :
  - titre ;
  - badge de priorité (« Haute », « Moyenne », « Basse », toujours écrite) ;
  - « n retours » ;
  - ticket « #431 » s'il existe ;
  - « Annoncé » si une nouveauté est publiée ;
  - l'article lié.
  - La carte entière est un bouton qui ouvre la fiche. Son nom accessible dit le titre, le statut, la priorité et le nombre de retours.
- **Déplacer un élément** :
  - dans la fiche, les 5 boutons de statut (groupe `aria-pressed`) ;
  - le glisser-déposer entre colonnes est un plus, jamais le seul moyen ;
  - au clavier : le menu ⋯ de la carte propose « Déplacer vers… ».
  - Rejeté demande un motif (280 caractères, obligatoire).
- **Fiche** (tiroir de 560 px, maquette étape 8) :
  - en-tête : statut, « Élément du backlog », « Enregistré », Fermer ;
  - Titre, Statut, Priorité, Article lié, **Ticket GitHub**, Note interne, Retours regroupés · n, Historique.
  - Enregistrement automatique.
- **Ticket GitHub** :
  - champ URL facultatif, au format `https://github.com/<organisation>/<dépôt>/issues/<n>` ou `/pull/<n>` (sinon : « Collez l'adresse d'un ticket ou d'une demande de fusion GitHub. ») ;
  - affiché « #n » sur la carte, avec le lien « Ouvrir le ticket #n » (nouvel onglet) ;
  - aide : « Lien seulement : le statut du ticket n'est pas synchronisé. ».
  - **Aucune intégration** : ni appel à l'API GitHub, ni jeton.
- **Nouvel élément** : la même modale que « Créer un élément », sans retour rattaché.

## 7. Nouveautés (L41-07, L41-09)

### 7.1 Annoncer (console)
- **Au passage d'un élément à « Fait »** (s'il n'a pas déjà été annoncé), un dialogue (`alertdialog`) s'ouvre :
  - titre « Annoncer cette amélioration ? » ;
  - texte « L'élément est passé à Fait. Une annonce prévient les clients dans « Nouveautés », avec un point sur le menu du compte. Vous pourrez la relire avant de la publier. » ;
  - boutons « Plus tard » et « Rédiger l'annonce ».
  - « Plus tard » ne crée rien ; l'action « Annoncer » reste dans la fiche tant que rien n'est publié.
- **Rédaction** (modale large) :
  - Titre (90 caractères au plus) ;
  - Texte (400 caractères au plus ; aide « Ni nom de client, ni donnée d'un espace. ») ;
  - Lien vers l'aide (l'article lié, prérempli, facultatif) ;
  - Public : « Tous les espaces » (seule option) ;
  - **aperçu côté client** à droite ;
  - boutons « Enregistrer le brouillon » et « Publier l'annonce ».
  - Toast : « Annonce publiée. Les clients voient un point sur « Nouveautés ». ».
- **Onglet Nouveautés** :
  - « Publiées · n » et « Brouillons · n » ;
  - chaque annonce porte sa date, son titre, son texte, son lien d'aide et l'élément lié (ou « Annonce libre »), avec les actions « Modifier » et « Retirer » ;
  - « Nouvelle annonce » permet une annonce sans élément ;
  - « Voir côté client » ouvre l'aperçu.
  - Retirer une annonce la masque chez les clients, et passe au journal.

### 7.2 Côté client
- **Entrée** : « Nouveautés » (`megaphone`) dans le menu du compte, pour tous les rôles de tous les espaces.
- **Point de nouveauté** :
  - un point `primary` de 8 px sur l'avatar du pied de la barre latérale et sur l'entrée « Nouveautés » du menu, quand une annonce a été publiée depuis la dernière visite de la page par **cette personne** ;
  - nom accessible du bouton du menu : « Menu du compte, 1 nouveauté » ;
  - le point disparaît à l'ouverture de la page.
- **Page `#/nouveautes`** :
  - titre « Nouveautés » ;
  - sous-titre « Les améliorations récentes de TutoClick, souvent nées de vos retours sur l'aide. » ;
  - cartes de la plus récente à la plus ancienne : date, badge « Nouveau » (non lu), titre (h2), texte, « Lire l'article d'aide : … » ;
  - largeur de lecture de 760 px au plus ;
  - état vide : « Aucune nouveauté pour l'instant. ».
- **Aucun lien** vers le backlog, les retours ou la console, et aucun nom de client.

## 8. Équipe et journal (L41-08)

- **Équipe** :
  - tableau Personne (nom, e-mail `@tutoclick…`), Rôle (liste Admin ou Lecture seule), Dernière activité, Retirer ;
  - « Ajouter un propriétaire » : e-mail d'un compte TutoClick **existant** et rôle. Il n'y a pas d'invitation par e-mail, l'envoi n'existant pas encore.
  - Retirer demande une confirmation ; le compte garde son accès normal à ses espaces.
- **Journal d'audit** :
  - tableau Date, Personne, Action, Objet ; filtres Personne et Action ; export CSV ;
  - actions tracées : connexion à la console, création, rattachement, classement et suppression d'un retour, création d'un élément et tout changement de statut, de priorité ou de ticket, publication, modification ou retrait d'une nouveauté, ajout, retrait ou changement de rôle d'un propriétaire, exports ;
  - le journal ne peut être ni modifié ni effacé depuis la console. Conservation : 12 mois, rappelée sous le tableau.
  - Il ne contient jamais le texte d'un commentaire, seulement son article.

## 9. Export CSV et états (L41-10)

- **Exports** : Retours (synthèse par article, ou commentaires), Backlog (titre, statut, priorité, article, retours, ticket, motif de rejet, dates, note), Journal. Les filtres en cours s'appliquent ; format `;`, UTF-8 avec BOM, dates ISO ; jamais l'identité d'un répondant.
- **États vides** :
  - « Aucun retour sur cette période » ;
  - « Tout est lu. » ;
  - « Aucun élément pour l'instant », avec « Nouvel élément » ;
  - « Aucune annonce. ».
- **Chargement** : squelettes (L32).
- **Erreur** : « Impossible de charger la console. » avec « Réessayer ».

## 10. Données (indications pour le dev)

- **`help_feedback_entries`** :
  - colonnes : `id`, `workspace_id`, `article`, `helpful`, `page`, `author_id`, `comment` (500 au plus, nullable), `comment_status` (`new`, `linked` ou `archived`, seulement si `comment` existe), `backlog_item_id` (nullable), `created_at` ;
  - unicité sur (`workspace_id`, `article`, `author_id`).
- **`improvement_items`** : `id`, `title`, `description`, `status` (`triage`, `planned`, `in_progress`, `done`, `rejected`), `priority` (`high`, `medium`, `low`), `article` (nullable), `note`, `reject_reason`, `github_url` (nullable, format validé côté serveur), `announced_at`, `created_by`, `updated_by`, `created_at`, `updated_at`. Plus une table d'historique des statuts.
- **`platform_owners`** : `user_id`, `role` (`admin` ou `read_only`), `added_by`, `added_at`. Contrainte : au moins un admin. `is_platform_owner()` et `is_platform_admin()` sont utilisés par toutes les RPC de la console.
- **`console_audit`** : `id`, `at`, `actor_id`, `action`, `object_type`, `object_id`, `object_label`. Insertion seulement, par les RPC (aucune mise à jour ni suppression, hors purge à 12 mois).
- **`product_news`** : `id`, `title` (90 au plus), `body` (400 au plus), `article`, `item_id` (nullable), `state` (`draft`, `published` ou `withdrawn`), `published_at`, `created_by`. Lecture côté client : les annonces publiées, par une RPC ouverte à `authenticated`.
- **`news_seen`** : (`user_id`, `last_seen_at`) pour le point de nouveauté.
- **Accès** :
  - aucune lecture pour `authenticated` ;
  - la lecture de la console passe par des RPC `security definer` qui vérifient `is_platform_owner()`, et l'écriture par `is_platform_admin()` ; aucune ne renvoie **jamais** `author_id` ;
  - chaque RPC d'écriture ajoute sa ligne à `console_audit` dans la même transaction ;
  - l'écriture du vote et du commentaire côté client se fait par RPC (contrôles de longueur, `PERSONAL_DATA`, 20 commentaires par personne et par jour au plus).
- **« Mes données » et suppression du compte** :
  - les commentaires de la personne sont dans son export ;
  - à la suppression du compte, ses commentaires sont supprimés et `author_id` est mis à null, le vote restant compté.
- **Purge** : les commentaires de plus de 12 mois passent par la tâche planifiée existante (le commentaire est vidé, le lien vers l'élément devient « supprimé »).
- **Suppression d'un espace** : ses votes sont anonymisés (`workspace_id` mis à null, « Espace supprimé » dans la console), ses commentaires sont supprimés.

## 11. Recette

- **Côté client** :
  - « Non », puis un commentaire de 500 caractères ; le 501e est refusé ;
  - `test@example.com` est bloqué, côté client comme côté serveur ;
  - « Passer » et Échap ; changer sa réponse ;
  - un propriétaire et un admin d'espace : **aucune** entrée « Console », et `#/console` affiche « Page introuvable » ;
  - Nouveautés : après une publication, le point apparaît sur l'avatar et dans le menu, puis disparaît à l'ouverture de la page, pour cette personne seulement ; une annonce retirée disparaît.
- **Console** (compte propriétaire de la plateforme, données fictives de 2 espaces) :
  - classement « Moins bien notés » avec un article à 1 réponse, qui ne doit pas arriver en tête ;
  - filtre Espace ;
  - créer un élément depuis un commentaire, rattacher 3 commentaires en une fois, classer sans suite, Annuler ;
  - parcourir les 5 statuts ; Rejeté sans motif est refusé ;
  - passer un élément à Fait, puis « Annoncer cette amélioration ? » : rédiger, voir l'aperçu, publier ; « Plus tard » ne crée rien ;
  - ticket GitHub : une adresse valide affiche « #n », une adresse invalide est refusée, et aucun appel n'est fait vers GitHub ;
  - un compte **Lecture seule** : tous les onglets se lisent, les actions sont désactivées, l'export fonctionne, et une RPC d'écriture appelée directement est refusée ;
  - équipe : ajouter un propriétaire, changer un rôle, retirer le dernier admin (refusé), changer son propre rôle (impossible) ;
  - journal : chaque action du parcours y figure, et il ne peut être ni modifié ni effacé ;
  - les exports (retours, backlog, journal), avec les filtres appliqués ;
  - aucun nom ni aucune adresse d'utilisateur à l'écran, dans les exports ou dans les réponses réseau.
- **Contrôles** : 1 440, 1 024 et 390 px, en clair et en sombre, avec axe sans violation.
