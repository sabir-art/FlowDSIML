# Recette réelle L60, lot C, popup « Que voulez-vous capturer ? » (8652737, bc14afe) : VERT

Recette du 26/11, faite à la place de l'utilisateur, sur `claude/dev-mvp` à bc14afe.

**Montage** : extension construite (`WXT_E2E=1 WXT_DEBUGGER=1`) et chargée dans Chromium, avec le faux Supabase. J'ai comparé le popup à `propositions/l60/planche-l60-capture.png` (ligne 1) et à la règle de hauteur de L64 §5, en clair et en sombre.

## Résultats

- **`popup.e2e.cjs`** : 68/68 (34 par thème).
- **Mesures dans le popup chargé** :

  | Vue | Hauteur du popup | Pied (haut / bas) | Lignes de mode |
  |---|---|---|---|
  | Modes | **568 px**, ajustée au contenu | 12 / 16 px | 4 × 64 px |
  | Dernier mode | 587 px (l'aide fait 2 lignes) | 12 / 16 px | 4 × 64 px |
  | Destination | 449 px | 12 / 16 px | — |
  | Réglages | 600 px, le corps défile | 12 / 16 px | — |
  | Page impossible | 600 px, le corps défile | 12 / 16 px | 4 × 64 px, désactivées |
  | Avertissement HTML | 600 px, le corps défile | 12 / 16 px | 4 × 64 px |

Captures : `popup-6-vues-clair.png` et `popup-6-vues-sombre.png` (modes, dernier mode, destination, réglages, page impossible, avertissement), et `capture-demarree-clair.png`.

## Conforme à la planche

- **Le choix d'un mode démarre la capture.** La barre de capture s'affiche sur la page, sans autre décision, et la démo prend le titre de l'onglet.
- **Les 4 modes** ont leur icône, leur nom et leur phrase. Ils forment une liste de boutons au nom accessible « Démarrer : {mode}… », et les flèches passent d'un mode à l'autre.
- **Dernier mode** : sa ligne est encadrée en couleur de marque, sa tuile est teintée, elle porte la touche « Entrée » et a le focus. Entrée le relance. Le rendu est conforme en sombre.
- **Destination** : « Dans **Acme** · Nouvelle démo », sur 44 px, avec « Changer ». La vue Destination a un retour et propose l'espace et la démo.
- **Réglages** : tous sont mémorisés. « Format mobile » devient la taille « Mobile » (Actuelle · 1440 · Mobile).
- **Page impossible** : le bandeau s'affiche et les 4 lignes restent visibles, désactivées. La règle de l'espace grise HTML et Sandbox, avec la raison.
- **Avertissement HTML** : il s'affiche une seule fois, dans le popup, avec « Compris », et ne recouvre plus la page.

## Arbitrage du §6 du rapport du dev

1. **Hauteur avec le bandeau d'erreur** : dans cet état, on **masque la ligne Destination et l'aide** « Un clic démarre la capture », qui ne servent à rien quand rien ne peut démarrer. Le popup tient alors sans défiler. Sinon, la règle des 600 px au plus avec défilement du corps est acceptée.
2. **Webcam et cadre par défaut dans les Réglages** : on les garde. La spec citait les réglages nouveaux, sans retirer ceux qui existaient.
3. **Taille de l'onglet** : on accepte « Mobile » réservé aux captures d'écran, et la taille actuelle gardée en HTML. La taille personnalisée et l'orientation disparaissent. À rouvrir si un client le demande.
4. **« Page entière » en « Bientôt »** : on la retire, conformément à la spec.
5. **Destination limitée à l'espace et à la démo** : accepté jusqu'à L64 §2 (arbre des dossiers et « Ajouter à une démo »).
6. **Vidéo depuis le popup** : à vérifier sur un vrai poste, car Chromium sans écran n'a pas de flux d'onglet. C'est la limite connue de la spec (§4). Je la garde ouverte dans mes recettes.

## Gênes (non bloquantes, pour le prochain lot de la capture)

1. **Réglages trop serrés** (`popup-6-vues-clair.png`, 4e vue).
   - La taille de l'onglet et le cadre par défaut mettent leur contrôle **à côté** d'une aide de 4 lignes, dans 140 px de large.
   - **Attendu** : le segmenté « Actuelle · 1440 · Mobile » et la liste « Cadre par défaut » passent **sous** leur libellé, en pleine largeur. Les aides tiennent alors en 1 ou 2 lignes, et la vue défile moins.
   - Aides plus courtes proposées :
     - « Mobile : captures d'écran seulement. » ;
     - « Cadre au démarrage, modifiable dans la barre. ».
2. **Pied de la vue Connexion** : 12 / 12 px, contre 12 / 16 px dans les autres vues. À aligner sur 16 px en bas.

## Pour la suite

La Vidéo, démarrée depuis le popup, sera à vérifier sur un vrai poste. Le VERT ne couvre pas ce point.

---

# Contrôle des arbitrages et des gênes (2723813) : VERT

J'ai reconstruit l'extension sur 2723813 et rejoué le parcours. `popup.e2e` : 74/74 en clair et en sombre (`v2-erreur-reglages-connexion.png`).

- **Page impossible** : il n'y a plus ni destination ni aide. Le popup fait **543 px** et ne défile pas.
- **Réglages** :
  - le segmenté « Actuelle · 1440 · Mobile » et la liste « Cadre par défaut » sont **sous** leur libellé, en pleine largeur ;
  - les aides tiennent sur une ligne (« Mobile : captures d'écran seulement. », « Cadre au démarrage, modifiable dans la barre. »).
  - La vue atteint encore 600 px et défile, ce qui est normal pour 6 réglages.
- **Vue Connexion** : le pied est à 12 / 16 px, comme dans les autres vues.
