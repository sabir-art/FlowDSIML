# Vérification réelle : correctif du job Accessibilité (dev-mvp ceab0ef)

**Banc** :
- `claude/dev-mvp` à e99ae5e, qui contient ceab0ef ;
- faux backend ;
- Chromium à 1440 × 900 (et 390 px pour le Partager), en clair et en sombre ;
- focus amené au clavier, pour obtenir `:focus-visible`.

**e2e**, en clair et en sombre : l45-espacements 24/24, l48f-integrations 47/47 (et 47/47 avec `SLOW_ANIM=1`, qui reproduit la lenteur de la CI), assistant-modele 15/15, presenter-l66 27/27, partager-lien 30/30.

## Verdict : ROUGE léger, à cause de la carte Présenter

| Retouche | Verdict | Mesure |
| --- | --- | --- |
| 1 · Pilule « Modèle : Auto », padding de 12 px | **VERT** | Padding 12 px des deux côtés, chevron à **12 px** du bord, hauteur 32 px. Focus : trait intérieur de 2 px en `--fd-color-focus` (#a3195b en clair, #cf86a9 en sombre). Contraste avec le fond : 7,4:1 en clair et 6,4:1 en sombre. Capture : `1-pilule-chevron-12-focus-x3.png` (agrandie 3 fois). |
| 2 · Focus de ai.css et de la carte Présenter en `--fd-color-focus` | **ROUGE léger** | La pilule est conforme (voir 1). **La carte Présenter, non** (voir plus bas). |
| 3 · Partager refait, écart avant « Enregistrer l'adresse » | **VERT** | Le changement porte sur l'**écart**, et non sur la taille du texte : de l'aide « Un suffixe de 6 caractères… » à « Enregistrer l'adresse », **12 px** à 1440 comme à 390, en clair et en sombre. Du champ à l'aide : 8 px. Capture : `3-adresse-aide-12-px.png`. |

### Carte Présenter : le focus ne se voit plus

Mesures des styles calculés :
- carte **sélectionnée, sans focus** : bordure #a3195b de 1 px et ombre `0 0 0 1px #a3195b` (règle `.lx-card` cochée) ;
- carte **sélectionnée, avec focus clavier** : bordure #a3195b de 1 px et ombre `inset 0 0 0 1px #a3195b`.

Les deux états ont la même couleur et la même épaisseur totale de 2 px : à l'écran, ils sont identiques (`2-carte-presenter-focus-vs-sans-focus.png`, focus à gauche, sans focus à droite, en clair et en sombre). Dans un groupe de radios, le focus arrive toujours sur la carte cochée. Celui qui tabule jusqu'à « Affichage » ne voit donc **aucun changement** : c'est un échec du critère WCAG 2.4.7 (focus visible). Avant ceab0ef, l'anneau `--fd-shadow-focus` s'ajoutait par-dessus la sélection.

**Correction demandée** : au focus clavier, ajouter un indicateur **distinct de la sélection**, sans ombre extérieure diffuse :
- soit `outline: 2px solid var(--fd-color-focus); outline-offset: 2px` sur `.lx-card:has(input:focus-visible)` ;
- soit, à défaut, un trait intérieur de 2 px en plus de la bordure (3 px au total contre 2 px pour la sélection).

Je recommande la première : elle se voit aussi quand la carte est déjà sélectionnée. Il faut l'ajouter à l'e2e, qui doit comparer la carte sélectionnée avec et sans focus.

Demandes concernées : correctif Accessibilité de la CI · pilule « Modèle : Auto » (chevron à 12 px, focus FIELD-01) · focus de la carte Présenter (FIELD-01) · Partager › Adresse personnalisée (12 px avant « Enregistrer l'adresse »).
