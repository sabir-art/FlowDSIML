# SETTINGS-HDR-01 — En-tête des pages Paramètres (E + B)

Choix de l'utilisateur du 25/11 : l'en-tête compact de la variante E, posé dans la bande pleine largeur avec filet de la variante B. Rien d'autre ne change : fond du contenu (`--fd-color-content-bg`), palette, navigation des Paramètres, sections et lignes de réglage restent comme aujourd'hui. Les boutons et champs de l'en-tête suivent RADIUS-01 (`--fd-radius-control`). À livrer après l'étape 1 de RADIUS-01 (`packages/ui`).

Captures de référence : `docs/ux/propositions/en-tete-parametres/planche-EB-1440.png` et `planche-EB-390.png` (Équipe, Général, Glossaire, Notifications ; clair et sombre).

## 1. Anatomie (1440 et au-dessus de 600 px)

```
| ← bande : toute la largeur de la colonne de contenu (bord gauche → bord droit de .st-main) → |
|   Titre de la page (h1)                          [Recherche 240 px] [Secondaire] [Primaire] |
|   Sous-titre gris                                                                            |
|──────────────────────────── filet 1 px, pleine largeur de la colonne ────────────────────────|
    24 px
    1re section…
```

- **Bande** : elle déborde du retrait horizontal de la colonne, de sorte que le filet touche les deux bords de la colonne de contenu. Le texte et les actions restent alignés sur le retrait des sections. Elle n'a pas de fond propre : elle garde `--fd-color-content-bg`, et seul le filet la distingue.
- **Espacements** :
  - 32 px du haut de la colonne au titre, comme aujourd'hui ;
  - 20 px du bas du bloc (texte ou actions, le plus bas des deux) au filet ;
  - 24 px du filet à la première section ;
  - 16 px entre le bloc texte et le bloc actions ;
  - 8 px entre deux actions.
- **Filet** : `1px solid var(--fd-color-border)`, en clair comme en sombre.
- **Titre (h1)** : `600 18px/1.4 var(--fd-font-sans)`, couleur `--fd-color-text`. Il reste le seul h1 de la page (PAGE-01).
- **Sous-titre** : `400 13px/1.5`, couleur `--fd-color-text-muted`, 620 px au plus de large, 2 px sous le titre. Il peut passer sur deux lignes, sans troncature.
- **Actions** : centrées verticalement sur le bloc texte, alignées à droite, ordre fixe de gauche à droite :
  1. la recherche de la page s'il y en a une (240 px, hauteur des contrôles, avec `kbd` « Ctrl K ») ;
  2. les actions secondaires (bouton secondaire) ;
  3. « Annuler » (secondaire) ;
  4. l'action principale (primaire), une seule au plus.
- **Barre du haut** : elle ne garde que le fil d'Ariane, l'aide et la cloche. Aucun bouton d'action de page n'y reste.
- La première section qui porte le titre de la page (`data-page-title`) continue de ne pas répéter son intitulé.

## 2. Pages et actions

| Page | Recherche | Actions dans l'en-tête (gauche → droite) | Aujourd'hui |
|---|---|---|---|
| Profil | — | Annuler · **Enregistrer** | barre du haut |
| Notifications | — | aucune | — |
| Général | — | Annuler · **Enregistrer** | barre du haut |
| Équipe | « Rechercher un membre » (quitte la tête de section « Membres ») | **Inviter** | barre du haut + section |
| Utilisation | — | aucune (« Renseigner le lien du support » reste dans sa section) | — |
| Sécurité | — | Annuler · **Enregistrer** | barre du haut |
| Confidentialité | — | aucune | — |
| Thème et couleurs | — | Annuler · **Enregistrer** (« Nouveau style » reste dans sa section) | barre du haut |
| Page publique | — | Voir la page · Annuler · **Enregistrer** | barre du haut |
| Variables | — | **Nouvelle variable** | barre du haut |
| Glossaire | — | Importer un CSV · **Ajouter un terme** | barre du haut |
| Étiquettes | — | **Nouvelle étiquette** | barre du haut |
| Assistance IA | — | aucune | — |
| Intégrations | — | Webhooks (secondaire, icône Webhook) | barre du haut |
| Intégrations › Webhooks | — | **Ajouter un webhook** (le retour reste dans le fil d'Ariane) | barre du haut |
| Clés d'accès | — | **Créer une clé** | barre du haut |

Règles :
- **Annuler / Enregistrer** gardent leur comportement actuel (états, désactivation tant que rien n'a changé, confirmation en quittant), seul l'emplacement change.
- **Page sans action** : l'en-tête garde la même bande, les mêmes espacements et le filet. Seul le bloc actions est absent, et la hauteur suit le texte.
- **État vide d'une page de liste** (Variables, Glossaire, Étiquettes, Clés) : le bouton de l'état vide reste, et l'action de l'en-tête aussi. Les deux ouvrent la même fenêtre.
- **Nouvelle page Paramètres** : elle reprend ce gabarit, et sa ligne s'ajoute au tableau.

## 3. À 390 px (moins de 600 px)

- La bande garde le filet sur toute la largeur de l'écran. Le retrait horizontal est de 16 px, 16 px en haut et 16 px avant le filet.
- **Bloc texte** : en haut, sur toute la largeur.
- **Bloc actions** : dessous, 12 px plus bas, sur une ligne pleine largeur.
  - Avec une recherche, elle prend la place restante et l'action principale reste à sa taille, à droite.
  - Sans recherche, les boutons sont alignés à droite.
  - Avec trois boutons ou plus (Page publique), les secondaires passent dans un menu ⋯ (`fd-btn--icon`, 40 px) à gauche du primaire. Exemple : ⋯ (Voir la page, Annuler) · **Enregistrer**.
- **Formulaires** (Annuler / Enregistrer) : quand des modifications sont en attente et que l'en-tête est sorti de l'écran, une barre collée en bas affiche les deux mêmes boutons :
  - 64 px de haut, fond `--fd-color-surface`, filet en haut ;
  - elle disparaît une fois l'enregistrement fait ou les modifications annulées ;
  - en mouvement réduit, elle apparaît d'un coup.
- La barre secondaire mobile (‹ Titre) reste comme aujourd'hui. Elle ne porte plus de bouton d'action.

## 4. Accessibilité

- L'ordre de tabulation suit l'ordre visuel : titre (focus d'arrivée), recherche, secondaires, Annuler, primaire, puis la première section.
- Le raccourci Ctrl K / ⌘K de la recherche est inchangé.
- La barre collée en bas (390) est un `role="region"` nommé « Modifications non enregistrées ». Elle n'est annoncée qu'une fois, quand elle apparaît (`aria-live="polite"` sur son texte).

## 5. e2e à adapter

- `parametres-espacement`, `l48f-integrations`, `espacements` et `a11y` : le titre et les actions sont dans `.stg-page`, et il ne reste plus de bouton d'action de page dans la barre du haut.
- Nouveau contrôle, sur toutes les pages du §2, en clair et sombre, à 1440 et 390 :
  - le filet touche les deux bords de la colonne ;
  - il y a 24 px du filet à la première section ;
  - les actions sont dans l'ordre fixé ;
  - il y a au plus un primaire ;
  - le rayon des contrôles vaut `--fd-radius-control` ;
  - aucun débordement horizontal à 390.
