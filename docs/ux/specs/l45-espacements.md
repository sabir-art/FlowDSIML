# L45 : espacements (loi de proximité), modale Exporter, avatar des commentaires

> Retours client du 20 novembre :
> 1. espacements incohérents à plusieurs endroits ;
> 2. cartes de format trop serrées dans la modale Exporter ;
> 3. avatar mal aligné dans le composeur des commentaires.
>
> Les règles chiffrées sont dans `docs/ux/composants.md` §15.4 bis (tokens `--fd-gap-*`).
> Audit fait le 20 novembre en local sur `claude/dev-mvp` (9b56843), à 1 440 px. Les écarts ont été mesurés par script (écart vertical entre un contrôle et le bloc visible qui le précède), puis vérifiés sur captures.
> Maquette de la modale Exporter : `docs/ux/maquettes/refonte/l45-exporter.html`. Captures : `img/l45-avant-exporter.png` et `img/l45-apres-exporter.png`.

## 1. Règles (rappel de §15.4 bis)

| Relation | Panneau compact | Pages et modales |
|---|---|---|
| Libellé → champ (`--fd-gap-label`) | 6 | 6 |
| Champ → aide (`--fd-gap-help`) | 4 | 6 |
| Option → option (`--fd-gap-option`) | 8 | 8 |
| Texte → son bouton (`--fd-gap-action`) | 12 | 12 |
| Champ → champ, interrupteur → interrupteur (`--fd-gap-field`) | 16 | 20 |
| Groupe → groupe dans une section (`--fd-gap-group`) | 20 | 24 |
| Titre de section → contenu (`--fd-gap-title`) | 12 | 16 |
| Section → section (`--fd-gap-section`) | filet, avec 16 px de part et d'autre | filet, avec 24 px de part et d'autre |

Mise en œuvre :
- ajouter les tokens `--fd-gap-*` à `tokens.css`, avec une variante compacte appliquée par la classe `.fd-dense` sur le panneau de l'éditeur et les tiroirs ;
- chaque groupe porte un `gap`, et les enfants n'ont plus de marge propre ;
- `p { margin: 0 }` dans les panneaux.

## 2. Écarts relevés (audit)

Valeurs mesurées en px, puis valeur attendue. Les écarts **en gras** sont ceux que le client a signalés.

### Éditeur > Réglages
| # | Endroit | Mesuré | Attendu | Correction |
|---|---|---|---|---|
| E1 | **Format des écrans : dernière option « Personnalisé » → libellé « Largeur de sortie »** | 6 | 20 (groupe → groupe) | Deux groupes distincts dans la section, `gap: var(--fd-gap-group)` |
| E2 | Format des écrans : option → option (radios) | 6 | 8 | `--fd-gap-option` |
| E3 | Format des écrans : la légende « Format » est en retrait de 2 px par rapport aux radios | — | aligné à gauche | `legend { padding: 0 }` |
| E4 | **Jeu de données : texte « Aucun jeu de données… » → « Importer un fichier CSV »** | 0 | 12 | `--fd-gap-action`, comme Formulaire de lead (12, conforme) |
| E5 | Notes du présentateur (démo) : l'en-tête passe sur 2 lignes, et l'icône `lock` s'empile au-dessus de « PRIVÉES » | — | une ligne, comme dans l'onglet Étape | En-tête en `flex` sans retour à la ligne ; « Privées » avec son icône sur la même ligne |
| E6 | Lecture : un filet sous « Lecture automatique » seulement ; aide sous un interrupteur à 12 px | 12 | 4 (aide), 16 (interrupteur → interrupteur) | Pas de filet entre les lignes d'une même section |

### Éditeur > Étape
| # | Endroit | Mesuré | Attendu | Correction |
|---|---|---|---|---|
| E7 | Test A/B : texte → « Créer une variante B » | 0 | 12 | `--fd-gap-action` |
| E8 | Voix off : « Ouvrir le réglage » isolé entre le bouton désactivé et l'aide | 8 | lien sur la ligne de « Générer à partir du texte » | Le lien suit le bouton désactivé, sur la même ligne |
| E9 | « Suite de l'étape » : titre de 20 px avec une pastille d'icône, alors que les autres sections ont un titre de 12 px en capitales | — | même titre de section que les autres | Composant de titre de section commun |

### Éditeur > Design
| # | Endroit | Mesuré | Attendu | Correction |
|---|---|---|---|---|
| E10 | Cadre du navigateur : interrupteur « Barre d'adresse » → libellé « Adresse affichée » ; « Boutons de fenêtre » → « Fond autour du cadre » | 10 | 20 (groupe → groupe) | Un groupe par réglage |
| E11 | Choisir un style : grille → « Enregistrer le style actuel » | 10 | 12 | `--fd-gap-action` |
| E12 | Logo et marque : « Choisir dans la médiathèque » → case « Afficher « Créé avec TutoClick » » | 8 | 16 | `--fd-gap-field` |

### Partager
| # | Endroit | Mesuré | Attendu | Correction |
|---|---|---|---|---|
| E13 | Intégrer : segmenté « Où intégrer ? » → segmenté du mode d'intégration → libellé « Code à copier » | 12, puis 8 | 24 entre chaque groupe | Trois groupes, `--fd-gap-group` ; le second segmenté reçoit son libellé (« Mode d'intégration ») |
| E14 | Intégrer : aide « Pris en compte à la prochaine publication… » → « Enregistrer » | 6 | 12 | `--fd-gap-action` |
| E15 | Lien : aide « Un suffixe de 6 caractères… » → « Enregistrer l'adresse » | 14 | 12 | Valeur hors échelle |

### Paramètres
| # | Endroit | Mesuré | Attendu | Correction |
|---|---|---|---|---|
| E16 | Mon profil > Mes données : texte → « Télécharger mes données (.zip) » | 0 | 12 | `--fd-gap-action` |
| E17 | Mon profil > Préférences : le libellé « Apparence » est décalé de 2 px vers la droite | — | aligné | Même composant de champ que « Langue » |
| E18 | Marque > Couleurs : aide → « Enregistrer » | 14 | 24 (dernier champ → validation) | `--fd-gap-group` |
| E19 | Marque > Page publique : groupe « Bouton principal » → « Bouton secondaire » | 40 | 24 | `--fd-gap-group` |
| E20 | Marque > Styles des démos : sous-titre « Styles de l'espace » → texte d'état vide | 20 | 12 | `--fd-gap-title` |

### Modales
| # | Endroit | Constat | Correction |
|---|---|---|---|
| E21 | **Exporter : 5 cartes de format d'environ 130 px**, descriptions sur 6 à 7 lignes | Trop serrées | §3 |
| E22 | Publier, Nouvelle démo | Conformes aux règles | — |
| E23 | Diffuser, Partager > Page publique, Liens personnalisés | Non audités dans cette passe | À mesurer avec le script du §5 au moment de la correction |

## 3. Modale Exporter : formats en liste (E21)

La largeur de la modale (1 120 px), l'aperçu à droite, les options « Contenu », l'encart et le pied ne changent pas.

- **Présentation** :
  - les 5 formats deviennent une **liste verticale** dans un `fieldset` avec la légende « Format » ;
  - une ligne par format, de 60 px de haut au moins : radio, pastille d'icône de 36 px, nom (15 px, graisse 700), description sur une ligne (13 px, `text-muted`), badge éventuel à droite (« Bientôt ») ;
  - écart de 8 px entre les lignes (`--fd-gap-option`).
- **Format choisi** : bordure `primary` de 2 px (1 px de bordure, plus 1 px en `inset`) et fond `primary-soft`, comme les cartes d'aujourd'hui.
- **Format « Bientôt »** : visible, radio désactivé, contenu à 60 % d'opacité, badge « Bientôt ». Jamais masqué.
- **Descriptions** (une ligne chacune, sans couper) :
  - PDF : « À imprimer ou à joindre : étapes, captures et textes des bulles. »
  - GIF animé : « Boucle courte, sans son, pour une documentation ou un ticket. »
  - Version accessible (HTML) : « Page web lisible au lecteur d'écran et au clavier, mêmes textes et captures que le PDF. »
  - Vidéo MP4 : « Vidéo H.264 avec sous-titres, créée dans votre navigateur. »
  - Hors ligne (.zip) : « Démo autonome, ouvrable sans Internet. »
- **Clavier** : flèches haut et bas dans le groupe de radios (comportement natif). Le focus visible est sur la ligne entière.
- **Hauteur** : la modale passe d'environ 600 à 750 px. Elle tient dans un écran de 900 px. Sous 820 px de hauteur, la colonne gauche défile et le pied reste fixe.
- **Sous 900 px de large** (déjà prévu en L15) : l'aperçu passe sous la liste.

## 4. Composeur des commentaires : avatar

**Révision de L43** : l'avatar est **conservé** à gauche du champ (choix du client), mais aligné correctement.

- **Champ sur une ligne** : l'avatar (32 px) est centré verticalement sur le **cadre du champ** (48 px), pas sur le bloc champ + aide. Le conteneur aligne l'avatar et le cadre en `align-items: center` ; la ligne d'aide est hors de cette rangée.
- **Champ sur plusieurs lignes** : l'avatar reste en haut, aligné sur la première ligne. Rangée en `align-items: flex-start`, avec une marge haute de 8 px sur l'avatar (centré sur la hauteur d'une ligne de 48 px).
- **Mise en œuvre** : une seule règle CSS, `align-self` de l'avatar selon l'état « multiligne » (`textarea.scrollHeight > 48`), sans saut au passage d'une ligne à deux.
- Le bouton d'envoi est dans le champ, en bas à droite (L43). La spec L43 est corrigée sur ce point : l'avatar est conservé.

## 5. Recette

- **Script de mesure** :
  - pour chaque panneau (éditeur : Étape, Design, Réglages ; Partager, ses 5 onglets ; Paramètres, toutes les pages ; modales Publier, Exporter, Nouvelle démo, Diffuser), mesurer l'écart entre chaque contrôle et le bloc qui le précède ;
  - aucune valeur hors du tableau du §1. Les mesures de l'audit sont dans le message de livraison.
- **Captures avant/après** des écarts E1 à E20, à 1 440 px, en clair et en sombre.
- **Modale Exporter** : 1 440 × 900 (sans défilement), 1 280 × 800 (la colonne gauche défile, le pied reste visible), 390 px.
- **Composeur** : sur une ligne, l'avatar est centré sur le cadre à ±1 px ; sur trois lignes, il est en haut ; aucun saut visible au passage à deux lignes.
