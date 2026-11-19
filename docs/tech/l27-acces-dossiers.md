# L27-09 : accès par dossier

Migration `20261122100000_acces_dossiers.sql`, séparée des migrations de la marque et des règles de partage.

## Modèle

- `folders.restricted` et `folder_members(folder_id, user_id, workspace_id)`. Les administrateurs et les propriétaires ont toujours accès. La restriction vaut aussi pour les sous-dossiers.
- Le réglage passe uniquement par `set_folder_access(folder, restricted, users[])`, réservée aux administrateurs et au plan Enterprise. Le statut restreint n'est pas modifiable directement : les droits par colonne sur `folders` l'interdisent.
- Fonctions de visibilité :
  - `folder_visible(ws, folder)` et `demo_visible(demo)` traitent une démo ou un dossier à la fois. Elles sont `stable` et `security definer`.
  - `my_hidden_folders()` et `my_hidden_demos()` donnent les dossiers et les démos masqués pour l'utilisateur connecté. Elles sont calculées **une fois par requête**, via `(select …)::uuid[]`.
- Chemins rapides, où rien n'est masqué :
  - démo hors dossier ;
  - appel sans utilisateur (lecteurs publics, service role, tâches planifiées) ;
  - espace sans dossier restreint ;
  - administrateur.

## Filtrage côté serveur

- **Politiques** :
  - `demos` : lecture, modification et suppression ;
  - `folders` ;
  - toutes les tables qui portent `demo_id` : lecture, et « for all », modification et suppression quand elles existent.
- **RPC en `security definer`** : 33 fonctions sont redéfinies. Les redéfinitions sont générées mécaniquement depuis les définitions en vigueur et ne diffèrent que par le filtre ajouté :
  - analytics, KPI, leads, sessions, visiteurs récurrents, segments ;
  - temps réel ;
  - apprenants et parcours ;
  - glossaire et médiathèque ;
  - actions sur une démo : publier, diffuser, dupliquer, tests A/B, etc.
- **Sans changement** :
  - lecteurs publics : open-demo, `public_page`, `personal_page`, liens personnalisés, centre de formation, collecte d'événements, quiz et leads ;
  - `workspace_onboarding` (indicateurs oui/non) ;
  - `session_visits` (numéros de visite de sessions déjà filtrées).
- Les liens déjà partagés restent valables, comme le prévoit la spec.

Tests : `supabase/tests/acces_dossiers.test.sql`, 40 tests.

- **Non-fuite par table** : chaque table qui porte `demo_id` est parcourue dynamiquement. Pour un membre sans accès, elle ne doit renvoyer aucune ligne d'une démo du dossier ou du sous-dossier. Ce contrôle est fait pour un éditeur et pour un lecteur.
- **Non-fuite par RPC** : analytics, leads, sessions, visiteurs récurrents, temps réel, quiz, sondages, choix, intégrations, actions, notifications.
- **Autres cas** : chemin rapide, lecteurs publics, réglage réservé aux administrateurs et au plan Enterprise.

## Mesure

Requête de liste des démos d'un espace, faite par un éditeur sur 1 000 démos (la moitié dans 20 dossiers) et 20 000 événements, sur un Postgres 16 local. Valeurs après mise en cache.

| Cas | Liste des démos | `workspace_kpis` |
|---|---|---|
| Avant (sans la migration) | 3,1 ms | 14 à 15 ms |
| Après, aucun dossier restreint | 3,8 ms | 15 à 16 ms |
| Après, 2 dossiers restreints (950 démos visibles) | 3,8 ms | 15 à 17 ms |

Une première version évaluait `folder_visible` ligne par ligne. La liste passait alors à 15 ms, puis à 47 ms avec des dossiers restreints : c'est ce qui a conduit au calcul unique par requête.

## Limites

- Fichiers de capture (bucket `captures`) : la politique de stockage reste celle de l'espace. Un membre sans accès qui connaîtrait le chemin exact d'une image (`<espace>/<démo>/…`) pourrait la lire. Il ne peut pas obtenir l'identifiant de la démo par l'application.
