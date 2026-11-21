# Parcours mobile de l'apprenant à 390 px (après les refontes)

> Relevé fait le 20 novembre sur dev-mvp 09db6a8, à 390 × 844 px, en clair et en sombre : centre de formation, page d'une formation, module (étape et fin), quiz (question, échec, réussite) et attestation.
> Données fictives : `center-data.cjs` et les manifestes des e2e.
> Maquette : `docs/ux/maquettes/refonte/mob-apprenant.html`, avec un sélecteur Avant / Après par écran.
> Règles : `composants.md` §17, deltas T1 à T9, L42 (résultat du quiz).

## 1. Ce qui va

- **Aucun défilement horizontal** sur les 10 écrans relevés (largeur de la page égale à celle de la fenêtre).
- e2e à 0 échec :
  - center : 67 ok ;
  - formation-fin : 22 ok ;
  - quiz-player : 29 ok à 1280 px, et 29 ok rejoué à 390 px ;
  - formation-player : 24 ok ;
  - parcours : 24 ok ;
  - player-ux : 15 ok ;
  - demo-center : 25 ok.
- Fin de module :
  - feuille du bas, avec « Module suivant » en bouton principal ;
  - « Retour au centre » en secondaire ;
  - « Recommencer » en lien de 14 px.
- Page d'une formation : fil d'Ariane, une ligne par module, une seule action principale (« Reprendre »).

## 2. Écarts et corrections

| # | Écran | Constat à 390 px | Correction |
|---|---|---|---|
| M1 | Centre | Le titre fait environ 40 px sur 3 lignes : il occupe le premier tiers de l'écran. | Titre en 28 px 700, interligne 1,15 ; sous-titre en 15 px. Pas plus de 2 lignes sur 390 px avec le titre de démonstration. |
| M2 | Centre, formation terminée | Grands aplats vert-jaune (`hero`) : la carte « Ma formation en cours », le bandeau « Formation terminée » et les pastilles « 2 sur 2 validés ». En sombre, ils éblouissent. | Même règle que le delta L47 : **pas d'aplat `hero`**. Carte `surface` ; barre de 6 px à la couleur du thème (`--brand`), comme les autres barres de progression de l'app (décidé le 21 novembre) ; icône `award` de 24 px en `success` pour la fin. « 2 sur 2 validés » passe en texte de 13 px `text-muted`. |
| M3 | Centre | 5 étiquettes de filtre sur 3 lignes (environ 140 px). | Une seule ligne, qui défile horizontalement (sans barre visible), avec « Toutes » en premier ; pas de compteurs (T2) ; sélection en fond `text` et texte `surface`, comme aujourd'hui. |
| M4 | Centre | Chaque carte de formation contient la liste de ses modules et un bouton : environ 430 px de haut, une carte dans la carte (T4). | Carte réduite : vignette de 120 px de haut, titre, une ligne de texte (« 1 module sur 4 validé · 4 modules »), barre de 6 px, et toute la carte est un lien (chevron). La liste des modules reste sur la page de la formation. Les pastilles « En cours » et « Terminée » sur la vignette passent en texte, sous le titre. |
| M5 | Module, étape | La capture zoomée est centrée verticalement, avec environ 170 px vides au-dessus. « Voir tout l'écran » est posé **sur** la capture et cache son contenu. | Capture alignée en haut, 12 px sous l'en-tête. « Voir tout l'écran » passe sous la capture, à droite, en lien de 14 px avec l'icône `expand`. |
| M6 | Quiz, question | La carte est centrée verticalement (environ 230 px vides au-dessus). L'option choisie a deux contours (couleur du thème et anneau de focus bleu) après un clic. | Carte alignée en haut, 12 px sous l'en-tête. L'anneau de focus n'apparaît qu'au clavier (`:focus-visible`) ; l'option choisie garde un seul contour de 2 px. |
| M7 | Quiz, échec | **L'action principale « Réessayer le quiz » est coupée sous la barre du lecteur.** La carte défile à l'intérieur : sur 844 px, on ne voit que « Revoir le module ». Badge « Pas encore validé » et paragraphe de 5 lignes. | Delta L42 : on retire le badge ; le paragraphe devient une ligne, « 1 bonne réponse sur 3 · il vous reste 2 tentatives ». Les actions vont dans une barre collée en bas de la carte, toujours visible : « Réessayer le quiz » en principal, puis « Revoir le module » en lien. La carte ne défile plus seule : c'est la page qui défile. |
| M8 | Quiz, réussite | Pastille vert-jaune « Module validé » sous l'anneau. | Texte de 14 px 600, en `success`, avec l'icône `award` de 16 px (M2). |
| M9 | Centre | « Reprendre "Fiches usagers" » est un bouton noir sur l'aplat vert. | Avec M2 : bouton `primary` « Reprendre », et le nom du module en texte au-dessus. |

## 3. Priorités

1. **M7** : l'apprenant ne voit pas comment réessayer. C'est bloquant sur mobile.
2. M2 et M9 : la cohérence avec la reprise UI (pas d'aplat `hero`), en clair et en sombre.
3. M4 et M3 : la longueur du centre, aujourd'hui 2 758 px pour 4 formations.
4. M1, M5, M6 et M8.

## 4. Recette (390 × 844, clair et sombre)

1. Centre : le titre tient sur 2 lignes ; la carte « Ma formation en cours » et 2 cartes de formation tiennent dans les 1 200 premiers pixels ; aucun aplat `hero`.
2. Filtres : une ligne qui défile ; la page ne défile pas horizontalement.
3. Module : la capture commence à 12 px sous l'en-tête ; « Voir tout l'écran » ne recouvre rien.
4. Quiz, échec : « Réessayer le quiz » est visible sans défiler, au-dessus de la barre du lecteur.
5. Quiz, question : après un clic sur une option, un seul contour ; au clavier, l'anneau de focus est visible.
6. Attestation : le bandeau de fin est sur un fond `surface` ; le bouton « Télécharger mon attestation (PDF) » est l'action principale.
7. Aucun défilement horizontal, sur tous les écrans du parcours.
