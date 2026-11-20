# L29 : snippets d'intégration et version accessible des exports

> Arbitrage du chef d'équipe sur A5-05 et A11Y-10. Version courte : écrans existants plus deltas, sans maquette.
> Composants du design system, icônes Lucide. Données fictives : espace « Acme », démo « Prise en main d'un logiciel », domaines `.example`.

## 1. États et codes

| Code | État | Où |
|---|---|---|
| L29-01 | Snippets : choix de l'outil, code et consignes | Partager > Intégrer, et Diffuser > Intranet |
| L29-02 | Snippets : mode pop-up | même emplacement, mode « Bouton + pop-up » |
| L29-03 | Export « Version accessible » (HTML) | Modale d'export (L15-01) |
| L29-04 | Version accessible ouverte dans le navigateur | Fichier HTML exporté |

## 2. Snippets d'intégration (L29-01, L29-02)

Ce lot remplace le lien « Guides » en « Bientôt » de l'onglet Intégrer. Il part du code iframe ou pop-up déjà produit (L16-05, L16-06) : aucun nouveau mode d'intégration n'est créé.

- **Emplacement** : au-dessus du bloc de code existant, un sélecteur segmenté « Où intégrer ? ». Les choix, dans cet ordre :
  - **HTML** (par défaut) ;
  - **WordPress** ;
  - **SharePoint** ;
  - **Moodle** ;
  - **Notion**.
  - Le choix est mémorisé par utilisateur.
- **Contenu par outil** :
  - le code à copier, adapté à l'outil ;
  - 3 consignes numérotées au plus, avec le vocabulaire de l'outil ;
  - une limite connue s'il y en a une.

| Outil | Code | Consignes | Limite affichée |
|---|---|---|---|
| HTML | iframe ou bouton + script, comme aujourd'hui | « Collez le code à l'endroit voulu de la page. » | — |
| WordPress | même code | 1. Ajoutez un bloc « HTML personnalisé ». 2. Collez le code. 3. Prévisualisez la page. | « Le mode pop-up demande un thème qui autorise les scripts. » |
| SharePoint | adresse de la démo seule (pas de code) | 1. Modifiez la page. 2. Ajoutez le composant « Incorporer ». 3. Collez l'adresse. | « Le domaine demos.<domaine> doit être autorisé par l'administrateur SharePoint (sites autorisés pour l'incorporation). Mode pop-up non disponible. » |
| Moodle | iframe | 1. Dans l'éditeur de texte, ouvrez le mode HTML. 2. Collez le code. 3. Enregistrez. | « Pour suivre la progression des apprenants, préférez le paquet SCORM (Diffuser > Plateforme de formation). » avec un lien |
| Notion | adresse de la démo seule | 1. Tapez /embed. 2. Collez l'adresse. 3. Ajustez la hauteur du bloc. | « Mode pop-up non disponible. » |

- **Mode pop-up** (L29-02) : si l'outil ne permet pas les scripts (SharePoint, Notion), le choix « Bouton + pop-up » reste visible mais est désactivé pour cet outil (`aria-disabled`), avec la limite en aide. Il n'est jamais masqué.
- **Copier** :
  - bouton « Copier le code », ou « Copier l'adresse » pour SharePoint et Notion ;
  - toast : « Code copié. » ou « Adresse copiée. ».
- **Adresse utilisée** : l'adresse personnalisée si elle existe (L28-01), sinon `#/d/<id>`.
- **Accessibilité** :
  - le sélecteur est un `radiogroup` nommé « Où intégrer ? » ;
  - le bloc de code est un `pre` avec un libellé ;
  - les consignes sont une liste ordonnée.
- **Hors périmètre** : Webflow, Confluence et Google Sites (A5 §5) ; on peut les ajouter plus tard sur le même modèle.

## 3. Version accessible des exports (L29-03, L29-04)

jsPDF ne produit pas de PDF balisé (dette de L15 §4). Le PDF reste tel quel, avec deux ajouts, et un export HTML sémantique est proposé à côté.

### 3.1 PDF (delta)
- Métadonnées du PDF : **titre** = titre de la démo, **langue** = langue de la démo (`fr-FR` par défaut). Le titre est affiché à la place du nom de fichier (`DisplayDocTitle`).
- L'aide du pied de modale reste exacte : « {{n}} pages · titre et langue du document renseignés ». Elle ne parle jamais de « PDF balisé ».

### 3.2 Export « Version accessible » (L29-03)
- **Modale d'export** : un troisième format, « Version accessible (HTML) », après PDF et GIF, avec l'icône `accessibility`.
  - Aide : « Une page web lisible au lecteur d'écran et au clavier, avec les mêmes textes et captures que le PDF. »
- **Options** : les mêmes que le PDF, quand elles ont un sens (étapes incluses, chapitres). Les options de mise en page (format, marges) sont masquées pour ce format.
- **Résultat** : un fichier `{{demo}}-accessible.html` autonome. Les images sont intégrées dans le fichier : un seul fichier, qui s'ouvre sans connexion.
- **Après le PDF** : quand l'export PDF est terminé (L15-04), un lien secondaire « Télécharger aussi la version accessible (HTML) » est proposé.

### 3.3 Contenu du fichier HTML (L29-04)
- `<html lang="{{langue}}">`, `<title>` = titre de la démo.
- `h1` : titre de la démo. `h2` : chapitres. `h3` : « Étape {{n}} · {{titre de l'étape}} ».
- Chaque capture est un `img` avec un texte alternatif, construit dans cet ordre :
  1. le texte alternatif saisi sur l'étape, s'il existe ;
  2. sinon « Capture d'écran : {{titre de l'étape}}. » suivi de l'action du repère, par exemple « Le bouton « Nouvelle opportunité » est entouré. ».
- La consigne de la bulle suit l'image en texte réel. Les variables sont remplacées par leur valeur par défaut.
- Les zones floutées restent floutées dans l'image. Le texte alternatif ne contient jamais de texte masqué.
- L'ordre de lecture est l'ordre des étapes. Il n'y a ni position absolue ni texte dans les images.
- Un sommaire en tête (`nav` avec liens vers chaque `h3`), puis un lien « Aller au contenu ».
- Les styles sont intégrés au fichier : contraste d'au moins 4,5:1, texte agrandissable à 200 % sans perte, impression propre.
- Les étapes vidéo deviennent une image de la première image de la vidéo, avec la transcription. Les quiz deviennent une liste des questions, sans les réponses.

### 3.4 Déclaration d'accessibilité
Ajouter à la déclaration, rubrique « Contenus non accessibles » :

> Les exports PDF ne sont pas balisés (titres, textes alternatifs). Ils renseignent le titre et la langue du document. Une version accessible au format HTML, avec le même contenu, est proposée à chaque export.

La ligne A11Y-10 passe ensuite en « dérogation documentée avec alternative ».

## 4. Recette
- Snippets : copier pour chaque outil, puis coller dans une page HTML de test. Vérifier que les modes non disponibles restent visibles et désactivés.
- Version accessible :
  - NVDA et Firefox : navigation par titres, textes alternatifs lus, sommaire ;
  - axe sans erreur ;
  - zoom à 200 % ;
  - ouverture hors connexion.
- PDF : titre et langue visibles dans les propriétés du document.
