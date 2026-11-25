# Recette d764bb0 — SETTINGS-HDR-01, variante C : VERT

Recette réelle du 25/11 sur l'app locale (faux backend, données fictives). Elle porte sur 8 pages des Paramètres (Général, Équipe, Intégrations, Assistance IA, Page publique, Profil, Clés d'accès, Notifications), à 1440 et 390, en clair et en sombre, soit 32 vues.

## Tests du dev

| Test | Clair 1440 | Clair 390 | Sombre 1440 | Sombre 390 |
|---|---|---|---|---|
| parametres-entete | 15/15 | 15/15 | 15/15 | 15/15 |
| parametres-espacement | 56/56 | 56/56 | 56/56 | 56/56 |

## Mesures UX (32 vues)

- **Fond de la bande** : il vaut `--fd-color-surface-muted` (#f6f8fa en clair, #0f1216 en sombre). Il va du haut de la colonne de contenu jusqu'au filet, et d'un bord à l'autre de la colonne.
- **Du filet à la première section** : **40 px** à 1440 et **32 px** à 390, sur les 8 pages.
- Aucun débordement horizontal, à 1440 comme à 390.
- Le titre, l'aide et les actions sont inchangés, alignés sur le retrait des sections.

Captures : les fichiers PNG de ce dossier.

## Défaut d'espacement déjà présent avant ce commit (non bloquant)

Sur les pages dont le contenu ne commence pas par un titre de section, le **premier texte** est plus bas que sur les autres pages : il commence par une ligne de réglage, dont le retrait intérieur de 20 px s'ajoute aux 40 px.

| Page | Premier texte sous le filet (1440 / 390) | Attendu |
|---|---|---|
| Général, Équipe, Profil, Notifications | 40 / 32 | 40 / 32 |
| Assistance IA (« Activer l'Assistance IA ») | **60 / 52** | 40 / 32 |
| Page publique (interrupteur « Page publique ») | **60 / 52** | 40 / 32 |
| Intégrations (pastilles) et Clés d'accès (tableau) | 50 et 52 / 42 et 32 | normal : retrait intérieur de la pastille ou de la cellule |

**Correction demandée** : quand une ligne de réglage est le premier élément de la page, elle perd son retrait du haut (`padding-top: 0`). C'est la même règle qu'après un titre de section. Le texte arrive alors à 40 et 32 px du filet, comme sur les autres pages.
