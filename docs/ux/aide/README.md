# L51, Centre d'aide : articles à jour des refontes du 20 novembre

Format identique à `apps/web/src/aide/*.md` (en-tête `title`, `section`, `summary`, puis le texte en Markdown). Une procédure par article, en étapes numérotées, et au plus 150 mots.

## Lot 1 : à copier tout de suite dans `apps/web/src/aide/` (fonctions déjà sur dev-mvp 09db6a8)

| Fichier | État | Sujet |
|---|---|---|
| `ranger-demos.md` | remplace | Barres de liste L40 : recherche, Toutes, Publiées, Brouillons, Dossier, Étiquettes, Tri, vue |
| `partager-lien.md` | remplace | Lien et les 4 modes d'accès |
| `acces-invitation-domaine.md` | **nouveau** | Accès sur invitation et par domaine e-mail (L39) |
| `utiliser-variables.md` | **nouveau** | Variables lisibles (L46) |
| `modifier-etape.md` | remplace | Retire `{{first_name}}`, renvoie aux variables |
| `lire-statistiques.md` | remplace | Indicateurs en onglets, évolutions, raccourcis de la page Démos (L47) |
| `commenter-etape.md` | **nouveau** | Composeur, Entrée, Maj + Entrée, mentions (L43) |
| `resultat-quiz.md` | **nouveau** | Anneau du score, seuil, tentatives, « Revoir » (L42) |
| `suivre-apprenants.md` | remplace | Chiffres, filtres, relance, « Accorder une tentative » |
| `changer-espace.md` | **nouveau** | Sélecteur d'espace, retour sur Démos |
| `parametres-espace.md` | remplace | Contact d'aide ; logo de l'espace « bientôt » |
| `membres-roles.md` | remplace | Vocabulaire, « Inviter un membre » |

**`PAGE_ARTICLES`** (dans `help/articles.ts`) :
- `demos` : ranger-demos, creer-demo-extension, partir-modele ;
- `editor-step` : modifier-etape, utiliser-variables, commenter-etape ;
- `share` : partager-lien, acces-invitation-domaine, page-publique ;
- `analytics` : lire-statistiques, visiteurs-recurrents ;
- `learners` : suivre-apprenants, resultat-quiz ;
- `settings` : parametres-espace, membres-roles, changer-espace.

## Lot 2 : à copier **seulement avec la fonction**, pour ne jamais décrire ce qui n'existe pas

| Fichier | Avec | Remarque |
|---|---|---|
| `securite-captures-html.md` | L49 | Libellés à vérifier sur la livraison (« Captures HTML », « Sécurité de la page »). |
| `console-proprietaire.md` | L41 | En-tête `audience: console`. `parseArticle` doit lire ce champ ; le tiroir et la recherche ne montrent l'article qu'aux comptes qui ont un rôle dans la console (L41 §3), jamais aux propriétaires d'un espace. |

## Vocabulaire (L50, X6)

| Écrire | Ne pas écrire |
|---|---|
| espace | workspace |
| e-mail, adresse e-mail | email, mail |
| démo | tutoriel interactif, guide (sauf dans un titre de formation) |
| étape, bulle, hotspot | slide, popup (on écrit « pop-up ») |
| apprenant | utilisateur, élève |
| statistiques, Analytics (nom de la page) | stats, métriques |
| Utilisation | plans, facturation, abonnement |
| Bientôt | V2, prochainement, à venir |
| variable, valeur de repli | clé, placeholder, `{{…}}` |

Mises en forme : les noms de boutons et de pages en **gras**, comme à l'écran. Les touches en texte simple (Entrée, Maj + Entrée, Ctrl Z). Pas de symbole comme icône : on écrit « menu **Plus d'actions** », jamais « ⋯ ».
