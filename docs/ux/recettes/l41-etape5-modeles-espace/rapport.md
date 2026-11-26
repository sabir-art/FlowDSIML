# Recette réelle : A) focus de la carte Présenter (5f75527) et B) L41 étape 5, modèles de l'espace

**Banc** :
- `claude/dev-mvp` à 5f75527, qui contient 1fe6d0f, 8deff77, f768c8a et 073d0d4 ;
- faux backend, clés factices ;
- Chromium à 1440 × 900 et 390 px, en clair et en sombre.

| Lettre | Verdict |
| --- | --- |
| **A** · focus de la carte Présenter | **VERT** |
| **B** · Paramètres › Assistance IA › « Modèles proposés dans l'assistant » | **ROUGE léger** (un nouveau modèle arrive coché dans un espace jamais réglé) |

## A · Focus de la carte Présenter : VERT

- **Au clavier** (flèche dans le groupe), la carte cochée reçoit `outline: 2px solid` en `--fd-color-focus` (#a3195b en clair, #cf86a9 en sombre), **décalé de 2 px**. Sa bordure et son trait de sélection restent en place.
- **À la souris** (clic sur la 2e carte), il n'y a pas de contour : la sélection seule s'affiche, comme avant.
- Quand le focus quitte la carte (Tab), le contour disparaît.
- presenter-l66 : 28/28 en clair comme en sombre.

Capture : `a-carte-presenter-contour-focus.png`.

## B · Modèles proposés dans l'assistant (espace)

**Tests** : e2e assistance-ia-modeles 16/16, assistance-ia 41/41, console-modeles 56/56 et assistant-modele 15/15, en clair comme en sombre. J'ai aussi fait mes propres sondes par rôle et par état.

| Point | Verdict | Mesure |
| --- | --- | --- |
| Auto en tête, coché, « Toujours proposé » | **VERT** | Case cochée et désactivée, en gris, avec « Toujours proposé » et l'aide « Équilibre la vitesse, l'effort et le coût ». |
| Seuls les modèles cochés dans la Console, avec leur étiquette | **VERT** | Départ : Sonnet [Recommandé] et Opus [Recommandé]. Quand la Console coche Haiku Bêta, il apparaît avec « Bêta ». |
| Le propriétaire retire un modèle ; décocher le dernier est refusé | **VERT** | Retirer Opus : le serveur garde `["claude-sonnet-5-5"]` et le toast « Modèles de l'assistant enregistrés » s'affiche. Décocher Sonnet ensuite : la case reste cochée, et « Gardez au moins un modèle coché. » s'affiche (role=alert, relié par `aria-describedby`). |
| Admin en lecture seule, autres rôles sans la section | **VERT** | Admin : les 3 cases sont désactivées (grises), avec « Réservé aux propriétaires ». Éditeur et lecteur : la section est absente. |
| **Un modèle ajouté ensuite arrive décoché** | **ROUGE léger** | Voir plus bas. |
| Le menu de l'éditeur suit l'espace | **VERT** | Opus retiré : le menu montre Auto et Sonnet seulement. Un modèle hors menu est refusé côté serveur (403 MODEL, tests Deno). |
| La note du propriétaire revient dans « Autres modèles » | **VERT** | Sous-menu : « Claude Haiku (Bêta) », puis « Le propriétaire choisit les modèles dans Paramètres › Assistance IA. ». La phrase est vraie désormais. |
| 390 px, clair et sombre | **VERT** | Une colonne, pas de défilement horizontal (`b2-section-390.png`). |

Captures : `b1-section-proprietaire-et-admin.png` (propriétaire en clair et en sombre, admin en sombre).

### Le défaut : un nouveau modèle arrive coché

- **Espace déjà réglé** (le propriétaire a retiré Opus) : la Console ajoute Haiku Bêta, et Haiku arrive **décoché**. C'est conforme.
- **Espace jamais réglé** (`settings.ai.models` absent, ce qui veut dire « tous les modèles proposés ») : Haiku arrive **coché**, et il apparaît tout de suite dans l'éditeur, sous « Autres modèles ».

Or l'aide affichée dans la section dit « Les nouveaux modèles ajoutés par TutoClick arrivent décochés. », comme la spec §5. C'est faux pour tous les espaces qui n'ont jamais touché la liste, c'est-à-dire la plupart. Un modèle Bêta peut alors arriver dans leur éditeur sans que le propriétaire l'ait choisi.

**Correction demandée** : quand la Console ajoute un modèle au menu (`ai_assistant_set`), écrire, pour chaque espace sans liste, la liste d'avant le changement. Le nouveau modèle arrive alors décoché partout. Une autre option : retenir la date d'ajout de chaque modèle, et ne cocher par défaut que les modèles antérieurs à la date du réglage de l'espace. À vérifier dans l'e2e avec un espace jamais réglé.

### f768c8a · case cochée et désactivée en gris (design system)

Vérifié sur 3 autres écrans en lecture seule, en clair et en sombre :
- **Éditeur**, rôles lecteur, commentateur et relecteur : 5 cases, dont « Animation de pulsation ». La case est grise (#4f5966 en clair, #a9b3bf en sombre) et la coche reste lisible.
- **Console › Modèles IA**, rôle de plateforme Lecture seule : les cases « Proposer » de Sonnet et Opus sont grises.
- **Paramètres › Assistance IA**, rôle admin : les 3 cases sont grises.

Les interrupteurs (« Lecture automatique », « Sous-titres affichés ») ne sont pas touchés : leur case est transparente. Désactivés, ils restent prune pâle. Aucun autre écran n'a de case cochée et désactivée parmi les 11 pages des Paramètres, de la Console et du Partager que j'ai parcourues. Capture : `b3-case-grise-editeur-lecture-seule.png` (propriétaire, puis lecteur).

Remarques non bloquantes :
1. Le gris de la case cochée et désactivée diffère de l'interrupteur désactivé, qui reste prune pâle. C'est cohérent avec le radio, comme le dit f768c8a, mais à harmoniser un jour dans FIELD-01.
2. Dans « Gardez au moins un modèle coché. », l'icône touche le texte : il faut 6 px d'écart, comme dans les autres `field-error`.

Demandes concernées : A) focus de la carte Présenter (WCAG 2.4.7) · B) L41 étape 5, Paramètres › Assistance IA › Modèles proposés dans l'assistant (Auto, liste de la Console, retrait, dernier modèle, rôles, nouveau modèle décoché, menu de l'éditeur, note du propriétaire) · case cochée et désactivée en gris (f768c8a).
