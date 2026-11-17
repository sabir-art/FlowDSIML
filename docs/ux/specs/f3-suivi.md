# Spec F3 : suivi des apprenants et pilotage par structure

> Objectif : savoir **qui est formé**, à quel point, et **où** il faut agir. Le vocabulaire reste générique : « apprenant », « structure », « module », « parcours ».
>
> Maquette : `docs/ux/maquettes/refonte/f3-suivi.html`, avec `?view=learners|structures|resume` et `&theme=dark`.
> Microcopie FR/EN (75 clés) : `learners.*` et `player.resume.*`.
>
> Base réutilisée :
> - **accès restreint** par invitation, domaine e-mail ou jeton : A1 §3 (`partage-avance.html?view=acces`) et écrans visiteur `acces-visiteur.html` ;
> - **quiz** : F2.

## 0. Modèle

- **Parcours** : suite ordonnée de modules (des démos), avec un ordre libre ou imposé, et des modules obligatoires ou facultatifs. Un parcours a un **objectif** en pourcentage de personnes formées (80 % par défaut).
- **Apprenant** : une personne identifiée par son e-mail, via une invitation, un domaine ou un jeton. Il est rattaché à **une structure** et, en option, à une équipe :
  - la structure est déduite du domaine de l'e-mail, d'une colonne de l'import CSV ou d'une revendication du jeton ;
  - à défaut, elle est choisie par l'apprenant à la première connexion, dans la liste du workspace.
- **Progression par module** :
  - pourcentage d'étapes vues ;
  - statut : `not_started` → `in_progress` → `validated` / `failed` ;
  - un module sans quiz est `validated` quand la dernière étape est vue ;
  - un module avec quiz est `validated` quand le score atteint le seuil (F2).
- **« Formée »** = tous les modules obligatoires du parcours sont validés.
- **Visiteurs anonymes** (lien public) : ils sont comptés dans Analytics, mais **pas** dans le suivi des apprenants.

## 1. Écran « Suivi de la formation », onglet Apprenants

- **Navigation** : une nouvelle section « Formation » dans la barre latérale, avec « Apprenants » (`GraduationCap`). L'onglet « Pilotage par structure » est dans la même page (`.fd-tabs`, gardé dans `?tab=`).
- **En-tête** : `h1` « Suivi de la formation » ; sous-titre « Parcours « … » · n modules · n apprenants ». Sélecteur de parcours s'il y en a plusieurs. Actions « Exporter CSV » et « Inviter des apprenants » (primaire, ouvre l'onglet Accès d'A1).
- **Filtres** en puces (`fchip`) : module, structure, statut. Recherche par nom ou e-mail. Les filtres sont gardés dans l'URL.
- **KPI** (4) :
  - Module validé (héro, en %, avec « n apprenants sur N ») ;
  - En cours (avec le nombre d'inactifs depuis 7 jours) ;
  - Non validé (avec le nombre de personnes sans tentative restante) ;
  - Score moyen au quiz (avec le seuil).
- **Tableau** :

  | Colonne | Contenu |
  |---|---|
  | Apprenant | Nom, puis e-mail en `caption` |
  | Structure | Nom de la structure |
  | Progression | Barre et pourcentage en texte (`aria-label`) |
  | Score | Meilleur score, ou « — » |
  | Statut | Badge, voir ci-dessous |
  | Tentatives | « utilisées / max » |
  | Dernière activité | Date ou « Invité le … » |
  | Actions | Menu ⋯ |

- **Badges de statut**, toujours avec texte et icône :
  - Module validé : `Award`, pilule vert DSI avec texte noir ;
  - En cours : `Clock`, info-soft ;
  - Non validé : `RefreshCw`, pilule neutre bordée, **jamais en framboise** ;
  - Non commencé : contour seul, `text-muted`.
- **Menu ⋯** (en portail) : Voir le détail (tiroir avec la timeline et les réponses au quiz par tentative), Relancer par e-mail, Accorder une tentative, Retirer l'accès (`ConfirmDialog`).
- **« Relancer les n inactifs »** (inactifs depuis 7 jours) envoie un e-mail type depuis le workspace. Toast `remindDone`. Au maximum une relance par personne et par 72 h ; au-delà, le bouton indique la date de la prochaine relance possible.
- Pagination de 50 lignes, tri sur chaque colonne (`aria-sort`). Le tableau défile horizontalement sous 1 024 px, avec une ombre de bord (RF5).
- **État vide** : `learners.empty`.

## 2. Onglet « Pilotage par structure » (chefs de projet)

- **KPI** :
  - Personnes formées (héro, avec l'objectif) ;
  - Structures au-dessus de l'objectif (« 1 / 5 » et leurs noms) ;
  - Progression sur 7 jours (en points) ;
  - Module le moins validé.
- **Carte de chaleur structure × module** :
  - un vrai `<table>` avec `caption` masqué, `th scope` en ligne et en colonne ;
  - **la valeur est toujours écrite** dans la case ;
  - 5 paliers de prune (0, < 25, < 50, < 80, ≥ 80 %) mélangés à `surface`, ce qui fonctionne en clair comme en sombre ;
  - texte `text`, sauf sur le dernier palier (`on-primary`) : contraste ≥ 4,5:1 vérifié ;
  - légende des paliers ;
  - un clic sur une case ouvre l'onglet Apprenants filtré sur la structure et le module.
- **Courbe « Personnes formées dans le temps »** (SVG) :
  - part cumulée par semaine, avec la ligne d'**objectif** en pointillé noir et la dernière valeur écrite ;
  - période : 4 semaines, 8 semaines ou tout ;
  - `role="img"` avec une phrase de synthèse dans `aria-label` ;
  - tableau de valeurs masqué pour les lecteurs d'écran.
- **Anonymat** : à ce niveau, les données sont agrégées. Une structure ou une case de **moins de 5 personnes** est masquée (« — » et `minGroup` dans l'infobulle).
- **Exports** : CSV par structure × module, et PNG de la carte de chaleur pour les comités.

## 3. Reprise (player)

- Un apprenant identifié qui revient sur un parcours commencé voit la carte « Bon retour » **avant** le player :
  - badge « Parcours en cours » ;
  - `h1` « Bon retour, {{prénom}} » ;
  - phrase « Vous vous étiez arrêté à l'étape n sur N du module « … » » ;
  - barre segmentée par étape ;
  - liste des modules du parcours : validé (`CircleCheck` + texte « Validé »), en cours (fond prune pâle, gras, « n / N »), verrouillé si l'ordre est imposé (`Lock` + « Après le module n »).
- Actions : « Recommencer le module » (fantôme) et « Reprendre à l'étape n » (primaire, focus initial).
- La position est sauvegardée à chaque changement d'étape (côté serveur pour un apprenant identifié, en `localStorage` sinon).

## 4. Droits et RGPD

- Le suivi des apprenants est visible des rôles **propriétaire, admin et éditeur**. Le rôle lecteur voit seulement l'onglet Pilotage (agrégé).
- Un apprenant voit seulement **sa** progression (`privacyNote`).
- Durée de conservation des résultats réglable (12 mois par défaut), puis anonymisation. Export et effacement sur demande (droit d'accès et à l'effacement).
- Aucune donnée de suivi pour les visiteurs anonymes.

## 5. Recette prévue

- Calcul des statuts : module sans quiz, module avec quiz réussi, échoué, puis réussi après plusieurs tentatives (la meilleure fait foi).
- Agrégats par structure et masquage sous 5 personnes.
- Filtres et URL ; tri au clavier ; carte de chaleur lue au lecteur d'écran (en-têtes de ligne et de colonne annoncés).
- Reprise exacte de l'étape.
- Contrôles communs : 1 440, 1 024 et 390 px, en clair et en sombre.
