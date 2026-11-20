# L48-F, Intégrations : catégories, liste, demande à la DSI

> Paquet L48-F du benchmark (`benchmark-structure.md`, rang 7). Maquette : `docs/ux/maquettes/refonte/l48f-integrations.html`.
> Code de départ : `apps/web/src/pages/settings/integrations/IntegrationsPage.tsx` (b0aa6cc). Règles visuelles : `composants.md` §17, deltas T1 à T9.
> **Aucun changement de schéma.** Les fonctions « Bientôt » restent visibles et désactivées. Aucune n'est masquée, aucune n'est ajoutée.

## 1. Page Intégrations (`/settings/integrations`)

- Dans les Paramètres (navigation de L48-A), groupe **Connexions** (corrigé le 20 novembre : c'est le groupe de L48-A). Fil d'Ariane : « Paramètres › Connexions ». Titre « Intégrations », puis une phrase : « Envoyez les événements de vos démos vers vos outils. »
- **Filtre** en segmenté au-dessus de la liste. Pas de colonne de catégories : la page a déjà la navigation des Paramètres.
  - Options : Toutes, Connectées, Communication, Mesure d'audience, Automatisation, Relation usagers.
  - Aucun compteur. Le filtre est gardé dans l'URL (`?categorie=automatisation`).
- **Une seule carte**, qui contient une **liste** (T4) ; plus de grille de cartes.
  - Avec « Toutes », la liste est groupée par catégorie, avec un titre de groupe en 12 px 600 `text-muted`, sans capitales.
  - Avec une catégorie choisie, pas de titre de groupe.
- **Ligne** (hauteur 72 px, filet entre deux lignes) :
  - logo de 28 px dans une zone de 32 px (logo officiel de la marque, déjà dans `src/assets/brands/`, à sa couleur, jamais estompé ni passé en gris, même en « Bientôt » : `CREDITS.md`), ou icône Lucide de 20 px `text-muted` ; pas de pastille de fond ;
  - nom en 15 px 600, une phrase en 13 px `text-muted` (textes `integrations.soon_*_body` existants) ;
  - à droite, l'état, sous une seule des trois formes suivantes :
    - **Disponible et non connectée** : bouton secondaire « Connecter » ;
    - **Connectée** : point de 8 px `success` et « 2 actifs » en 14 px, puis un chevron ; toute la ligne mène à la page de l'intégration ;
    - **Pas encore disponible** : « Bientôt » en 13 px `text-muted`. La ligne a `aria-disabled="true"` et n'est pas cliquable.
  - Aucun badge.

| Catégorie | Lignes |
|---|---|
| Automatisation | **Webhooks** (disponible), Zapier, Clés d'API, Pilotage du player (Bientôt) |
| Communication | Slack, Microsoft Teams, Outils d'e-mailing (Bientôt) |
| Mesure d'audience | Google Analytics, Matomo (Bientôt) |
| Relation usagers | CRM, Enrichissement des visiteurs (Bientôt) |

- **Webhooks** reste en tête de la catégorie Automatisation, et dans « Connectées » dès qu'un webhook est actif.
  - Sans webhook : bouton « Connecter », qui ouvre directement la boîte « Ajouter un webhook » (existante).
  - Avec des webhooks : « n actifs » (le nombre de webhooks à l'état `active`), puis un chevron vers la page Webhooks (§2).
  - Un webhook en pause automatique ajoute, sous la phrase, « 1 en pause après des échecs » en 13 px `warning`.
- **Outils d'e-mailing** : la phrase « En attendant, un webhook peut alimenter ces outils » reste, avec le lien « Utiliser un webhook » (comportement actuel VB-02).
- **Connectées, vide** : état vide compact (L48-B), icône `unlink` de 32 px : « Aucune connexion active », avec le lien « Ajouter un webhook ».

### 1.1 Demande d'une autre connexion
- Sous la carte, une ligne de texte, sans encadré ni bannière colorée : « Besoin d'une autre connexion ? », puis le lien **« Faire une demande à la DSI »**.
- Le lien utilise le « Lien du support » de L48-A §5 (`mailto:` ou URL), avec le sujet « Demande de connexion » quand c'est un `mailto:`.
- **Lien du support vide** : la page est réservée aux propriétaires et aux admins, qui peuvent le renseigner. Le lien devient donc « Renseigner le lien du support » et mène à Paramètres › Général, au champ.

## 2. Page Webhooks (`/settings/integrations/webhooks`)

- Nouvelle route : la déclarer **avant** `/settings/integrations/:id`.
- Fil d'Ariane « Paramètres › Intégrations », titre « Webhooks », sous-titre `integrations.webhooksSub`.
- Le contenu ne change pas : tableau, état vide, actions.
  - Le bouton principal « Ajouter un webhook » passe en haut à droite. C'est la seule action principale de la page.
  - Le tableau suit T4 : l'état en texte avec un point (Actif, En pause, Désactivé), sans badge.
- `WebhookDetail` (`/settings/integrations/:id`) : le fil d'Ariane va jusqu'à « … › Intégrations › Webhooks », le h1 est l'hôte du webhook, et le bouton « ← Intégrations » disparaît.
- Les anciens liens `/settings/integrations#webhooks` mènent à cette page.

## 3. Mobile (moins de 768 px)

- Le segmenté devient un `select` natif « Catégorie ».
- Même ligne qu'en grand écran (logo, nom et phrase, état à droite) ; la phrase passe sur 2 ou 3 lignes.

## 4. Textes (i18n, nouvelles clés)

| Clé | Texte |
|---|---|
| `integrations.sub` | Envoyez les événements de vos démos vers vos outils. (raccourci) |
| `integrations.cat.all` … `cat.crm` | Toutes, Connectées, Communication, Mesure d'audience, Automatisation, Relation usagers |
| `integrations.connect` | Connecter |
| `integrations.activeCount` | {{count}} actif / {{count}} actifs |
| `integrations.pausedCount` | {{count}} en pause après des échecs |
| `integrations.noneConnected` | Aucune connexion active |
| `integrations.needOther` | Besoin d'une autre connexion ? |
| `integrations.askIt` | Faire une demande à la DSI |
| `integrations.setSupport` | Renseigner le lien du support |
| `integrations.requestSubject` | Demande de connexion |

## 5. Recette

1. « Toutes » : 4 groupes, 11 lignes (Enrichissement des visiteurs, rangée ici par L48-A, reste visible) ; seule « Webhooks » a un bouton ou un chevron, les 10 autres disent « Bientôt » et ne réagissent pas au clic.
2. « Connectées » sans webhook : état vide et lien « Ajouter un webhook » ; avec 2 webhooks actifs : une ligne « Webhooks · 2 actifs ».
3. « Connecter » sur Webhooks : la boîte « Ajouter un webhook » s'ouvre.
4. Lien du support `mailto:dsi@example.com` : « Faire une demande à la DSI » ouvre un e-mail avec le sujet « Demande de connexion ». Champ vide : « Renseigner le lien du support » mène au champ.
5. `/settings/integrations/webhooks` : la liste des webhooks s'affiche ; `/settings/integrations/<id>` ouvre toujours le détail.
6. 390 px : pas de défilement horizontal ; la catégorie se choisit dans un `select`.
7. Clavier : le segmenté se parcourt aux flèches ; les lignes « Bientôt » ne prennent pas le focus.
