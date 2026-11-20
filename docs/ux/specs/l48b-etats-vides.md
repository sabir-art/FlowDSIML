# L48-B : états vides, et limite atteinte ou « Bientôt »

> Paquet B du benchmark de structure (`docs/ux/benchmark-structure.md` §3). **À réaliser après L48-A.**
> Maquette : `docs/ux/maquettes/refonte/l48b-etats-vides.html`. Captures : `img/l48b-variantes.png`, `img/l48b-demos-vide.png`, `img/l48b-widgets-offre.png` et `img/l48b-sombre-mobile.png`.
> Données fictives.

## 1. État actuel (code de `claude/dev-mvp`, c48894c)

- **Classe `.empty-state`** dans `app.css` : utilisée par Apprenants (2 cas) et `LeadsTable` seulement.
- **Ailleurs, des compositions propres à chaque page** :
  - `demos-empty` (carte, titre « Aucune démo pour l'instant ») ;
  - `empty-folder` ;
  - Webhooks, avec un bon modèle (icône, titre, phrase, bouton) ;
  - Glossaire, Notifications, Commentaires ;
  - le reste en texte seul : Analytics « Pas encore de données sur la période. », Variables, Temps réel, Alertes, Sondages.
- **Page Démos sans démo publiée** : un grand bloc blanc « Les statistiques apparaîtront après la première publication. » à la place des 4 cartes KPI, puis la checklist dépliée, puis l'état vide de la liste, en bas de page.
- **Fonctions hors offre** : le formulaire de lead (offre Gratuit) affiche une alerte dans l'éditeur. Après la décision L48-00, il n'y a plus d'offre à choisir (§5).

## 2. Composant `fd-empty` (packages/ui)

```tsx
<Empty icon={<Monitor />} title="Créez votre première démo"
  body="Ouvrez votre logiciel métier et lancez une capture…"
  action={<Button variant="primary">Nouvelle démo</Button>}
  secondary={<Button>Voir un exemple</Button>}
  variant="page" | "compact" | "search" />
```

| Variante | Usage | Aspect |
|---|---|---|
| `page` | Liste ou page entière sans contenu | Carte `surface`, bordure 1 px, arrondi 16 px, 48 px de marge verticale. Contenu centré : pastille de 64 px (arrondi 20 px, `primary-soft`) avec l'icône de l'objet en 32 px `primary`, titre 18 px graisse 700, phrase de 14 px `text-muted` (440 px de large au plus), actions à 12 px. |
| `compact` | Widget, panneau, colonne | Ligne : pastille de 40 px (`surface-sunken`, icône de 20 px `text-muted`), titre 14 px, phrase 13 px, action `sm` à droite. Bordure pointillée 1 px, fond transparent, 20 px de marge. |
| `search` | Recherche ou filtres sans résultat | Comme `page`, pastille neutre (`surface-sunken`) avec l'icône `search`. Titre « Aucune {objet} ne correspond à « {saisie} » ». Phrase qui donne le nombre de filtres actifs. Action « Réinitialiser les filtres ». |

- **Rédaction** :
  - titre à l'action pour un premier usage (« Créez votre première démo », « Ajoutez votre premier terme ») ;
  - le constat (« Ce dossier est vide ») passe dans la phrase ;
  - le constat seul n'est en titre que pour `search` et les données sans activité (« Rien à analyser pour l'instant »).
- **Sans droit d'édition** : pas de bouton, et une phrase adaptée (« Les démos de l'espace apparaîtront ici. »).
- **Pictogramme** : toujours une icône Lucide de l'objet. Pas d'illustration externe, pas d'emoji.
- **Accessibilité** :
  - `role="status"` sur les variantes `search` et `compact` des widgets qui se vident après un filtre (annonce « Aucune démo ne correspond… ») ;
  - le titre est un vrai titre (`h2` pour une page, `h3` dans une section).
- `.empty-state` d'`app.css` devient un alias de `fd-empty` le temps de la migration, puis est supprimé.

## 3. Inventaire (tous passent sur `fd-empty`)

| Endroit | Variante | Titre | Phrase | Action |
|---|---|---|---|---|
| Démos, aucune démo | page | Créez votre première démo | Ouvrez votre logiciel métier et lancez une capture : chaque clic devient une étape, avec sa bulle d'explication. | Nouvelle démo ; Voir un exemple (si une démo d'exemple existe dans l'Académie, sinon absent) ; 3 tuiles de départ (§4) |
| Dossier vide | page | Rangez vos premières démos ici | Ce dossier est vide. Glissez une démo depuis la liste, ou créez-en une directement dans « {dossier} ». | Nouvelle démo dans ce dossier |
| Recherche ou filtres (Démos, Apprenants, Leads, Sessions) | search | Aucune {objet} ne correspond à « {saisie} » | Vérifiez l'orthographe, ou retirez un filtre ({n} filtres actifs). | Réinitialiser les filtres |
| Archivées (L48-A) | page | Aucune démo archivée | Archivez une démo depuis son menu « … » pour la retirer des listes sans la supprimer. | aucune |
| Parcours de formation | page | Créez votre premier parcours | Enchaînez plusieurs démos dans un ordre à suivre, et suivez la progression des apprenants. | Créer un parcours |
| Apprenants | page | (texte actuel, structure `fd-empty`) | (texte actuel) | (actuelle) |
| Analytics, chaque widget | compact | Rien à analyser pour l'instant | Les {données} apparaissent dès les premières visites sur la période choisie. | aucune |
| Leads | page | Collectez vos premiers leads | Ajoutez un formulaire à une démo, ou partagez des liens personnalisés pour identifier vos visiteurs. | Ajouter un formulaire |
| Variables (L46) | page | Créez votre première variable | Un mot défini une fois, puis inséré dans toutes les démos : le nom du logiciel, un lien… | Nouvelle variable |
| Glossaire | page | Ajoutez votre premier terme | (texte actuel) | Ajouter un terme ; Importer un CSV |
| Étiquettes (L48-A) | page | Créez votre première étiquette | Les étiquettes classent les démos par thème, public ou logiciel. | Nouvelle étiquette |
| Intégrations, Webhooks | page | (texte actuel) | (texte actuel) | Ajouter un webhook |
| Commentaires de l'étape | compact | (texte actuel) | (texte actuel) | aucune |
| Notifications | compact | Rien de nouveau | (texte actuel) | aucune |
| Temps réel, Alertes, Sondages et tests | page | (textes actuels, titre à l'action pour Alertes : « Créez votre première alerte ») | | Créer une alerte |

## 4. Page Démos vide

- **Cartes KPI** : **masquées** tant qu'aucune démo n'est publiée (au lieu du bloc « Les statistiques apparaîtront… »). Elles reviennent dès la première publication (L47 §8).
- **Checklist « Prise en main »** : repliée en une ligne au-dessus de l'état vide (« Prise en main de votre espace · 2 étapes sur 7 », barre de progression, « Afficher »). Elle se déplie d'un clic, sans changer d'emplacement.
- **État vide** `page`, sous la checklist, à la place de la liste. Il contient **3 tuiles de départ** (boutons de 3 colonnes, 640 px au plus, une colonne sur mobile) :
  - « Capturer avec l'extension » (`puzzle`) : lance la capture si l'extension est détectée, sinon ouvre la modale Extension (L48-A) ;
  - « Partir d'images » (`image`) : ouvre la création à partir d'images (existante) ;
  - « Partir d'un modèle » (`copy`) : ouvre la galerie de modèles de « Nouvelle démo », filtrée selon l'usage choisi à l'accueil (L48-C).
- La barre de liste (L40) est masquée tant qu'il n'y a aucune démo.

## 5. Limite atteinte ou « Bientôt »

> Révisé après la décision du client (L48-00) : outil interne sans offre à choisir. Il n'y a donc **pas de badge d'offre**. Toutes les fonctions sont disponibles pour tous les espaces ; seuls les **quotas** limitent (L48-A §6).

Deux situations à ne jamais confondre :

| Situation | Repère | Comportement |
|---|---|---|
| La fonction **existe**, mais un **quota** de l'espace est atteint (stockage plein, requêtes IA du mois épuisées, limite de démos publiées) | Le bouton reste visible et actif. Au clic : dialogue « Limite atteinte », avec la conséquence et les chiffres (« Stockage : 500 Mo sur 500 Mo ») | Actions du dialogue : « Voir l'utilisation » (L48-A §6) et « Demander plus à la DSI » (lien de support). Pour un quota mensuel : « Disponible à nouveau le 1er {mois} ». |
| La fonction **n'existe pas encore** | Badge « Bientôt » (règle actuelle) | Visible, `aria-disabled="true"`, infobulle « Bientôt disponible » (L44). Jamais masquée. |

- **Quota proche** (80 % ou plus) : une alerte discrète `warning` dans le panneau concerné (médiathèque, assistant IA), « Bientôt atteinte : 412 sur 500 requêtes ce mois-ci », avec le lien « Voir l'utilisation ».
- **Confirmé par le chef de projet (20 novembre)** : il n'y a plus d'offres, et **toutes les fonctions sont ouvertes à tous les espaces**. Cela inclut le formulaire de lead, dont la mention RGPD reste obligatoire. `PlanFormsWarning` disparaît.
- Les chiffres et dates viennent de l'état lu par l'interface (quotas) ; ils ne sont jamais écrits en dur.

## 6. Recette

- Chaque ligne du §3 vérifiée en clair et en sombre, à 1 440 px et 390 px. Plus aucun `.empty-state` ou texte vide « nu » (recherche dans le code).
- Page Démos d'un espace neuf :
  - pas de bloc KPI vide ;
  - checklist repliée ;
  - état vide avec les 3 tuiles ;
  - chaque tuile ouvre le bon parcours.
- Recherche « zzz » dans Démos avec 2 filtres actifs : variante `search`, et « Réinitialiser les filtres » remet tout. L'annonce `role="status"` est lue.
- Quota atteint (stockage plein, simulé) : l'ajout d'un fichier ouvre « Limite atteinte » avec les chiffres et « Demander plus à la DSI » ; aucun badge d'offre nulle part.
- Fonction à venir : badge « Bientôt », `aria-disabled`, infobulle.
