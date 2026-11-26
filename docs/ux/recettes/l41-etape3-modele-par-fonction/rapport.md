# Recette réelle : L41 étape 3 (Modèle par fonction) et en-tête de la Console sous 600 px

**Banc** :
- `claude/dev-mvp` à 9bb1012, qui contient a66d5e9, ab6f8d8, 39e91c4 et cfa7c9a ;
- app locale lancée comme en CI, faux backend, clés factices (`sk-fictive-…`) ;
- Chromium à 1440 × 900 et 390 px, en clair et en sombre.

**Tests** :
- e2e `console-modeles` : 32/32 en clair comme en sombre.
- Côté serveur, avec un deno installé dans le bac à sable :
  - `ai/lib_test` et les tests voisins : 38/38 ;
  - `_shared/ai/console_test` : 10/10 ;
  - mon propre scénario sur la fonction `resolve()` (voir « Repli » et « Sans choix »).

Spec de référence : `docs/ux/specs/l41-console-modeles-ia.md` §1 et §3.

| Lettre | Verdict |
| --- | --- |
| **A** · Modèle par fonction et bandeau d'attention | **ROUGE léger** (focus perdu après un choix ; explication de « Indisponible » invisible à 900 px de haut ; journal en identifiants techniques) |
| **B** · En-tête de la Console sous 600 px | **VERT** |

## A · Modèle par fonction : détail

| Point | Verdict |
| --- | --- |
| Changement immédiat, journalisé, toast « Annuler » | **ROUGE léger** : le fonctionnement est bon, mais le focus est perdu et le journal est illisible |
| Repli sur un modèle retiré | **VERT**, une remarque |
| Sans clé : entrée IA désactivée, « Indisponible pour le moment », aucun nom de fournisseur | **ROUGE léger** : l'entrée et le texte sont bons, mais l'explication est invisible à 900 px de haut et l'Assistant reste ouvert |
| Sans choix : comportement d'avant | **VERT** |
| Bandeau « A, B et C » | **VERT**, une remarque |

### Changement immédiat, journalisé, toast « Annuler »

Conforme :
- choisir « Claude Opus » pour Traduction enregistre le choix tout de suite, sans confirmation ;
- le toast « Traduction : Claude Opus » propose **Annuler**. Annuler revient au défaut, Claude Sonnet, et retire le choix ;
- chaque changement est journalisé, Annuler compris (3 lignes « Modèle IA changé ») ;
- aucune clé dans les réponses réseau de la Console.

Capture : `a2-toast-annuler.png`.

Défauts :
1. **Le focus est perdu après un choix**, à la souris comme au clavier (Entrée, Flèche bas, Entrée). Après le choix, `document.activeElement` est `body`, et la touche Tab repart sur « Application », en haut de la page. Avec Échap sans choix, le focus reste bien sur la liste. La cause est probablement le rechargement de la liste des fonctions, qui recrée la ligne. C'est un défaut WCAG 2.4.3 (ordre du focus) pour un utilisateur au clavier. Attendu : le focus revient sur la liste de la fonction changée.
2. **Le journal affiche des identifiants techniques** : « translate · défaut → claude-opus-5-5 » (`ai_set_function_model` écrit `p_fn` et les ids du catalogue). Attendu : le nom de la fonction et le nom du modèle, par exemple « Traduction · Claude Sonnet (défaut) → Claude Opus ». Capture : `a3-journal-identifiants-techniques.png`.

Écarts à la spec, non bloquants :
- les listes font **32 px** de haut, contre 40 px dans la spec §3 ;
- les options n'ont pas la tuile du fournisseur (20 px) ;
- « Historique des changements » ouvre « Équipe et journal » sans filtre sur « Modèles IA » (§1) ;
- dans le catalogue actuel, la Traduction n'a pas de modèle OpenAI : la règle « fournisseur sans clé grisé » ne peut pas se voir sur cette liste.

### Repli sur un modèle retiré

- Console : bordure orange sur la liste, « Ancien modèle (retiré) », état « Modèle retiré : repli sur Claude Haiku », et le bandeau « 1 fonction demande votre attention : Traduction (modèle retiré). ».
- Serveur : `resolve()` rend `fallback` et `claude-haiku-5-5`. Le modèle de repli est bien appliqué à la demande (`index.ts`, `explicit || status === 'fallback'`).

Capture : `a1-fonctions-retire-clair-coupee-sombre.png`.

**Remarque** : la spec dit « premier modèle connecté du même fournisseur ». Pour la Traduction, c'est donc Haiku, le modèle le plus rapide et le moins cher, alors que le défaut de la fonction est Sonnet. Je propose une amélioration de la règle, à arbitrer par le chef : repli sur **le modèle par défaut de la fonction** s'il est disponible, sinon sur le premier du fournisseur. Une traduction ne perd alors pas en qualité sans que personne ne l'ait choisi.

### Sans clé : l'espace voit « Indisponible pour le moment »

Banc : clé Anthropic retirée, clé ElevenLabs définie au déploiement.

Conforme :
- 7 fonctions sont coupées (assistant, rédaction, données, graphique, génération, cohérence, traduction), et la Voix reste active. La Console affiche « Clé Anthropic manquante : coupée » sur 4 lignes, avec une liste grisée.
- Dans l'éditeur, « Assistance IA » de la bulle a `aria-disabled="true"` et l'explication « Indisponible pour le moment. Réessayez plus tard. », sans lien vers le réglage.
- **Aucun nom de fournisseur** dans l'éditeur. Le relevé de tout le texte visible n'en trouve aucun : Anthropic, OpenAI, ElevenLabs, Claude, GPT.
- L'Assistant n'envoie aucune demande au serveur : 0 appel, donc aucun quota décompté.

Défauts :
1. **L'explication est invisible dans une fenêtre de 900 px de haut.** L'infobulle `.ai-tip` s'ouvre sous l'entrée. L'entrée étant en bas du panneau, l'infobulle sort de l'écran (y = 906 à 955 pour une fenêtre de 900). Dans une fenêtre de 1300 px, elle est bien visible. Capture : `a4-explication-900-vs-1300.png`, à gauche 900 px sans rien, à droite 1300 px.

   Le défaut vient du composant commun `DisabledEntry` et existait déjà avant cette livraison. Il compte ici, parce que cette phrase est la seule explication donnée à l'utilisateur. Attendu : l'infobulle s'ouvre au-dessus quand la place manque en dessous (même règle que EXT-LIST-01), ou la raison s'affiche en légende sous l'entrée.
2. **L'Assistant reste ouvert et actif.** Le bouton du rail s'ouvre, et les 3 suggestions et le champ restent actifs. « Indisponible pour le moment » n'apparaît qu'après un envoi. Capture : `a5-assistant-message-apres-envoi.png`. Attendu : le message s'affiche dès l'ouverture, et les suggestions et l'envoi sont désactivés, comme pour les autres entrées.

Remarque : si le serveur coupe une fonction pendant qu'un éditeur est déjà ouvert, il répond `503 UNAVAILABLE`. `AiWrite` (et les autres entrées) affiche alors l'erreur générique « La proposition n'a pas pu être générée. Réessayez. ». Je demande de traduire `UNAVAILABLE` en « Indisponible pour le moment » et de rafraîchir l'état IA.

### Sans choix : le comportement d'avant

- Sans ligne dans `ai_function_models`, le serveur garde le modèle de chaque tâche (`lib.ts`). Il ne remplace le modèle que si un choix explicite existe ou si un repli s'applique. Mon scénario `resolve()` donne Traduction → Sonnet, Rédaction → Haiku, Assistant → auto, Voix → ElevenLabs. Ce sont les modèles d'avant.
- Dans la Console, les 6 fonctions sont « Actif » et il n'y a pas de bandeau (e2e).

**Remarque** : « Rédaction automatique » affiche Claude Haiku, et son aide dit « Textes des étapes pendant la capture ». Pourtant, la fonction couvre aussi la génération de démo, les données et les graphiques. Or la génération utilise Sonnet par défaut. Choisir Haiku ici fait donc passer la génération de Sonnet à Haiku sans que l'admin le sache. Attendu : l'aide nomme tout ce que la fonction couvre (« Textes des étapes, génération, données et graphiques »), ou bien la génération a sa propre ligne.

### Bandeau d'attention

- « 1 fonction demande votre attention : Traduction (modèle retiré). »
- « 4 fonctions demandent votre attention : A (clé Anthropic manquante), B (…), C (…) et D (…). »
- La liste est bien faite (« A, B et C »), en clair comme en sombre.

**Remarque** : quand la même cause touche plusieurs fonctions, la phrase la répète. À 1440 px, elle tient sur 2 lignes ; à 390 px, sur 6. Je propose de regrouper par cause : « 4 fonctions coupées faute de clé Anthropic : A, B, C et D. »

## B · En-tête de la Console sous 600 px : VERT

| Largeur | Titre | Bouton « Historique des changements » |
| --- | --- | --- |
| 390 px | 358 px de large, une ligne | sous le sous-titre, aligné à gauche (x = 0), **12 px** d'écart |
| 599 px | 535 px de large | idem |
| 600 px et plus | une ligne | revient à droite du titre |

Aucun défilement horizontal, en clair comme en sombre. Capture : `b-en-tete-390.png`.

Demandes concernées : L41 étape 3 · Modèle par fonction (changement, toast Annuler, journal, repli d'un modèle retiré, fonctions coupées sans clé, comportement sans choix) · bandeau d'attention · entrée IA de l'espace « Indisponible pour le moment » · en-tête de la Console › Modèles IA sous 600 px.

## Contre-recette sur b6448ad (26/11) : 6 points VERT

**Banc** :
- `claude/dev-mvp` à b6448ad (avec 3056891) ;
- faux backend, clés factices, Chromium à 1440 × 900 (et 1300 pour l'infobulle), en clair et en sombre.

**Tests** : e2e `console-modeles` 38/38 en clair comme en sombre ; Deno `_shared/ai` et `ai` 38/38. J'ai rejoué mes sondes de la recette (focus, journal, infobulle, Assistant, repli, bandeau).

| Point | Verdict | Mesure |
| --- | --- | --- |
| 1 · Focus après un choix | **VERT** | Au clavier (Entrée, Flèche bas, Entrée) comme à la souris, le focus reste sur `#ai-fn-…`, avec la nouvelle valeur. Tab passe à la liste suivante (`#ai-fn-translate`). |
| 2 · Journal lisible, Historique filtré | **VERT** | « Traduction · Claude Sonnet (défaut) → Claude Opus », « Traduction · Claude Opus → Claude Sonnet (défaut) » (Annuler) et « Vérification de cohérence · … ». « Historique des changements » ouvre `#/console/equipe?objet=ai`, avec « Filtré sur Modèles IA ». |
| 3 · Infobulle au-dessus quand la place manque (fenêtre de 900 px) | **VERT** | À 900 px de haut, l'infobulle s'ouvre au-dessus de l'entrée (y = 804 à 854) et elle est au premier plan. À 1300 px, elle reste en dessous. |
| 4 · Assistant « Indisponible » dès l'ouverture | **VERT** | Le message s'affiche en tête du panneau dès l'ouverture. Les 3 suggestions ont `aria-disabled="true"`, et le champ et l'envoi sont désactivés. Aucun nom de fournisseur. |
| 5 · Repli sur le défaut de la fonction | **VERT** | Console : « Modèle retiré : repli sur Claude Sonnet ». Serveur : `resolve()` rend `fallback` et `claude-sonnet-5-5` pour la Traduction. |
| 6 · Bandeau groupé par cause | **VERT** | « 4 fonctions coupées faute de clé Anthropic : Assistant IA de l'éditeur, Rédaction automatique, Vérification de cohérence et Traduction. », sur une ligne à 1440 px. « 1 fonction en repli, son modèle est retiré : Traduction. » |

Captures :
- `b6448ad-bandeau-repli.png` ;
- `b6448ad-infobulle-900-assistant.png` (infobulle au-dessus à 900 px, et Assistant coupé) ;
- `b6448ad-journal-lisible.png`.

**Points non bloquants** :
- Les listes font **40 px** : conforme.
- L'aide de « Rédaction automatique » devient « Textes des étapes pendant la capture (extension), génération, données et graphiques » : conforme.
- La tuile du fournisseur dans les options est reportée, faute d'icône par option dans la liste commune : accepté.
- **Message 503** : partiel.
  - Conforme pour l'Assistant, la voix et les dialogues, qui disent « Indisponible pour le moment ».
  - Pour l'« Assistance IA » d'une bulle, quand la fonction est coupée pendant que l'éditeur est ouvert, l'état est bien rechargé et l'entrée passe en désactivée. Mais **aucun message ne s'affiche** : le menu se ferme, le focus retombe sur `body`, et seule l'infobulle de l'entrée, au survol ou au focus, donne la raison.
  - À reprendre dans un prochain lot : rendre le focus à l'entrée désactivée, ce qui affiche l'infobulle, ou annoncer « Indisponible pour le moment » dans la zone `aria-live`.

**Note pour le chef** : 3056891 modifie la migration `20261201380000_ia_modele_par_fonction.sql` au lieu d'en ajouter une nouvelle. C'est sans risque seulement si cette migration n'a encore été appliquée nulle part.

Demandes concernées : L41 étape 3 · focus après un choix · journal lisible et Historique filtré · infobulle de l'entrée indisponible · Assistant coupé · repli sur le défaut de la fonction · bandeau groupé par cause.

## Vérification sur 52fb330 (26/11) : Assistance IA coupée pendant l'édition, VERT

**Banc** : `claude/dev-mvp` à 52fb330, à 1440 × 900 en clair et en sombre (plus 1440 × 1300 en clair). Je coupe la fonction côté serveur pendant que l'éditeur est ouvert : réponse `503 UNAVAILABLE`, et état IA mis à jour.

| Contrôle | Résultat |
| --- | --- |
| Annonce aria-live | « Indisponible pour le moment. Réessayez plus tard. » écrit dans la zone `role=status` et dans la zone `role=alert` **364 ms** après la demande. Mesuré avec un observateur des mutations. |
| Focus | Il revient sur l'entrée désactivée « Assistance IA » (`aria-disabled="true"`), **au clavier comme à la souris**, dans les 6 cas. Il ne retombe plus sur `body`. |
| Description | `aria-describedby` donne « Indisponible pour le moment. Réessayez plus tard. » : elle est relue avec le focus. |
| Infobulle | Au clavier, elle s'affiche au premier plan (au-dessus de l'entrée, à 900 px de haut). À la souris, le focus n'est pas « visible » : l'infobulle reste cachée jusqu'au survol, comme partout ailleurs dans l'app. |

Capture : `52fb330-coupee-pendant-edition.png` (clavier, clair et sombre, à 900 px).

Remarque non bloquante : un lecteur d'écran peut entendre la phrase jusqu'à trois fois (status, alert, puis description au focus). Une seule zone suffirait (`role=status`), puisque le focus relit déjà la description.

Demandes concernées : L41 étape 3 · Assistance IA d'une bulle coupée pendant l'édition (annonce, focus, description, infobulle).
