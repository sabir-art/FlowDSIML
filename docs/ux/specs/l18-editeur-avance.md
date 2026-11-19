# L18 : éditeur avancé (test A/B, médiathèque, styles prédéfinis)

> **Maquette** : `reference/editeur-avance.html`, dérivée de `editeur-gains.html`. États par `?etat=` :
> `ab-creer` · `ab` · `media` · `media-vide` · `styles`.
>
> **Base** :
> - `specs/a2-editeur.md` §6 (test A/B) et §7 (médiathèque) ;
> - `specs/a1-partage.md` §7 (styles prédéfinis) ;
> - `refonte/styles-predefinis.html`, qui donne les valeurs des 6 styles.
>
> **Déjà construit dans l'app** (il ne manque que les captures, suivies sur A2-01 à A2-04) :
> - modes de lecture ;
> - étape pop-up ;
> - checklist ;
> - mode Sondage du quiz.
>
> Ces écrans ne sont pas redessinés ici.

## 1. États et codes

| Code | État | `?etat=` | Remplace |
|---|---|---|---|
| L18-01 | Panneau Étape : « Créer une variante B » | `ab-creer` | A2-06 |
| L18-02 | Test A/B en cours : variantes, résultat, répartition, objectif | `ab` | A2-06 |
| L18-03 | Médiathèque | `media` | A2-07 |
| L18-04 | Médiathèque vide | `media-vide` | A2-07 |
| L18-05 | Onglet Design : styles prédéfinis, style appliqué | `styles` | A2-11 |

## 2. Test A/B (L18-01, L18-02)

**Création (L18-01)**
- Le point d'entrée est la section « Test A/B », en bas du panneau Étape d'une étape à bulle. Elle contient une phrase d'usage et le bouton « Créer une variante B » (icône `gitBranch`).
- « Créer une variante B » duplique le titre, le texte de la bulle et le bouton d'action. La capture reste partagée entre A et B.
- Il y a un seul test par démo à la fois. Si un test existe déjà sur une autre étape, le bouton est désactivé avec l'aide « Un test est déjà en cours à l'étape n ».
- L'option n'existe pas sur les étapes formulaire, fin, pop-up, menu de choix et Avant / Après.

**Test en cours (L18-02)**
- **Canevas** :
  - au-dessus du canevas, un sélecteur « Test A/B · Variante A / Variante B » (`radiogroup`) ;
  - le canevas montre la variante choisie ;
  - les pastilles A et B utilisent `#217BAC` (lettre blanche 4,67:1, comme le style Bleu institutionnel) et `#A3195B`, avec la lettre écrite dans la pastille (jamais la couleur seule). En sombre, la bordure de la variante B qui mène prend une teinte plus claire pour atteindre 3:1 sur la carte.
- **Panneau** :
  - titre de section et badge « En cours · jour n » (`badge-success`) ;
  - **deux cartes de variante** : pastille, libellé (« Original », puis le libellé donné à B), valeur de l'objectif en grand, dénominateur réel (« de complétion · n visiteurs »). La variante qui mène a une bordure de 2 px de la couleur B ou A. Il n'y a pas de meneur sous 50 visiteurs par variante ;
  - **phrase de résultat prudente** :
    - « B mène de 11 points sur 412 visiteurs. » ;
    - puis « Résultat fiable à partir d'environ 1 000 visiteurs. » tant que le total est en dessous ;
    - sous 50 visiteurs par variante : « Pas encore assez de visiteurs pour comparer. » ;
    - pas de p-value, pas de pourcentage de confiance, pas de mot « gagnant » ;
  - **Objectif** (select) : Taux de complétion (par défaut), Clics sur le bouton d'action, Leads. Le changer recalcule les cartes sans redémarrer le test ;
  - **Répartition** : un `range` de 10 à 90 par pas de 10, avec `aria-valuetext` (« A 50 %, B 50 % ») et l'aide « Un visiteur voit toujours la même variante ». L'affectation est mémorisée par visiteur, dans un cookie fonctionnel sans donnée personnelle ;
  - **Texte de la variante B** : titre, texte et bouton, modifiables tant que le test tourne. Une modification de B est horodatée dans l'historique du test ;
  - **Actions** :
    - « Garder B et terminer » (bouton principal) : B remplace A, le test est archivé ;
    - « Garder A et terminer » apparaît à la place si A mène ;
    - « Arrêter le test » (texte en couleur danger) : confirmation « Arrêter le test ? Les visiteurs verront à nouveau la variante A. Les résultats sont conservés dans Analytics. »
- **Publication** : la variante B n'est servie qu'une fois la démo publiée. Créer ou modifier B marque la démo « Modifications non publiées ».
- **Analytics** : les résultats détaillés relèvent de A4 « Sondages et tests » (lot L19).

## 3. Médiathèque (L18-03, L18-04)

- **Ouverture** :
  - par « Choisir dans la médiathèque » depuis tout champ image ou police : logo du workspace, fond de pop-up, image importée, capture « Avant / Après » (L17), police de l'onglet Design ;
  - par Paramètres > Marque > « Médiathèque ».
- **Modale** de 720 px (`modal-lg`) :
  - recherche, et filtre Tout / Logos / Images / Polices (`radiogroup`) ;
  - grille de 4 colonnes (2 sur mobile). La première case est « Importer » : bordure pointillée, glisser-déposer, PNG, JPG, SVG ou WOFF2, 5 Mo au plus ;
  - vignette et nom tronqué (nom complet en `title`). La sélection a un contour de 2 px de la couleur principale et `aria-pressed` ;
  - pied, à gauche : nom sélectionné, « utilisé dans n démos », « n Mo sur 500 Mo » ;
  - pied, à droite : « Annuler » et « Utiliser ce fichier ».
- **Vide (L18-04)** : une seule grande case « Importer votre premier fichier » avec l'usage, « 0 Mo sur 500 Mo », et « Utiliser ce fichier » en `aria-disabled`.
- **Règles** :
  - un SVG importé est nettoyé côté serveur : scripts, `foreignObject` et liens externes sont retirés ;
  - une image passe par la détection des données personnelles (F1 §1). Si elle contient des données repérées, l'import demande de flouter ou de confirmer ;
  - supprimer un fichier utilisé demande confirmation : « Ce fichier est utilisé dans n démos. Il sera remplacé par l'image par défaut. » ;
  - quota de 500 Mo par workspace. Au-delà, erreur à l'import : « Médiathèque pleine : supprimez des fichiers inutilisés ».

## 4. Styles prédéfinis (L18-05)

- **Où** : en tête de l'onglet Design, section « Choisir un style ».
  - Grille de 2 colonnes (panneau de 340 px).
  - Chaque carte montre : aperçu (fond, bulle, bouton, pastille du hotspot), nom, 3 pastilles de couleur.
  - Le style actif a une bordure de 2 px de la couleur principale et `aria-pressed="true"`. « DSI Prune » porte le badge « Par défaut ».
- **6 styles livrés**, avec les valeurs de `refonte/styles-predefinis.html` stockées dans `themes.tokens` :
  - DSI Prune ;
  - Bleu institutionnel ;
  - Vert DSI (texte **noir** sur le bouton vert) ;
  - Nuit ;
  - Minimal ;
  - Contraste élevé.
  Chacun respecte : texte de bulle ≥ 4,5:1, bouton ≥ 4,5:1, pastille ≥ 3:1 sur le fond.
- **Appliquer** :
  - un clic applique le style à **toute la démo** : bulle, boutons, hotspot, fond, arrondis, police ;
  - toast « Style « {{nom}} » appliqué à toute la démo. », avec « Annuler » pendant 8 s ;
  - les champs fins (couleurs, forme, cadre) prennent les valeurs du style et restent modifiables. Après une modification fine, plus aucune carte n'est marquée active, et un libellé « Style personnalisé » apparaît.
- **« Enregistrer le style actuel »** : modale avec le nom (40 caractères). Elle crée un style du workspace, ajouté à la fin de la grille avec un menu ⋯ (Renommer, Supprimer). Disponible pour les propriétaires, admins et éditeurs.
- **Le select « Thème » disparaît** de l'onglet Design : les styles le remplacent. Le « Thème du workspace » (« Bientôt » dans l'app) devient le style par défaut choisi dans Paramètres > Marque.
- **Alerte de contraste** : la règle existante est conservée. Si une couleur saisie à la main fait passer un contraste sous le seuil, l'alerte apparaît avec une couleur proposée.

## 5. Accessibilité

- Les cartes de style sont des boutons à bascule (`aria-pressed`) dans un groupe nommé « Styles prédéfinis ». Leur nom accessible est le nom du style.
- Le sélecteur de variante A/B, le filtre de la médiathèque et l'objectif ont un nom.
- La répartition est un `range` natif, avec sa valeur textuelle.
- Dans la médiathèque, la grille se parcourt au clavier (Tab entre les vignettes, Entrée pour choisir). Le nombre de fichiers est annoncé après une recherche.

## 6. Hors périmètre

- Tests à plus de deux variantes, ou portant sur plusieurs étapes.
- Médiathèque partagée entre plusieurs workspaces.
- Génération de style à partir d'un site web.
