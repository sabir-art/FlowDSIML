# Spec : commentaires d'équipe dans l'éditeur

> Demande client du 17 nov. 2026, sur le modèle des « presenter notes » de Figma Slides.
> Maquettes :
> - `maquettes/refonte/editeur.html` : panneau sous le canevas, avec une barre d'états de maquette en bas à gauche (Liste, + résolus, Saisie, Modification, Vide, Tout résolu, Replié) et la bascule clair / sombre ;
> - `maquettes/refonte/commentaires-mobile.html` : vue mobile.
>
> Microcopie : clés `editor.comments.*` dans `docs/ux/i18n/fr.json` et `en.json`, reprises au §6.
> Fonctionnel (données, droits, temps réel) : déjà transmis au dev par le chef d'équipe. Ce document ne couvre que l'interface.

## 1. Principe

- Les commentaires sont rattachés **à une étape**, **internes à l'équipe** et **jamais publiés** : ils ne figurent ni dans le manifeste du player ni dans l'aperçu.
- Le panneau est **sous le canevas**, dans la colonne centrale de l'éditeur. Le rail des étapes et le panneau de propriétés gardent toute leur hauteur.
- Le panneau est redimensionnable par une poignée horizontale et repliable. La hauteur et l'état replié sont mémorisés par utilisateur (`localStorage` : `fd.editor.comments.height`, `fd.editor.comments.collapsed`).

## 2. Anatomie (de haut en bas)

| Élément | Spécification |
|---|---|
| **Poignée** | Zone de 16 px de haut, sur toute la largeur de la colonne, avec une barre centrale de 48 × 4 px en `border-strong` (`text-muted` au survol et au focus). Curseur `row-resize`. `role="separator"`, `aria-orientation="horizontal"`, `aria-valuemin=160`, `aria-valuemax=520`, `aria-valuenow`, `aria-controls` vers le panneau, `tabindex=0`. **Clavier** : ↑ / ↓ par pas de 24 px, Entrée pour replier ou déplier. Glisser à la souris ou au doigt (`pointer events`, `touch-action: none`). Hauteur de 160 à 520 px, et jamais plus de 60 % de la colonne : le canevas garde au moins 240 px. Valeur par défaut : 280 px |
| **Carte** | `fd-card` avec un padding de 16 / 20 px et un gap de 12 px, en colonne : en-tête, liste qui défile, zone de saisie fixée en bas |
| **En-tête** | `fd-icon-chip` (`MessageSquare`) + `h2.fd-card__title` « Commentaires · Étape n » + badge « n ouverts » (`accent-soft` / `accent-soft-text`, masqué à 0). Sous le titre, ligne `caption` `text-subtle` avec l'icône `Lock` de 14 px : « Interne à l'équipe · jamais publié ». À droite : interrupteur « Afficher les résolus (n) » (masqué s'il n'y en a aucun), puis bouton icône `ChevronDown` « Replier les commentaires » (`aria-expanded`, `aria-controls`) |
| **Commentaire** | Grille avatar de 32 px \| contenu \| actions. Padding de 12 px, rayon `lg`, fond `surface-hover` au survol et au focus. Méta : **nom** (600) + « (vous) » pour l'auteur courant + date relative en `<time datetime>` (`caption`, `text-subtle`, date complète au survol) + « · modifié » s'il a été édité. Texte en `body`, `white-space: pre-wrap`, liens cliquables, sans Markdown |
| **Avatar** | Rond de 32 px avec les initiales (700, 11 px) ou la photo du profil. Couleur de fond stable par membre, prise dans `chart-1`…`chart-5` (texte noir sur orange, vert et bleu ; blanc sur prune et framboise) |
| **Actions** | Visibles au survol, au focus et toujours en tactile (`@media (hover: none)`). « Résoudre » (`CircleCheck`, `fd-btn--sm`) + menu ⋯ (« Modifier » et « Supprimer », réservés à l'auteur, et « Supprimer » pour les admins). **Le menu suit la règle §15.7** (portail, jamais coupé par la liste qui défile) |
| **Commentaire résolu** | Visible seulement avec le filtre. Texte en `text-muted`, avatar à 60 % d'opacité, mention `CircleCheck` « Résolu par {{name}} » en `success`. Action « Rouvrir » (`RotateCcw`) |
| **Nouveau (temps réel)** | Un commentaire reçu d'un autre membre s'insère à sa place chronologique, avec un fond `info-soft` et un badge « Nouveau » pendant 4 s ou jusqu'au survol. **Pas de défilement automatique** si l'utilisateur lit plus haut ; à la place, une pilule « 1 nouveau commentaire ↓ » en bas de la liste. Annonce dans une région `aria-live="polite"` : « {{name}} a ajouté un commentaire. » |
| **Saisie** | Fixée en bas, avec un séparateur `border` au-dessus. Avatar de l'utilisateur + `textarea` (rayon `xl`, hauteur de 40 px qui grandit jusqu'à 120 px puis défile) + bouton rond `ArrowUp` « Envoyer le commentaire » (désactivé si le texte est vide). Aide « Entrée pour envoyer · Maj + Entrée pour aller à la ligne », visible quand le champ a le focus. Au-delà de 1 800 caractères, compteur « n / 2000 » ; refus à 2 000 |
| **Modification** | Le commentaire est remplacé sur place par un `textarea` pré-rempli et focalisé, avec « Échap pour annuler », « Annuler » et « Enregistrer ». Ctrl / ⌘ + Entrée enregistre |
| **Suppression** | `ConfirmDialog` : « Supprimer ce commentaire ? » / « Il sera supprimé pour toute l'équipe. Cette action est définitive. » / bouton danger « Supprimer » |

## 3. États

| État | Rendu |
|---|---|
| **Liste** | Commentaires ouverts par ordre chronologique (le plus ancien en haut, comme une conversation). Focus sur la saisie à l'ouverture d'une étape **seulement** si le panneau a été ouvert par l'utilisateur, jamais automatiquement au chargement |
| **Vide** | `fd-icon-chip` + « Aucun commentaire sur cette étape » + « Notez une remarque pour l'équipe : elle reste dans l'éditeur et n'est jamais publiée. » La saisie reste visible ; le badge et le filtre sont masqués |
| **Tout résolu** | `fd-icon-chip` (`CircleCheck`) + « Tout est résolu » + « n commentaires résolus sur cette étape. » + lien « Les afficher » (active le filtre) |
| **Avec les résolus** | Les résolus sont mêlés aux ouverts par ordre chronologique, avec le style « résolu » |
| **Replié** | Barre de 48 px (padding de 12 px) : puce d'icône + « Commentaires » + badge « n ouverts » + mention « Interne à l'équipe » + `ChevronUp`. Toute la barre est un bouton « Afficher les commentaires » (`aria-expanded="false"`). Le canevas récupère la hauteur |
| **Chargement** | 2 squelettes de commentaire (avatar rond + 2 lignes) en `skeleton` |
| **Erreur d'envoi** | Le texte reste dans le champ. Alerte en ligne `fd-alert--error` au-dessus de la saisie : « Le commentaire n'a pas pu être envoyé. Votre texte est conservé. » + « Réessayer » |
| **Hors ligne** | Bandeau `caption` en `warning` dans l'en-tête : « Hors ligne : les nouveaux commentaires s'afficheront au retour de la connexion. » La saisie reste possible ; l'envoi part au retour du réseau |
| **Lecture seule** (rôle viewer) | Liste et filtre visibles. La saisie, « Résoudre » et les menus sont masqués |

## 4. Rail des étapes

- **Badge** en haut à droite de chaque vignette qui a au moins un commentaire **ouvert** : pilule `accent` (framboise, texte blanc 5,2:1) de 22 px de haut, icône `MessageSquare` de 12 px et nombre (700, 11 px).
- Le badge est aussi décrit pour les lecteurs d'écran : « 3 commentaires ouverts », ajouté au nom accessible de l'étape. Il n'apparaît pas à 0. Au-delà de 99 : « 99+ ».
- Mise à jour en temps réel, comme la liste.

## 5. Mobile et écrans étroits

- **≥ 1 024 px** : panneau sous le canevas, comme décrit plus haut. Entre 1 024 et 1 280 px, la hauteur par défaut passe à 220 px.
- **< 1 024 px** : l'éditeur reste indisponible (écran « L'éditeur nécessite un écran plus large »), mais **les commentaires sont consultables et on peut y répondre** depuis cet écran (`commentaires-mobile.html`) :
  - encart compact d'explication ;
  - sélecteur d'étape en pilule, qui indique « — n ouverts » par étape ;
  - carte Commentaires sur toute la hauteur, avec les actions toujours visibles ;
  - saisie collée en bas (`position: sticky`, `env(safe-area-inset-bottom)`), bouton d'envoi de 44 px ;
  - cibles tactiles d'au moins 44 px (`@media (pointer: coarse)`) ;
  - pas de poignée ni de repli.

## 6. Microcopie (FR / EN) : clés `editor.comments.*`

| Clé | FR | EN |
|---|---|---|
| `title` / `titleStep` | Commentaires / Commentaires · Étape {{n}} | Comments / Comments · Step {{n}} |
| `openCount_one` / `_other` | {{count}} ouvert / {{count}} ouverts | {{count}} open |
| `private` | Interne à l'équipe · jamais publié | Team only · never published |
| `showResolved` | Afficher les résolus ({{count}}) | Show resolved ({{count}}) |
| `collapse` / `expand` | Replier les commentaires / Afficher les commentaires | Collapse comments / Show comments |
| `resize` / `resizeHint` | Redimensionner le panneau Commentaires / Glisser pour redimensionner · Entrée pour replier | Resize the comments panel / Drag to resize · Enter to collapse |
| `placeholder` / `placeholderShort` | Ajouter un commentaire pour l'équipe… / Ajouter un commentaire… | Add a comment for your team… / Add a comment… |
| `send` / `composeHint` | Envoyer le commentaire / Entrée pour envoyer · Maj + Entrée pour aller à la ligne | Send comment / Enter to send · Shift + Enter for a new line |
| `resolve` / `reopen` / `resolvedBy` | Résoudre / Rouvrir / Résolu par {{name}} | Resolve / Reopen / Resolved by {{name}} |
| `edit` / `delete` | Modifier / Supprimer | Edit / Delete |
| `actionsFor` / `actionsMine` | Actions sur le commentaire de {{name}} / Actions sur votre commentaire | Actions for {{name}}'s comment / Actions for your comment |
| `editLabel` / `editHint` / `cancel` / `save` | Modifier votre commentaire / Échap pour annuler / Annuler / Enregistrer | Edit your comment / Esc to cancel / Cancel / Save |
| `you` / `edited` / `new` | (vous) / modifié / Nouveau | (you) / edited / New |
| `emptyTitle` / `emptyBody` | Aucun commentaire sur cette étape / Notez une remarque pour l'équipe : elle reste dans l'éditeur et n'est jamais publiée. | No comments on this step / Leave a note for your team: it stays in the editor and is never published. |
| `allResolvedTitle` / `allResolvedBody_*` / `showThem` | Tout est résolu / {{count}} commentaire(s) résolu(s) sur cette étape. / Les afficher | All resolved / {{count}} resolved comment(s) on this step. / Show them |
| `deleteTitle` / `deleteBody` / `deleteConfirm` | Supprimer ce commentaire ? / Il sera supprimé pour toute l'équipe. Cette action est définitive. / Supprimer | Delete this comment? / It will be deleted for the whole team. This can't be undone. / Delete |
| `railBadge_one` / `_other` | {{count}} commentaire ouvert / {{count}} commentaires ouverts | {{count}} open comment / {{count}} open comments |
| `liveAdded` / `liveResolved` / `liveDeleted` | {{name}} a ajouté un commentaire. / {{name}} a résolu un commentaire. / Un commentaire a été supprimé. | {{name}} added a comment. / {{name}} resolved a comment. / A comment was deleted. |
| `errorSend` / `retry` | Le commentaire n'a pas pu être envoyé. Votre texte est conservé. / Réessayer | Your comment couldn't be sent. Your text has been kept. / Retry |
| `offline` | Hors ligne : les nouveaux commentaires s'afficheront au retour de la connexion. | Offline: new comments will appear when you're back online. |
| `tooLong` | {{count}} / 2000 caractères | {{count}} / 2000 characters |
| `mobileNoticeTitle` / `mobileNoticeBody` / `step` | L'éditeur nécessite un écran plus large / Ouvrez cette démo sur un ordinateur pour la modifier. Vous pouvez lire et répondre aux commentaires ici. / Étape | The editor needs a larger screen / Open this demo on a computer to edit it. You can read and reply to comments here. / Step |

Dates relatives : `Intl.RelativeTimeFormat` dans la langue de l'interface (« à l'instant » sous 1 min, puis « il y a 5 min », « il y a 2 h », « hier », puis « 12 nov. »), avec la date complète dans `title`.

## 7. Accessibilité et motifs

- La liste est un `<ol>` dont le nom accessible est « Commentaires de l'étape n ». Chaque commentaire est un `<li>` ; le nom de l'auteur et la date sont lus avant le texte.
- Tout est faisable au clavier : poignée, filtre, Résoudre, menu, édition (Échap), envoi (Entrée).
- Couleurs :
  - badge du rail en framboise avec texte blanc (5,2:1) ;
  - « Nouveau » en `info` sur `info-soft` ;
  - pas d'information portée par la seule couleur (badge « Nouveau » en texte, mention « Résolu par » en texte).
- Motifs proscrits respectés : pas d'emoji ni de réaction emoji, pas de dégradé, icônes Lucide uniquement.
- Les commentaires ne sont **jamais** rendus dans le player, l'aperçu ou l'export, ce que doit vérifier un test e2e côté dev.
