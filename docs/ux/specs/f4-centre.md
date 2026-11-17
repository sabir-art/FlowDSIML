# Spec F4 : centre de formation

> Le centre de formation est le hub où l'apprenant trouve ses parcours et ses modules, suit sa progression et reprend là où il s'était arrêté. Il remplace le « Demo Center » (A8) dans une logique de formation. Le vocabulaire reste générique.
>
> Maquette : `docs/ux/maquettes/refonte/f4-centre.html`, avec `?view=hub|path|config` et `&theme=dark` (le thème ne change que la vue Configuration).
> Microcopie FR/EN (72 clés) : `trainingCenter.*`.
>
> Ce qui est réutilisé :
> - accès : A1 §3 (domaine e-mail, invitation, public) ;
> - tags : A2 §8 ;
> - quiz : F2 ;
> - progression et reprise : F3 ;
> - page publique : A1 §6 (style, SEO, `noindex` par défaut).

## 1. Côté apprenant : accueil

- **Fond** : `#F6F7F9` aux couleurs du workspace. Le style suit le réglage « Workspace / Clair / Sombre ».
- **Barre du haut** (blanche) : symbole et nom du centre, lien « Glossaire » (si le glossaire contient au moins un terme, proposition F1 §4), prénom et avatar. Sous 900 px, le prénom est masqué.
- **Héro** sur 2 colonnes (une seule sous 900 px) :
  - à gauche : `h1` de 36 px en 800, texte d'accueil, recherche en pilule de 52 px sur les titres, descriptions et tags ;
  - à droite : carte **« Mon parcours »** en vert DSI avec texte noir. Elle affiche n / N et « module(s) validé(s) », une barre noire sur piste translucide (avec `aria-label` en pourcentage) et le bouton noir « Reprendre « module » » (ou « Commencer le parcours »).
  - Elle n'apparaît que pour un apprenant identifié ayant au moins un parcours.
- **Filtres de thème** : puces à `aria-pressed` construites depuis les tags (Tout, puis un tag par puce). Le filtre est gardé dans `?theme=`.
- **Sections** (dans l'ordre défini par l'admin) : `h2` + méta (« Parcours · n modules · n min » ou « n modules »), puis une grille de cartes (`auto-fill, minmax(250px, 1fr)` ; **2 colonnes compactes sous 480 px**).
- **Carte de module** : un **lien** unique (toute la carte est cliquable, focus en anneau bleu) qui contient :
  - une vignette 16:9 (capture de l'étape 1) ;
  - un badge d'état en haut à gauche : Validé (vert DSI, texte noir), En cours (prune, texte blanc), Nouveau (blanc bordé) ;
  - le titre en `h3`, puis « n étapes · n min · quiz » ;
  - si le module est commencé, une barre prune avec le pourcentage écrit.
- **Pied** : nom du centre, liens « Accessibilité : … » (statut RGAA obligatoire pour un service public), « Données personnelles », « Besoin d'aide ? ».
- **États** :
  - recherche sans résultat : `noResults` avec un bouton « Effacer la recherche » ;
  - centre vide (admin) : invitation à ajouter une section.

## 2. Côté apprenant : page d'un parcours

- Fil d'Ariane (`nav aria-label`), `h1` de 32 px, intro (« 4 modules, à suivre dans l'ordre · 32 min au total · un quiz valide chaque module. »), badge « n sur N validé ».
- **Liste ordonnée** (`ol`) de modules. Chaque ligne affiche la pastille du numéro, une mini-vignette, le titre en `h3`, une ligne d'état et une action :

  | État | Pastille | Ligne d'état | Action |
  |---|---|---|---|
  | Validé | Vert, texte noir | `validatedOn` (date et score) | « Revoir » (secondaire) |
  | En cours | Prune, texte blanc | `inProgressAt` | « Reprendre » (primaire) |
  | À faire | Neutre | — | « Commencer » |
  | Verrouillé (ordre imposé) | Opacité 0,7 | `availableAfter` | Badge `Lock` « Verrouillé » (pas de lien) |

  Les modules facultatifs sont marqués « Facultatif ».
- Sous 900 px, la mini-vignette est masquée et l'action passe sous le texte.
- **Attestation** : en fin de parcours, si l'option est activée, bouton « Télécharger mon attestation (PDF) ». Le PDF contient le nom, le parcours, la date, les modules, les scores et le nom du workspace. Ce n'est pas une certification.

## 3. Côté admin : configuration

Nouvelle entrée « Centre de formation » dans la section Formation de la barre latérale. En-tête : URL publiée, « Ouvrir » et « Publier les modifications ». Les changements restent en brouillon jusqu'à la publication.

- **Page d'accueil** :
  - titre et texte d'accueil ;
  - **Accès** : Public / Domaine e-mail / Invitation, avec les mêmes écrans visiteur qu'A1 §4. Un accès public déclenche l'avertissement RGPD de F1 §2 ;
  - **Style** : Workspace / Clair / Sombre.
- **Sections**, réordonnables (poignée, ou Alt + flèches au clavier). Trois types de section :
  - **Parcours** : modules ordonnés, ordre imposé ou libre, modules obligatoires ou facultatifs. C'est la même entité que dans F3 ;
  - **Collection** : liste libre de modules ;
  - **Automatique** : règle sur les tags ou la date (par exemple « Nouveautés » = modules publiés depuis moins de 30 jours).

  Chaque section a un menu ⋯ (renommer, modifier, masquer, supprimer) en portail.
- **Pied de page et attestation** : interrupteur « Délivrer une attestation… », lien « Accessibilité », contact « Besoin d'aide ? ».
- **Aperçu** : réduit et collant à droite (420 px ; il passe dessous sous 900 px). Il se met à jour en direct et est `aria-hidden` (« Ouvrir » donne la vraie page).

## 4. SEO, partage, accessibilité

- Un centre public est en `noindex` par défaut (interrupteur, comme A1 §6). `<title>` = nom du centre. Image Open Graph = la vignette du premier parcours.
- Chaque carte est un lien unique ; on ne met pas de bouton dans un lien. Les badges d'état sont du texte réel. Les barres de progression ont un `aria-label`. Les titres suivent une hiérarchie `h1` → `h2` (sections) → `h3` (modules).
- Focus visible partout, cibles ≥ 44 px, zoom à 200 % sans défilement horizontal (la grille se replie).

## 5. Recette prévue

- Accueil, parcours et configuration en 1 440, 1 024 et 390 px.
- Configuration en clair et en sombre ; centre en style Workspace, Clair et Sombre.
- Ordre imposé (verrouillage) et ordre libre ; module facultatif non bloquant pour « formée » (F3).
- Recherche, filtres de thème, attestation PDF.
- Navigation au clavier seul et au lecteur d'écran.
