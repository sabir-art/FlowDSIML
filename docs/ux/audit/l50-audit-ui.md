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
