# F1 : parcours guidés (implémentation)

Spec UX : `docs/ux/specs/a2-editeur.md` §1, 2, 3 et 5 (branche de la Lead UX). Migration : `20261117131000_formation_parcours.sql`.

## Modèle

| Où | Champ | Rôle |
| --- | --- | --- |
| `demos.settings.mode` | `walkthrough` \| `spotlight` | Mode de lecture de toute la démo. En Spotlight, `publish_demo` force `style = spotlight` sur chaque hotspot. |
| `hotspots.style` | `beacon` \| `spotlight` | Style d'un hotspot (surcharge par hotspot, prévue pour « Pour cette étape »). |
| `steps.options` | `display`, `variant`, `background`, `bgColor`, `showIcon`, `buttonLabel`, `choices[]` | Étape pop-up (info ou consigne) et menu de choix (6 au maximum). |
| `choices[].action` | `goto` (stepId) \| `chapter` (chapterId) \| `end` \| `url` (https) | Destination d'un choix. `duplicate_demo` remappe les étapes et les chapitres. |
| `demos.settings.checklist` | `{ enabled, title, position: left \| right \| collapsed }` | Checklist du player : un élément par chapitre, sinon par étape. |
| `demos.settings.autoplay` | `{ enabled, delayMs }` | Lecture automatique ; délai borné à 1,5–30 s. |

Le manifeste (`packages/manifest`) ignore un choix invalide (un lien `javascript:`, par exemple) sans invalider la démo.

## Player

- **Spotlight** : un seul voile SVG (`spotlightVeilPath`) troué sur chaque zone, avec un anneau de 3 px. La bulle est ancrée au bord de la zone et ne la recouvre jamais.
- **Pop-up** : carte de 380 px au maximum, posée sur la capture précédente floutée ou sur une couleur. Échap vaut « Suivant » quand l'étape n'a pas de choix.
- **Choix** : chaque clic est tracé en `hotspot_click` avec `props.choice`. « Fin de la démo » affiche l'écran de fin.
- **Checklist** : carte de 260 px, repliable en pilule. Un chapitre est coché quand sa dernière étape a été vue ; une annonce `aria-live` le signale.
- **Autoplay** : avance seul, avec un bouton Lecture / Pause. Il s'arrête sur un formulaire, un menu de choix ou la dernière étape, et reste inactif en aperçu.

## Éditeur

- **Onglet Design** : cartes « Mode de lecture ».
- **Onglet Réglages** : Checklist et Lecture automatique.
- **Panneau d'étape texte** : Étape pop-up (affichage, type, icône, fond, bouton) et Menu de choix (libellé, destination, lien).
- **Rail** : le menu « Ajouter une étape » propose Pop-up et Menu de choix, et la vignette porte un badge « n choix ».
- **Contrôle de cohérence** : un avertissement non bloquant signale toute étape atteinte par aucun chemin (`reachability.ts`).

## Tests

- pgTAP : `supabase/tests/formation.test.sql` (14).
- Unitaires : `apps/player/src/logic.test.ts`, `apps/web/src/pages/editor/reachability.test.ts` et `packages/player-core`.
- e2e : `apps/web/e2e/parcours.e2e.cjs` (player, 22 vérifications) et `editor.e2e.cjs` (section F1).
- Captures : `docs/tech/captures/f1/`.

## Pas encore fait (suite de F1)

- Cadre Navigateur / Mobile (spec §1).
- Fond « Image » des pop-up (attend la médiathèque, A2 §7).
- Réordonnancement propre à la checklist : l'ordre suit celui des chapitres.
