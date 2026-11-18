# Spec L14 : centre de formation (F4)

> Le lot réalise le centre décrit en F4 (`f4-centre.md`) avec le modèle de L13 : une **formation** (parcours) regroupe des démos publiées en **modules**. La page publique est aux couleurs du workspace. Les réglages restent dans le cadre validé (CAD).
>
> **Maquette** (clair et sombre) : `docs/ux/maquettes/refonte/l14-centre.html`, états `?view=accueil|anonyme|filtre|sans-resultat|formation|terminee|vide|reglages|reglages-vide`.
>
> F4 reste la source pour l'accessibilité (§4) et la recette (§5). Ce document fixe ce qui change : des cartes de **formation** (et non plus de module), des filtres par **étiquettes** (L12-07), le badge des démos protégées (L11), la marque du workspace et un style prédéfini.

## 1. États (codes de l'outil de suivi)

| Code | État | Maquette |
|---|---|---|
| L14-01 | Accueil, visiteur identifié (progression) | `?view=accueil` |
| L14-02 | Accueil, visiteur non identifié | `?view=anonyme` |
| L14-03 | Recherche et étiquette actives | `?view=filtre` |
| L14-04 | Recherche sans résultat | `?view=sans-resultat` |
| L14-05 | Page d'une formation, avec un module protégé par mot de passe | `?view=formation` |
| L14-06 | Formation terminée (attestation) | `?view=terminee` |
| L14-07 | Centre vide (côté public) | `?view=vide` |
| L14-08 | Réglages de la page (admin) | `?view=reglages` |
| L14-09 | Réglages, aucune formation (centre non publié) | `?view=reglages-vide` |

## 2. En-tête à la marque

- Barre blanche (sombre en style Sombre). Elle contient :
  - le logo du workspace (40 px, coins 12 px ; à défaut, ses initiales sur la couleur principale) ;
  - le nom du workspace, avec « Centre de formation » en dessous ;
  - à droite, « Glossaire » (seulement si le glossaire contient un terme ; la fonction n'existe pas encore, l'entrée reste donc masquée), puis le prénom et l'avatar du visiteur identifié. Sans identification, il n'y a ni prénom ni avatar.
- La **couleur principale** du workspace (`--brand`) colore :
  - les boutons et les barres de progression ;
  - le module en cours ;
  - les liens.
- La **couleur d'accent** colore la carte « Ma formation en cours » et les badges « Terminée ». Par défaut, ce sont le prune et le vert DSI.
- Pied de page : le nom du workspace, « Accessibilité : … » (statut RGAA), « Données personnelles », « Besoin d'aide ? » et « Créé avec TutoClick ».

## 3. Accueil (L14-01 à L14-04)

- **Héro** sur 2 colonnes : titre `h1` (36 px, 800) et texte d'accueil réglés par l'admin, puis une recherche en pilule de 52 px.
  - Champ `type="search"`, avec un bouton « Effacer la recherche » dès qu'il y a une saisie.
  - La recherche porte sur les titres des formations et des modules, leurs descriptions et les étiquettes.
- **Colonne de droite** :
  - **identifié** (L14-01) : carte « Ma formation en cours : {{formation}} », avec n / N, « module(s) validé(s) », une barre (`role="img"`, `aria-label` en pourcentage) et « Reprendre « {{module}} » ». Cette action ouvre la reprise L13-06.
  - **non identifié** (L14-02) : carte « Retrouvez votre progression ». Elle explique qu'il faut ouvrir le centre depuis son lien personnel, et que sans ce lien rien n'est enregistré. Elle n'a pas de formulaire, puisqu'il n'y a pas d'envoi d'e-mails.
- **Filtres par étiquettes** (`role="group"`, boutons `aria-pressed`) :
  - « Toutes », puis une puce par étiquette utilisée par au moins une formation visible ;
  - chaque puce porte le point de couleur L12-07 et un compteur ;
  - une seule étiquette à la fois ; elle est gardée dans `?tag=`, et la recherche dans `?q=`.
- **Titre de liste** : « Formations » avec « n formations · n modules ». Avec un filtre (L14-03), il est remplacé par une ligne `role="status"` : « **n formation(s)** pour « q » avec l'étiquette X », suivie du lien « Effacer les filtres ». Le terme trouvé est surligné en orange clair (`mark`, règle L12-04).
- **Carte de formation** (grille de 2 ; 1 colonne sous 900 px). Toute la carte est **un seul lien** vers la page de la formation, sans aucun bouton à l'intérieur. Elle contient :
  - une couverture : la capture de l'étape 1 du premier module ;
  - un badge d'état en haut à droite : « En cours » (couleur principale), « Terminée » (accent, texte noir), « Nouveau » (blanc bordé, publiée depuis moins de 30 jours) ;
  - le titre `h3` (19 px, 800), les pastilles d'étiquettes, puis la méta : « n modules à suivre dans l'ordre » ou « en ordre libre », et les quiz. **Aucune durée** n'est affichée : elle n'est pas mesurée ;
  - **étiquettes d'une formation** : l'union des étiquettes de ses modules (L12-07), sans saisie dédiée ;
  - pour un visiteur identifié qui a commencé : une barre et « n sur N validé(s) » ;
  - la liste des **3 premiers modules** avec leur état :

    | État | Icône | Texte à droite |
    |---|---|---|
    | Validé | `CircleCheck`, vert | « Validé » |
    | En cours (fond de la couleur principale, pâle) | `Play` | « Étape n sur N » |
    | Verrouillé | `Lock` | « Après le module n » |
    | Pas commencé | `CircleDot` | « Pas commencé » (sans identification : rien) |
    | Protégé par mot de passe | — | badge orange `Key` « Mot de passe » |
    | Expiré (date L11 dépassée) | — | badge neutre `Clock` « Expiré », sans action |

    Un module validé n'affiche jamais de date de validation : la base ne la garde pas.
    Au-delà de 3 modules : « + n module(s) » en pied (« + 1 module expiré » si c'est le cas) ;
  - en pied : une note (« Tous les modules validés », « Non commencée », « + 1 module facultatif ») et un faux bouton (texte stylé, pas un `button`) : Reprendre, Commencer ou Revoir.
- **Sans résultat** (L14-04) : un bloc centré avec l'icône de recherche, le titre « Aucune formation pour « q » », une aide, et le bouton « Effacer la recherche ». Les filtres restent visibles.

## 4. Page d'une formation (L14-05, L14-06)

- Elle reprend F4 §2 :
  - fil d'Ariane, `h1` de 32 px, description de la formation (`paths.description`, champ ajouté dans L13-07), puis la méta (modules, ordre, quiz), étiquettes, badge « n sur N validé » ;
  - liste ordonnée des modules (pastille de numéro, mini-vignette, titre `h3`, ligne d'état, action).
- **Module protégé** (L14-05) : à côté du titre, le badge orange `Key` « Protégé par mot de passe ».
  - La ligne d'état précise : « le mot de passe vous est donné par votre responsable ».
- **Module expiré** (date d'expiration L11 dépassée) : il reste listé, jamais sans badge. Badge neutre `Clock` « Expiré », ligne « Ce module n'est plus disponible depuis le … » (date d'expiration L11), aucune action, opacité 0,72, et pas de vignette (cadre vide bordé). Il ne compte pas dans la progression : « n sur N validé » ne compte que les modules disponibles (ex. 1 sur 3 avec un module expiré sur 4).
  - « Commencer » ouvre l'écran mot de passe du lecteur (L11-06 à L11-08), puis le module. La progression est enregistrée comme pour les autres modules.
- **Formation terminée** (L14-06) :
  - bandeau couleur d'accent, avec l'icône `Award` et « Formation terminée, bravo {{prénom}} », **sans date** (la base ne garde pas la date de validation) ;
  - bouton noir « Télécharger mon attestation (PDF) ». La génération n'existe pas encore : le bouton est **désactivé avec le badge « Bientôt »** (`aria-describedby`), jamais supprimé. La génération arrivera avec le lot L15 (Exports) ;
  - tous les modules affichent « Validé » (et le score s'il y a un quiz), sans date, avec l'action « Revoir » ;
  - une ligne rappelle ce que contient l'attestation, et que ce n'est pas une certification.

## 5. Centre vide (L14-07)

- Héro sans recherche ni filtres. Bloc centré avec l'icône `Book`, le titre « Aucune formation pour le moment », un texte qui cite le workspace, et « Besoin d'aide ? » (contact réglé par l'admin).
- Le centre est vide quand aucune formation n'est visible, ou quand toutes ses démos sont en brouillon.

## 6. Réglages (L14-08, L14-09)

- **Barre latérale** : dans la section Formation, nouvelle entrée « Centre de formation » (`LayoutTemplate`), sous « Apprenants ». Réservée aux rôles propriétaire et admin.
- **En-tête** :
  - « Centre de formation » ;
  - un statut : « Publié · {{url}} · n modifications non publiées », ou « Brouillon · jamais publié » ;
  - les boutons « Ouvrir » et « Publier les modifications » (ou « Publier le centre »).
- **Deux colonnes** : réglages à gauche, aperçu réduit et collant à droite (400 px, `aria-hidden`, mis à jour en direct). Sous 1 180 px, l'aperçu passe dessous.
- **Adresse** :
  - préfixe fixe en mono et slug modifiable ;
  - bouton Copier ;
  - vérification en direct (`role="status"`) : « Adresse disponible. Lettres minuscules, chiffres et tirets. », ou « Cette adresse est déjà prise » ;
  - interrupteur « Visible dans les moteurs de recherche », désactivé par défaut (`noindex`).
- **Identité** :
  - Titre et Texte d'accueil ;
  - **Logo** : PNG, SVG (nettoyé à l'envoi) ou WebP, 512 Ko au plus, carré, avec les actions Remplacer et Retirer. Il est stocké dans l'espace « branding » ;
  - **Couleur principale** et **couleur d'accent** : pastille et champ hexadécimal. Le contraste du texte posé dessus est calculé en direct (blanc sur la principale, noir sur l'accent). Sous 4,5:1, la couleur est refusée et le message donne la valeur.
- **Style prédéfini** (`radiogroup` de 4 cartes avec une vignette) :
  - Couleurs du workspace (par défaut) ;
  - Sobre (boutons noirs) ;
  - Sombre ;
  - Contraste renforcé (bordures de 2 px, noir sur blanc).
- **Formations visibles** :
  - une ligne par formation : poignée (glisser, ou Alt + flèches), case « Afficher », nom, modules, ordre, étiquettes, nombre d'apprenants ;
  - l'ordre des lignes est celui de la page ;
  - le bouton « Gérer les formations » ouvre L13-07 ;
  - aide : une formation masquée reste accessible par son lien personnel, et les démos en brouillon ne sont jamais montrées.
- **Pied de page** :
  - « Statut d'accessibilité (RGAA) » : Non évaluée (par défaut), Partiellement conforme, Totalement conforme, avec un lien facultatif vers la déclaration. Le pied affiche « Accessibilité : non évaluée » tant que rien n'est choisi : on n'affiche jamais un statut faux ;
  - contact « Besoin d'aide ? » (e-mail ou lien ; vide, l'entrée est masquée) et lien « Données personnelles ».
- **Accès à la page** : mêmes modes que L11.
  - Toute personne avec le lien, et Avec un mot de passe ;
  - Par domaine e-mail et Sur invitation restent visibles, avec le badge « Bientôt », tant que l'envoi d'e-mails n'est pas branché ;
  - aide : l'accès à la page ne remplace pas le mot de passe propre à un module.
- **Aucune formation** (L14-09) :
  - « Publier le centre » est désactivé (`aria-describedby`) ;
  - une alerte d'avertissement l'explique : « Ajoutez au moins une formation visible pour publier le centre. » ;
  - la carte Formations visibles montre un état vide, avec « Créer une formation » (ouvre L13-07) ;
  - l'aperçu affiche « Aucune formation pour le moment ».
- Les modifications restent en brouillon jusqu'à « Publier ».

## 7. Règles

- Données fictives uniquement (`*.example`, « Mission Locale Exemple »). Icônes Lucide, aucun caractère utilisé comme icône.
- La couleur n'est jamais le seul repère : chaque état et chaque étiquette a un texte. Un seul lien par carte. Cibles de 44 px au moins. Au zoom de 200 %, aucun défilement horizontal.
- En style Sombre, la page suit les jetons sombres. La carte « Ma formation en cours » et le bandeau « Formation terminée » gardent l'accent avec un texte noir.
- On ne montre jamais une durée ou un score inventés. Une valeur inconnue est omise.
