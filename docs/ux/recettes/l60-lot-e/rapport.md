# Recette réelle L60, lot E et L64 (04aa470 → 136d6a8) : ROUGE léger

Recette du 26/11, faite à la place de l'utilisateur, sur `claude/dev-mvp` à 136d6a8.

**Montage** :
- extension construite (`WXT_E2E=1 WXT_DEBUGGER=1 WXT_APP_URL=http://localhost:54400`) et chargée dans Chromium ;
- faux Supabase avec un faux fournisseur d'IA : aucun appel réel ;
- éditeur sur le faux backend de l'app.

J'ai comparé l'extension et l'éditeur à `propositions/l60/planche-l60-capture.png` (déroulé 6 et arrivée) et à `propositions/l64/planche-l64-extension.png`, en clair et en sombre.

## Parcours rejoués

| Parcours | Résultat |
|---|---|
| extension : terminer, popup, redaction, capture, html, ajout | 11, 104, 11, 26, 43 et 51 contrôles, tous verts |
| éditeur : arrivee-capture | 11/11 en clair, 11/11 en sombre |

**Correctif de test** : en sombre, `arrivee-capture` ne pose que `colorScheme`. L'app suit le thème mémorisé (`fd.theme`), si bien que les captures « sombres » du rapport du dev sont en clair. J'ai rejoué le parcours avec le thème posé (`_theme.cjs`, `themedContext`) : le résultat est conforme en sombre (`arrivee-redaction-sombre.png`). Il faut corriger le test.

## Conforme aux planches

- **Terminer sans détection** : la vérification ne s'ouvre pas, et la barre devient « Envoi des étapes… 0 / 2 », avec la barre de progression et « La démo s'ouvre dans TutoClick… » (`redaction-envoi-arrivee-clair.png`, en bas à gauche).
- **Arrivée dans l'éditeur** :
  - toast « Démo prête : 3 étapes capturées », avec « Aperçu » ;
  - étiquette verte « Nouvelle » sur chaque étape, lisible en clair et en sombre ;
  - « Généré par IA, à vérifier » sous le titre de l'étape rédigée.
- **Rédaction automatique** :
  - le réglage est en tête, dans un encadré de marque ;
  - la carte de capture dit « Texte proposé : « … » », sur 2 lignes au plus ;
  - seuls le libellé et le titre de la page partent vers l'IA ;
  - aucun nom de fournisseur.
- **Barre claire** : conforme à la planche L64. Fond clair, « Terminer » en couleur de marque, mêmes mesures.
- **Apparence** : Système, Clair et Sombre, mémorisée. Elle s'applique au popup, à la barre et à la vérification.
- **Menu ⋯** (`popup-menu-destination-reglages.png`, 1re colonne) :
  - les espaces, avec leurs membres et le rôle ;
  - « Lecteur : capture impossible » en gris ;
  - Ouvrir TutoClick, Réglages de capture, Aide, puis Se déconnecter avec l'adresse.
- **Destination, « Ajouter à une démo »** (3e colonne) : la recherche, puis « Créer une facture · Support · 7 étapes », cochée. L'aide dit que les étapes s'ajoutent à la fin.

## Ce qui bloque (ROUGE léger)

**Dans l'onglet « Nouvelle démo » de Destination, une liste « Démo : Nouvelle démo » reste sous l'arbre des dossiers** (2e colonne, en clair et en sombre). Elle vient de l'ancien choix des démos à compléter (« Chaque clic remplit l'étape « À capturer » suivante »).
- On voit donc deux fois « Nouvelle démo » : l'onglet, puis la valeur de la liste.
- La liste permet aussi de choisir une démo existante depuis l'onglet « Nouvelle démo ».
- Pour l'utilisateur, on ne sait plus si la capture crée une démo ou en complète une.
- Elle pousse en plus la ligne « Espace » sous le pied.

**Attendu** (planche L64, Destination) :
- l'onglet « Nouvelle démo » ne contient que l'arbre des dossiers, l'aide de mémorisation et la ligne Espace ;
- les démos à compléter (avec des étapes « À capturer ») passent dans la liste de l'onglet **« Ajouter à une démo »**, en tête, avec une pastille « 3 étapes à capturer ». Les choisir remplit ces étapes dans l'ordre, et l'aide le dit (« Chaque clic remplit l'étape « À capturer » suivante. »).

**e2e** : l'onglet « Nouvelle démo » n'a aucune liste « Démo » ; une démo à compléter apparaît dans « Ajouter à une démo », avec sa pastille.

## Arbitrage des écarts annoncés par le dev

1. **Étapes « en direct » insérées à l'envoi** : accepté pour 0.3.3, mais le bandeau ne doit pas promettre ce qui n'arrive pas.
   - Pendant la capture, il dit : « Capture en cours dans l'extension · 3 étapes · elles arriveront à la fin. »
   - À l'envoi, il passe à « Réception… », puis au toast « Démo prête ».
   - Le repère « Étape 6 · réception… » ne s'affiche qu'à l'envoi.
   - L'insertion au fil des clics reste un lot à part.
2. **Pas d'ajout à une démo existante en vidéo** : accepté. En vidéo, l'onglet « Ajouter à une démo » reste **visible, grisé**, avec la raison « Vidéo : nouvelle démo seulement », selon la règle « jamais de choix qui disparaît ».
3. **Sans réponse de l'IA en 4 s, l'étape garde le libellé du clic** : accepté.
   - L'étape garde son libellé, sans message, et elle ne porte ni le repère « IA » ni « Généré par IA, à vérifier ».
   - Le crédit n'est pas décompté si la réponse n'arrive pas.

## Pour le VERT

- La liste « Démo » retirée de l'onglet « Nouvelle démo », et les démos à compléter dans « Ajouter à une démo ».
- La vidéo avec « Ajouter à une démo » grisé, et non masqué.
- Le texte du bandeau « en direct » (écart 1).
- Le test `arrivee-capture` en sombre, avec le thème posé.

---

# Nouvelle recette après 2ab2ee7 → acc93dd : VERT pour l'extension, bandeau à confirmer par la CI

J'ai reconstruit l'extension avec `WXT_APP_URL` et rejoué les parcours avec un faux serveur neuf :

| Parcours | Résultat |
|---|---|
| extension : popup | 110 |
| extension : redaction | 13 |
| extension : terminer | 11 |
| extension : ajout | 51 |
| extension : capture | 26 |
| extension : video | 34 |
| éditeur : arrivee-capture | 12/12 en clair, 12/12 en sombre (thème posé) |

- **(A) Destination** (`v2-destination.png`) :
  - l'onglet « Nouvelle démo » ne contient plus que les dossiers, l'aide et la ligne Espace ;
  - la démo à compléter est en tête de « Ajouter à une démo », avec « 2 étapes à capturer », contrôlé en clair et en sombre.
- **(B) Vidéo vers une démo existante** : la ligne Vidéo reste visible, grisée, avec « Vidéo : nouvelle démo seulement ». Comme la destination se choisit avant le mode, c'est la bonne place : **confirmé**.
- **(D) Délai de 4 s** : ni repère IA ni crédit décompté, et la carte garde « Rédaction… » (redaction 13/13).
- **(E) Test arrivee-capture** : il est maintenant en vrai sombre.
- **(C) Bandeau « Capture en cours dans l'extension… »** : je n'ai pas pu le voir en local.
  - `capture-etapes.e2e.cjs` s'arrête avant, sur la détection de la version de l'extension : « La version 0.2.0 est installée… » et « Extension TutoClick 0.3.0 détectée. » n'apparaissent jamais.
  - Il échoue de la même façon sur 136d6a8, avant ces commits : ce n'est donc pas une régression du lot.
  - La CI de acc93dd fera foi pour le bandeau. À expliquer par le dev : est-ce le banc local, ou la détection de version ?
