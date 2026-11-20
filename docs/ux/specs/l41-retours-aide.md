# L41 : retours sur l'aide (commentaire après « Non », écran de suivi pour les admins)

> Besoin client, dans une démarche d'amélioration continue. Aujourd'hui, « Cet article vous a aidé ? » (L26-02) n'alimente qu'un compteur global et anonyme (`help_feedback` : article, oui, non), lisible par le service seulement.
> Le lot ajoute deux choses :
> - un commentaire facultatif après « Non » ;
> - un écran de suivi dans Paramètres, réservé aux admins de l'espace.
>
> Version courte, sans maquette : écrans existants plus deltas, composants du design system, icônes Lucide.
> La barre de l'écran suit L40 (40 px, filtres à gauche, tri à droite).
> Données fictives dans les tests : espace « Acme », adresses `@example.com`.
> Code de lot : **L41**. L40 est déjà pris par les barres de liste.

## 0. Principe : les retours appartiennent à l'espace

- Chaque nouveau retour est enregistré **dans l'espace actif** de la personne qui répond. L'écran d'un espace ne montre que les retours de ses membres, jamais ceux d'autres organisations.
- Le compteur global existant (`help_feedback`) continue d'être incrémenté pour l'équipe produit. Il n'est pas affiché dans l'app.
- **Personne qui répond** :
  - elle est enregistrée (anti-abus, une réponse par article, export et suppression de ses données) ;
  - elle n'est **jamais affichée** aux admins ni exportée ;
  - les retours suivent la suppression du compte (L28 §7) : le vote reste compté, le commentaire est supprimé.

## 1. États et codes

| Code | État | Où |
|---|---|---|
| L41-01 | Après « Non » : champ « Qu'est-ce qui vous manquait ? » | Panneau d'aide, bas d'un article |
| L41-02 | Commentaire envoyé, erreur d'envoi, donnée personnelle détectée | Même emplacement |
| L41-03 | Écran « Retours sur l'aide », onglet Articles | Paramètres > Espace |
| L41-04 | Onglet Commentaires (À traiter / Traités) | Même écran |
| L41-05 | Export CSV | Même écran |
| L41-06 | Badge des nouveaux « Non » | Barre latérale (Paramètres) et menu des Paramètres |
| L41-07 | État vide, accès réservé | Même écran |

## 2. Dans l'aide : après « Non » (L41-01, L41-02)

Le comportement de « Oui » ne change pas : « Merci pour votre réponse. ».

Après « Non » :

1. **Le vote est enregistré tout de suite.** Le commentaire est facultatif : si la personne ferme le panneau, le « Non » reste compté.
2. À la place des boutons, le bloc devient :
   - une ligne `role="status"` : « Merci. Qu'est-ce qui vous manquait ? » ;
   - un champ texte multiligne (`fd-input`, 3 lignes, redimensionnable), dont le libellé est cette question ;
   - le compteur « 0 / 500 » (500 caractères au plus, saisie bloquée au-delà) ;
   - l'aide sous le champ, reliée par `aria-describedby` : « Facultatif. N'indiquez aucune donnée personnelle : ni nom, ni e-mail, ni numéro, ni information sur un usager. Votre réponse est lue par les administrateurs de l'espace, sans votre nom. » ;
   - les boutons « Envoyer » (primaire, désactivé tant que le champ est vide) et « Passer » (ghost), en 40 px.
3. **Focus** : il passe dans le champ juste après « Non ». « Passer » ou Échap dans le champ ferment le bloc sur « Merci pour votre réponse. » ; le panneau d'aide reste ouvert.
4. **Après l'envoi** : « Merci, votre commentaire a été transmis. » (`role="status"`). Le champ disparaît.
5. **Donnée personnelle détectée** :
   - si le texte contient une adresse e-mail ou un numéro de 9 chiffres ou plus (espaces et points ignorés), l'envoi est bloqué ;
   - le message sous le champ (`role="alert"`) dit : « Ce texte semble contenir une adresse e-mail ou un numéro. Retirez-le avant d'envoyer. » ;
   - la même vérification est faite côté serveur.
6. **Erreur d'envoi** : « Votre commentaire n'a pas pu être envoyé. » avec « Réessayer ». Le texte saisi est conservé.
7. **Une réponse par article et par personne dans l'espace** :
   - si la personne revient sur l'article, elle voit « Vous avez répondu Non. Changer ma réponse » ;
   - ce lien rouvre Oui / Non, et un nouveau vote remplace l'ancien ;
   - un commentaire déjà envoyé reste lié à l'ancien vote.
   - La mémoire locale actuelle (`localStorage`) est remplacée par la réponse enregistrée, qui suit la personne d'un navigateur à l'autre.
8. **Contexte enregistré avec le vote** :
   - l'article et la page de l'app où l'aide a été ouverte (`help.page.*`, par exemple « Éditeur ») ;
   - la date et l'espace ;
   - **aucune** autre donnée (pas d'URL complète, pas d'identifiant de démo).

## 3. Écran « Paramètres > Retours sur l'aide » (L41-03 à L41-07)

### 3.1 Accès

- **Navigation** : entrée « Retours sur l'aide » (icône `message-square-text`), dans la section Espace des Paramètres, après « Confidentialité ».
- **Droits** : propriétaires et admins de l'espace seulement. L'entrée est absente pour les autres rôles, comme Centre de formation. Une adresse directe affiche la page « Accès réservé » existante.
- **Adresse** : `#/settings/help-feedback`. Les onglets, filtres et tris sont gardés dans l'adresse (`?tab=commentaires&statut=a-traiter`).

### 3.2 En-tête

- **Titre** : « Retours sur l'aide ».
- **Sous-titre** : « Ce que les membres de l'espace pensent des articles d'aide. Les réponses sont anonymes pour les administrateurs. »
- **Actions à droite** : aide, cloche, « Exporter (CSV) » (§3.6).
- **Trois indicateurs** (cartes `fd-kpi`), calculés sur la période choisie :
  - « Réponses » : le nombre de Oui et de Non ;
  - « Satisfaction » : la part de Oui en %, avec « {{oui}} Oui, {{non}} Non » dessous ;
  - « Commentaires à traiter ».
  - Sans réponse, la valeur affichée est « — », jamais « 0 % ».

### 3.3 Barre (L40)

- **À gauche** :
  - période en segmenté : « 30 j », « 90 j », « 12 mois » (par défaut 90 j) ;
  - filtre « Rubrique : Toutes » (les rubriques de l'aide) ;
  - Réinitialiser.
- **À droite** : « Tri : Moins bien notés » dans l'onglet Articles, « Tri : Plus récents » dans l'onglet Commentaires.
- **Onglets au-dessus de la barre** : « Articles » et « Commentaires · {{n à traiter}} ».

### 3.4 Onglet Articles (L41-03)

Un tableau, avec une ligne par article ayant reçu au moins une réponse sur la période.

| Colonne | Contenu |
|---|---|
| Article | Titre de l'article (lien « Ouvrir l'article » qui ouvre le panneau d'aide dessus), avec la rubrique en dessous |
| Oui | Nombre |
| Non | Nombre |
| Satisfaction | « {{x}} % », avec une barre de 80 px (`success` sur `surface-sunken`). La valeur est toujours écrite, jamais la couleur seule. |
| Commentaires | « {{n}} », dont « {{m}} à traiter » en `text-muted`. Un clic ouvre l'onglet Commentaires filtré sur l'article. |
| Dernier retour | Date relative (« il y a 2 j »), avec la date complète en infobulle |

- **Tri par défaut, « Moins bien notés »** :
  - satisfaction croissante, puis le plus de Non en premier ;
  - les articles qui ont **moins de 5 réponses** viennent ensuite, quelle que soit leur note, avec le badge neutre « Peu de réponses ». Ainsi, un seul Non ne place pas un article en tête.
- **Autres tris** : « Plus de Non », « Plus de réponses », « Titre (A à Z) ».
- **Sous le tableau** : « {{n}} articles n'ont reçu aucune réponse sur la période. » (sans liste).

### 3.5 Onglet Commentaires (L41-04)

Une liste de cartes. Les « Non » sans commentaire n'y figurent pas : ils sont seulement comptés.

- **Carte** :
  - en tête : titre de l'article (lien), « Page : {{page}} », date et heure (« 18 nov. 2026, 14:05 ») ;
  - le texte du commentaire, en texte brut (aucun lien rendu cliquable, retours à la ligne gardés) ;
  - en pied : un badge de statut, une action et un menu ⋯ (icône `ellipsis`, nom « Plus d'actions ») avec « Supprimer le commentaire ».
- **Statuts** :
  - « À traiter » (badge `warning-soft`, icône `circle-dot`), avec l'action « Marquer comme traité » ;
  - « Traité » (badge `success-soft`, icône `check`), avec « Traité le {{date}} par {{prénom nom de l'admin}} » et l'action « Rouvrir ».
  - Toast : « Commentaire marqué comme traité. » avec « Annuler ».
- **Note interne facultative** : « Ajouter une note » sous le commentaire, 280 caractères au plus. Elle est visible des admins seulement, par exemple « Article réécrit le 20 nov. ».
- **Filtres** : statut (segmenté : « À traiter » par défaut, « Traités », « Tous »), Article, Page.
- **Sélection multiple** : cases à cocher, puis « Marquer comme traités ({{n}}) » dans une barre d'action qui apparaît au-dessus de la liste.
- **Suppression** :
  - confirmation « Supprimer ce commentaire ? Le vote Non reste compté. » ;
  - à utiliser si un commentaire contient malgré tout une donnée personnelle.
- **Conservation** : les commentaires sont supprimés automatiquement 12 mois après leur création ; les votes restent comptés. La règle est écrite sous la liste : « Les commentaires sont conservés 12 mois. »

### 3.6 Export CSV (L41-05)

- « Exporter (CSV) » ouvre une petite modale avec deux choix :
  - « Synthèse par article » : article, rubrique, oui, non, satisfaction (%), commentaires, à traiter, dernier retour ;
  - « Commentaires » : date, article, page, commentaire, statut, traité le, traité par, note.
- La période et les filtres en cours s'appliquent, et la modale le rappelle (« 90 derniers jours · Rubrique : Toutes »).
- **Format** : séparateur `;`, UTF-8 avec BOM, dates ISO, comme les autres exports. Nom du fichier : `retours-aide-{{espace}}-{{AAAA-MM-JJ}}.csv`.
- Jamais d'identité de la personne qui a répondu.

### 3.7 Badge des nouveaux « Non » (L41-06)

- **Compte** : les « Non » reçus depuis la dernière ouverture de l'écran **par cet admin** (dernière visite enregistrée par admin).
- **Où** :
  - sur l'entrée « Paramètres » de la barre latérale, une pastille numérique (`primary`, 9+ au-delà de 9) ;
  - sur l'entrée « Retours sur l'aide » du menu des Paramètres, le même nombre.
- **Nom accessible** : « Paramètres, 3 nouveaux retours Non sur l'aide ».
- **Remise à zéro** : à l'ouverture de l'écran.
- **Mise à jour** : au chargement de l'app et toutes les 5 minutes. Le temps réel n'est pas exigé.
- **Notification** : facultative, dans les préférences de notification (L28 §6), réglée par défaut sur « Résumé hebdomadaire » : « Aide : {{n}} nouveaux Non cette semaine ». Aucun e-mail par vote.

### 3.8 États (L41-07)

- **Aucune réponse sur la période** : état vide avec l'icône `message-square-text`, le titre « Aucun retour sur cette période » et le texte « Les membres répondent depuis le bas de chaque article d'aide. ».
- **Aucun commentaire à traiter** : « Tout est traité. », avec le lien « Voir les commentaires traités ».
- **Chargement** : squelette du tableau (L32), même géométrie.
- **Erreur** : carte « Impossible de charger les retours. » avec « Réessayer ».

## 4. Données (indications pour le dev)

- **Table `help_feedback_entries`** :
  - colonnes : `id`, `workspace_id`, `article`, `helpful`, `page`, `author_id`, `comment` (500 au plus, nullable), `status` (`todo` ou `done`, seulement si `comment` existe), `note` (280 au plus), `handled_at`, `handled_by`, `created_at` ;
  - unicité sur (`workspace_id`, `article`, `author_id`) : un nouveau vote met à jour la ligne.
- **RLS** :
  - lecture et mise à jour du statut ou de la note par les propriétaires et admins de l'espace, **sans exposer `author_id`** (vue ou RPC qui ne renvoie pas cette colonne) ;
  - écriture du vote et du commentaire par RPC `security definer` uniquement.
- **Contrôle serveur** :
  - longueur du commentaire ;
  - e-mail et numéro de 9 chiffres ou plus refusés (`PERSONAL_DATA`) ;
  - au plus 20 commentaires par personne et par jour.
- **Compteur global** : la RPC `help_feedback` existante continue d'être appelée (même vote).
- **Suppression du compte et « Mes données »** :
  - les commentaires de la personne figurent dans son export ;
  - à la suppression du compte, les commentaires sont supprimés et `author_id` est mis à null, le vote restant compté.
- **Purge** : les commentaires de plus de 12 mois sont supprimés par la tâche planifiée existante.

## 5. Recette

- **Aide** :
  - « Non », puis un commentaire de 500 caractères envoyé ; le 501e caractère est refusé ;
  - un e-mail fictif (`test@example.com`) bloque l'envoi, côté client comme côté serveur ;
  - « Passer » et Échap fonctionnent, et le vote est compté même si le panneau est fermé ;
  - changer sa réponse.
- **Écran** :
  - tri « Moins bien notés » avec un article à 1 réponse, qui ne doit pas arriver en tête ;
  - Marquer comme traité, puis Annuler ; sélection multiple ; suppression ;
  - les deux exports, avec les filtres appliqués ;
  - le badge, qui apparaît puis se remet à zéro à l'ouverture ;
  - un éditeur et un lecteur : entrée absente et page « Accès réservé » ;
  - deux espaces : les retours de l'un sont invisibles dans l'autre ;
  - aucun nom de répondant visible, ni à l'écran, ni dans l'export, ni dans les réponses réseau.
- **Contrôles** : 1 440, 1 024 et 390 px, en clair et en sombre, avec axe sans violation.
