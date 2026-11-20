# L42 : présentation du score du quiz

> Retour client : le cercle de score du résultat du quiz était mal exécuté, et le trait noir du seuil (70 %) jugé incompréhensible et laid.
> **Révision du 20 nov.** : le client veut **garder le cercle**, bien dessiné. Cette version remplace la proposition « barre horizontale » (e7517d7).
> Le cercle est redessiné : piste et arc de même épaisseur, bouts arrondis, seuil marqué par une **encoche** dans la piste (sans trait) et **écrit en texte** sous le cercle.
> Maquette avant/après : `docs/ux/maquettes/refonte/l42-score-quiz.html`. Captures : `docs/ux/maquettes/refonte/img/l42-*.png` (avant ; après en clair, en sombre et sur mobile ; cas validé, non validé et 0 %).
> Données fictives.

## 1. Où

- **Lecteur, écran de résultat du quiz** (`apps/player/src/Quiz.tsx`, `svg.p-ring`) : c'est le **seul** endroit où le cercle existe aujourd'hui.
- **Apprenants, centre de formation, attestation** : le score y est déjà écrit en texte (« 55 % », « Validé · 85 % », tableau de l'attestation). Rien ne change.
  - Si un score y est un jour mis en forme avec son seuil, ce sera avec le même composant (§2), avec le même anneau.
- **Questionnaire** (sondage, sans score) : aucun bloc score, comme aujourd'hui.

## 2. Anneau de score (remplace l'actuel `svg.p-ring`)

Il est centré en haut de la carte de résultat. De haut en bas :

1. **Anneau** : 168 × 168 px (144 × 144 px sous 480 px), avec `viewBox="0 0 168 168"`, un rayon de 74 et `aria-hidden="true"`. Départ en haut, sens horaire (`rotate(-90deg)` sur le SVG).
   - **Piste** : cercle de trait 12, `stroke-linecap: butt`, couleur `color-mix(in srgb, var(--p-text) 10%, transparent)`.
   - **Encoche du seuil** : une coupure de 6 px **dans la piste**, à la position du seuil, obtenue par `stroke-dasharray="{t − 3} 6 {C}"` sur la piste, où `t = seuil/100 × C`.
     - Pas de trait, pas de couleur ajoutée : le fond de la carte apparaît dans la coupure.
     - L'arc est dessiné par-dessus : l'encoche disparaît dès que le score dépasse le seuil.
   - **Arc** : trait 12, `stroke-linecap: round`, `stroke-dasharray="{score/100 × C} {C}"`.
     - Couleur : `--p-primary` si le module est validé ; ardoise `#5b6675` sinon (`#A9B3BF` en sombre).
   - **Supprimés** : `.p-ring__threshold` (le trait noir) et le texte « seuil 70 % » à l'intérieur de l'anneau.
   - **Cas limites** : à 0 %, aucun arc n'est dessiné (pas de point dû au bout arrondi) ; à 100 %, le cercle est plein.
2. **Score au centre** (texte HTML posé sur l'anneau, pas un `<text>` SVG) :
   - « Votre score : » masqué visuellement, puis le nombre et « % » ;
   - 44 px (38 px sous 480 px), graisse 800, chiffres tabulaires, couleur du texte **dans tous les cas** ;
   - « % » à 50 % de la taille du nombre, précédé d'une espace fine insécable.
3. **Seuil** : sous l'anneau, à 12 px, « Seuil de validation : {{threshold}} % » en 14 px, `--p-text` à 72 %.
   - Clé i18n `quiz.scoreThreshold` : « Seuil de validation : {{value}} % » (en anglais : « Pass mark: {{value}}% »).

Le reste de la carte ne change pas : badge, titre, phrase de score en `role="status"`, récapitulatif, boutons.

## 3. Animation

- L'arc se dessine de 0 au score en 600 ms (`stroke-dasharray`, `cubic-bezier(.2,.7,.2,1)`), une seule fois à l'affichage.
- Avec `prefers-reduced-motion: reduce`, l'arc s'affiche directement à sa valeur.
- Le chiffre n'est pas animé : pas de compteur qui défile.

## 4. Accessibilité

- **Ordre de lecture** :
  1. « Votre score : 85 % » ;
  2. « Seuil de validation : 70 % » ;
  3. le badge ;
  4. le titre (qui reçoit le focus, comme aujourd'hui) ;
  5. la phrase de score.
- L'anneau est `aria-hidden` : il double le chiffre. Pas de `role="progressbar"`, ce n'est pas une progression en cours.
- Le résultat (validé ou non) est porté par le **badge** (icône et texte) et par le **titre**, jamais par la couleur de l'arc seule.
- **Contrastes** :
  - chiffre et seuil : ceux du texte du lecteur ;
  - arc contre piste, au moins 3:1 en clair et en sombre (mesuré, piste à 10 à 12 %) :
    - sur la piste claire (`#E1E1E1`) : primaire `#A3195B` 5,6:1, ardoise `#5b6675` 4,5:1 ;
    - sur la piste sombre (`#303339`) : `#A9B3BF` 6,0:1, primaire sombre `#CF86A9` 4,6:1.
- **Thème du lecteur** (couleur primaire personnalisée) : si le contraste de l'arc contre la piste descend sous 3:1, utiliser la couleur du texte à 70 % (le même contrôle que pour les boutons).

## 5. Cas à couvrir (maquette)

| Cas | Score | Barre | Badge | Titre |
|---|---|---|---|---|
| Validé | 85 % | arc à 85 %, couleur primaire (encoche recouverte) | « Module validé » | « Bravo, vous avez validé « … » » |
| Non validé | 55 % | arc à 55 %, ardoise ; encoche visible à 70 % | « Pas encore validé » | « Encore un peu d'entraînement » |
| 0 % | 0 % | piste seule, avec l'encoche | « Pas encore validé » | « Encore un peu d'entraînement » |
| 100 % | 100 % | cercle plein, couleur primaire | « Module validé » | idem Validé |

## 6. Recette

- Les 4 cas du §5, à 1 280 px et à 390 px, en clair et en sombre, ainsi que dans un lecteur à couleur primaire personnalisée.
- Aucun élément `.p-ring__threshold` ni texte « seuil » dans l'anneau ; l'encoche n'apparaît que sous le seuil.
- Netteté : à une densité de 1, 2 et 3, la piste et l'arc ont la même épaisseur, sans crénelage visible.
- NVDA : la lecture suit l'ordre du §4 ; « Votre score : 55 % » est lu une seule fois.
- `prefers-reduced-motion` : pas d'animation.
- 200 % de zoom : le chiffre et le seuil restent lisibles, sans chevauchement.
- Les tests e2e `quiz-player` sont mis à jour (le trait du seuil n'existe plus ; le texte du seuil change).
