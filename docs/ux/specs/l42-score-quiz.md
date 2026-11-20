# L42 : présentation du score du quiz

> Retour client : le cercle de score du résultat du quiz ne plaît pas, et le trait noir du seuil (70 %) est jugé incompréhensible et laid.
> Il est remplacé par un **grand score en chiffres**, une **barre horizontale fine sans marqueur** et le **seuil écrit en texte**.
> Maquette avant/après : `docs/ux/maquettes/refonte/l42-score-quiz.html`. Captures : `docs/ux/maquettes/refonte/img/l42-*.png` (avant ; après en clair, en sombre et sur mobile ; cas validé, non validé et 0 %).
> Données fictives.

## 1. Où

- **Lecteur, écran de résultat du quiz** (`apps/player/src/Quiz.tsx`, `svg.p-ring`) : c'est le **seul** endroit où le cercle existe aujourd'hui.
- **Apprenants, centre de formation, attestation** : le score y est déjà écrit en texte (« 55 % », « Validé · 85 % », tableau de l'attestation). Rien ne change.
  - Si un score y est un jour mis en forme avec son seuil, ce sera avec le même composant (§2), jamais avec un cercle.
- **Questionnaire** (sondage, sans score) : aucun bloc score, comme aujourd'hui.

## 2. Bloc score (remplace `svg.p-ring`)

Il est centré en haut de la carte de résultat, sur une largeur de 300 px au plus (100 % sur mobile). De haut en bas :

1. **Score** : `<p class="p-score__num">`.
   - Contenu : « Votre score : » en texte masqué visuellement, puis le nombre, puis « % » ; exemple « 85 % ».
   - Style : 52 px (48 px sous 480 px), graisse 800, chiffres tabulaires, couleur du texte `--p-text` **dans tous les cas**. La couleur ne porte jamais le résultat.
   - Le signe « % » fait 55 % de la taille du nombre, précédé d'une espace fine insécable.
2. **Barre** : `<div class="p-score__bar" aria-hidden="true"><i style="width:{{score}}%"></i></div>`.
   - Hauteur 8 px, arrondi complet, marge de 10 px au-dessus et en dessous.
   - Piste : `color-mix(in srgb, var(--p-text) 12%, transparent)`.
   - Remplissage : couleur primaire du lecteur (`--p-primary`) si le module est validé ; ardoise `#5b6675` sinon (`#A9B3BF` en sombre).
   - **Aucun repère, aucun trait, aucune graduation, aucune étiquette** sur la barre.
   - À 0 %, seule la piste est visible, sans remplissage minimal.
3. **Seuil** : `<p class="p-score__meta">`, contenant « Seuil de validation : {{threshold}} % ».
   - Style : 14 px, `--p-text` à 72 %.
   - Nouvelle clé i18n : `quiz.scoreThreshold` devient « Seuil de validation : {{value}} % » (en anglais : « Pass mark: {{value}}% »). L'ancienne « seuil {{value}} % » n'est plus utilisée.

Le reste de la carte ne change pas : le badge « Module validé » ou « Pas encore validé » (icône et texte), le titre, la phrase de score en `role="status"`, le récapitulatif et les boutons (L38 n° 14).

## 3. Animation

- La barre se remplit de 0 au score en 600 ms (`cubic-bezier(.2,.7,.2,1)`), une seule fois à l'affichage.
- Avec `prefers-reduced-motion: reduce`, la barre s'affiche directement à sa valeur.
- Le chiffre n'est pas animé : pas de compteur qui défile.

## 4. Accessibilité

- **Ordre de lecture** :
  1. « Votre score : 85 % » ;
  2. « Seuil de validation : 70 % » ;
  3. le badge ;
  4. le titre (qui reçoit le focus, comme aujourd'hui) ;
  5. la phrase de score.
- La barre est `aria-hidden` : elle double le chiffre. Pas de `role="progressbar"`, ce n'est pas une progression en cours.
- Le résultat (validé ou non) est porté par le **badge** (icône et texte) et par le **titre**, jamais par la couleur de la barre seule.
- **Contrastes** :
  - chiffre et seuil : ceux du texte du lecteur ;
  - remplissage contre piste, au moins 3:1 en clair et en sombre (mesuré) :
    - sur la piste claire (`#E1E1E1`) : primaire `#A3195B` 5,6:1, ardoise `#5b6675` 4,5:1 ;
    - sur la piste sombre (`#303339`) : `#A9B3BF` 6,0:1, primaire sombre `#CF86A9` 4,6:1.
- **Thème du lecteur** (couleur primaire personnalisée) : si le contraste du remplissage contre la piste descend sous 3:1, utiliser la couleur du texte à 70 % (le même contrôle que pour les boutons).

## 5. Cas à couvrir (maquette)

| Cas | Score | Barre | Badge | Titre |
|---|---|---|---|---|
| Validé | 85 % | 85 %, couleur primaire | « Module validé » | « Bravo, vous avez validé « … » » |
| Non validé | 55 % | 55 %, ardoise | « Pas encore validé » | « Encore un peu d'entraînement » |
| 0 % | 0 % | piste seule | « Pas encore validé » | « Encore un peu d'entraînement » |
| 100 % | 100 % | pleine, couleur primaire | « Module validé » | idem Validé |

## 6. Recette

- Les 4 cas du §5, à 1 280 px et à 390 px, en clair et en sombre, ainsi que dans un lecteur à couleur primaire personnalisée.
- Aucun élément `svg.p-ring` ni `.p-ring__threshold` dans le DOM.
- NVDA : la lecture suit l'ordre du §4 ; « Votre score : 55 % » est lu une seule fois.
- `prefers-reduced-motion` : pas d'animation.
- 200 % de zoom : le chiffre et le seuil restent lisibles, sans chevauchement.
- Les tests e2e `quiz-player` sont mis à jour (le cercle n'existe plus ; le texte du seuil change).
