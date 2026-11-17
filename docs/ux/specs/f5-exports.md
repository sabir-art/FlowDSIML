# Spec F5 : exports, avec le PDF « mode d'emploi » en priorité

> Le PDF « mode d'emploi » est un support papier ou PDF qui accompagne le tutoriel interactif : à imprimer, à afficher près du poste ou à joindre à une convocation. Les autres formats (MP4, GIF, hors ligne) reprennent tels quels la spec **A3** (`a3-export.md`, `export.html`) : modale de choix, progression, terminé et erreur, liste des exports.
>
> Maquette : `docs/ux/maquettes/refonte/f5-pdf.html`, avec `?view=pages|options` et `&theme=dark` (le thème ne s'applique qu'à la modale).
> Microcopie FR/EN : `export.pdf.*` (54 clés). Les clés `export.*` d'A3 restent valables pour la modale générale.

## 1. Points d'entrée et modale

- Les points d'entrée sont ceux d'A3 §1.
- Le centre de formation (F4) ajoute un lien « Télécharger le mode d'emploi (PDF) » sur la page de parcours et dans le menu d'un module, si l'admin l'a activé.
- Dans la modale A3, la carte **PDF** ouvre un panneau dédié (`?view=options`). Sous 1 100 px, l'aperçu passe sous les options.
- **Modèle** (cartes `aria-pressed` avec vignette) :

  | Modèle | Contenu | Rôle |
  |---|---|---|
  | **Mode d'emploi** | Couverture, sommaire, 2 étapes par page, auto-évaluation | Par défaut |
  | **Une étape par page** | Grandes captures, A4 paysage conseillé | Projection |
  | **Aide-mémoire** | 1 page, les gestes clés en liste, sans captures | Aide-mémoire |

- **Contenu** (cases) :
  - couverture avec QR code ;
  - sommaire par chapitre ;
  - encadrés « À retenir » ;
  - questions d'auto-évaluation, si le module a un quiz (F2) ;
  - glossaire en annexe (seulement si la proposition F1 §4 est validée ; sinon la case est masquée).
- **Format** : A4 portrait ou paysage. **Repères** : pastilles numérotées + cadre, pastilles seules, ou aucun.
- Alerte info `privacy` (toujours visible). Estimation du nombre de pages et du poids. Bouton « Exporter en PDF ».
- **Aperçu à droite** : rendu réel de la page, sur fond ardoise, avec un pager (« Page n sur N ») et des boutons Précédente / Suivante dotés d'un `aria-label`. Il se met à jour à chaque option.
- La progression, le terminé et l'erreur suivent A3 §3–4. L'assemblage d'un PDF de moins de 20 étapes doit prendre moins de 10 secondes.

## 2. Le document « Mode d'emploi »

A4, marges de 15 mm, Plus Jakarta Sans embarquée, couleurs du **thème de la démo** (par défaut prune DSI). Le document est toujours en clair.

| Page | Contenu |
|---|---|
| **Couverture** | Bandeau `primary` sur 46 % de la hauteur, avec le sur-titre « MODE D'EMPLOI », le titre de la démo (30 pt, 800) et le parcours ou le module. Dessous : texte d'intro, tableau (durée, public, version et date, URL), **QR code** vers le tutoriel en ligne (lien perso ou page publique, selon l'accès) avec sa phrase d'aide. En bas : logo du workspace et « Document interne » |
| **Sommaire** | Chapitres en gras, étapes numérotées en prune, numéro de page aligné à droite, liens internes cliquables dans le PDF. Encadré « Repères » qui explique les pastilles et les zones floutées |
| **Étapes** (2 par page) | Bloc numéro (pastille noire) + titre (`h3`) + texte de la bulle. Capture avec un **cadre framboise de 2 px** autour de la zone du hotspot et une **pastille numérotée** framboise (même numéro que l'étape). Si l'étape a des notes ou une étape Avant / Après : encadré « À retenir » (fond vert pâle, filet vert DSI de 3 px, texte noir) |
| **Auto-évaluation** | Questions du quiz en liste, avec cases à cocher vides à imprimer. Réponses en petit en bas de page. Une phrase renvoie vers le quiz en ligne pour **valider** le module (le papier ne valide rien) |

- **En-tête courant** (à partir de la page 2) : « Mode d'emploi · {{titre}} » à gauche, logo du workspace à droite. La maquette montre le wordmark Tutoclic à cette place.
- **Pied** : « Version n · date · workspace » et « Page n / N ». La mention « Créé avec Tutoclic » n'apparaît qu'en plan Free.
- Les étapes de type pop-up, checklist ou choix (A2) sont rendues en texte : titre + texte + liste des choix. Une étape de choix (branching) donne une liste « Si vous êtes… → voir étape n ».
- **Zones floutées** : le flou est déjà appliqué dans les pixels (F1 §1), donc rien ne peut être dé-flouté à l'export.

## 3. Accessibilité du PDF (PDF/UA autant que possible)

- PDF **balisé** : titres H1 (couverture) et H2 (chapitres et sections), étapes en H3, texte réel (jamais une image de texte), ordre de lecture logique, langue du document (`fr-FR`), titre du document = titre de la démo.
- Chaque capture a un texte alternatif (« Capture de l'étape n : {{titre}} »). Les pastilles et les cadres sont décoratifs (artefacts).
- Le QR code a toujours son URL écrite en clair à côté.
- Contrastes : texte ≥ 4,5:1 ; le framboise (5,21:1 sur blanc) est réservé aux repères.

## 4. Les autres formats (rappel A3)

- **MP4 et GIF** : comme A3. Pour la formation, la durée par étape est « Automatique » et le curseur animé est activé par défaut.
- **Hors ligne (.zip)** : comme A3, pour un intranet sans accès Internet. Le quiz y fonctionne, mais ses résultats **ne remontent pas** dans le suivi (F3) ; une `fd-help` le dit.
- La diffusion (popup, intranet, LMS / SCORM) relève de F6.

## 5. Recette prévue

- Les 3 modèles, en portrait et en paysage.
- Démo avec chapitres, pop-up, branching et quiz.
- Vérification des pages : sommaire cliquable, numéros de pages justes, pastilles alignées sur les hotspots, flous présents.
- Contrôle d'accessibilité : PAC ou l'outil d'accessibilité d'Acrobat (balises, ordre, langue, textes alternatifs).
- Impression réelle en noir et blanc : les repères restent lisibles grâce au cadre et au numéro, pas à la couleur seule.
