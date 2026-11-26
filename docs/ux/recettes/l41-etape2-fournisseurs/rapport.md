# Recette réelle : L41 étape 2, Console › Modèles IA › Fournisseurs

**Banc** : branche `claude/dev-mvp` à 24882d8, soit 2ed3712 et les commits qui le suivent. App locale, faux Supabase, **clés factices uniquement** (`sk-fictive-…`) : aucune vraie clé saisie ni testée. Chromium à 1440 px, en clair et en sombre.

| e2e | Clair | Sombre |
| --- | --- | --- |
| `console-modeles` | 20/20 | 20/20 |
| `console` | 56/56 | 56/56 |
| `modeles` | 31/31 | 31/31 |

J'ai ajouté mes propres captures (succès, Tester, clé de déploiement, lecture seule) et une mesure de la fenêtre. Référence : spec `l41-console-modeles-ia.md` §1-2.

| Point | Verdict | Constat |
| --- | --- | --- |
| État vide | **VERT**, remarque | « Aucun fournisseur connecté », avec l'explication et « Ajouter une clé ». Les 3 fournisseurs sont en « Clé manquante », plus « Autres fournisseurs · Bientôt ». |
| États Connecté, Clé manquante, Clé refusée, « Clé définie au déploiement » | **VERT** | Connecté (vert, coche) avec « Clé ajoutée le 26 nov. 2026 ». Manquante en orange. Refusée en framboise, avec la cause « Le fournisseur refuse la clé (401) ». La clé de déploiement affiche Connecté et « Clé définie au déploiement ». La colonne d'état est alignée. |
| Fenêtre MODAL-01 | **VERT**, remarque | Gabarit sm. Champ mot de passe, **sans « Afficher »** (0 bouton). Aide « Collée une seule fois… ». Erreur sous le champ, avec `aria-invalid` et `aria-describedby` qui relie l'aide et l'erreur. Le champ est vidé après l'échec. |
| Toast, et « Tester et enregistrer » qui ne garde rien en cas d'échec | **ROUGE léger** | Le comportement est conforme : un échec n'enregistre rien, un succès donne « Connecté » et un toast, « Tester » affiche « Anthropic répond (320 ms) ». **Mais** le toast de succès coupe « 320 » et « ms » sur deux lignes (`toast-320-ms-coupe.png`), en clair comme en sombre : la règle NUM-01 (espace insécable entre le nombre et l'unité) n'est pas tenue. |
| Lecture seule | **VERT** | Bandeau « Lecture seule… ». Tout reste visible, et les 4 actions sont désactivées (`aria-disabled`). Aucune fenêtre ne s'ouvre, rien n'est écrit. |
| Onglet après « Équipe et journal » | **VERT** | Vue d'ensemble · Retours · Backlog · Nouveautés · Équipe et journal · **Modèles IA**. Un client qui ouvre #/console/modeles est renvoyé à l'accueil. |
| Clair et sombre | **VERT** | Les deux thèmes sont conformes, sans violation axe sérieuse. |
| Aucune clé dans le DOM ni sur le réseau | **VERT** | Aucune clé factice dans le DOM ni dans les 13 réponses du serveur. Le journal note ajoutée, remplacée et testée, sans la clé. |

## Correctif demandé (ROUGE léger)

- Toast : « … répond (320 ms) », avec une espace insécable entre la durée et l'unité. Même règle pour « Anthropic répond (320 ms) » et pour toute durée affichée dans la Console.

## Remarques non bloquantes

1. **État vide : 4 boutons primaires** à l'écran (« Ajouter une clé » et 3 × « Ajouter la clé »). Je propose que l'action de ligne « Ajouter la clé » soit **secondaire** (contour) quand l'état vide porte déjà le bouton primaire, pour qu'un seul se détache. Hors état vide, une ligne « Clé manquante » peut garder le primaire.
2. **Fenêtre** : l'erreur arrive **sous l'aide**, à 50 px du champ. Je propose de la placer juste sous le champ, avant l'aide, pour la proximité ; l'aide reste dessous.

Demandes concernées : L41 · Console › Modèles IA › Fournisseurs (état vide, états des clés, fenêtre d'ajout de clé, test, lecture seule, onglet, aucune clé affichée).
