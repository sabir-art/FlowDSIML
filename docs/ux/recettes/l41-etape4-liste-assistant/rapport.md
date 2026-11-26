# Recette réelle : L41 étape 4 (Assistant IA : modèles proposés, règles d'Auto)

**Banc** :
- `claude/dev-mvp` à 469a882, qui contient 07cee50 et 87567c8 ;
- faux backend, clés factices (`sk-fictive-…`) ;
- Chromium à 1440 × 900 et 390 px, en clair et en sombre.

**Tests** :
- e2e : `console-modeles` 48/48 et `assistant-modele` 15/15, en clair comme en sombre ;
- Deno `_shared/ai` et `ai` : 44/44 ;
- mon propre scénario sur les fonctions `menuOf`, `autoPick`, `fallbackOf` et `requested` ;
- mes sondes dans la Console et dans l'éditeur.

Spec de référence : `docs/ux/specs/l41-console-modeles-ia.md` §4.

## Verdicts par point

| Point | Verdict |
| --- | --- |
| **Console** · liste ordonnée : glisser, Monter et Descendre, focus gardé | **VERT** |
| **Console** · case « Proposer » | **VERT** |
| **Console** · étiquettes Sans, Recommandé et Bêta | **VERT**, remarque sur le journal |
| **Console** · règles d'Auto | **VERT** |
| **Console** · aperçu du menu | **VERT** |
| **Console** · impossible de décocher le dernier modèle | **VERT** |
| **Console** · lecture seule | **VERT** |
| **Éditeur** · le ModelPicker lit le menu du serveur, groupes Auto, Recommandé et « Autres modèles » | **ROUGE léger** : « Autres modèles » vide, et une phrase qui renvoie à un réglage qui n'existe pas |
| **Éditeur** · l'entrée OpenAI « Bientôt » a disparu | **VERT** |
| **Décision 3** · une règle dont le modèle est décoché affiche « (non proposé) » et Auto prend le premier du menu | **ROUGE léger** : rien ne signale l'écart, et Auto peut prendre un modèle Bêta |

Les décisions 1 et 2 du chef sont notées. Vérifié : sans réglage, Auto prend Sonnet pour une demande courte comme pour une analyse. Réglée sur Opus, l'analyse passe bien sur Opus.

## Console

État de départ :
- Sonnet ☑ Recommandé, Opus ☑ Recommandé, Haiku ☐ Sans étiquette ;
- règles : Sonnet, Sonnet, « Le suivant de la liste ».

Capture : `1-console-liste-regles-apercu-clair-sombre.png`.

- **Ordre** :
  - « Descendre Claude Sonnet » au clavier (Entrée, deux fois), puis « Monter Claude Haiku » à la souris : l'ordre change, il est enregistré côté serveur (positions 1 à 3), et l'aperçu suit tout de suite ;
  - **le focus reste sur le bouton utilisé** (`ai-as-down-claude-sonnet-5-5`, `ai-as-up-claude-haiku-5-5`) ;
  - glisser la 3e ligne sur la 1re fonctionne ;
  - la poignée est `aria-hidden` et le clavier passe par Monter et Descendre, comme le prévoit la spec.
- **Proposer et étiquette** : cocher Haiku puis choisir « Bêta » enregistre les deux, et le focus reste sur la liste « Étiquette ». Dans l'aperçu, Haiku (Bêta) va sous « Autres modèles ».
- **Règles d'Auto** :
  - « Analyse de toute la démo » → Claude Haiku est enregistré, le focus reste sur la liste, et un toast confirme ;
  - le repli propose « Le suivant de la liste » puis les modèles ;
  - un modèle non proposé reste visible mais grisé.
- **Dernier modèle** : décocher le dernier est refusé. La case reste cochée et « Gardez au moins un modèle. » s'affiche sous la liste (`role=alert`, reliée par `aria-describedby`). Le serveur garde 1 modèle proposé.
- **Lecture seule** : les 3 cases et les 6 listes sont désactivées, les 6 flèches ont `aria-disabled`, et les poignées ont `draggable=false`. Un clic forcé sur Descendre ne change rien.
- **390 px** : pas de défilement horizontal, rien ne déborde, les lignes passent en colonne. Capture : `6-console-390.png`.

Captures : `2-dernier-modele-et-lecture-seule.png`.

Remarques non bloquantes :
1. **Le journal ne dit pas ce qui a changé.** Un changement d'ordre et un changement d'étiquette écrivent la même ligne, « Liste de l'assistant : Claude Sonnet, Claude Haiku, Claude Opus ». Attendu, comme pour l'étape 3 : « Claude Haiku : étiquette Bêta », « Claude Haiku : proposé », « Ordre : Haiku, Sonnet, Opus ».
2. **Les toasts s'empilent.** Trois changements rapides donnent trois « Liste de l'assistant enregistrée » les uns sur les autres, et ils couvrent les règles d'Auto. Le même message devrait remplacer le précédent.
3. À 390 px, l'écart entre une liste de règle et le libellé de la règle suivante n'est que de 4 px : le libellé semble aller avec la liste du dessus. Demande : 12 px entre deux règles.

## Décision 3 · règle dont le modèle n'est plus proposé : ROUGE léger

Je garde volontiers la valeur visible (« Claude Sonnet (non proposé) »), c'est honnête. Mais en l'état :
- la liste fait 220 px et affiche « Claude Sonnet (non pro… », tronqué, sans bordure ni message (`3-regle-non-proposee-sans-alerte.png`) ;
- l'admin ne sait pas quel modèle Auto utilise vraiment ;
- surtout, **Auto prend le premier du menu, quelle que soit son étiquette**. Avec Haiku Bêta en tête et Sonnet décoché, `autoPick` rend `claude-haiku-5-5` : toutes les demandes courtes et toutes les analyses partent sur un modèle Bêta, sans que personne l'ait choisi.

Demande :
1. Même motif que « Modèle retiré » à l'étape 3 : bordure orange sur la liste, et sous la règle « Non proposé : Auto utilise {modèle} ». Le bandeau d'attention compte aussi la règle : « 1 règle d'Auto vise un modèle non proposé ».
2. Le choix de remplacement prend **le premier modèle Recommandé** du menu, sinon le premier du menu.

## Éditeur

- Le ModelPicker lit le menu du serveur (`assistant_models`). L'ordre et les cases de la Console sont respectés, en clair comme en sombre :
  - défaut : Auto, Recommandé (Sonnet, Opus), Autres modèles ;
  - réglé : Auto, Recommandé (Sonnet), puis Autres modèles, qui contient Haiku avec son étiquette « Bêta ».
- Plus d'OpenAI ni de « Bientôt » dans l'éditeur.
- Côté serveur, un modèle demandé hors du menu est refusé (403 MODEL), et sans clé le menu est vide.

Captures : `4-editeur-menu-clair-sombre.png` et `5-editeur-autres-modeles-vide-et-note.png`.

**Défauts (ROUGE léger)** :
1. **« Autres modèles » vide.** Dans la configuration par défaut (aucun modèle coché hors Recommandé), l'entrée « Autres modèles › » est quand même affichée. Elle ouvre un sous-menu sans aucun modèle, avec seulement la phrase d'aide. Attendu : masquer l'entrée quand il n'y a aucun autre modèle.
2. **La phrase « Le propriétaire choisit les modèles dans Paramètres › Assistance IA. » est fausse aujourd'hui.** Cette page n'a pas de section de modèles : seulement « Assistance IA » et « Voix et sous-titres ». La section « Modèles proposés dans l'assistant » (spec §5) n'est pas encore livrée. Attendu : retirer la phrase jusqu'à la livraison du §5, ou bien livrer le §5.

Demandes concernées : L41 étape 4 · Console › Modèles IA › Assistant IA (liste ordonnée, Proposer, étiquettes, règles d'Auto, aperçu, dernier modèle, lecture seule) · ModelPicker de l'éditeur (menu du serveur, groupes, fin d'OpenAI « Bientôt ») · décision 3 (règle dont le modèle n'est plus proposé).

## Contre-recette sur bb8dd58 (26/11) : 3 points VERT, non bloquants VERT

**Banc** :
- `claude/dev-mvp` à bb8dd58, qui contient ba1e186 et 69999b1 ;
- faux backend, clés factices ;
- Chromium à 1440 × 900 et 390 px, en clair et en sombre.

**Tests** :
- e2e `console-modeles` 56/56 et `assistant-modele` 15/15, en clair comme en sombre ;
- Deno 45/45 ;
- mes sondes de la recette, rejouées.

| Point | Verdict | Mesure |
| --- | --- | --- |
| 1 · « Autres modèles › » masqué quand le sous-menu est vide | **VERT** | Configuration par défaut : le menu contient Auto, Recommandé (Sonnet, Opus), et plus d'entrée « Autres modèles ». Avec Haiku Bêta proposé, l'entrée revient et ne contient que Haiku (Bêta). |
| 2 · Phrase du propriétaire retirée | **VERT** | Plus affichée dans le sous-menu. La clé `ai.model.ownerNote` reste dans les fichiers de langue mais n'est plus utilisée : à supprimer au passage. |
| 3 · Règle dont le modèle n'est plus proposé | **VERT** | Bordure orange (#855104 en clair, #f8bb61 en sombre). Sous la liste, « Non proposé : Auto utilise Claude Opus », relié par `aria-describedby`. Bandeau : « 2 règles d'Auto visent un modèle qui n'est plus proposé : demandes courtes et analyse de toute la démo. » Liste de 272 px, sans troncature (« Claude Sonnet (non proposé) » en entier). Serveur : Haiku Bêta en tête et Sonnet décoché donnent `autoPick` = **Opus**, le premier Recommandé. Quand seul un Bêta est proposé, Auto le prend : c'est le seul choix possible. |

Captures : `bb8dd58-regle-non-proposee-bandeau.png`, `bb8dd58-editeur-menu-defaut-et-regle.png`.

**Points non bloquants**

| Point | Verdict | Mesure |
| --- | --- | --- |
| Journal | **VERT** | Chaque changement a sa ligne : « Liste de l'assistant · Claude Haiku : proposé », « · Claude Haiku : étiquette Bêta », « · Claude Sonnet : retiré », « · Ordre : Claude Sonnet, Claude Opus ». |
| Un seul toast pour un même message (`Toast.tsx`, changement global) | **VERT** | 3 changements d'étiquette d'affilée donnent 1 seul « Liste de l'assistant enregistrée ». Les toasts avec action (Annuler) s'empilent encore, ce qui est voulu. Rien de cassé ailleurs : console 56, acces-mot-de-passe 28, acces-email 33, assistance-ia 41, assistant 18, distribute 93, editor 41, glossary 21, integrations 41 et generer 27, tous verts. |
| 8 px entre les règles à 390 px | **VERT** | 8 px mesurés entre deux règles. J'avais demandé 12 px, mais avec le message « Non proposé » placé sous la liste, chaque règle se lit comme un groupe. J'accepte 8 px. Capture : `bb8dd58-regles-390.png`. |
| ba1e186 · `AiWrite` n'annonce qu'une fois | **VERT** | Plus de `role=alert` : seule la zone `role=status` reçoit « Indisponible pour le moment ». Pendant le focus automatique, l'entrée n'a pas de description, ce qui évite la double lecture. Après Maj+Tab puis Tab, la description revient : « Indisponible pour le moment. Réessayez plus tard. ». Au clavier, l'infobulle reste visible au premier plan. |

Demandes concernées : L41 étape 4 · ModelPicker (« Autres modèles » vide masqué, phrase du propriétaire retirée) · règle d'Auto dont le modèle n'est plus proposé (alerte, bandeau, premier Recommandé) · journal détaillé · toast unique · espacement des règles à 390 px · annonce unique dans AiWrite.
