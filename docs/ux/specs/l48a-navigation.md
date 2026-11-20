# L48-A : navigation, colonne Dossiers, Paramètres groupés, support

> Paquet A du benchmark de structure (`docs/ux/benchmark-structure.md`, §1, §2, §8 et §9). **À réaliser après L41.**
> Maquettes : `docs/ux/maquettes/refonte/l48a-navigation.html` et `l48a-utilisation.html`. Captures : `img/l48a-demos.png`, `img/l48a-parametres.png`, `img/l48a-sombre.png`, `img/l48a-mobile.png`, `img/l48a-utilisation.png` et `img/l48a-utilisation-sombre-mobile.png`.
> Données fictives.

## 1. Barre latérale (`components/Layout.tsx`)

**Aujourd'hui.**
- **Premier groupe** : Démos, Analytics, Leads.
- **« Formation »** : Apprenants, Centre de formation.
- **« Workspace »** : Membres, Paramètres, Plans.
- **Le profil** en bas.

**Cible**, de haut en bas :
1. Logo, sélecteur d'espace (inchangé ; le sous-titre devient « Espace · n membres »).
2. **Contenus** (sans titre de section) :
   - Démos (`layout-grid`) ;
   - Parcours de formation (`route`), aujourd'hui « Centre de formation » à `/center`, affiché aux droits actuels ;
   - Analytics (`chart-column`).
3. **Formation** : Apprenants (`graduation-cap`).
4. Espace libre (`flex: 1`).
5. **Utilitaires**, séparés par un filet en haut, éléments de 36 px, texte de 14 px :
   - **Extension** (`puzzle`) : ouvre une modale. Si l'extension n'est pas détectée : « Installer l'extension », avec le lien vers la boutique et les étapes de l'accueil. Si elle est détectée : la version et « Lancer une capture » ;
   - **Centre d'aide** (`circle-help`) : ouvre le tiroir d'aide existant, sur son accueil (Académie, articles). Il remplace l'accès par l'icône de l'en-tête, qui reste pour l'aide contextuelle ;
   - **Paramètres** (`settings`) : mène à `/settings/workspace`, et reste actif dans toutes les pages `/settings/*`.
6. **Bloc profil** (inchangé), avec le menu : Mon profil, Changer d'espace, Nouvel espace, Se déconnecter.

**Retirés de la barre** :
- **Leads** reste un onglet d'Analytics (`?tab=leads`) ; la redirection est conservée ;
- **Membres** et **Plans** restent seulement dans les Paramètres.

**Vocabulaire.** « Workspace » devient **« Espace »** dans toute l'interface (`nav.workspace`, `nav.newWorkspace`, `plans.sub`, etc.). Les clés i18n peuvent garder leur nom.

**Accessibilité.**
- Deux `nav` : « Navigation principale » et « Utilitaires ».
- La page active porte `aria-current="page"`.
- En tiroir mobile, l'ordre reste le même et le focus est piégé (inchangé).

## 2. Colonne Dossiers (page Démos)

Elle remplace le filtre « Dossier » de la barre de liste (L40) au-dessus de 1 024 px.

- **Place** : entre la barre latérale et le contenu, 232 px, fond `surface`, filet à droite.
- **Repli** : l'en-tête de colonne a un bouton « Masquer les dossiers » (`panel-left-close`). Une fois repliée, un bouton « Dossiers » (`folder`) au début de la barre de liste la rouvre. L'état est gardé par utilisateur.
- **En-tête** : « Dossiers » et un bouton à icône « Nouveau dossier » (`plus`).
- **Entrées**, chacune de 36 px avec un compteur à droite (`tabular-nums`, `text-muted`) :
  1. **Toutes les démos** (`layers`) : toutes les démos non archivées ;
  2. **Mes démos** (`user`) : `created_by` = moi ;
  3. un filet, puis la section « Dossiers de l'espace » (11 px, capitales) ;
  4. les dossiers, triés par nom, avec les sous-dossiers en retrait de 24 px (`parent_id`, un niveau affiché, puis un chevron pour déplier au-delà). Un dossier à accès restreint (`restricted`) a l'icône `lock` au lieu de `folder` ;
  5. **« Nouveau dossier »** en lien `primary` ;
  6. un filet, puis **Archivées** (`archive`) : démos au statut `archived`.
- **Sélection** :
  - fond `primary-soft`, texte `primary-soft-text`, graisse 600, `aria-current="true"` ;
  - l'entrée choisie est dans l'adresse (`?dossier={id}`, `?vue=mes-demos`, `?vue=archivees`) ;
  - le titre de la page devient le nom du dossier, avec un fil d'Ariane « Démos > Procédures ».
- **Menu d'un dossier** (bouton « … » au survol et au focus, ou clic droit) : Renommer, Nouveau sous-dossier, Gérer l'accès (si restreint), Supprimer. Les actions existantes de `DemosPage` sont déplacées ici.
- **Glisser-déposer** : une carte de démo glissée sur un dossier le met en évidence (contour `primary` de 2 px, fond `primary-soft`). Le dépôt range la démo, avec le toast actuel « Déplacée dans {dossier} » et « Annuler ». Au clavier, « Déplacer vers… » reste dans le menu de la carte (inchangé).
- **Compteurs** : ils tiennent compte du filtre de statut de la barre (Toutes, Publiées, Brouillons).
- **Sous 1 024 px** : pas de colonne. Le filtre « Dossier » revient dans la barre de liste (L40), avec les mêmes entrées.
- **Accessibilité** : `nav` « Dossiers », liste de liens ; les dossiers dépliables ont `aria-expanded`.

## 3. Barre de liste de Démos (ajouts à L40)

- **À gauche** : Statut, **Créé par** (`users`, valeurs « Tous », « Moi », puis chaque membre), Étiquettes, Réinitialiser. Le filtre « Dossier » disparaît au-dessus de 1 024 px (§2).
- **À droite** :
  - Tri, avec une valeur ajoutée, **« Date de création »**, après « Modifiées récemment » ;
  - puis l'Affichage (grille ou liste).
- **Barre étroite** : quand la barre fait moins de 1 100 px (colonne Dossiers ouverte à 1 440 px), le Tri passe en **icône** de 40 px. Son nom complet (« Tri : Modifiées récemment ») est donné en infobulle L44 et en `aria-label`. C'est le même comportement qu'à 390 px dans L40.

## 4. Paramètres (`pages/settings/SettingsShell.tsx`)

**Aujourd'hui.**
- **« WORKSPACE »** (10 entrées à plat) : Général, Membres, Marque, Variables, Glossaire, Intégrations, Sécurité, Confidentialité, Assistance IA, Fonctions à venir.
- **« COMPTE »** : Mon profil, Plans et facturation.

**Cible.** Cinq groupes ; les titres de groupe font 11 px, en capitales, `text-muted`.

| Groupe | Entrées (route) |
|---|---|
| Espace | Général (`/settings/workspace`), Équipe (`/settings/members`), Utilisation (`/settings/usage`, §6), Sécurité, Confidentialité |
| Marque | Thème et couleurs (`/settings/brand`), Page publique (section de Marque, à sa propre route `/settings/brand/page`), Domaine (Bientôt) |
| Contenu | Variables (L46), Glossaire, Étiquettes (nouvelle page : liste, renommer, fusionner, supprimer ; à défaut, Bientôt), Assistance IA |
| Connexions | Intégrations (L48-F), Clés d'accès (Bientôt) |
| Mon compte | Profil (`/settings/profile`), Notifications (Bientôt, tant que les préférences ne sont pas stockées) |

- **« Fonctions à venir »** (`/settings/soon`) est **supprimée**. Chaque fonction qu'elle liste apparaît à sa place logique avec le badge « Bientôt » (règle existante : jamais masquée). La route redirige vers `/settings/workspace`.
- **« Membres »** devient **« Équipe »**.
- **« Plans et facturation »** devient **« Utilisation »** (§6), décision du client du 20 novembre (L48-00).
- **Fil d'Ariane** au-dessus du titre de chaque page : « Paramètres > {Groupe} > {Page} ». Le groupe n'est pas cliquable (pas de page de groupe) ; Paramètres mène à Général.
  - Balisage : `nav aria-label="Fil d'Ariane"` > `ol`, page courante en `aria-current="page"`, séparateurs `chevron-right` en `aria-hidden`.
  - Le fil remplace le grand titre « Paramètres » de l'en-tête actuel. Le titre de la page (h1) est le nom de la section.
- **Navigation** : 232 px, entrées de 36 px, sélection `primary-soft` (comme la colonne Dossiers). Le badge « Bientôt » est aligné à droite.
- **Mobile** : la navigation des Paramètres devient une liste de groupes (page d'index), puis la page choisie, avec « < Paramètres » en retour (comportement actuel à vérifier).

## 5. Support

- « Centre d'aide » dans les utilitaires (§1).
- Dans le tiroir d'aide, en pied : **« Contacter la DSI »** :
  - un lien vers le canal de support interne (adresse ou page), saisi dans Paramètres > Espace > Général, champ « Lien du support » ;
  - masqué tant que le champ est vide.
  - Pas de nouveau service : simple lien `mailto:` ou URL.

## 6. Utilisation (remplace « Plans et facturation »)

> Décision du client (20 novembre, L48-00) : outil interne de la DSI, environ 100 personnes, **sans paiement**.
> On retire les prix, les factures et les choix d'offre. Les quotas et la consommation restent affichés clairement.

- **Route** : `/settings/usage`. `/settings/plans` redirige vers cette page.
- **Retirés** :
  - prix mensuels et annuels, période de facturation, « Recommandé pour vous », « Choisir un plan », « Paiement en ligne bientôt disponible » ;
  - nom d'offre affiché comme produit (« Plan Business ») : le sélecteur d'espace affiche « Espace · n membres » (L48-A §1).
  - Les limites restent stockées dans `plans.limits` côté serveur ; seule l'interface change.
- **En-tête** :
  - fil d'Ariane « Paramètres > Espace > Utilisation », titre « Utilisation » ;
  - phrase : « Ce que consomme l'espace {nom}, et ses limites. Aucun paiement : pour aller au-delà, faites une demande à la DSI. »
- **Encart** : « Une limite vous gêne ? La DSI peut relever un quota pour votre espace. » et le bouton « Demander plus à la DSI ». Le bouton ouvre le lien de support (§5) avec l'objet prérempli « Demande de quota : {espace} ». Sans lien configuré, l'encart est masqué.
- **Cartes de quota** (grille de 3 colonnes, une seule sur mobile), chacune avec une icône, un titre, la valeur « n / limite », une jauge `role="meter"` et une ligne d'explication :

| Carte | Valeur | Source | Note |
|---|---|---|---|
| Assistance IA | requêtes ce mois-ci / quota mensuel | `ai_usage`, `limits.ai_monthly_requests` (via l'état lu par l'interface) | « Remise à zéro le 1er {mois} » |
| Voix off et sous-titres | minutes d'audio ce mois-ci / quota | `ai_usage.audio_seconds`, `limits.ai_monthly_audio_seconds` | idem |
| Stockage | Mo utilisés / 500 Mo | tailles réelles de `storage.objects` (médiathèque, vidéos, voix off) | détail par type sous la jauge |
| Membres | membres / limite | `members`, `limits.members` | « Les apprenants ne comptent pas. » |
| Démos publiées | publiées / limite, ou « Sans limite » | `limits.published_demos` (null = sans limite) | « Les brouillons ne comptent pas. » |
| Conservation des statistiques | durée (mois) | `limits.analytics_retention_days` | pas de jauge |

- **États** :
  - sous 80 %, jauge `text` ;
  - à partir de 80 %, pastille « Bientôt atteinte » (icône `triangle-alert`, fond `warning` à 14 %) et jauge `warning` ;
  - à 100 %, pastille « Limite atteinte » et jauge `danger`, avec la conséquence écrite (« Ajout de fichiers bloqué… ») et « Demander plus ».
  - Le texte de la pastille porte l'état, pas seulement la couleur.
- **Sans limite** : « Sans limite », sans jauge.
- **Accessibilité** : chaque jauge a `aria-valuenow`, `aria-valuemin`, `aria-valuemax` et un nom « {carte} : {n} % utilisés ».
- **Fonctions ouvertes à tous** (confirmé par le chef de projet, 20 novembre) : plus aucune fonction n'est réservée à une offre. Le dev retire les gates d'offre dans ce paquet : `lead_forms`, `share_rules`, `remove_branding` et tout autre test sur `plan_code` qui masque ou bloque une fonction, côté interface comme côté serveur (politiques, RPC). Le formulaire de lead garde sa mention RGPD obligatoire.
- **Seules limites restantes** : les quotas techniques (IA, voix, stockage, membres, démos publiées) et les plafonds anti-abus (fréquence des envois, taille des fichiers). Les plafonds anti-abus ne sont pas affichés dans « Utilisation » ; en cas de blocage, le message dit pourquoi et quand réessayer.
- **Ailleurs dans l'app** : les messages de limite (médiathèque pleine, quota IA atteint, limite de démos publiées) renvoient vers cette page et vers « Demander plus à la DSI ». Plus aucun « Voir les plans » ni « Changer de plan ».

## 7. Recette

- Barre latérale à 1 440 px, 1 024 px (tiroir) et 390 px, en clair et en sombre. Aucune entrée « Leads », « Membres » ou « Plans ». Aucun « Workspace » visible (recherche dans `fr.json`).
- Colonne Dossiers :
  - sélection et adresse ;
  - compteurs avec chaque statut ;
  - sous-dossiers ;
  - Archivées ;
  - glisser-déposer avec Annuler ;
  - repli gardé après rechargement ;
  - à 1 023 px, le filtre Dossier revient.
- Barre de liste : Créé par, Date de création. Le Tri passe en icône quand la colonne est ouverte, et reste une seule ligne à 1 440 px (mesure L40).
- Paramètres : 5 groupes, fil d'Ariane sur chaque page, `/settings/soon` redirigé, badges « Bientôt » à leur place.
- Support : « Contacter la DSI » absent sans lien configuré, présent après saisie.
- Fonctions ouvertes : un espace dont `plan_code` vaut `free` publie un formulaire de lead et des règles de partage, sans avertissement ni blocage.
- Utilisation : aucun prix, aucun nom d'offre, aucun bouton de paiement (recherche de « €», « plan », « facturation » dans `fr.json`) ; jauges à 50, 80 et 100 % ; `/settings/plans` redirige.
- e2e : `l40-barres`, `dashboard`, `settings`, `navigation` mis à jour (sélecteurs de la barre latérale).
