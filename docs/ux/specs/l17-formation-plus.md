# L17 : formation, confirmation RGPD, étape Avant / Après, glossaire

> **Maquettes** (structure de référence) :
> - `reference/editeur-formation.html` (`?etat=avap`) : éditeur, étape Avant / Après ;
> - `reference/player-formation.html` (`?etat=cote|curseur|bascule|terme|tiroir`) : lecteur ;
> - `reference/parametres-glossaire.html` (`?etat=liste|vide|ajout`) : Paramètres > Glossaire ;
> - `refonte/f1-formation.html?view=rgpd` : confirmation RGPD, déjà réalisée dans l'app.
>
> **Base** : `specs/f1-formation.md` §2 à §4. Les « propositions » F1 §3 et §4 deviennent ici des fonctions à construire.
>
> **Données** : fictives (Acme, `.example`). Aucun terme métier réel d'un outil client.

## 1. États et codes

| Code | État | Maquette | Remplace |
|---|---|---|---|
| L17-01 | Confirmation avant publication publique (bilan RGPD) | `refonte/f1-formation.html?view=rgpd` | F1-02 |
| L17-02 | Éditeur : étape Avant / Après | `editeur-formation.html?etat=avap` | F1-03 |
| L17-03 | Lecteur : Avant / Après côte à côte | `player-formation.html?etat=cote` | F1-03 |
| L17-04 | Lecteur : curseur de comparaison | `player-formation.html?etat=curseur` | F1-03 |
| L17-05 | Lecteur mobile : bascule Avant / Maintenant | `player-formation.html?etat=bascule` (390 px) | F1-03 |
| L17-06 | Paramètres > Glossaire | `parametres-glossaire.html?etat=liste` | F1-04 |
| L17-07 | Glossaire vide | `parametres-glossaire.html?etat=vide` | F1-04 |
| L17-08 | Modale « Ajouter un terme » | `parametres-glossaire.html?etat=ajout` | F1-04 |
| L17-09 | Lecteur : terme souligné et infobulle | `player-formation.html?etat=terme` | F1-04 |
| L17-10 | Lecteur : tiroir Glossaire | `player-formation.html?etat=tiroir` | F1-04 |

## 2. Confirmation RGPD (L17-01)

Déjà construite (`GdprDialog`), conforme à F1 §2 :
- bilan calculé sur la version à publier ;
- deux cases obligatoires ;
- « Revoir l'étape n » ;
- lien vers les modes d'accès restreints.

Il ne manque que les captures de l'app, en clair et en sombre. À vérifier sur les captures :
- la modale n'apparaît qu'en accès public ;
- « Publier en public » reste désactivé tant que les deux cases ne sont pas cochées, avec le motif sous les boutons ;
- l'horodatage et l'auteur de la confirmation sont enregistrés avec la version.

## 3. Étape Avant / Après : éditeur (L17-02)

- **Ajout** : menu « Ajouter une étape » → « Avant / Après » (icône `layers`). Le type d'étape est `before_after`.
- **Canevas** : les deux captures côte à côte, avec leur étiquette au-dessus et la note en bas. Les outils hotspot, flou et zoom sont masqués : ils ne s'appliquent pas à ce type d'étape.
- **Panneau Étape** :
  - **Capture « Avant »** et **Capture « Maintenant »** : vignette, source (« Étape n », ou « Image importée » avec son nom) et bouton « Changer ». Le menu de « Changer » propose : choisir une étape de la démo, importer une image (PNG, JPEG, WebP, 10 Mo au plus).
    - La capture d'une étape est **copiée** au moment du choix, flous compris. Modifier ensuite l'étape source ne change pas l'Avant / Après.
    - Une image importée passe par la détection des données personnelles (F1 §1), comme une capture.
  - **Disposition** (`radiogroup`) : Côte à côte (par défaut), Curseur, Bascule. Aide : « Sur mobile, la bascule est toujours utilisée. »
  - **Libellés** : « Avant » et « Maintenant » par défaut, 20 caractères au plus.
  - **Note sous les captures** : une ligne pour l'Avant, une pour le Maintenant, 140 caractères chacune. C'est du texte réel, lu par les lecteurs d'écran. Si les deux lignes sont vides, la note n'est pas affichée.
- **Rail** : icône `layers` et titre de l'étape.
- **Publication** : la vérification bloque si l'une des deux captures manque (« L'étape n Avant / Après n'a pas ses deux captures »).

## 4. Étape Avant / Après : lecteur (L17-03 à 05)

- **Étiquettes** :
  - « Avant » : pastille neutre (`stone-200`, texte `stone-800`), et la capture est **désaturée**. Ce n'est jamais une couleur d'erreur : l'ancien outil n'est pas une faute ;
  - « Maintenant » : pastille vert DSI (#C5E86C) avec du texte noir (#12210A, contraste 12,1:1).
- **Côte à côte (L17-03)** :
  - deux colonnes égales ;
  - note en bas dans une carte blanche, avec le bouton « Suivant » ;
  - pas de hotspot : on avance avec « Suivant » ou la flèche droite.
- **Curseur (L17-04)** :
  - une seule zone : l'Avant à gauche du curseur, le Maintenant à droite ;
  - le curseur est un vrai `input type="range"`, étiqueté « Curseur de comparaison Avant / Maintenant », avec un `aria-valuetext` (« 55 % Avant visible ») ;
  - il se pilote avec les flèches, par pas de 5 %, et avec Début et Fin ;
  - la poignée centrale est décorative ;
  - la zone a un `role="img"` et un nom qui décrit la comparaison.
- **Bascule (L17-05)** :
  - un groupe de deux boutons (« Avant » / « Maintenant », `aria-pressed`) au-dessus d'une seule capture ;
  - « Maintenant » est affiché par défaut ;
  - imposée sous 640 px, quel que soit le réglage ;
  - la note passe en feuille du bas.
- **Alternatives** :
  - chaque capture : « {{libellé}} : capture de l'écran, étape n sur N » ;
  - la note reste en texte réel.
- **Mouvement réduit** : pas d'animation de transition entre Avant et Maintenant.

## 5. Glossaire : Paramètres (L17-06 à 08)

- **Onglet** « Glossaire » (icône `notebook`) dans la navigation des Paramètres, après Variables. Il est réservé aux propriétaires, admins et éditeurs. Les lecteurs ne voient pas l'onglet.
- **Actions en tête** : « Importer un CSV », « Exporter » (seulement s'il y a au moins un terme), « Ajouter un terme » (bouton principal).
- **Tableau (L17-06)** :
  - colonnes : Nouveau terme (`th scope="row"`), Ancien terme (barré, `text-muted`), Définition, Modules (nombre de démos publiées qui contiennent le terme), menu « Actions pour {{terme}} » (Modifier, Supprimer) ;
  - recherche sur le nouveau terme, l'ancien et la définition, avec le compteur « n termes » en `role="status"` ;
  - tri alphabétique sur le nouveau terme ;
  - 500 termes au plus par workspace.
- **Réglage** « Souligner les termes dans le lecteur » : activé par défaut. Chaque démo peut le désactiver dans ses Réglages (Réglages > Lecture > « Glossaire »).
- **Vide (L17-07)** : titre « Aucun terme pour l'instant », une phrase d'usage avec le format du CSV, puis « Ajouter un terme ».
- **Modale « Ajouter un terme » (L17-08)** :
  - **Nouveau terme** : obligatoire, 60 caractères, unique dans le workspace (erreur « Ce terme existe déjà ») ;
  - **Ancien terme** : facultatif, 60 caractères, avec l'aide « Affiché barré au-dessus du nouveau terme » ;
  - **Définition** : obligatoire, 140 caractères, avec un compteur ;
  - **Autres formes repérées** : facultatif, séparées par des virgules. Le pluriel simple et l'absence d'accents sont reconnus automatiquement ;
  - « Modifier » ouvre la même modale, titrée « Modifier le terme ».
- **Import CSV** :
  - colonnes `nouveau,ancien,definition,formes`, encodage UTF-8, séparateur virgule ou point-virgule ;
  - aperçu avant l'import : « n termes à ajouter, n à mettre à jour, n lignes ignorées », avec le motif de chaque ligne ignorée (définition trop longue, nouveau terme vide) ;
  - un terme existant est mis à jour, jamais dupliqué.
- **Suppression** : confirmation « Supprimer « {{terme}} » ? Il ne sera plus souligné dans les démos. » Aucune démo n'est modifiée.

## 6. Glossaire : lecteur (L17-09, L17-10)

- **Repérage** :
  - côté lecteur, au chargement : correspondance par mot entier, insensible à la casse et aux accents, sur le texte des bulles, des étapes texte et des pop-up ;
  - le nouveau terme et ses autres formes sont repérés. **L'ancien terme n'est pas souligné** : le texte de la démo doit utiliser le nouveau vocabulaire ;
  - seule la **première occurrence** par étape est soulignée ;
  - le contenu des variables `{{…}}` et les titres d'étape ne sont jamais soulignés.
- **Terme souligné (L17-09)** :
  - soulignement pointillé (`border-bottom: 1.5px dotted currentColor`), `tabindex="0"` et `aria-describedby` vers l'infobulle ;
  - l'infobulle s'ouvre au survol et au focus, et se ferme avec Échap ;
  - elle est sombre (`stone-900`, texte blanc) et affiche : le nouveau terme en gras, « Ancien terme : ~~…~~ » s'il existe, puis la définition ;
  - elle est rendue en portail et placée automatiquement (au-dessus ou en dessous), sans jamais couvrir les boutons de la bulle.
- **Bouton « Glossaire »** :
  - dans l'en-tête du lecteur (icône `notebook`), seulement si au moins un terme est présent dans la démo ;
  - sur mobile, bouton icône seul, nommé « Glossaire ».
- **Tiroir (L17-10)** :
  - `role="dialog"` à droite, de 380 px (plein écran sur mobile) ;
  - recherche, puis le compteur « n termes » (`role="status"`) ;
  - liste `dl` triée : nouveau terme, « Ancien terme : ~~…~~ », définition ;
  - **ne liste que les termes présents dans la démo**, pas tout le glossaire du workspace ;
  - Échap ferme le tiroir et le focus revient sur le bouton « Glossaire ».
- **Centre de formation** (L14) : page « Glossaire » à ajouter plus tard, hors de ce lot.

## 7. Accessibilité

- Les étiquettes Avant / Maintenant sont du texte réel. Le contraste est vérifié pour la pastille neutre (11,4:1) et la pastille verte (12,1:1).
- Le curseur est un `range` natif, avec son nom et sa valeur textuelle.
- Les termes soulignés sont atteignables au clavier. L'infobulle est un `role="tooltip"`.
- Le tiroir piège le focus et rend le focus au bouton à la fermeture.

## 8. Hors périmètre

- Traduction automatique des termes.
- Glossaire partagé entre plusieurs workspaces.
- Page Glossaire du centre de formation.
