# Spec A6 : collaboration (notifications, mentions, présence, mode présentateur)

> Lot A6 de la parité (Collaborate) : centre de notifications, mentions @ dans les commentaires, présence en direct dans l'éditeur, mode présentateur avec notes. Il complète le panneau de commentaires (`commentaires.md`) et les alertes (A4 §6).
>
> Maquette : `docs/ux/maquettes/refonte/collaboration.html`, avec `?view=notif|mention|presence|presenter` et `&theme=dark`.
> Microcopie FR/EN (69 clés) : `collab.*`.

## 1. Centre de notifications

- **Cloche** (`Bell`) dans la barre du haut de l'app, à gauche de l'avatar.
  - Pastille framboise avec le nombre de non lues (9+ au-delà), cerclée de la couleur du fond.
  - `aria-label` = `bellUnread` (par exemple « Notifications, 3 non lues »), `aria-expanded`.
  - La cloche est **la seule** de l'interface. `refonte.md` excluait une cloche décorative ; celle-ci est fonctionnelle.
- **Panneau** : popover en portail de 420 px, 620 px de haut au maximum avec défilement. En mobile, feuille plein écran.
  - En-tête : « Notifications », « Tout marquer comme lu » (`CheckCheck`), réglages (engrenage).
  - Filtres en segmenté : Toutes, Mentions · n, Non lues · n.
  - Groupes datés (Aujourd'hui, Cette semaine, Plus ancien) en `caption` majuscule.
  - Chaque élément : avatar de la personne, ou puce d'icône du type ; phrase avec le nom ou l'objet en gras ; extrait cité (filet prune de 3 px) pour une mention ou une réponse ; temps relatif et lien contextuel.
  - Non lue : fond `primary-soft` et point prune (`aria-label` « Non lue »). Un clic ouvre la cible (étape et commentaire, lead, journal du webhook…) et marque comme lu.
  - Pied : « Voir tout l'historique (30 jours) ».
- **Types** :

  | Type | Déclencheur |
  |---|---|
  | Mention | `@` dans un commentaire |
  | Réponse | Réponse à un de vos commentaires |
  | Commentaire résolu | Un de vos commentaires est résolu |
  | Nouveau lead | Lead sur une démo |
  | Modules validés | Agrégé (« 12 apprenants ont validé… ») |
  | Alerte | A4 §6 |
  | Webhook en pause | A5 |
  | Publication | Une démo est publiée par un membre |
  | Invitation | Invitation dans un workspace |

- **Temps réel** : Supabase Realtime sur `notifications` (une ligne par destinataire). La pastille se met à jour sans recharger la page. Un nouvel élément est annoncé en `aria-live="polite"`, au plus une fois par minute, en regroupant.
- **Préférences** (engrenage) : un tableau type × canal (Dans l'app / E-mail), avec l'option « Résumé quotidien par e-mail ». Les mentions restent toujours notifiées dans l'app. Par démo : « Couper les notifications de cette démo ».
- Les notifications sont conservées 30 jours.

## 2. Mentions @

- Dans le champ de commentaire, `@` ouvre une **liste de suggestions** (combobox ARIA, `role="listbox"`) **au-dessus** du champ, en portail. Elle propose les membres qui ont accès à la démo, filtrés à la frappe (5 au maximum), avec avatar, nom, rôle et « en ligne ».
- Clavier : flèches pour choisir, Entrée ou Tab pour insérer, Échap pour fermer.
- Une fois insérée, la mention est une **puce de texte** `@Prénom` (fond `primary-soft`, texte `primary-soft-text`, en gras), supprimable d'un retour arrière.
- **À l'envoi**, une notification « Mention » part pour chaque personne citée, plus un e-mail selon ses préférences.
  - Mention d'une personne sans accès à la démo : avertissement `noAccess` avant l'envoi, et pas de notification.
- Dans le texte affiché, la mention reste une puce, avec le nom complet en `title`.

## 3. Présence en direct (éditeur)

- **Pile d'avatars** dans la barre de l'éditeur, à gauche de « Présenter » et « Publier » : 4 au maximum, puis « +n ».
  - Point vert « en ligne » ; `aria-label` qui liste les personnes et leurs étapes (`presence.group`).
  - Un clic sur un avatar amène à l'étape de la personne.
- **Rail des étapes** : petit avatar en haut à droite de la vignette où se trouve chaque personne.
- **Bandeau d'édition concurrente** (`role="status"`, fond `info-soft`) quand une autre personne modifie l'étape affichée : « Marie Durand modifie cette étape… ». Pas de verrou bloquant : fusion champ par champ, le dernier enregistré l'emporte sur un même champ.
  - Pendant la saisie d'un **même champ** par une autre personne, ce champ affiche un contour de sa couleur et son prénom en étiquette.
- **Curseurs** des autres sur le canevas : flèche et étiquette du prénom, de la couleur de la personne (palette chart, texte blanc ou noir selon le contraste). Ils sont masquables (`cursors`) et ne sont jamais affichés en `prefers-reduced-motion` (pas d'animation continue).
- **Panneau « Sur cette démo »** (dans l'onglet Réglages, ou en popover depuis la pile d'avatars) : liste des personnes, leur étape et ce qu'elles font, ou « inactif depuis … ».
- Implémentation : Realtime Presence sur le canal `demo:{id}`, état `{ userId, stepId, field?, cursor? }`, envoyé au plus 10 fois par seconde pour le curseur.

## 4. Mode présentateur

- Bouton **« Présenter »** (`Presentation`) dans la barre de l'éditeur et sur la carte de démo. Il ouvre la vue présentateur en plein écran, en sombre fixe (salle obscurcie).
- **Mise en page** :
  - à gauche, l'**étape courante** (rendu player, thème de la démo) et une barre : chronomètre (`role="timer"`), « Étape n sur N », « Précédente », « Suivante » (primaire), « Écran public », « Quitter » ;
  - à droite, 3 cartes :
    - **Notes du présentateur** (18 px, liste) ;
    - **Étape suivante** (miniature et titre) ;
    - **Raccourcis** : → ←, N (masquer les notes), B (écran noir), Échap (quitter).
- **Écran public** : ouvre une 2e fenêtre (à mettre sur le vidéoprojecteur) qui affiche seulement le player. Elle est synchronisée avec la vue présentateur (`BroadcastChannel`) et n'affiche jamais les notes.
- **Notes du présentateur** : nouveau champ de l'étape (onglet Étape, `notesField`), **jamais publié** dans le player ni dans les exports, sauf le PDF « mode d'emploi » (F5) où l'on peut les intégrer comme « À retenir ».
- **Accessibilité** : la barre est une `toolbar` nommée ; les raccourcis sont déclarés (`aria-keyshortcuts`). Le chronomètre n'est pas annoncé en continu (`aria-live="off"`).

## 5. Recette prévue

- **Notifications** : deux comptes de test (données fictives), mention, puis notification en direct, puis clic vers le commentaire ; filtres ; préférences e-mail.
- **Présence** : deux navigateurs sur la même démo (avatars, rail, bandeau, curseurs) ; fusion des modifications sur des champs différents et sur le même champ.
- **Présentateur** : écran public synchronisé, notes absentes du player et de l'écran public, raccourcis.
- Contrôles communs : 1 440, 1 024 et 390 px (cloche et panneau), en clair et en sombre ; lecteur d'écran sur la cloche et la combobox de mention.
