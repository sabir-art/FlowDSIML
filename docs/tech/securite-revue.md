# Revue de sécurité transversale (L29)

> Périmètre demandé par le chef d'équipe : toutes les fonctions `security definer` exécutables par le
> rôle `anon`, et toutes les politiques du stockage (`storage.objects`). État du dépôt au commit de ce
> document, base rejouée en local (`supabase/tests/local/run.sh`, avec les privilèges par défaut de
> Supabase reproduits par `supabase_shim.sql`). Les Edge Functions ne sont revues que là où elles
> remplacent une politique (écritures des buckets `media` et `html`).

## Méthode

1. Liste des fonctions du schéma `public` avec `prosecdef` et `has_function_privilege('anon', …, 'execute')`.
2. Lecture du corps de chacune : entrées bornées, secret exigé, fuite possible, effet de bord sans limite.
3. Liste des buckets (`storage.buckets`) et des politiques (`pg_policies` du schéma `storage`).
4. Pour chaque constat : gravité, correction, et si elle change des droits (schéma au chef avant d'écrire la migration).

## 1. Fonctions `security definer` exécutables par `anon`

18 fonctions. 6 sont des fonctions de déclencheur, que PostgREST ne peut pas appeler directement. Restent 12 RPC publiques.

| Fonction | Ce qu'il faut pour l'appeler | Ce qu'elle renvoie ou écrit | Constat |
|---|---|---|---|
| `get_invitation(token)` | Jeton d'invitation (uuid aléatoire) | Nom de l'espace, e-mail invité, rôle, état | Conforme : le jeton est le secret du lien d'invitation |
| `resolve_demo_address(adresse)` | Adresse publique (L28) | Identifiant de la démo publiée | Conforme : le contrôle d'accès reste dans open-demo (mot de passe, expiration, liens coupés) |
| `resolve_share_link(token)` | Jeton du lien personnalisé | Démo, variables du lien, ligne de jeu de données | **R1** : les variables sont renvoyées entières, `email` compris, alors que `personal_page` retire `email` |
| `personal_page(démo, code)` | Code de 12 caractères | Page personnalisée, signataire (nom seul) | Conforme |
| `public_page(démo)` | Identifiant de démo | Page publique activée | Conforme : `null` identique pour tous les refus |
| `learner_resume(token, démo)` | Jeton du lien | Prénom, progression du parcours | **R2** : ne vérifie pas `public_links_enabled`, contrairement à `issue_certificate` |
| `issue_certificate(token, parcours)` | Jeton du lien | Attestation | Conforme |
| `submit_lead(…)` | Identifiants de démo et de version (publics dans le manifeste) | Écrit un lead | **R3** : la limite (20 par heure) porte sur un `visitor_id` choisi par l'appelant ; rien ne borne le volume par démo |
| `submit_quiz_attempt(lot)` | Idem | Écrit une tentative | Faible : bonnes réponses déjà dans le manifeste publié (correction côté lecteur). Volume borné par visiteur seulement (voir R3) |
| `track_events(lot)` | Idem | Écrit jusqu'à 50 événements par appel | **R4** : aucune limite de volume ; `embed_origin` et `referrer` sont déclarés par le client (statistiques « Où elle est diffusée » falsifiables) |
| `present_remote_pair(id, code)` | Code à 8 chiffres | Jeton de télécommande | Conforme : 5 essais par session, limite globale (30 échecs en 10 minutes), délai de 0,3 s |
| `present_remote_state(token)` | Jeton de 64 caractères | État de la présentation | Conforme |

Fonctions de déclencheur exécutables par `anon` : `demo_access_rules`, `demo_versions_check_capture`, `glossary_limit`, `publish_rules_trigger`, `share_links_rules`, `step_comments_context`. PostgreSQL refuse de les appeler hors d'un déclencheur, mais le droit d'exécution n'a pas lieu d'être (**R5**, hygiène).

Toutes les fonctions ci-dessus fixent `search_path = ''` et qualifient les objets : pas d'injection par le chemin de recherche.

## 2. Stockage

| Bucket | Public | Lecture | Écriture | Constat |
|---|---|---|---|---|
| `captures` | non | membre (lecteur) de l'espace | éditeur | **S1** |
| `videos` | non | lecteur | éditeur | **S1** |
| `voices` | non | lecteur | éditeur | **S1** |
| `html` | non | lecteur | aucune politique : écriture par l'Edge Function `html-ingest` seulement | **S1** pour la lecture ; écriture conforme |
| `published` | non | lecteur de l'espace de la démo ; visiteurs par URL signée (open-demo) | éditeur | **S1** |
| `media` | oui | toute personne qui connaît le chemin | aucune politique : écriture par l'Edge Function `media` seulement (type vérifié dans les octets, SVG assaini) | **S2** |
| `branding` | oui | toute personne qui connaît le chemin ; politique de lecture pour les membres | admin | Conforme (logos destinés à être publics) |

- **S1, accès restreint par dossier (dette L27-09, aggravée)** : les politiques ne vérifient que le rôle dans l'espace. Un membre exclu d'un dossier restreint peut **lister** `<espace>/` dans `captures`, `videos`, `voices` ou `html` avec l'API de stockage. Il obtient ainsi les identifiants des démos du dossier, puis leurs fichiers. La dette disait « il faut connaître le chemin exact » : le listage le donne. Correction : schéma E (ajouter `demo_visible(path_uuid(name, 2))`, ou `path_uuid(name, 1)` pour `published`), soumis au chef le 20 novembre.
- **S2, médiathèque publique** : voulu, car le lecteur public affiche les images remplacées (L28-05) et les logos. Le chemin `<espace>/<uuid>.<ext>` contient un uuid aléatoire, donc il ne se devine pas, mais un fichier reste lisible par toute personne qui a eu son URL, même après sa suppression de la médiathèque si un cache le garde. À indiquer dans l'aide de la médiathèque : « Les fichiers de la médiathèque sont publics par leur adresse. »

## 3. Corrections

| Réf. | Correction | Change des droits ? | État |
|---|---|---|---|
| R5 | Retirer `execute` à `public`, `anon` et `authenticated` sur les 6 fonctions de déclencheur | Non (appel déjà impossible) | Fait : migration `20261123150000_securite_revue.sql`, test pgTAP |
| R3 | Plafond par démo pour `submit_lead` : 300 leads par heure et par démo, au-delà `RATE_LIMITED` (en plus des 20 par visiteur) | Non (anti-abus, aucun accès retiré) | Fait : même migration, test pgTAP |
| R1 | `resolve_share_link` : retirer `email` des variables renvoyées, comme `personal_page` | Oui (réduit ce que voit le porteur du lien) | Proposé au chef (schéma F) ; à vérifier : le lecteur n'utilise pas `{{email}}` dans les textes |
| R2 | `learner_resume` : exiger `public_links_enabled`, comme `issue_certificate` | Oui (accès anonyme retiré quand l'espace coupe ses liens publics) | Proposé au chef (schéma F) |
| R4 | `track_events` : plafond par démo et par minute ; marquer `embed_origin` « déclaré par le lecteur » dans l'écran « Où elle est diffusée » | R4 a : non ; R4 b : texte UX | Proposé (à mesurer avant de fixer le plafond) |
| S1 | Filtre de dossier sur le stockage | Oui | Schéma E soumis au chef, en attente |
| S2 | Aide de la médiathèque | Non (texte) | Proposé à la Lead UX |

## 4. Points vérifiés sans constat

- Aucune fonction `security definer` exécutable par `anon` ne renvoie d'e-mail de membre, sauf `get_invitation` (e-mail de l'invité, au porteur du jeton).
- Les refus des RPC publiques ne distinguent pas « n'existe pas » et « pas accessible » (`public_page`, `personal_page`, `resolve_demo_address`).
- Les buckets `html` et `media` n'ont aucune politique d'écriture : seules les Edge Functions (service role, contrôles de type et d'assainissement) y écrivent.
- Le bucket `published` est privé depuis L11 : les visiteurs passent par open-demo et des URL signées.
