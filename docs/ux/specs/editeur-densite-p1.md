# Éditeur et partage : écarts avec l'outil de référence, et specs P1

> Retour client du 21/11 : 15 captures d'un éditeur de démos concurrent, décrites par le chef (les captures restent hors du dépôt, qui est public). Le client juge TutoClick « lourd ». Ce document compare les deux outils à partir de TutoClick sur `claude/dev-mvp` (172daf6) : en-tête, menu d'ajout, rail d'outils, panneaux, page Partager. Il liste les écarts par priorité, puis spécifie les P1.
>
> **Validé par le chef le 21/11** : P1 1 à 5 tels quels, P2 et P3 validés. Ordre de la file du dev : logo, NAV-02 et §11, ICON-01, éditeur P1, MOTION-01, P2.
>
> Hors périmètre (règles fermes) : campagnes CRM et marketing automation, réseaux sociaux (outil interne), domaine personnalisé, SSO.

## 1. Écarts

### P1 : à faire maintenant

| # | Écart | TutoClick aujourd'hui | Cible |
|---|---|---|---|
| P1-1 | **Actions sur une étape** | Aucune action sur la vignette d'étape : « Supprimer l'étape » est au pied du panneau Étape. Pas de copier, coller, couper, dupliquer ni masquer, et pas de raccourcis. | Menu « ⋯ » sur chaque vignette, le même au clic droit, avec les raccourcis affichés (§2). |
| P1-2 | **Ajouter une étape depuis une autre démo** | Le menu « Ajouter une étape » propose capture (Bientôt), image, texte, pop-up, menu de choix, Avant / Après et formulaire. | Entrée « Depuis une autre démo… » (§2.4). |
| P1-3 | **Partager : densité** | Page avec 5 onglets, une colonne de 5 cartes à droite et de longs textes d'aide. Les réglages sont répartis entre les onglets, la colonne et le bouton Exporter de l'en-tête. | Une modale de 720 px : navigation à gauche, interrupteur « Accès public » toujours visible, et une seule mise en page en lignes (§3). |
| P1-4 | **États vides des panneaux** | Le panneau « Bouton d'action » d'une étape sans bouton n'affiche qu'un interrupteur sur un grand vide. Les autres panneaux sont hétérogènes. | Un composant d'état vide commun : icône de 24 px, titre, une phrase, une action principale (§4). |
| P1-5 | **Réseaux sociaux dans Partager** | « Partager ailleurs » propose deux réseaux sociaux. | Retirés : c'est un outil interne. On garde E-mail et « GIF / vidéo » (§3). |

### P2 : lot suivant

| # | Écart | Cible |
|---|---|---|
| P2-1 | **IA regroupée** : les fonctions existent mais sont dispersées (rédaction, « Traduire la démo… » dans le menu, voix de synthèse dans le panneau Voix off, Assistant dans le rail). | Une modale « Améliorer avec l'IA » (400 px) en 3 onglets segmentés, Textes, Voix off et Traduction : langue, style, consigne complémentaire, puis interrupteurs « Pop-up d'accueil », « Pop-up de fin » et « Zoom automatique ». Pied : Annuler, puis « Générer ». Rien n'est appliqué sans validation (règle IA existante). L'Assistant reste dans le rail. |
| P2-2 | **En-tête de l'éditeur** : retour, titre fixe, annuler et rétablir, Édition / Aperçu, ⋯, Partager, Publier. | Titre modifiable sur place (icône crayon de 16 px au survol), auteur en dessous (12 px, `text-muted`). Onglets segmentés **au centre de l'en-tête** : Édition · Aperçu · Analytics · Leads. Analytics et Leads ouvrent les pages existantes, filtrées sur la démo. Le passage d'un onglet à l'autre suit MOTION-01. |
| P2-3 | **Masquer une étape** : il faut d'abord le support du lecteur. | Étape masquée : sautée par le lecteur, vignette à 50 % d'opacité, badge « Masquée ». L'entrée du menu (§2) est en « Bientôt » tant que le lecteur ne la gère pas. |

### P3 : plus tard

| # | Écart | Cible |
|---|---|---|
| P3-1 | Boutons flottants « Redimensionner » et « Flouter » en bas à droite du canevas | Raccourcis vers les outils Recadrage et Flou du rail. Gain faible : le rail les a déjà. |
| P3-2 | Icône « Traduire » dans l'en-tête | Couvert par P2-1. |
| P3-3 | Annuler et rétablir en bas du rail | Non : TutoClick les a dans l'en-tête, près du titre, où on les cherche. On garde. |

### Déjà équivalent ou meilleur chez TutoClick

- **Formation et diffusion hors ligne** : paquet SCORM pour les plateformes de formation, export HTML, export PDF et GIF / vidéo, parcours de formation et apprenants.
- **Accès** : accès sur invitation par e-mail, mot de passe, expiration du lien, écran d'accès prévisualisable, adresse personnalisée qui redirige pendant 90 jours, liens personnalisés et variables d'URL.
- **Éditeur** :
  - aperçu avec « Exemples » et « Valeurs de repli » ;
  - menu de choix et embranchements, avec un test A/B ;
  - étapes Avant / Après, quiz, chapitres ;
  - voix off enregistrée, importée ou générée ;
  - texte alternatif de chaque capture ;
  - recherche et remplacement (Ctrl + F).
- **Collaboration** : commentaires dans un panneau bas avec mentions et non-lus, présence des co-éditeurs.
- **Conformité** : contrôle RGPD avant l'IA, données fictives, floutage. Accessibilité RGAA, avec e2e d'accessibilité en clair et en sombre.

## 2. P1-1 et P1-2 : menu d'une étape et raccourcis

### 2.1 Déclencheurs

- **Bouton « ⋯ »** (`Ellipsis`, 16 px, cible de 28 × 28 px) en haut à droite de chaque vignette d'étape. Visible au survol et au focus de la vignette, et toujours sur la vignette sélectionnée. `aria-label` : « Actions de l'étape {{n}} ».
- **Clic droit** sur la vignette : le même menu, ouvert à la position du pointeur.
- **Bouton « Lire depuis ici »** (`Play`, 16 px, 28 × 28 px), à gauche du « ⋯ » : ouvre l'Aperçu à cette étape.

### 2.2 Contenu du menu (composant `Menu` existant, 240 px de large)

| Entrée | Icône (ICON-01) | Raccourci affiché | Effet |
|---|---|---|---|
| Modifier | `Pencil` | Entrée | Sélectionne l'étape et ouvre le panneau Étape |
| Copier | `Copy` | Ctrl C / ⌘ C | Copie l'étape dans le presse-papiers de l'éditeur |
| Coller après | `ClipboardPaste` | Ctrl V / ⌘ V | Insère l'étape copiée après celle-ci. Grisée si rien n'est copié |
| Couper | `Scissors` | Ctrl X / ⌘ X | Copie l'étape, puis la retire |
| Dupliquer | `CopyPlus` | Ctrl D / ⌘ D | Insère une copie juste après |
| Remplacer la capture… | `Replace` | | Choix d'une image ; hotspots et bulle conservés |
| Télécharger la capture | `Download` | | PNG de la capture, flous appliqués |
| Masquer l'étape | `EyeOff` | Ctrl Maj H / ⌘ Maj H | « Bientôt » tant que P2-3 n'est pas livré |
| séparateur | | | |
| Supprimer | `Trash2`, en `danger` | Suppr / ⌫ | Supprime l'étape (§2.3) |

- **Raccourci affiché** : `<kbd>` en 12 px, `text-muted`, fond `surface-sunken`, rayon de 4 px, padding de 0 × 4 px, aligné à droite. Le système est détecté : ⌘ sur Mac, Ctrl ailleurs. Il est aussi exposé par `aria-keyshortcuts` sur l'entrée.
- **Entrée de 32 px de haut**, icône de 16 px, 8 px entre l'icône et le libellé.
- Étape de fin (« Merci ! ») : Copier, Couper, Dupliquer et Supprimer sont absents.

### 2.3 Raccourcis

- **Portée** : ils agissent quand le focus est dans la liste des étapes (vignette ou liste). Jamais dans un champ de texte, ni sur le canevas : là, Ctrl C copie le texte, comme d'habitude.
- **Copier, coller, couper** : les étapes vont dans le presse-papiers de l'éditeur, qui est partagé entre les démos de l'espace pendant la session. Le collage d'une étape vient donc aussi d'une autre démo.
- **Suppression sans confirmation** : l'action s'annule. Un toast « Étape supprimée » avec un bouton « Annuler » reste 6 s ; Ctrl Z fonctionne aussi. La confirmation actuelle du pied du panneau est retirée, et le bouton de pied devient un bouton ghost `danger`.
- Les raccourcis s'ajoutent à la fenêtre d'aide « ? » (ShortcutsDialog), dans une section « Étapes ».
- **Lecteurs d'écran** : chaque action annonce son résultat dans la zone `aria-live` existante (« Étape 3 copiée », « Étape collée en position 4 »).

### 2.4 Ajouter une étape depuis une autre démo

- **Menu « Ajouter une étape »** : nouvelle entrée « Depuis une autre démo… » (`Layers`), après « Importer une image ».
- **Modale « Ajouter des étapes depuis une démo »** (640 px) :
  - à gauche, la liste des démos de l'espace (recherche, 40 px par ligne) ;
  - à droite, les vignettes de la démo choisie, en grille de 3, à cocher ;
  - pied : « {{n}} étapes sélectionnées », Annuler, puis « Ajouter les étapes ».
- **Copie** : les étapes sont insérées après l'étape courante, avec leur capture, leurs hotspots, leur bulle et leurs flous. Les liens de « Suite du parcours » vers des étapes non copiées sont remis à « Étape suivante ». Un toast le signale si c'est le cas.
- Démos en lecture seule pour l'utilisateur : listées, mais pas sélectionnables, avec la mention « Lecture seule ».

## 3. P1-3 et P1-5 : modale « Partager »

### 3.1 Structure (720 × 560 px, plein écran sous 768 px)

- **En-tête** (64 px) :
  - titre « Partager « {{titre}} » » ;
  - à droite, l'interrupteur **Accès public**, toujours visible quel que soit le volet. Il reprend le comportement actuel (désactivé tant que la démo n'est pas publiée, avec l'aide « Publiez la démo pour activer le lien »).
- **Navigation à gauche** (200 px, liste verticale, 36 px par entrée, icône de 16 px). Les volets :

  | Volet | Icône | Contenu repris de l'existant |
  |---|---|---|
  | Lien public | `Link2` | URL et Copier, adresse personnalisée, variables d'URL |
  | Intégrer | `Code` | Code d'intégration |
  | Liens personnalisés | `UserRound` | Onglet existant |
  | Accès et sécurité | `ShieldCheck` | Mot de passe, invitation par e-mail, expiration, écran d'accès |
  | GIF et vidéo | `Film` | Export GIF / vidéo |
  | PDF | `FileText` | Export PDF |
  | HTML | `FileCode` | Export HTML |
  | Formation (SCORM) | `Package` | Paquet SCORM, lien vers Apprenants |
  | Page publique | `Globe` | Onglet existant |

- **Pied** : aucun. Chaque volet enregistre ses réglages tout de suite et l'indique par « Enregistré » à côté du titre du volet, comme dans l'éditeur.
- **Accès** : le bouton « Partager » de l'en-tête ouvre la modale. La route `/demos/:id/share` reste valide et ouvre la même modale par-dessus l'éditeur. La page actuelle disparaît. Les cartes Aperçu et « Cette semaine » ne sont pas reprises : l'aperçu est dans l'en-tête de l'éditeur, les chiffres dans Analytics.

### 3.2 Mise en page d'un volet (la même partout)

1. **Carte d'introduction** :
   - fond `surface-sunken`, rayon de 12 px, padding de 16 px ;
   - icône de 20 px dans une pastille de 36 px ;
   - titre de 14 px en 600, et **une seule phrase** de 13 px en `text-muted`.
2. **Lignes de réglage** :
   - 48 px de haut au moins, séparées par un filet de 1 px `border` ;
   - à gauche, icône de 16 px, libellé de 14 px et aide facultative de 12 px sur une ligne ;
   - à droite, le contrôle : interrupteur, contrôle segmenté, déroulant de 200 px ou bouton.
   - Aucune carte dans une carte, aucun texte d'aide de plus d'une ligne : le détail va dans le centre d'aide (lien « En savoir plus », 12 px).
3. **Action principale** du volet (PDF, HTML, GIF et vidéo, SCORM) : bouton primaire en bas à droite du volet (« Télécharger le PDF »…).

- **GIF et vidéo** : contrôles segmentés Format (GIF · Vidéo), Résolution (480p · 720p · 1080p), Images par seconde (24 · 30 · 60), Durée par étape (1 s · 3 s · 5 s · Personnalisée), puis « Exporter ». La 4K n'est pas proposée : poids trop lourd pour un usage interne. Si l'export existant n'offre pas un réglage, il s'affiche en « Bientôt ».
- **Lien public** : URL et Copier sur une ligne, puis « Envoyer par e-mail » (`Mail`, ouvre le client de messagerie). **Aucun bouton de réseau social** (P1-5).
- **Accès et sécurité** : trois lignes à interrupteur (Mot de passe, Accès sur invitation, Expiration du lien), chacune avec son champ dépliable sous la ligne, puis « Voir l'écran d'accès ».

### 3.3 Mesures de recette

- Modale de 720 px, navigation de 200 px, lignes de 48 px séparées par un filet, 24 px entre la carte d'introduction et la première ligne.
- Aucun défilement horizontal (§18.7) ; le volet défile seul en vertical, l'en-tête reste fixe.
- Clair et sombre, à 1440 px et à 390 px (navigation en liste déroulante sous 768 px).
- Focus : à l'ouverture, sur le volet actif de la navigation. Navigation au clavier par flèches haut et bas (`role="tablist"`, `aria-orientation="vertical"`). Échap ferme.

## 4. P1-4 : état vide des panneaux de l'éditeur

- **Composant** `PanelEmpty`, dans `packages/ui` :
  - centré dans le panneau, padding de 32 × 24 px ;
  - icône de 24 px (ICON-01) dans une pastille de 48 px, fond `surface-sunken` ;
  - titre de 14 px en 600, phrase de 13 px en `text-muted` (2 lignes au plus) ;
  - bouton primaire `sm` avec icône ;
  - 12 px entre la pastille et le titre, 4 px entre le titre et la phrase, 16 px avant le bouton.
- **Pas d'illustration** : la charte n'en prévoit pas, et l'icône suffit.
- **Panneaux concernés et textes** :

| Panneau | Titre | Phrase | Action |
|---|---|---|---|
| Bouton d'action | Aucun bouton sur cette étape | Ajoutez un bouton pour envoyer le visiteur vers une page ou l'étape suivante. | Ajouter un bouton (`Plus`) |
| Bouton d'action, dernière étape | C'est la dernière étape | Terminez par une pop-up qui invite à agir : prendre rendez-vous, ouvrir l'outil… | Ajouter une pop-up de fin (`Plus`) |
| Points d'intérêt | Aucun point d'intérêt | Cliquez sur la capture pour poser un point, ou ajoutez-en un au centre. | Ajouter un point (`Plus`) |
| Voix off | Pas de voix off | Enregistrez, importez ou générez une piste pour cette étape. | Enregistrer (`Mic`) ; Importer et Générer en boutons secondaires |
| Flou | Aucune zone floutée | Masquez une donnée sensible en traçant une zone sur la capture. | Ajouter une zone (`Plus`) |
| Commentaires (panneau bas) | Aucun commentaire sur cette étape | Les commentaires restent internes à l'équipe. | aucune : la saisie est déjà sous l'état vide |

- Une fois l'élément ajouté, le panneau affiche ses réglages. L'interrupteur « Afficher le bouton » disparaît : l'état vide le remplace.

## 5. Recette commune

- Chaque P1 est validé sur captures en clair et en sombre, avec les mesures des styles calculés.
- On contrôle aussi les espacements (§18.6) et l'absence de défilement horizontal (§18.7 : trackpad et Maj + molette).
- Données fictives uniquement (acme, example.com).
