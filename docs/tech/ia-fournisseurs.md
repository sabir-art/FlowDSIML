# Fournisseurs et modèles IA : note d'architecture (L41)

Statut : approuvée par le chef le 26/11 (réponses au §12). À développer après le Sandbox v2 (étapes 3 et 4). Spec UX :
`docs/ux/specs/l41-console-modeles-ia.md` (branche UX), planche `l41-modeles-ia`.

## 1. Le besoin

Aujourd'hui, les fournisseurs et les modèles sont écrits dans le code :

- `supabase/functions/ai/lib.ts` fixe `HAIKU`, `SONNET` et `OPUS`.
- `ALLOWED_MODELS = ['sonnet', 'opus']` en attendant L41.
- Les clés sont des variables d'environnement de l'Edge Function `ai` : `ANTHROPIC_API_KEY` et
  `ELEVENLABS_API_KEY`.

Changer de modèle, ajouter un fournisseur ou remplacer une clé demande donc un déploiement.

L41 veut tout piloter depuis la Console, par l'équipe TutoClick :

- les clés des fournisseurs, testées avant d'être enregistrées et jamais réaffichées ;
- le modèle de chaque fonction, avec un repli automatique ;
- la liste des modèles proposés dans l'assistant et les règles d'« Auto » ;
- côté espace client, un sous-ensemble de cette liste, réglé par les propriétaires.

## 2. Ce qui existe et que l'on garde

| Élément | Où | Rôle dans L41 |
|---|---|---|
| Rôles de plateforme `admin` / `read_only` | `platform_admins`, `is_platform_admin()`, `private.console_write()` (migration `20261125120000_console.sql`) | `admin` écrit ; `read_only` lit, sans actions |
| Journal de la Console | `console_audit`, `private.console_log()` | « Historique des changements », à compléter (§6) |
| Coffre de secrets | `vault.decrypted_secrets`, déjà lu par les webhooks et Slack | stockage chiffré des clés (§4) |
| Réglages IA de l'espace | `workspaces.settings.ai`, `ai_config()`, `ai_reserve()`, `ai_usage` | fonctions activées, quotas ; on y ajoute les modèles de l'espace (§7) |
| Fonctions et tâches | `FEATURE_OF`, `ai_features()` : write, translate, suggest, generate, dataset, chart, assistant, voice, captions | les « fonctions » de la spec §3 |
| Nom du modèle réellement utilisé | réponse `model` et `MODEL_LABEL` (planche 3, « Auto · Claude Sonnet ») | inchangé |
| Aucun nom de fournisseur dans l'extension | L64 | inchangé |

## 3. Catalogue : fournisseurs et modèles, dans le code

Le catalogue est **dans le code**, parce que chaque fournisseur demande un adaptateur (format des
requêtes, erreurs, tarifs). Il vit dans un nouveau module `supabase/functions/_shared/ai/catalogue.ts`.

```ts
type Capability = 'text' | 'vision' | 'tts' | 'stt';
interface ModelEntry {
  id: string;            // identifiant du fournisseur, ex. « claude-sonnet-5-5 »
  provider: 'anthropic' | 'openai' | 'elevenlabs';
  label: string;         // « Claude Sonnet »
  capabilities: Capability[];
  speed: 1 | 2 | 3;      // aide de la liste (vitesse, coût relatif)
  cost: 1 | 2 | 3;
  retired?: string;      // date de retrait annoncée : le modèle n'est plus proposé
}
```

- La Console le lit par une action de l'Edge Function `ai` (`console_catalog`). Le navigateur ne voit
  jamais d'adresse de fournisseur ni de clé.
- **Modèle retiré** : un modèle marqué `retired` dans un nouveau déploiement, ou une réponse
  « modèle inconnu » du fournisseur (404 ou `not_found_error`), le rend indisponible. Le service passe
  alors au repli (§5) et le note dans l'état de la fonction.
- Un **adaptateur par fournisseur** (`_shared/ai/providers/anthropic.ts`, `openai.ts`, `elevenlabs.ts`)
  expose :
  - `text(prompt, { model, deadline })` ;
  - `tts(...)` et `stt(...)` ;
  - `test(key)`, qui envoie une demande minimale et renvoie le délai ou l'erreur nommée.

  Le code actuel de `ai/index.ts` (SDK Anthropic, appels ElevenLabs) y est déplacé sans changer de
  comportement. Ses tests Deno restent verts à chaque étape.

## 4. Clés : coffre, jamais relues

- **Stockage** : dans Vault, un secret par fournisseur, nommé `ai_key_<fournisseur>`. Il est écrit
  par l'Edge Function `ai` (rôle de service) avec `vault.create_secret` / `vault.update_secret`.
- **Lecture** : seulement par l'Edge Function, via une fonction `private.ai_key(provider)` accordée au
  seul `service_role`. Le cache est de 60 s en mémoire, pour qu'un remplacement s'applique vite.
- **Jamais renvoyées** : ni par une RPC, ni par l'Edge Function, ni dans le journal. L'API ne rend
  que l'état. Table `ai_providers`, sans clé :
  - `provider` (clé primaire) ;
  - `added_at` ;
  - `last_test_at`, `last_test_ok` ;
  - `last_test_error`, une cause nommée (« Le fournisseur refuse la clé (401) ») ;
  - `last_test_ms`.
- **Tester et enregistrer** (spec §2) :
  1. la clé collée part une seule fois vers l'Edge Function, en HTTPS ;
  2. elle est testée par l'adaptateur ;
  3. seulement si le test réussit, elle est écrite dans Vault et l'état est mis à jour.

  En cas d'échec, rien n'est gardé. La clé n'est jamais écrite dans un log : le corps de la requête
  n'est pas journalisé, et les erreurs du fournisseur sont filtrées avant d'être rendues.
- **Tester** une clé enregistrée relit Vault côté serveur. Le toast affiche « Anthropic répond (320 ms) ».
- **Transition** : tant qu'aucune clé n'est dans Vault, les variables d'environnement actuelles
  servent de repli. Ainsi, rien ne casse à la mise en ligne, et `deploy.yml` ne change pas. La
  Console affiche alors « Connecté » avec l'aide « Clé définie au déploiement ». La première clé
  enregistrée depuis la Console prend le pas.

## 5. Modèle par fonction, repli et coupure

Table `ai_function_models` :

- `fn` (clé primaire) ;
- `provider`, `model` ;
- `updated_by`, `updated_at`.

| Fonction (spec §3) | Tâches couvertes (`FEATURE_OF`) | Capacité | Défaut |
|---|---|---|---|
| Assistant IA de l'éditeur | assistant | text | Auto (§6) |
| Rédaction automatique | step_draft | text | Claude Haiku |
| Vérification de cohérence | suggest | text | Claude Sonnet |
| Traduction | translate | text | Claude Sonnet |
| Voix | voice | tts | ElevenLabs, voix multilingue |
| Transcription | captions | stt | ElevenLabs aujourd'hui (la spec montre OpenAI : question §11) |

Les autres tâches de texte (write, write_all, generate, dataset, chart) suivent le modèle de la
Rédaction, sauf avis contraire.

**Résolution**, à chaque demande, dans une fonction pure et testée :

1. **Choisi et utilisable** (clé présente, modèle non retiré) : il est utilisé.
2. **Retiré** (décision du chef, recette de l'étape 3) : repli sur le modèle par défaut de la fonction
   (Sonnet pour la traduction) ; s'il est lui-même indisponible, sur le premier modèle disponible du même
   fournisseur. L'état « Modèle retiré : repli sur {modèle} » s'affiche, et le bandeau de la Console
   regroupe les fonctions par cause (« 4 fonctions coupées faute de clé Anthropic : A, B, C et D. »).

3. **Clé du fournisseur manquante ou refusée** : la fonction est **coupée** dans tous les espaces.
   - `ai_config()` renvoie la liste des fonctions coupées dans `unavailable` (sans nom de
     fournisseur).
   - L'app affiche « Indisponible pour le moment », comme pour une fonction désactivée, sans
     décompter de quota.
   - L'Edge Function répond 503 `UNAVAILABLE`.
4. Un **changement** s'applique aux demandes suivantes. Il est journalisé (§8) et le toast propose
   « Annuler », qui remet l'ancienne valeur et la journalise aussi.

## 6. Assistant : liste proposée et « Auto »

- Table `ai_assistant_models`, une ligne par modèle de capacité `text` :
  - `model` (clé primaire) ;
  - `position` ;
  - `proposed` (case Proposer) ;
  - `tag` (`none`, `recommended` ou `beta`).
- Contrainte : au moins un modèle `proposed`. La RPC refuse de décocher le dernier, avec le message
  « Gardez au moins un modèle. ».
- Table `ai_auto_rules`, une ligne par règle (`short`, `whole_demo`, `fallback`) et son modèle.
  `fallback` vaut `next` (« Le suivant de la liste ») ou un modèle donné.
- Ce que fait Auto, aujourd'hui figé dans le code (`applyModel`), devient : demande courte →
  modèle `short` ; analyse de la démo ou traduction → `whole_demo` ; échec, indisponibilité ou
  quota → `fallback`. La réponse donne toujours le modèle réellement utilisé.
- Le menu de l'assistant (`ModelPicker`, planche 3) lit une RPC `ai_models_for(p_ws)`. Elle renvoie
  les modèles proposés par la Console ET gardés par l'espace, dans l'ordre, avec leur étiquette.
  `MODEL_CHOICES` et `ALLOWED_MODELS` disparaissent du code.
- **Contrôle côté serveur** : un `model` demandé hors de cette liste est refusé (403 `MODEL`),
  quel que soit ce qu'envoie le navigateur.

## 7. Côté espace : Paramètres › Assistance IA

- `workspaces.settings.ai.models` : la liste des modèles cochés par l'espace. Elle est
  **absente par défaut**, ce qui veut dire « tous les modèles proposés ». Dès qu'un propriétaire
  enregistre, la liste devient explicite. Les modèles que TutoClick ajoute ensuite arrivent donc
  décochés, comme le veut la spec §5.
- **Écriture** par une RPC réservée aux propriétaires :
  - on ne peut que **retirer** des modèles : le serveur refuse tout modèle absent de la liste de
    la Console ;
  - il faut garder au moins un modèle ;
  - Auto est toujours proposé.
- Un modèle retiré de la Console disparaît de l'espace par le filtre de `ai_models_for`. Si
  l'espace n'en a plus aucun, Auto prend le relais.
- Les admins voient la section en lecture seule ; les autres rôles ne la voient pas.

## 8. Journal

`console_audit` garde aujourd'hui l'action et l'objet. La spec §6 demande aussi l'ancienne et la
nouvelle valeur.

- **Nouvelle migration** : colonnes `old_value` et `new_value`, `text` de 200 caractères au plus.
  `private.console_log()` reçoit deux paramètres optionnels. Les migrations existantes ne changent
  pas.
- **Actions** :
  - `ai.key_added`, `ai.key_replaced`, `ai.key_tested` : valeur = état, jamais la clé ;
  - `ai.model_changed` ;
  - `ai.assistant_list` ;
  - `ai.auto_rule`.
- « Historique des changements » ouvre le journal filtré sur `object_type = 'ai'`.

## 9. Sécurité et données

- RLS fermée sur les nouvelles tables. Lecture par les RPC `console_*` (rôle de plateforme), écriture
  par `private.console_write()` (admin seulement). pgTAP pour chaque règle, en particulier : un
  `read_only` ne peut rien écrire, un client ne voit rien, aucune RPC ne renvoie de clé.
- Les clés n'apparaissent dans aucune réponse, aucun log ni aucun journal. Un test Deno vérifie
  qu'une clé fictive passée en entrée n'apparaît dans aucune réponse ni aucune erreur rendue.
- Ajouter un fournisseur (OpenAI) ajoute un **sous-traitant** : la liste des sous-traitants et la
  politique de confidentialité (`docs/legal`) sont à mettre à jour avant la première clé.
- Rien ne change pour le masquage des données personnelles (`redact`) : il s'applique avant tout
  fournisseur.

## 10. Découpage proposé

1. **Adaptateurs et catalogue** : le code actuel est déplacé derrière l'interface, sans changement
   de comportement, et le repli sur les variables d'environnement est gardé. Tests Deno.
   **Livrée** : `_shared/ai/catalogue.ts`, `keys.ts` (variables de déploiement), adaptateurs
   `providers/anthropic.ts` et `providers/elevenlabs.ts` avec `test(key)` ; `ai/index.ts` les appelle.
   Tests `_shared/ai/providers_test.ts` (fetch simulé, la clé n'apparaît dans aucun résultat), lancés
   par la CI avec `--allow-env` : le SDK Anthropic lit l'environnement à sa création.
2. **Clés** : Vault, `ai_providers`, Tester et enregistrer, Tester ; onglet Console « Modèles IA »,
   section Fournisseurs. pgTAP, e2e « clé jamais visible », « échec : rien n'est enregistré ».
   **Livrée** : migration `20261201370000_ia_cles_fournisseurs.sql` (`ai_providers`, `ai_key_read`,
   `ai_key_save`, `ai_key_tested`, rôle de service seulement ; pgTAP 22/22) ; `keys.ts` lit le coffre puis
   le déploiement (cache de 60 s) ; actions `console_*` de l'Edge Function `ai` (`_shared/ai/console.ts`) ;
   onglet Console « Modèles IA », section Fournisseurs (e2e `console-modeles`, 20/20 en clair et en sombre).
3. **Modèle par fonction** : `ai_function_models`, résolution, repli et coupure, bandeau ;
   « Indisponible pour le moment » côté espace.
   **Livrée** : migration `20261201380000_ia_modele_par_fonction.sql` (`ai_function_models`, `ai_cut`,
   `ai_set_function_model`, `ai_set_cut`, `ai_status.unavailable` ; pgTAP 14/14) ; résolution pure
   `_shared/ai/functions.ts` (sans choix : défaut du code, aucun changement de comportement ; retiré ou
   inconnu : repli sur le premier modèle du même fournisseur ; clé manquante : coupée, 503 `UNAVAILABLE`
   avant toute réservation) ; Console « Modèle par fonction » et bandeau d'attention ; côté espace,
   « Indisponible pour le moment » (`AiBlock` « unavailable »). La transcription OpenAI n'est pas encore
   proposée : le catalogue n'a pas de modèle OpenAI (adaptateur de transcription à faire, §12.1).
4. **Assistant** : `ai_assistant_models`, `ai_auto_rules`, aperçu du menu ; `ai_models_for` branché
   sur `ModelPicker` ; contrôle côté serveur.
5. **Espace** : section « Modèles proposés dans l'assistant », retrait seulement.
6. **Journal** : anciennes et nouvelles valeurs, filtre « Modèles IA ».

Chaque étape est livrable seule. Jusqu'à l'étape 4, l'assistant garde Sonnet et Opus.

## 11. Questions pour le chef

1. **Transcription** : elle passe aujourd'hui par ElevenLabs (`speech-to-text`), mais la spec montre
   « OpenAI · transcription ». Garde-t-on ElevenLabs par défaut et OpenAI comme choix possible, ou
   bascule-t-on ?
2. **Clés de déploiement** : le repli sur les variables d'environnement (§4) est-il acceptable pendant
   la transition ? Et faut-il les retirer une fois les clés dans Vault ?
3. **Modèle retiré** : la détection par erreur du fournisseur en plus du catalogue (§3) suffit-elle,
   ou faut-il interroger la liste des modèles du fournisseur chaque jour ?
4. **Sous-traitants** : qui met à jour `docs/legal` pour OpenAI avant la première clé ?

## 12. Réponses du chef (26/11)

1. **Transcription** : ElevenLabs reste le défaut. OpenAI est une option, proposée dès qu'une clé
   OpenAI existe ; pas de bascule.
2. **Transition** : oui, repli sur les variables d'environnement actuelles, sans toucher à
   `deploy.yml`.
3. **Modèle retiré** : la détection par le catalogue et par l'erreur du fournisseur suffit. Le bouton
   « Tester » de la Console revérifie à la demande.
4. **Sous-traitant OpenAI** : le dev prépare la mise à jour de `docs/legal` (sous-traitant, finalité,
   données envoyées, région). Elle n'est publiée qu'à l'ajout de la première clé OpenAI, sur décision
   du client, signalée au chef le moment venu.
