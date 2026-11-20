# L50, Audit UI de l'app selon les règles §17

> Audit fait le 20 novembre :
> - sur l'app en ligne (sabir-art.github.io/FlowDSIML, page de connexion) ;
> - et en local sur dev-mvp 09db6a8, avec un faux Supabase et des données fictives, pour les pages connectées.
>
> Captures : `e2e/screens.cjs` (1440 × 900), complétées par des scripts temporaires.
> Référentiel :
> - `composants.md` §16 et §17 ;
> - deltas T1 à T9 (`specs/ui-deltas-l41-l49.md`) ;
> - lots L48 et MOB-01 déjà spécifiés.
>
> **Impact** :
> - **A** : gêne l'action principale ou casse la cohérence d'ensemble ;
> - **B** : alourdit l'écran ou brouille la hiérarchie ;
> - **C** : finition.
>
> Un écart déjà couvert par un lot spécifié renvoie à ce lot, sans nouvelle demande.

## Paquet 1 : Connexion, Démos, éditeur, Partager, Exporter

### 1. Connexion (en ligne)
| # | Impact | Constat | Correction |
|---|---|---|---|
| C1 | A | Le premier élément du formulaire est « Continuer avec Google », désactivé (« Bientôt »). L'action la plus visible est inutilisable. | Le formulaire e-mail d'abord. « Continuer avec Google · Bientôt » passe sous « Se connecter », après le séparateur « ou ». Il reste visible, jamais masqué. |
| C2 | A | Le logo complet est affiché à 198 px de large, sa signature « Porté par la DSIML » est illisible. Le minimum du logo complet est **480 px de large** (§16) ; LOGO-01 l'a lu comme une largeur d'écran. | Logo **compact** de 40 px de haut sur la page de connexion. Le logo complet est réservé aux documents et aux grands formats. (Correction de ma validation LOGO-01.) |
| C3 | B | « Créer un compte **gratuit** » : il n'y a ni paiement ni offre (outil interne). | « Créer un compte ». |
| C4 | C | Pied de page : « Bientôt » en pastille à côté de « Conditions ». | « Bientôt » en texte de 13 px `text-muted` (T2). |
| C5 | C | « Email professionnel » ; ailleurs l'app écrit « e-mail ». | « Adresse e-mail professionnelle ». |
| C6 | C | L'illustration de droite utilise des aplats bleus (#6B7CF0), hors des couleurs de la marque. | Gris neutres, et le magenta seulement sur le point d'intérêt. |

### 2. Démos
| # | Impact | Constat | Correction |
|---|---|---|---|
| D1 | A | Deux actions principales : « Nouvelle démo » et « Personnaliser », sur une ligne rose dans la checklist (T1). | Dans la checklist, l'étape conseillée a un bouton secondaire, sans fond rose. |
| D2 | A | La checklist « Prise en main » est dépliée (environ 390 px) au-dessus de la liste : les démos commencent à 750 px. | Repliée sur une ligne par défaut, avec « 2 étapes sur 7 » et « Afficher » (L48-B). Dépliée seulement à la demande. |
| D3 | B | Barre latérale : « Workspace » en anglais ; Leads, Membres et Plans en double ; « Plan Pro » dans le sélecteur d'espace. | L48-A §1 et §6 (déjà spécifié). |
| D4 | C | « Nouveau » en pastille dans les raccourcis. | Texte (écart L47-02 déjà envoyé). |

### 3. Éditeur (Étape, Design, Réglages)
| # | Impact | Constat | Correction |
|---|---|---|---|
| E1 | A | Dans l'éditeur, le bouton principal prend `--fd-color-accent` (rose vif, `maquette-ajouts.css`, `--tc-grad-cta`) avec une icône de fusée : « Publier » n'a pas la couleur `primary` magenta des autres écrans. | `fd-btn--primary` standard, sans icône. |
| E2 | A | Réglages : le titre « NOTES DU PRÉSENTATEUR · DÉMO · PRIVÉES » déborde du panneau (« PRIVÉES » touche le bord). | « Notes du présentateur », puis « Privées » en 13 px `text-muted` sur la ligne d'aide, sous le titre. |
| E3 | B | Titres de section en capitales espacées (CHOISIR UN STYLE, COULEURS, ÉTIQUETTES, COLLABORATION…). | 13 px 600 en casse normale (L48-E §3), avec un filet entre les sections. |
| E4 | B | Sélection en aplat rose et contour magenta : étape active dans la colonne, style choisi dans Design (T5). | Étape active : fond `surface-sunken`. Style choisi : contour de 2 px `text`. |
| E5 | B | En-tête : 9 contrôles et 3 boutons ; « Brouillon » en pastille jaune. | L48-E §6. En attendant : « Brouillon » en texte avec un point de 8 px. |
| E6 | B | Les aides font 3 à 4 lignes (Étiquettes, Notes, Format) ; le mot « workspace » y apparaît. | Une ligne au plus, le reste dans l'aide (T7) ; « espace ». |
| E7 | C | « Aperçu avec Exemples / Valeurs de repli » est toujours affiché au-dessus du canevas, même sans variable. | Affiché seulement si l'étape contient une variable. |
| E8 | C | Design : 4 couleurs saisies en hexadécimal, en colonne de 4 champs pleine largeur. | Une ligne par couleur : libellé à gauche, pastille et code à droite (T8). |

### 4. Partager
| # | Impact | Constat | Correction |
|---|---|---|---|
| P1 | A | Colonne de droite : 5 cartes empilées (Accès à la démo, Formation, Aperçu, Aperçu sur les réseaux, Cette semaine). « Accès » est aussi un onglet. | 2 cartes au plus : l'aperçu avec « Lancer la démo », puis « Cette semaine ». « Accès » ne vit que dans son onglet. La formation passe dans l'onglet Lien, en une ligne. |
| P2 | B | Bandeau vert « Démo publiée ! » affiché tant que `?published` est dans l'adresse (y compris après un rechargement), sans fermeture. | Toast après la publication, puis rien. |
| P3 | B | En-tête : « Aperçu » et « Exporter (PDF, GIF) » sont décalés entre les deux lignes du sous-titre ; la ligne RGPD fait concurrence au titre. | Boutons alignés sur le titre, en haut à droite. La confirmation RGPD passe dans l'onglet Accès. |
| P4 | B | « Personnaliser par paramètres d'URL » montre une adresse technique avec `?company=`. | « Les variables de la démo » : les pastilles L46, avec un exemple de lien. La syntaxe technique va dans l'aide. |
| P5 | C | « Partager ailleurs » mélange des réseaux (E-mail, LinkedIn, X) et un export (GIF / vidéo). | Les réseaux seulement ; le GIF passe par « Exporter ». |
| P6 | C | « Bientôt » en pastille sous l'aperçu réseaux. | Texte (T2). |

### 5. Exporter
| # | Impact | Constat | Correction |
|---|---|---|---|
| X1 | B | Formats en cartes encadrées, avec une pastille d'icône chacune ; sélection en aplat rose et contour. | Delta L45 déjà envoyé : une liste, sélection en `surface-sunken`. |
| X2 | B | Icône en pastille devant le titre de la modale. | Titre seul. |
| X3 | C | « Couverture et sommaire : Titre, workspace… » ; « Hors ligne » avec « Bientôt » en pastille. | « espace » ; « Bientôt » en texte. |

### Ordre conseillé (paquet 1)
1. C1, C2, D1, D2 et E1 : action principale et cohérence de la marque.
2. P1 et E2 : charge et débordement visibles.
3. Le reste, au passage.

## Paquet 2 : Analytics, Apprenants, centre de formation, lecteur, Paramètres

### 6. Analytics (espace)
| # | Impact | Constat | Correction |
|---|---|---|---|
| N1 | A | 7 onglets au même niveau ; 6 indicateurs serrés, avec des libellés sur 3 lignes à 1 280 px. | L48-D (4 onglets et « Plus ») et écart L47-01 (4 indicateurs), déjà envoyés. |
| N2 | B | Les blocs sous le graphique n'ont pas de grille commune : « Par démo » fait deux tiers, Sources un tiers, puis deux blocs pleine largeur de hauteurs différentes. | Grille de 12 colonnes, widgets en demi-largeur (L48-D §3.2). |
| N3 | B | « Étape par étape » utilise des barres orange, alors que les autres barres de la page sont magenta. | Couleur de progression unique (X1). |
| N4 | C | En-tête : « Mesure des visites » est un bouton à côté d'« Exporter » ; « Dates · Bientôt » en pastille dans la barre. | « Mesure des visites » dans « Plus » (L48-D §2) ; « Bientôt » en texte. |

### 7. Apprenants
| # | Impact | Constat | Correction |
|---|---|---|---|
| A1 | A | La carte « Terminé » est un aplat vert-jaune (`hero`) ; les 3 autres non. | 4 chiffres dans une bande, séparés par des filets, sans aplat ni pastille d'icône (comme L47-02). |
| A2 | B | Un statut en pastille sur chaque ligne (« À relancer » avec une cloche, « Quiz non validé »), et les formations en pastilles roses : 3 pastilles par ligne. | Statut en texte de 14 px avec un point de 8 px (orange pour « À relancer », rouge pour « Quiz non validé ») ; formations en texte gris, séparées par une virgule (T2). |
| A3 | B | Les en-têtes « Score au quiz » et « Dernière activité » passent sur 2 ou 3 lignes. | « Score » et « Activité » (le détail en infobulle), sur une ligne ; colonnes de largeur fixe. |
| A4 | B | Pastilles d'icône dans les cartes de chiffres et devant « 41 apprenants » ; ce titre répète le sous-titre de la page. | Pas de pastille (T3). Le titre du tableau disparaît : le sous-titre de la page suffit. |
| A5 | C | « Tentatives épuisées » et « Accorder une tentative » dans la cellule Statut : la première ligne fait le double des autres. | Le lien passe dans le menu « … » de la ligne ; le statut reste sur une ligne. |

### 8. Centre de formation (bureau)
| # | Impact | Constat | Correction |
|---|---|---|---|
| F1 | A | Carte « Ma formation en cours » en aplat vert-jaune, avec un bouton noir. | Comme MOB-01 M2 et M9 : carte `surface`, barre de 6 px, bouton `primary`. |
| F2 | B | Cartes de formation avec la liste de leurs modules, 4 statuts en pastilles par carte (« En cours », « Validé », « Mot de passe », « Expiré »…) et une pastille de statut sur la vignette. | Comme MOB-01 M4 : titre, une ligne, barre, chevron. Les modules sont sur la page de la formation. Statuts en texte. |
| F3 | B | Filtres en pastilles avec un point de couleur et un compteur. | Pastilles sans point ni compteur (MOB-01 M3). |
| F4 | C | En-tête : la carte « Ma formation en cours » est plus haute que le bloc titre et recherche, les bas ne s'alignent pas. | Bloc de reprise sous la recherche, sur toute la largeur (une ligne : nom, barre, « Reprendre »). |

### 9. Lecteur
| # | Impact | Constat | Correction |
|---|---|---|---|
| L1 | — | Bureau : conforme (bulle, barre de contrôle unique, « Créé avec TutoClick »). | — |
| L2 | A | Mobile : voir MOB-01 (M5 à M8), en particulier « Réessayer le quiz » caché. | Déjà envoyé. |
| L3 | C | Le compteur « 1 / 3 » est en chasse fixe dans la bulle, et en police normale dans la barre de contrôle. | Même police, en `tabular-nums`. |

### 10. Paramètres
| # | Impact | Constat | Correction |
|---|---|---|---|
| S1 | A | « Plans et facturation » dans le menu, « Plan Pro » dans le sélecteur d'espace : il n'y a ni prix ni offre. | L48-A §6 (« Utilisation »), déjà spécifié. |
| S2 | B | Navigation : « WORKSPACE » en capitales anglaises, une icône par entrée, entrée active en aplat rose. | Groupes « Espace », « Marque », « Contenu », « Compte » en capitales de 11 px ; pas d'icône ; entrée active en fond `surface` et graisse 600 (L48-A §4, T5). |
| S3 | B | « Autoriser les liens publics » a une aide de 3 lignes ; « Contact d'aide » en a 2. | Une ligne ; le reste dans l'aide (T7). |
| S4 | C | « Nom du workspace » ; 3 « Bientôt » en pastille (logo, langue…). | « Nom de l'espace » ; « Bientôt » en texte. |

## Paquet 3 : aide, et écarts transverses

### 11. Aide (tiroir)
| # | Impact | Constat | Correction |
|---|---|---|---|
| H1 | B | « Apprendre TutoClick » mélange 3 formes d'action sur 5 lignes (« Bientôt » en pastille, « Commencer » en lien, « 5 étapes » en texte). | Une ligne par parcours, toute la ligne cliquable : nom, puis « 5 étapes » en gris et un chevron ; « Bientôt » en texte pour celui qui manque. |
| H2 | B | Le champ de recherche a deux contours au focus (bordure magenta et halo bleu). | X2. |
| H3 | C | « SUR CETTE PAGE · DÉMOS » et « RACCOURCIS » en capitales. | Casse normale, 12 px 600 (X5). |

### 12. Écarts transverses (à corriger une fois, dans `packages/ui`)
| # | Impact | Constat | Correction |
|---|---|---|---|
| X1 | B | La progression a trois couleurs selon l'écran : orange (Apprenants, Étape par étape), magenta (lecteur, centre), vert-jaune (formations terminées). | Une règle : barre `text` dans l'app ; couleur du thème dans le lecteur et le centre, vus par le visiteur ; pas de couleur propre pour « terminé » (le texte le dit). |
| X2 | B | Double contour au focus des champs (bordure `primary` et halo `--fd-shadow-focus` bleu) : recherche, catalogue de variables, options du quiz. | Un seul indicateur : le halo, au clavier seulement (`:focus-visible`). La bordure reste `border-strong`. |
| X3 | A | Aplats vert-jaune `hero` sur des cartes : Apprenants, centre, attestation, raccourcis de Démos (déjà corrigé). | Retirer `hero` des cartes ; le token reste pour les illustrations. |
| X4 | B | Pastilles pour des états qui se disent en texte : statuts, « Bientôt », « Nouveau », « Brouillon », étiquettes. | Composant `fd-status` : un point de 8 px et un texte de 13 ou 14 px. Les pastilles restent pour les étiquettes choisies par l'utilisateur. |
| X5 | B | Titres de section en capitales espacées : éditeur, aide, navigation des Paramètres. | Casse normale pour les titres de section. Exception : les titres de groupe de la navigation des Paramètres restent en capitales de 11 px, comme dans la maquette L48-A. |
| X6 | C | Mots anglais et variantes : « workspace », « Email », « Plans ». | « espace », « e-mail », « Utilisation ». |

### Ordre conseillé (paquets 2 et 3)
1. X3 et X2 : corrigés une fois, ils règlent A1, F1, H2 et plusieurs écarts du paquet 1.
2. A2, F2 et X4 : la charge visuelle des listes.
3. Les lots déjà spécifiés : L48-A (S1, S2), L48-D (N1, N2) et MOB-01.
