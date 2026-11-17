# Spec A1 : partage avancé, accès visiteur, page publique, styles prédéfinis

> Lot A1 de la parité Guideflow (`docs/product/matrice-fonctionnalites.md` : Share, Customize).
> Maquettes (charte DSI, bascule clair / sombre en bas à droite, ou `?theme=dark`) dans `docs/ux/maquettes/refonte/` :
> - `partage-avance.html` : onglets Lien, Accès, Intégrer, Page publique (`?view=lien|acces|integrer|page`) ;
> - `acces-visiteur.html` : écrans d'accès côté visiteur, avec une barre d'états en haut ;
> - `demo-page.html` : page publique de la démo ;
> - `styles-predefinis.html` : styles et police.
>
> Microcopie FR/EN dans `docs/ux/i18n/*.json` : `share.advanced.*`, `player.gate.*`, `editor.presets.*` (132 clés).
> Règles transverses : `composants.md` §15 (finition, overlays §15.7), `refonte.md`.

## 1. Page Partager : structure

- En-tête : bouton rond de retour, `h1` « Partager », sous-titre « {{titre}} · publiée, version n ». À droite : « Ouvrir » (secondaire) et « Copier le lien » (primaire, toast « Lien copié »).
- Grille de 2 colonnes, avec la carte principale en `minmax(0, 1fr)` et une colonne de 320 px. Sous 900 px : une seule colonne, la colonne de droite passe sous la carte principale.
- La **carte principale** contient des `.fd-tabs` pilules avec icônes : Lien (`Link`), Accès (`Lock`), Intégrer (`Code`), Page publique (`LayoutPanelTop`). `role="tablist"` et navigation aux flèches. L'onglet actif est gardé dans l'URL (`?tab=`).
- La **colonne de droite** contient :
  - l'aperçu (P12), qui montre le mode d'intégration choisi (pop-up : bouton flottant sur un faux site) ;
  - la carte « Récapitulatif », avec une ligne par réglage (icône-puce + valeur + précision en `caption`).

  C'est l'état actuel du partage, lisible d'un coup d'œil.
- Les liens personnalisés et les versions publiées restent des cartes sous la grille, inchangées.

## 2. Onglet Lien (slug)

- Champ composé en pilule : préfixe `demos.<domaine>/<workspace>/` en mono sur `surface-sunken` (non modifiable), saisie du slug en mono, bouton « Copier » accolé. Focus sur l'ensemble du champ.
- **Validation en direct** (debounce de 400 ms) : « Vérification… », puis `CircleCheck` « Adresse disponible » (`success`), ou `CircleAlert` « Cette adresse est déjà utilisée dans le workspace » / « Utilisez 3 à 60 lettres minuscules, chiffres ou tirets » (`danger`, `aria-invalid`). Le statut est dans une région `role="status"`.
- Saisie normalisée à la volée : minuscules, accents retirés, espaces remplacés par `-`.
- Changer le slug **redirige l'ancien pendant 90 jours** (aide permanente sous le champ). Ce n'est pas à confirmer dans une modale.
- Bloc « Variables d'URL » : exemple en bloc de code sombre avec la partie `?clé=valeur` surlignée en prune 200 (P11).
- « Expiration du lien » : select (Jamais, 7 jours, 30 jours, Date précise…).
- Le domaine personnalisé reste en **vague B** : pas d'interface active. Une ligne `fd-help` avec un badge « Bientôt disponible » est possible ; ne jamais le présenter comme actif.

## 3. Onglet Accès

`fieldset` de cartes-choix radio, une seule active. Chaque carte contient une puce d'icône, un titre et une description, puis un rond radio. La carte sélectionnée a une bordure prune de 2 px sur fond `primary-soft`. La configuration de l'option choisie s'affiche **juste sous sa carte**, dans un bloc `surface-sunken`.

| Mode | Icône | Configuration |
|---|---|---|
| Toute personne avec le lien | `Globe` | Aucune |
| Mot de passe | `KeyRound` | Champ mot de passe avec boutons « Afficher » / « Générer » (16 caractères lisibles) ; aide « 8 caractères minimum… » ; interrupteur « Demander aussi l'e-mail du visiteur » |
| Invitation par e-mail | `Mail` | Champ à puces (chips) : virgule ou Entrée pour ajouter, × pour retirer, adresses invalides en puce `danger-soft`. Bouton « Envoyer les invitations ». Liste des invités avec leur statut (Invité · Ouvert le …) et « Révoquer » |
| Domaine e-mail | `Building2` | Champ à puces de domaines (`exemple.fr`, sans `@`) |
| Jeton d'authentification | `ShieldCheck` + badge « Avancé » | Clé de signature masquée, avec « Copier » et « Régénérer la clé » (`ConfirmDialog` : `access.token.regenerateConfirm`), aide JWT HS256 de 1 h au maximum, et lien vers la doc développeur |

- Sous la liste, une `Alert` info rappelle la portée : `access.note`.
- Passer à un mode plus ouvert (par exemple de Mot de passe à Public) affiche une `ConfirmDialog` : « Rendre la démo accessible à toute personne disposant du lien ? »
- Le récapitulatif de droite se met à jour immédiatement. L'enregistrement est **automatique** ; un toast « Accès mis à jour » s'affiche, avec la mention « pris en compte à la prochaine ouverture ».

## 4. Écrans d'accès côté visiteur (player)

`acces-visiteur.html`. Carte centrée de 440 px, rayon 24 px, ombre `lg`, sur `--fd-player-backdrop`, **aux couleurs du thème de la démo** (`.fd-player-scope`) :
- en-tête : logo et nom du workspace ;
- puce d'icône du mode ;
- `h1` de 24 px, texte `text-muted` ;
- champ pilule de 48 px et bouton primaire pleine largeur de 48 px.

| État | Contenu |
|---|---|
| Mot de passe | `protectedTitle` / `protectedBody` (avec le titre de la démo), champ `password` (`autocomplete="current-password"`), « Accéder à la démo » |
| Erreur | Champ `aria-invalid` + `wrongPassword` en `role="alert"`, puis `rateLimit` en pied. Le champ n'est **pas vidé** |
| Invitation | `inviteTitle` / `inviteBody`, champ e-mail, « Recevoir mon lien d'accès ». **Réponse identique** que l'adresse soit invitée ou non (pas de divulgation de la liste) |
| Lien envoyé | `CircleCheck`, `sentTitle` / `sentBody` (« Si l'adresse … est autorisée »), « Renvoyer le lien » (désactivé 30 s, avec un compte à rebours dans le libellé) |
| Domaine | `domainTitle` / `domainBody` avec les domaines en gras. Refus **immédiat** côté client si le domaine ne correspond pas : `domainRefused` |
| Jeton invalide ou expiré | `tokenTitle` / `tokenBody` + « Retour au portail » (URL de retour du workspace, sinon rien) |

Après accès accordé, le player s'ouvre directement à l'étape 1 et l'accès est mémorisé pour la session.

## 5. Onglet Intégrer

- Segmenté : **Dans la page** (iframe responsive actuelle), **Bouton pop-up**, **Lien texte** (un lien qui ouvre la pop-up).
- Bouton pop-up :
  - texte du bouton (par défaut « Voir la démo ») ;
  - position (bas droite, bas gauche, dans le contenu) ;
  - interrupteur « Ouvrir automatiquement après 10 secondes ».

  Le bouton flottant reprend `primary` et `on-primary` du thème de la démo. La pop-up s'ouvre en modale (`<dialog>` en *top layer* sur le site hôte, avec Échap, piège du focus et retour du focus), à 90 vw × 90 vh au maximum, et en plein écran sous 480 px.
- Code d'intégration en bloc sombre avec « Copier » en haut à droite. Les attributs `data-*` sont surlignés.
- « Sites autorisés » en champ à puces (remplace le textarea), avec la même aide qu'aujourd'hui.

## 6. Onglet Page publique

- Interrupteur principal « Page publique activée », avec description.
- Champs : titre de la page, description, texte et lien du bouton d'action. Style de la page (segmenté : Style de la démo / Clair / Sombre). Interrupteurs « Proposer d'autres démos du workspace » et « Indexation par les moteurs de recherche » (désactivée par défaut, `noindex` sinon).
- Bouton « Voir la page publique » (nouvel onglet).

**Page publique** (`demo-page.html`) :
- en-tête : logo et nom du workspace, CTA pilule primaire ;
- titre `display` de 40 px en 800, description en `body-lg` `text-muted` ;
- badges « Environ n min · n étapes · Mis à jour le … » ;
- player en 16:9 avec un rayon de 20 px ;
- **carte CTA héro** (vert DSI avec texte noir, bouton pilule noir), « Créé avec FlowDSIML » + lien de politique de confidentialité ;
- largeur maximale de 1 120 px. Sous 900 px, la carte CTA passe en colonne.
- **SEO et partage social** : `<title>` = titre, `meta description`, image Open Graph = capture de l'étape 1, `noindex` sauf si l'interrupteur est activé.

## 7. Styles prédéfinis (onglet Design de l'éditeur)

- En tête de l'onglet Design : carte « Choisir un style », grille de vignettes (`repeat(auto-fill, minmax(200px, 1fr))`, 2 colonnes dans le panneau de 340 px de l'éditeur).
- Chaque vignette montre la bulle, le bouton, la pastille et le fond du style, son nom et 3 pastilles de couleur. Le style actif a une bordure prune de 2 px (`aria-pressed`). Le style par défaut porte le badge « Par défaut ».
- 6 styles livrés : **DSI Prune** (par défaut), Bleu institutionnel, Vert DSI, Nuit, Minimal, Contraste élevé. Valeurs de référence dans `styles-predefinis.html`, à stocker comme `themes.tokens`.
- **Chaque style doit respecter AA** : texte de bulle ≥ 4,5:1, bouton ≥ 4,5:1, pastille ≥ 3:1 sur le fond. Le style « Vert DSI » met un texte **noir** sur son bouton vert.
- Un clic applique le style à **toute la démo**. Toast `applied` avec « Annuler » pendant 8 s. Les réglages fins de l'onglet Design restent modifiables ensuite.
- « Enregistrer le style actuel » crée un style du workspace, qui s'ajoute à la grille, renommable et supprimable via ⋯.
- **Police** : select (Plus Jakarta Sans, police système, polices importées du workspace, « Importer une police… » en WOFF2, 2 Mo maximum par graisse). Arrondi : segmenté Net (6 px) / Doux (12 px) / Rond (20 px et boutons pilules).

## 8. Accessibilité

- Cartes-choix : un vrai `input type="radio"` (visuellement masqué) dans un `label`, focus visible sur la carte (`:has(:focus-visible)`), groupe nommé par une `legend`.
- Champs à puces : chaque puce a un bouton « Retirer {{valeur}} » ; Retour arrière dans le champ vide retire la dernière puce ; annonce `aria-live` à l'ajout et au retrait.
- Validation du slug et erreurs des écrans d'accès : `aria-describedby` + `role="status"` ou `role="alert"`.
- Écrans visiteur : un `h1` par écran, `autocomplete` correct, pas de captcha visuel. La limite de tentatives est expliquée en texte.

## 9. Recette prévue

Pour chaque onglet et chaque écran visiteur : 1 440, 1 024 et 390 px, clair et sombre. Contrastes des 6 styles prédéfinis. Comportement clavier des cartes-choix et des puces. Absence de divulgation sur l'invitation par e-mail. `noindex` par défaut de la page publique.
