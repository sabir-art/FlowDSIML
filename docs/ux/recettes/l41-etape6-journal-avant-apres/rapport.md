# Contre-recette L41 étape 5 et recette L41 étape 6 (dev-mvp 6fdd2c7)

**Banc** :
- `claude/dev-mvp` à 6fdd2c7, qui contient 69a8273, puis 248cf7b, 2a20be2, b536c56 et fdad3c0 ;
- faux backend, clés factices ;
- Chromium à 1440 × 900, en clair et en sombre.

| Lettre | Verdict |
| --- | --- |
| **Étape 5** · nouveau modèle décoché, icône à 8 px | **VERT**, une remarque importante |
| **Étape 6** · colonnes Avant et Après du journal | **ROUGE léger** : les listes de l'assistant sont à resserrer |
| Trouvé en passant (étape 4) | Section « Assistant IA » figée après l'ajout de la clé Anthropic |

## Étape 5 : VERT

**Tests** : e2e assistance-ia-modeles 20/20 en clair comme en sombre ; Deno 47/47.

| Contrôle | Résultat |
| --- | --- |
| Espace jamais réglé, Haiku proposé par la Console **après** la création de l'espace | Haiku arrive **décoché** (liste de l'espace : `null`). L'éditeur montre Auto, Sonnet et Opus, sans Haiku. |
| Le propriétaire coche Haiku | La liste est enregistrée (Sonnet, Opus, Haiku), et Haiku entre dans l'éditeur sous « Autres modèles », avec « Bêta » et la note du propriétaire. |
| Espace existant (modèles datés du 1er janvier 2000) | La liste reste la même : Auto, Sonnet, Opus, tous cochés. |
| Icône de « Gardez au moins un modèle coché. » | **8 px** entre l'icône et le texte, en clair comme en sombre. |

Capture : `etape5-nouveau-modele-decoche-et-icone-8px.png`.

**Remarque importante, non bloquante**. Le déclencheur `ai_assistant_proposed_at` remet `proposed_at` à `null` quand la Console décoche un modèle, puis à `now()` quand elle le recoche. Une erreur de clic dans la Console (décocher Sonnet, puis le recocher) date donc Sonnet d'aujourd'hui. **Tous les espaces jamais réglés perdent alors Sonnet**, en silence, et ne le retrouvent que si leur propriétaire le recoche. Correction proposée : garder la date de la **première** proposition (`first_proposed_at`, jamais remise à `null`), et ne dater d'aujourd'hui qu'un modèle qui n'a jamais été proposé.

## Étape 6 : ROUGE léger

**Tests** : e2e console 56/56 et console-modeles 58/58, en clair comme en sombre.

J'ai fait dans la Console :
- un ajout de clé refusé (OpenAI), un ajout réussi (Anthropic), un test et un remplacement ;
- Traduction → Claude Opus ;
- la règle « analyse de toute la démo » → Opus ;
- l'étiquette Bêta sur Opus.

| Point | Verdict | Mesure |
| --- | --- | --- |
| Valeurs lisibles : fonction, règle d'Auto, clés | **VERT** | « Traduction : Claude Sonnet (défaut) → Claude Opus » ; « Auto · analyse de toute la démo : Claude Sonnet → Claude Opus » ; « Anthropic : Aucune clé → Clé enregistrée, test réussi » ; remplacement « Clé enregistrée → Clé remplacée, test réussi ». |
| Clés : un état, jamais la clé | **VERT** | Aucune trace de la clé dans le DOM ni dans le CSV (recherche de `sk-fictive`). L'ajout refusé n'écrit rien, ce qui est logique puisque rien n'a été gardé. |
| Filtre « Modèles IA » | **VERT** | « Historique des changements » ouvre le journal filtré sur les 6 lignes IA, avec « Filtré sur Modèles IA ». « Tout afficher » rend les 10 lignes, dont « Connexion à la console ». |
| Export CSV | **VERT** | En-tête `date;personne;action;objet;avant;après`. Les 6 lignes correspondent au filtre, avec les mêmes valeurs qu'à l'écran. |
| **Listes longues de l'assistant** | **ROUGE léger : à resserrer** | Voir plus bas. |

Capture : `etape6-journal-filtre-valeurs.png`.

### Listes de l'assistant : je tranche, à resserrer

Avec 3 modèles, chaque ligne « Liste de l'assistant modifiée » répète **toute la liste avec les étiquettes** dans Avant et dans Après, sur des colonnes de 205 px. Une ligne monte à **6 lignes de texte** (`etape6-listes-longues-6-lignes.png`) : le journal devient difficile à parcourir, alors que la colonne Objet dit déjà ce qui a changé.

Demande : à l'écran, Avant et Après ne montrent que **ce qui change**, et l'export CSV garde les listes complètes.

| Objet | Avant | Après |
| --- | --- | --- |
| Claude Opus : étiquette | Recommandé | Bêta |
| Claude Haiku : proposition | Non proposé | Proposé |
| Ordre | Sonnet · Opus · Haiku | Haiku · Sonnet · Opus |

- Pour l'ordre : les noms courts, sans étiquette, sur une seule ligne.
- Le préfixe « Liste de l'assistant · » de l'objet répète la colonne Action : à retirer.

Remarques non bloquantes :
- « Clé IA testée : Test réussi → Test réussi ». L'Avant devrait être le résultat du test précédent, ou « — ».
- Dans le CSV, la colonne action contient le code technique (`ai.assistant_list`, `ai.auto_rule`) au lieu du libellé de l'écran (« Liste de l'assistant modifiée »).
- La date tient sur 2 lignes (colonne de 128 px) : elle tiendrait sur une ligne en 148 px, pris sur Objet.

## Trouvé en passant (étape 4) : section « Assistant IA » figée après l'ajout de la clé

Sans clé Anthropic, j'ajoute la clé dans la même page. La carte Fournisseurs et « Modèle par fonction » se mettent à jour, mais **la section « Assistant IA : modèles proposés » reste comme sans clé** :
- les 3 modèles restent désactivés, avec « Ajoutez la clé Anthropic » ;
- l'aperçu ne montre que « Auto » ;
- les règles d'Auto proposent leurs modèles grisés.

Il faut recharger la page pour que tout redevienne normal (`etape4-section-figee-apres-ajout-cle.png`). De plus, sans clé, le bandeau dit « 2 règles d'Auto visent un modèle qui n'est plus proposé ». C'est faux : les modèles sont proposés, il manque seulement la clé, et la ligne « 4 fonctions coupées faute de clé Anthropic » le dit déjà.

Correction :
- recharger `console_assistant` après l'enregistrement ou le test d'une clé ;
- dans le bandeau, ne pas compter une règle comme « non proposée » quand son modèle est proposé mais sans clé.

Demandes concernées : L41 étape 5 · nouveau modèle décoché dans un espace jamais réglé · icône de l'erreur à 8 px · L41 étape 6 · journal de la Console, colonnes Avant et Après (fonction, règle d'Auto, liste de l'assistant, clés), filtre Modèles IA, export CSV · étape 4 · section Assistant IA après l'ajout d'une clé.
