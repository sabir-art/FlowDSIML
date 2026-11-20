# Spec L15 : exports (PDF, GIF animé, attestation de suivi)

> Ce lot active la modale d'export d'une démo (A3, `export.html`) avec deux formats réels, PDF et GIF animé. Il fixe le gabarit des pages PDF aux couleurs du workspace (repris de F5, `f5-pdf.html`) et l'attestation de suivi annoncée en L14-06. La vidéo MP4 et le hors-ligne restent visibles avec le badge « Bientôt ».
>
> **Maquette** (clair et sombre pour les modales ; les documents sont toujours en clair) : `docs/ux/maquettes/refonte/l15-exports.html`, états `?view=pdf|gif|en-cours|termine|erreur|gabarit|attestation`.
>
> F5 reste la source pour l'accessibilité du PDF (§3) et la recette (§5). Le modèle « Mode d'emploi » complet de F5 (QR code, auto-évaluation, aide-mémoire) n'est pas dans ce lot.

## 1. États (codes de l'outil de suivi)

| Code | État | Maquette |
|---|---|---|
| L15-01 | Modale d'export, PDF et ses options, avec aperçu | `?view=pdf` |
| L15-02 | Modale d'export, GIF animé et ses options, avec aperçu | `?view=gif` |
| L15-03 | Export en cours | `?view=en-cours` |
| L15-04 | Export terminé | `?view=termine` |
| L15-05 | Export en erreur | `?view=erreur` |
| L15-06 | Gabarit des pages PDF, à la marque du workspace | `?view=gabarit` |
| L15-07 | Attestation de suivi (PDF) | `?view=attestation` |

## 2. Modale d'export (L15-01, L15-02)

- **Points d'entrée** : ceux d'A3 §1 (menu « … » d'une démo, éditeur, page Partager). Une démo jamais publiée ouvre une petite modale qui explique qu'il faut d'abord la publier.
- **Gabarit** : modale large (1 120 px), titre « Exporter « {{démo}} » », options à gauche et aperçu à droite sur fond ardoise (`#5B6670`). Sous 1 100 px, l'aperçu passe sous les options.
- **Formats** (`radiogroup` de 4 cartes ; la carte choisie a une bordure prune de 2 px sur fond `primary-soft`) :
  - **PDF** (choisi par défaut) ;
  - **GIF animé** ;
  - **Vidéo MP4** et **Hors ligne (.zip)** : visibles, avec le badge « Bientôt » en haut à droite, `aria-disabled="true"` et une description liée. On ne peut pas les choisir. On ne les supprime pas.
- **Options PDF** :
  - **Mise en page** : segmenté « Une étape par page » (par défaut) ou « Deux étapes par page » ;
  - **Contenu**, quatre interrupteurs avec une aide chacun :
    - Captures d'écran (zones floutées déjà appliquées) ;
    - Texte des bulles (titre et texte) ;
    - Numérotation des étapes (pastille numérotée et cadre sur la capture) ;
    - Couverture et sommaire.

    « Captures » et « Texte des bulles » ne peuvent pas être coupés tous les deux : le second se grise avec l'aide « Il faut au moins les captures ou le texte » ;
  - **Format** : A4 portrait ou paysage. **Langue du document** : celle de la démo (un seul choix aujourd'hui).
- **Options GIF** :
  - **Vitesse** : segmenté Lente (4 s par étape), Normale (2,5 s, par défaut), Rapide (1,5 s) ;
  - **Taille** : 640, 960 (recommandé) ou 1 280 px de large ;
  - **Étapes** : toutes, ou « Une plage d'étapes » qui affiche deux listes « De l'étape » et « À l'étape » ;
  - **Contenu** : interrupteurs « Bulle de l'étape », « Curseur et animation de clic » et « Lecture en boucle », tous actifs par défaut.
- **Alerte d'information**, toujours visible : les zones floutées restent floutées ; les commentaires internes et les étapes de formulaire ne sont jamais exportés.
- **Pied** :
  - une aide calculée : « n pages · texte réel, titre et langue du document renseignés » pour le PDF, ou la durée du GIF (nombre d'étapes × vitesse) ;
  - on n'affiche **aucun poids estimé** avant la création du fichier, pour ne pas donner un chiffre faux. Le poids réel apparaît dans L15-04 ;
  - pour le GIF, l'aide ajoute « Au-delà de 15 étapes, préférez le PDF » ;
  - les boutons « Annuler » et « Exporter en PDF » ou « Exporter en GIF ».
- **Aperçu** :
  - PDF : la vraie page rendue, avec un pager « Page n sur N » et des boutons Précédente / Suivante (`aria-label`). Il se met à jour à chaque option ;
  - GIF : l'image animée elle-même. Une barre de segments indique l'étape (« Étape n sur N ») et un bouton Pause respecte `prefers-reduced-motion` (pause par défaut si le visiteur réduit les animations) ;
  - l'aperçu est `aria-hidden` ; le texte du pied donne l'information.

## 3. En cours, terminé, erreur (L15-03 à L15-05)

- Petite modale (540 px), gabarit A3.
- **En cours** :
  - barre `role="progressbar"` (orange DSI) ;
  - une ligne `aria-live="polite"` : « n % · page n sur N » (ou « étape n sur N » pour le GIF) ;
  - trois étapes : Préparation des captures, Mise en page ou Rendu des images, Assemblage du PDF ou Encodage du GIF ;
  - aide : le fichier se crée dans le navigateur, il faut garder l'onglet ouvert ;
  - « Annuler l'export ».
  - On n'affiche pas de temps restant tant qu'il n'est pas mesuré.
- **Terminé** :
  - icône de succès et titre « PDF prêt » ou « GIF prêt » ;
  - carte du fichier : nom tiré du titre de la démo (minuscules, tirets), puis nombre de pages ou durée, poids réel et format ;
  - bouton « Télécharger ». Le téléchargement démarre aussi tout seul ;
  - aide : le fichier n'est pas conservé ;
  - « Exporter dans un autre format » rouvre L15-01.
- **Erreur** (`alertdialog`) :
  - titre « L'export n'a pas abouti » ;
  - une phrase qui dit la cause et quoi faire, puis un encadré « Détail » (l'étape en cause) ;
  - les boutons Fermer, l'action de repli quand elle existe (« Exporter sans les captures ») et « Réessayer » en primaire.

## 4. Gabarit des pages PDF (L15-06)

- A4, marges de 15 mm, Plus Jakarta Sans embarquée. Le document est toujours en clair.
- **Couleurs** : celles du workspace, comme le centre de formation (L14) : couleur principale pour le bandeau de couverture et les numéros du sommaire. Les repères (cadre et pastille sur la capture) restent framboise `#D60B52` pour être vus sur toute capture.
- **Couverture**, si l'option est active :
  - bandeau de la couleur principale sur 46 % de la hauteur, avec le sur-titre « TUTORIEL », le titre de la démo et la formation ou le module ;
  - tableau : étapes, version, adresse du tutoriel en ligne (seulement si la démo est publiée) ;
  - sommaire des premières étapes avec leur page. Au-delà, « … n autres étapes » ;
  - en bas, le logo et le nom du workspace, avec « document interne ».
- **En-tête courant** (dès la page 2) : le titre de la démo à gauche, le logo et le nom du workspace à droite.
- **Pied** : « {{workspace}} · version n » et « Page n / N ». « Créé avec TutoClick » n'apparaît qu'en plan Free.
- **Une étape par page** :
  - pastille noire numérotée, titre, texte de la bulle ;
  - la capture en grand, avec le cadre et la pastille du même numéro ;
  - l'encadré « À retenir » si l'étape a des notes. **Pas dans cette version** : le manifeste n'a pas encore de champ de notes par étape.
- **Deux étapes par page** : même bloc, deux fois, comme F5.
- **Sans captures** : liste numérotée des étapes (titre et texte), séparées par un filet.
- **Sans numérotation** : on retire les pastilles et les cadres, et les titres gardent leur numéro écrit (« 3. Cliquer sur… »).
- **Accessibilité** :
  - **livré** : texte réel (jamais une image de texte), titre du document et langue renseignés, ordre de lecture des étapes ;
  - **dette connue** : pas de balisage (H1/H2/H3, textes alternatifs des captures, repères en artefacts), que jsPDF ne sait pas produire. À reprendre si l'on change de moteur de génération. En attendant, l'aide du pied de modale dit seulement « n pages · texte réel, titre et langue du document renseignés », sans parler de « PDF balisé ».

## 5. Attestation de suivi (L15-07)

- Elle se télécharge depuis la page d'une formation terminée du centre (L14-06). Le bouton « Télécharger mon attestation (PDF) » perd son badge « Bientôt » à la livraison de L15.
- **A4 portrait, une page, sobre**, imprimable en noir et blanc, sans aplat de couleur :
  - en-tête : logo et nom du workspace, « Centre de formation », filet noir de 2 px ;
  - pastille bordée « ATTESTATION DE SUIVI · NON CERTIFIANTE » ;
  - titre « Attestation de suivi » ;
  - phrase : « {{workspace}} atteste que **{{prénom}} {{nom}}** a suivi en ligne la formation **« {{formation}} »** et validé l'ensemble de ses modules. Formation validée le **{{date}}**. » La date est celle où le dernier module obligatoire a été validé (événement `demo_complete` ou quiz réussi, horodaté côté serveur), renvoyée par la RPC d'attestation. Si elle manque, la phrase s'arrête après « modules » ;
  - tableau Module, Statut, Quiz (meilleur score, sinon « — ») ;
  - zone « Pour {{workspace}} » avec une ligne de signature vide, et « Document généré le {{date du jour}} » ;
  - encadré final : « Attestation de suivi, non certifiante. Elle indique que les modules ont été suivis et validés en ligne ; elle ne vaut ni diplôme, ni certification, ni habilitation. »
- **Prénom et nom** : l'attestation sert à un salarié, elle porte donc son nom complet. Il vient du nom complet de l'apprenant, sinon du prénom et du nom fournis par le lien personnel ; jamais de l'e-mail.
- **Aucun nom connu** : aucune attestation n'est délivrée. Sur la page de la formation terminée (L14-06), le bouton est remplacé par une aide : « Pour recevoir votre attestation, contactez {{workspace}} : votre nom n'est pas renseigné. », avec le lien « Besoin d'aide ? » s'il existe.
- Elle est disponible seulement si **tous** les modules obligatoires sont validés. Sinon, le bouton n'apparaît pas.
- Le PDF est balisé comme au §4, avec le titre « Attestation de suivi · {{formation}} ».

## 6. Règles

- Données fictives uniquement (`*.example`, « Mission Locale Exemple »). Icônes Lucide, aucun caractère utilisé comme icône.
- Aucune valeur inventée : pas de poids ni de durée estimés avant la création du fichier. La seule date de validation affichée est celle de la formation, horodatée côté serveur.
- Les formats non disponibles restent visibles avec « Bientôt ». On ne les supprime pas.
- Contrastes : texte ≥ 4,5:1. Le framboise des repères (5,21:1 sur blanc) ne sert jamais au texte courant.
