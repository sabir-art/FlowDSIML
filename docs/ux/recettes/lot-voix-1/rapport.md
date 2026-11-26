# Recette du lot voix, 1re partie (e0b00d4 et 4811864) : ROUGE

Recette du 26/11 sur `claude/dev-mvp` (7829697), app locale avec les réponses simulées de l'e2e `voix-sous-titres-ia`. Aucun appel réel au fournisseur. J'ai comparé le résultat à la planche `propositions/l62/planche-l62-selecteur-voix.png`, à 1440, en clair et en sombre.

## 1. Ce qui marche

- **e2e `voix-sous-titres-ia`** : 66/66 en clair et 66/66 en sombre.
- **Contenu du sélecteur**, conforme au §8 et à CHOIX-01 :
  - il montre les vraies voix du compte, sans emplacement fixe ;
  - il a deux sections, « Recommandées pour le français 4 » puis « Toutes les voix 5 », chacune avec son compteur ;
  - chaque voix a le badge « Recommandée », et sa ligne donne le genre, l'accent et le style ;
  - les lignes font 56 px, avec l'avatar en tête et sans colonne de coche ;
  - la voix choisie a un fond teinté et une pastille cochée sur l'avatar ;
  - le bouton Écouter est rond, de 32 px ;
  - le pied dit « Écoute : exemple lu en français » et donne le nombre de résultats ;
  - la recherche ignore les accents (« elodie » trouve « Élodie ») ;
  - le filtre Genre marche, et l'état vide propose « Effacer les filtres ».
- **Clavier** : Entrée choisit la voix, et Écouter ne choisit jamais la voix.
- **Écoute** : l'exemple ne consomme pas de quota. Les refus du fournisseur sont dits clairement.
- **Serveur (code de `supabase/functions/ai`)** :
  - `SAMPLE_TEXT.fr` = « Bonjour, je vais vous guider pas à pas dans cette démonstration. », avec 7 langues ;
  - la langue est celle de la démo (`body.lang`, envoyée par le sélecteur), et une langue sans phrase retombe sur l'anglais ;
  - l'exemple est cherché d'abord dans `voices/_samples/{voix}/{langue}.mp3`, puis généré une seule fois et gardé ;
  - la liste des voix est gardée 1 heure.
  - Les tests Deno vérifient `sampleLang`, la longueur des phrases et le chemin de cache. Ils ne vérifient pas le passage par le cache (lecture, puis génération seulement si absent).
  - **Limite** : Deno n'est pas installé dans mon environnement, donc j'ai relu ces tests sans les lancer.

## 2. Ce qui bloque (ROUGE)

1. **La fenêtre du sélecteur est rognée par le panneau** (`selecteur-rogne-annote.png`, `selecteur-ouvert-*.png`).
   - Elle fait bien 400 px de large. Mais elle est en `position: absolute` dans `.ed-tool__body` (`overflow: hidden auto`), qui commence à x = 1073 alors que la fenêtre commence à x = 976.
   - Les 97 premiers pixels sont donc coupés : on lit « cher : nom, accent, style », « nçais », « ille Recommandée »… On ne voit plus le nom des voix ni leur avatar, donc ni la pastille de la voix choisie.
2. **La fenêtre sort de l'écran par le bas.** Son bas est à 938 px pour un écran de 900 px : le pied (« Écoute : exemple lu en français ») et les dernières voix ne se voient pas sans faire défiler le panneau.
3. **Deux croix dans le champ de recherche** (`selecteur-vide-clair.png`) : la croix bleue du navigateur (`type="search"`) et la nôtre. C'est contraire à COMP-01 (pas de contrôle natif).

**Correction demandée** :
- Ouvrir la fenêtre dans une couche au-dessus de l'éditeur (portail, `position: fixed`), alignée sur le bord droit du champ « Voix ». Elle déborde alors à gauche, au-dessus de la page, comme sur la planche.
- Hauteur : au plus l'espace disponible sous le champ, moins 16 px. S'il reste moins de 320 px, la fenêtre s'ouvre au-dessus du champ. La liste défile à l'intérieur, et le champ de recherche, les puces et le pied restent visibles.
- Le panneau ne défile pas tant que la fenêtre est ouverte, et la fenêtre se ferme si on fait défiler l'éditeur.
- Masquer la croix du navigateur (`::-webkit-search-cancel-button { display: none }` et `appearance: none`).
- **e2e** : la fenêtre est entièrement visible, sans parent qui la coupe. Le contrôle : `elementFromPoint` au coin haut gauche et au coin bas droit renvoie la fenêtre. Le pied est visible à 1440 × 900 et à 1280 × 720.

## 3. Détail non bloquant

- **État vide** : « Effacer les filtres » est sur sa propre ligne. Sur la planche, le lien suit la phrase « Essayez un autre nom ou un autre filtre. ». À aligner quand la fenêtre sera reprise.

## 4. Pour le VERT

Les points 1 à 3 du §2. Je rejouerai l'e2e en clair et en sombre, avec mes captures de la fenêtre ouverte, de la recherche, du filtre Genre et de l'état vide.
