# L52, Gestion des étiquettes

> Remplace l'entrée « Paramètres › Contenu › Étiquettes · Bientôt » (L48-A). Lot à placer **après L49**.
> Maquette : `docs/ux/maquettes/refonte/l52-etiquettes.html`. Règles visuelles : `composants.md` §17, deltas T1 à T9.
> Existant (b0aa6cc et suivants) :
> - tables `tags` et `demo_tags` (migration `20261118100000_etiquettes.sql`) : 5 couleurs, 20 étiquettes au plus par espace, 5 par démo ;
> - droits : lecture à partir du rôle Lecteur, écriture à partir du rôle Éditeur ;
> - `components/Tags.tsx` : `TagChip`, `TagPicker`, `TagFilter`, `ManageTagsDialog` (renommer, supprimer) ;
> - textes `tags.*`.

## 1. Page Paramètres › Contenu › Étiquettes (`/settings/tags`)

- Fil d'Ariane « Paramètres › Contenu », titre « Étiquettes », puis une phrase : « Pour organiser et filtrer vos démos. »
- En haut à droite :
  - « 14 sur 20 » en 13 px `text-muted` ;
  - le bouton principal « Nouvelle étiquette », désactivé à 20, avec la raison en infobulle : « 20 étiquettes au plus par espace ».
- **Une carte, une liste** (T4), une ligne par étiquette, hauteur 56 px, séparée par un filet :
  - à gauche, l'étiquette telle qu'elle apparaît sur les démos (`TagChip`) ;
  - au milieu, « 12 démos » en 14 px `text-muted`. C'est un lien vers Démos filtré sur cette étiquette. Paramètre **nouveau** : Démos ne lit aujourd'hui que `?new=1` ; on y ajoute `?etiquettes=<id>`, qui préremplit le filtre Étiquettes (L40). « Aucune démo » quand il n'y en a pas, sans lien ;
  - à droite, le bouton à icône `dots`, « Plus d'actions pour Outil CRM », qui ouvre le menu : **Renommer**, **Couleur**, **Fusionner avec…**, un filet, puis **Supprimer** (texte `danger`).
- **Tri** : par nom (par défaut), ou par nombre de démos, avec deux en-têtes cliquables (« Nom », « Démos ») et `aria-sort`.
- **Lecteur** (rôle sans écriture) : la même liste, sans bouton ni menu. Une ligne en tête : « Seuls les éditeurs peuvent modifier les étiquettes. »
- **État vide** (L48-B, petit format) :
  - icône `tag` de 32 px, « Aucune étiquette pour l'instant » ;
  - « Créez-en une ici, ou depuis la carte d'une démo. » ;
  - bouton « Nouvelle étiquette ».

## 2. Actions

### 2.1 Créer
- « Nouvelle étiquette » ajoute en tête de liste une ligne en édition :
  - champ « Nom » (32 caractères), choix de la couleur (§3), « Créer » ;
  - Échap annule.
- Couleur proposée par défaut : la première des 8 qui n'est pas encore utilisée, sinon la moins utilisée.

### 2.2 Renommer
- Édition dans la ligne : le nom devient un champ, avec le texte sélectionné. Entrée valide, Échap annule, la perte du focus valide.
- **Nom déjà pris** (sans tenir compte de la casse), sous le champ :
  - « Cette étiquette existe déjà. » ;
  - puis un lien « Fusionner avec « Outil CRM » », qui ouvre directement la fusion (§2.4).

### 2.3 Couleur
- Une petite fenêtre avec les **8 pastilles** de 28 px (§3), en `role="radiogroup"`, chacune nommée (« Bleu », « Sarcelle »…).
- Choisie : un anneau de 2 px `text` et l'icône `check` (jamais la couleur seule).
- L'aperçu de la ligne change tout de suite.

### 2.4 Fusionner
- Boîte « Fusionner « Outil métier » ». Une phrase : « Les 7 démos de « Outil métier » reçoivent l'étiquette choisie. « Outil métier » est ensuite supprimée. »
- Champ « Avec » : menu des autres étiquettes, chacune avec sa pastille et son nombre de démos.
- Actions : Annuler, puis « Fusionner » (principal).
- Côté serveur, une RPC transactionnelle `merge_tags(p_from uuid, p_to uuid)` :
  - elle ajoute `p_to` à chaque démo de `p_from` qui ne l'a pas encore ;
  - puis elle supprime `p_from` ;
  - elle vérifie que les deux étiquettes sont du même espace et que l'appelant a le rôle Éditeur ;
  - une démo n'a jamais plus d'étiquettes qu'avant : la fusion en remplace une par une autre.
- Toast : « « Outil métier » fusionnée dans « Outil CRM » (7 démos) ».

### 2.5 Supprimer
- Boîte de confirmation : « Supprimer « Outil métier » ? » Puis : « Elle sera retirée de 7 démos. Les démos ne sont pas supprimées. »
- Actions : Annuler, puis « Supprimer » (bouton `danger`).
- Sans démo, la phrase devient : « Aucune démo ne l'utilise. »
- Toast « Étiquette supprimée » (existant).

### 2.6 Depuis la carte d'une démo (Démos)
- Sur la carte et dans la vue liste, la ligne d'étiquettes de la démo est cliquable. Sans étiquette, « + Étiquette » s'affiche **au survol et au focus de la carte**, en lien de 13 px.
- Le clic ouvre le `TagPicker` existant, accroché à cette ligne :
  - recherche ;
  - cases à cocher ;
  - « Créer « Nouvelle » », avec la couleur proposée au §2.1 ;
  - lien de pied « Gérer les étiquettes », vers `/settings/tags`.
- Le menu « Plus d'actions › Étiquettes » de la carte reste disponible.
- Limites (existantes) :
  - à 5 étiquettes sur la démo, les autres cases sont désactivées, avec « 5 étiquettes au plus par démo » ;
  - à 20 dans l'espace, « Créer » est désactivé, avec sa raison.
- `ManageTagsDialog` est remplacé par un lien vers la page du §1 : un seul endroit pour gérer les étiquettes.

## 3. Les 8 couleurs

| Clé | Nom | Fond (clair) | Texte (clair) | Contraste | Contraste (sombre) |
|---|---|---|---|---|---|
| `blue` | Bleu | `--fd-bleu-50` | `--fd-bleu-700` | 5,40:1 | 8,07:1 |
| `green` | Vert | `--fd-vert-50` | `--fd-vert-700` | 5,28:1 | 8,51:1 |
| `orange` | Orange | `--fd-orange-50` | **`#8F5300`** (nouveau `--fd-orange-800`) | **5,76:1** (aujourd'hui 4,37:1 : sous le seuil AA) | 8,55:1 |
| `raspberry` | Framboise | `--fd-framboise-50` | `--fd-framboise-700` | 6,43:1 | 7,39:1 |
| `plum` | Prune | `--fd-prune-50` | `--fd-prune-700` | 8,53:1 | 7,30:1 |
| `slate` | Ardoise | `--fd-ardoise-50` | `--fd-ardoise-700` | 9,55:1 | 10,91:1 |
| `teal` | Sarcelle | **`#EAF6F5`** (nouveau `--fd-sarcelle-50`) | **`#0B6660`** (`--fd-sarcelle-700`) | 6,16:1 | 8,49:1 |
| `violet` | Violet | **`#F3F0FB`** (nouveau `--fd-violet-50`) | **`#5A3A9C`** (`--fd-violet-700`) | 7,41:1 | 8,22:1 |

- En sombre, la règle actuelle de `app.css` s'applique : fond à 18 % du 400 sur `surface`, texte en 200. Nouveaux jetons :
  - sarcelle : 200 `#9ED9D3`, 400 `#2BA79C` ;
  - violet : 200 `#CDBDF0`, 400 `#8A6AD6`.
- Contrastes calculés avec la formule WCAG 2.x, texte sur fond de l'étiquette. Ils valent pour le texte de 13 px 600 des étiquettes, au seuil de 4,5:1.
- **Schéma** : seul changement, la contrainte `tags.color` accepte les 8 clés (`slate`, `teal` et `violet` en plus). C'est une migration courte : aucune donnée ne change.
- L'**orange** passe au texte `#8F5300` partout où `.tg--orange` est utilisé. C'est une correction d'accessibilité, à faire même sans le reste de L52.

## 4. Textes (i18n, nouvelles clés)

| Clé | Texte |
|---|---|
| `tags.pageSub` | Pour organiser et filtrer vos démos. |
| `tags.new` | Nouvelle étiquette |
| `tags.quota` | {{n}} sur {{max}} |
| `tags.colName` / `tags.colDemos` | Nom / Démos |
| `tags.noDemo` | Aucune démo |
| `tags.readOnly` | Seuls les éditeurs peuvent modifier les étiquettes. |
| `tags.emptyTitle` | Aucune étiquette pour l'instant |
| `tags.emptyBody` | Créez-en une ici, ou depuis la carte d'une démo. |
| `tags.merge` | Fusionner avec… |
| `tags.mergeTitle` | Fusionner « {{name}} » |
| `tags.mergeBody` | Les {{count}} démos de « {{name}} » reçoivent l'étiquette choisie. « {{name}} » est ensuite supprimée. |
| `tags.mergeWith` | Avec |
| `tags.merged` | « {{from}} » fusionnée dans « {{to}} » ({{count}} démos) |
| `tags.mergeInstead` | Fusionner avec « {{name}} » |
| `tags.deleteTitle` | Supprimer « {{name}} » ? |
| `tags.deleteBody` | Elle sera retirée de {{count}} démos. Les démos ne sont pas supprimées. |
| `tags.deleteUnused` | Aucune démo ne l'utilise. |
| `tags.addOnCard` | + Étiquette |
| `tags.colors.slate` / `teal` / `violet` | Ardoise / Sarcelle / Violet |

## 5. Recette

1. `/settings/tags` : liste triée par nom ; « 14 sur 20 » ; clic sur « 12 démos » : Démos filtré sur l'étiquette.
2. Renommer « Outil métier » en « outil crm » (déjà pris) : message, puis « Fusionner avec « Outil CRM » » ouvre la fusion.
3. Fusion de « Outil métier » (7 démos) dans « Outil CRM » : les 7 démos ont « Outil CRM », « Outil métier » a disparu, aucune démo n'a plus de 5 étiquettes, le toast donne le compte.
4. Suppression d'une étiquette utilisée par 3 démos : la confirmation cite 3 démos ; après, les 3 démos existent toujours, sans l'étiquette.
5. Couleur « Sarcelle » : la pastille choisie a un anneau et une coche ; l'étiquette change sur les cartes de Démos, en clair et en sombre.
6. Carte d'une démo sans étiquette : « + Étiquette » au survol et au focus ; créer « Nouvelle » depuis le sélecteur : elle apparaît sur la carte et dans la page.
7. Rôle Lecteur : liste visible, aucun bouton ni menu.
8. Contrastes : les 8 étiquettes dépassent 4,5:1 en clair et en sombre (axe et calcul) ; « Orange » a le texte `#8F5300`.
9. Clavier : menu « Plus d'actions » aux flèches ; pastilles de couleur aux flèches ; Entrée et Échap dans le renommage.
