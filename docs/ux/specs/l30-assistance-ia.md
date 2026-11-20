# L30 : Assistance IA

> Lot activé par le chef d'équipe : la clé du fournisseur est en place. Version courte, écrans existants plus deltas, sans maquette.
> Ce lot remplace VB-01 pour les fonctions listées au §1. Restent en « Bientôt » : voix de synthèse, sous-titres automatiques, génération d'images.
> Données des captures : espace « Acme », démo « Prise en main d'un logiciel », membres « Camille Fictive » et « Alice Exemple », domaines `.example`.

## 0. Règles communes (toutes les fonctions)

1. **Aucune écriture automatique.** Chaque résultat s'affiche d'abord en **aperçu**, avec deux boutons : « Appliquer » (`fd-btn--primary`) et « Ignorer ». Rien n'est modifié avant « Appliquer ».
   - Après « Appliquer » : toast « Texte appliqué. », avec « Annuler ».
   - L'action entre dans l'historique de l'éditeur (Ctrl+Z).
2. **Mention** : tout aperçu porte la ligne « Généré par IA, à vérifier » (icône `sparkles`, texte secondaire), juste au-dessus des boutons.
   - Après application, rien ne reste visible pour le visiteur. Dans l'éditeur, le champ garde un repère discret « IA » jusqu'à la prochaine modification manuelle.
3. **Données envoyées** : seulement les textes nécessaires à la demande, c'est-à-dire titres, textes des bulles et texte du plan.
   - Pour une capture HTML, on envoie le texte du DOM **après** remplacement des zones floutées (A8). Les zones floutées et les données personnelles détectées ne sont jamais envoyées.
   - Aucune image n'est envoyée.
   - Les commentaires internes, les leads et les données des apprenants ne sont jamais envoyés.
4. **Désactivé** : si l'Assistance IA est désactivée dans l'espace, les entrées restent visibles, désactivées (`aria-disabled`).
   - Infobulle : « Assistance IA désactivée dans cet espace. Un administrateur peut l'activer dans Paramètres > Assistance IA. »
   - Pour un administrateur, l'infobulle contient en plus un lien vers ce réglage.
5. **En cours** :
   - l'aperçu affiche « Rédaction en cours… », avec une barre indéterminée et un bouton « Arrêter » ;
   - le texte arrive progressivement si le fournisseur le permet ;
   - `aria-busy="true"`, et la fin est annoncée en `role="status"` (« Proposition prête. »).
6. **Quota atteint** : l'aperçu affiche « Quota d'Assistance IA atteint pour ce mois. Il se renouvelle le {{date}}. » (`role="alert"`). Les entrées restent visibles avec ce message en infobulle.
   - Aucune donnée n'est envoyée.
   - Si la date de renouvellement n'est pas connue, la deuxième phrase est omise.
7. **Erreur** :
   - message : « La proposition n'a pas pu être générée. Réessayez. » ;
   - bouton « Réessayer » ;
   - rien n'est modifié.
8. **Langue** : la réponse est rédigée dans la langue de la démo, sauf pour Traduire.
9. **Vocabulaire** : on écrit « Assistance IA ». Jamais « magique », « automatique » ni « intelligent ».

## 1. États et codes

| Code | État | Où |
|---|---|---|
| L30-01 | Réglage « Assistance IA » : désactivé, confirmation d'activation, activé avec quota | Paramètres > Assistance IA |
| L30-02 | Rédiger les textes : aperçu | Panneau du texte de bulle, bouton « Assistance IA » |
| L30-03 | Traduire une démo : choix de la langue, aperçu par étape | Éditeur, menu ⋯ > « Traduire » |
| L30-04 | Suggestions : liste d'améliorations | Éditeur, panneau « Suggestions » |
| L30-05 | Générer une démo : depuis un plan texte, depuis une capture HTML | Nouvelle démo > « Générer avec l'IA » |
| L30-06 | Jeu de données fictif : description, aperçu du tableau | Éditeur, Jeu de données (L25) > « Générer » |
| L30-07 | Graphique depuis une description | Éditeur, outil Graphique (L25) > « Décrire le graphique » |
| L30-08 | Assistant de l'éditeur : panneau de discussion | Éditeur, bouton « Assistant » |
| L30-09 | Quota atteint et Assistance désactivée (état commun) | Toute entrée IA |

## 2. Réglage « Assistance IA » (L30-01)

- **Emplacement** : Paramètres > « Assistance IA », nouvelle rubrique placée après « Confidentialité ». Elle remplace l'onglet IA de « Fonctions à venir » pour les fonctions de ce lot.
- **Droits** : propriétaires et administrateurs. Les autres rôles voient la page en lecture seule.
- **Désactivé par défaut** (opt-in). La carte contient :
  - le titre « Assistance IA » et l'interrupteur « Activer l'Assistance IA pour cet espace » ;
  - un bandeau de confidentialité (`fd-callout`, icône `shield`), toujours visible :
    > « Quand l'Assistance IA est activée, les textes nécessaires à chaque demande (titres, bulles, plan) sont envoyés au fournisseur d'IA de TutoClick (Anthropic) pour produire une proposition. Les zones floutées, les images, les commentaires internes et les données des apprenants ne sont jamais envoyés. Les demandes ne servent pas à entraîner les modèles. Rien n'est appliqué sans votre validation. »
    - Chaque affirmation du bandeau doit être vraie dans la configuration réelle. Le dev confirme le point « entraînement » avec les conditions du fournisseur avant la livraison ; sinon, la phrase est retirée.
  - un lien « Voir le registre des traitements » vers `docs/legal`, quand il sera publié dans l'app. En attendant, le lien n'apparaît pas.
- **Activation** : une modale de confirmation s'ouvre.
  - Titre : « Activer l'Assistance IA ? »
  - Texte : le bandeau, puis la case « J'ai lu ces informations. »
  - Bouton : « Activer », actif quand la case est cochée.
  - Toast : « Assistance IA activée pour l'espace. »
- **Activé** :
  - **Quota** : « Ce mois-ci : {{utilisées}} demandes sur {{quota}} », avec une barre de progression (`role="progressbar"`, valeurs ARIA) et « Renouvellement le {{date}} ».
    - Si le quota n'est pas défini, afficher seulement « {{utilisées}} demandes ce mois-ci ».
    - On n'affiche jamais un chiffre inventé.
  - **Fonctions** : des cases, toutes cochées par défaut. Un admin peut en décocher une, et elle devient désactivée dans l'éditeur, avec l'infobulle de la règle 4.
    - Rédiger les textes ;
    - Traduire ;
    - Suggestions ;
    - Générer une démo ;
    - Jeu de données fictif ;
    - Graphique ;
    - Assistant de l'éditeur.
  - **Toujours en « Bientôt »** : « Voix de synthèse », « Sous-titres automatiques » et « Images générées » restent listés en dessous, désactivés, avec le badge « Bientôt ».
- **Désactiver** : l'interrupteur repasse à l'arrêt. La confirmation dit « Les textes déjà appliqués restent dans les démos. ».

## 3. Rédiger les textes (L30-02)

- **Entrée** : dans le panneau du texte de bulle, le bouton « Assistance IA » (icône `wand`) ouvre un menu :
  - « Reformuler plus simplement » ;
  - « Raccourcir » ;
  - « Corriger l'orthographe » ;
  - « Rédiger à partir du titre » (si la bulle est vide) ;
  - « Adapter le ton » (sous-menu : neutre, chaleureux, formel).
  - L'entrée « Rédiger les textes (assistant) » du menu ⋯ perd son badge « Bientôt » et ouvre le même menu.
- **Aperçu** : sous le champ, une carte « Proposition » qui affiche l'avant (barré, gris) et l'après.
  - Elle porte la mention de la règle 2, puis les boutons « Appliquer » et « Ignorer », et « Autre proposition » (lien).
- **Variables** : les `{{variables}}` sont conservées telles quelles. Si une variable disparaît de la proposition, un avertissement s'affiche avant « Appliquer » : « La variable {{first_name}} a disparu de la proposition. »
- **Toutes les étapes** : l'option « Pour toutes les étapes » (Corriger l'orthographe seulement) ouvre une liste d'aperçus par étape, avec « Appliquer » par ligne et « Appliquer tout ».

## 4. Traduire une démo (L30-03)

- **Entrée** : menu ⋯ de l'éditeur > « Traduire la démo… ».
- **Modale** :
  - « Langue cible » : français, anglais, espagnol, allemand, italien, portugais, arabe ;
  - « Créer une copie traduite » (par défaut) ou « Ajouter une langue à cette démo » (si le lecteur multilingue existe ; sinon, option masquée) ;
  - bouton « Préparer la traduction ».
- **Aperçu** :
  - un tableau par étape avec trois colonnes : Étape, Texte d'origine, Traduction (modifiable) ;
  - la mention de la règle 2 ;
  - les boutons « Créer la copie » (ou « Ajouter la langue ») et « Ignorer ».
- **Glossaire** (L17) : les termes du glossaire sont envoyés comme consignes de traduction, et le résultat les respecte. Un terme non respecté est surligné, avec l'infobulle « Terme du glossaire ».
- **Copie créée** :
  - le titre de la démo devient « {{titre}} ({{langue}}) » et la démo est en brouillon ;
  - toast « Copie traduite créée. », avec le lien « Ouvrir ».
- **Langue arabe** : la copie passe en `dir="rtl"` dans le lecteur.

## 5. Suggestions (L30-04)

- **Entrée** : bouton « Suggestions » (icône `lightbulb`) dans la barre de l'éditeur, à côté de l'aide.
- **Panneau** :
  - une liste de suggestions, 10 au plus, groupées par étape ;
  - chaque suggestion a un type (« Clarté », « Longueur », « Accessibilité », « Cohérence »), une phrase d'explication et une proposition ;
  - chaque suggestion a « Appliquer » et « Ignorer » ;
  - en tête du panneau : « Analyser à nouveau » et la mention de la règle 2.
- **Règles locales d'abord** : les contrôles déjà faits sans IA (bulle trop longue, texte alternatif manquant, contraste) restent en tête. Ils portent le libellé « Vérification » et non la mention IA.
- **Liste vide** : « Aucune suggestion pour cette démo. ».
- La liste n'est jamais recalculée sans action de l'utilisateur.

## 6. Générer une démo (L30-05)

- **Entrée** : Nouvelle démo, quatrième carte « Générer avec l'IA » (icône `wand`). Elle est désactivée selon la règle 4.
- **Deux sources** (onglets) :
  1. **Plan texte** :
     - zone de texte « Décrivez la procédure, une étape par ligne », 4 000 caractères au plus ;
     - exemple affiché en placeholder : « Ouvrir le menu Usagers / Cliquer sur Ajouter / Renseigner l'identité… » ;
     - option « Avec un quiz de 3 questions ».
  2. **Capture HTML** : choix d'une démo ou d'une étape HTML existante (A8). On envoie le texte de la page après floutage (règle 3).
- **Aperçu** :
  - la structure proposée (chapitres, étapes, texte des bulles, quiz) en liste modifiable ;
  - le nombre d'étapes ;
  - la mention de la règle 2 ;
  - les boutons « Créer la démo » et « Ignorer ».
- **Création** : la démo est en brouillon. Les étapes sans écran sont « À capturer » (comme un modèle, L26-04), et l'utilisateur capture ou importe ensuite.
  - Avec une capture HTML, les repères sont placés sur les éléments trouvés, à vérifier.
  - Toast : « Démo créée. Vérifiez chaque étape avant de publier. »
- **Publication** : le bilan RGPD (L17-01) ajoute la ligne « Textes générés par IA dans {{n}} étapes, à relire » tant qu'un repère « IA » reste dans la démo.

## 7. Jeu de données fictif (L30-06)

- **Entrée** : dans la modale Jeu de données (L25), le bouton « Générer des données fictives ».
- **Saisie** :
  - « Décrivez les colonnes » (par exemple « structure, nombre de jeunes suivis, taux d'entrée en formation ») ;
  - « Nombre de lignes » : 10, 20 ou 50.
- **Aperçu** :
  - le tableau, avec les 10 premières lignes visibles ;
  - la mention de la règle 2 et la ligne « Données inventées : aucun nom ni identifiant de personne. » ;
  - les boutons « Utiliser ce jeu de données » et « Ignorer ».
- **Garde-fou** : les colonnes qui ressemblent à un nom, un e-mail ou un identifiant de personne sont refusées avec le message de L25 (« Un jeu de données ne doit contenir ni nom, ni e-mail, ni identifiant de personne. »).
- Les limites de L25 s'appliquent : 1 000 lignes et 500 Ko au plus.

## 8. Graphique depuis une description (L30-07)

- **Entrée** : outil Graphique (L25), bouton « Décrire le graphique ».
- **Saisie** : « Que doit montrer le graphique ? », par exemple « Évolution mensuelle des entrées en formation, par structure ».
  - Le graphique utilise le jeu de données relié à la démo.
  - S'il n'y en a pas : « Reliez d'abord un jeu de données, ou générez-en un. », avec un lien vers §7.
- **Aperçu** :
  - le graphique rendu, avec son type (barres, courbe, aires, secteurs), les colonnes utilisées et le titre proposé ;
  - la mention de la règle 2 ;
  - les boutons « Appliquer » et « Ignorer ».
  - Les réglages du graphique restent modifiables après.
- **Accessibilité** : le graphique appliqué reçoit une description textuelle (tableau de données accessible, L25), qui n'est pas générée en image.

## 9. Assistant de l'éditeur (L30-08)

- **Entrée** : bouton « Assistant » (icône `message-square-text`) dans la barre de l'éditeur. Il ouvre un panneau latéral à droite, qui se ferme avec Échap et se redimensionne comme Commentaires.
- **Contenu** :
  - **Contexte affiché en haut** : « Démo : {{titre}} · Étape {{n}} ». L'assistant ne voit que cette démo, et seulement ses textes (règle 3).
  - **Champ de message** : « Demandez une modification ou une explication », Entrée pour envoyer, Maj+Entrée pour aller à la ligne.
  - **Suggestions de départ**, en trois boutons :
    - « Rendre l'étape plus claire » ;
    - « Proposer un titre de chapitre » ;
    - « Vérifier la cohérence des textes ».
- **Réponses** :
  - une réponse qui propose une modification affiche une carte d'aperçu, avec l'étape concernée, l'avant et l'après, et les boutons « Appliquer » et « Ignorer ». L'assistant ne modifie jamais la démo de lui-même ;
  - une réponse purement explicative n'a pas de bouton ;
  - chaque réponse porte la mention de la règle 2.
- **Historique** : il est gardé pendant la session de l'éditeur, puis effacé à la fermeture. Il n'est ni stocké ni partagé avec l'équipe.
  - Le texte en bas du panneau le dit : « La conversation est effacée à la fermeture. »
- **Accessibilité** :
  - la liste des messages est en `role="log"` avec `aria-live="polite"` ;
  - chaque message a son auteur (« Vous », « Assistant ») ;
  - le focus reste dans le champ après l'envoi.

## 10. Quota atteint et Assistance désactivée (L30-09)

État commun, à capturer sur une entrée (Rédiger) et sur la carte Nouvelle démo :
- **Désactivée** : l'entrée est estompée, avec `aria-disabled` et l'infobulle de la règle 4.
- **Quota atteint** : l'entrée reste active. Elle ouvre l'aperçu, qui affiche le message de la règle 6 sans appel au serveur.

## 11. Fonctions à venir et VB-01

- L'onglet « Assistance IA » de « Fonctions à venir » ne garde que les trois cartes en « Bientôt » : Voix de synthèse, Sous-titres automatiques, Images générées.
- Son bandeau devient : « Les autres fonctions d'Assistance IA sont disponibles dans Paramètres > Assistance IA. Celles-ci ne sont pas encore actives : aucune donnée n'est envoyée pour elles. »
- VB-01 passe en « couvert par L30 » à la livraison.

## 12. Recette
- Tout se fait avec des données fictives, sans contenu réel ni appel en production pour les captures.
- Pour chaque fonction :
  - l'aperçu, puis « Appliquer » et « Ignorer » ;
  - Annuler après application ;
  - l'état désactivé et l'état quota atteint, avec une limite abaissée en développement.
- Vérifier sur un échantillon de requêtes qu'aucune zone floutée ni aucune image ne part chez le fournisseur.
- Lecteur d'écran : l'annonce « Proposition prête. », la navigation dans l'aperçu, et le journal de l'assistant.
- Contrôles : 1 440, 1 024 et 390 px, en clair et en sombre.
