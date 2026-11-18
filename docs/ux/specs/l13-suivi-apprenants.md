# Spec L13 : suivi des apprenants (F3)

> Ce lot réalise le suivi décrit en F3 (`f3-suivi.md`), sur plusieurs formations à la fois. Il garde le cadre validé (CAD, barre latérale de la refonte) et la peau DSI.
>
> **Maquette** (clair et sombre) : `docs/ux/maquettes/refonte/l13-suivi.html`, états `?view=liste|fiche|formation|export|rgpd|gerer|gerer-structures`. La reprise du lecteur est dans `refonte/f3-suivi.html?view=resume`.
>
> Le modèle (parcours, apprenant, progression par module, « formé »), les droits et l'anonymat restent ceux de F3 §0, §2 et §4.

## 1. États (codes de l'outil de suivi)

| Code | État | Maquette |
|---|---|---|
| L13-01 | Liste des apprenants | `?view=liste` |
| L13-02 | Fiche d'un apprenant (tiroir) | `?view=fiche` |
| L13-03 | Vue par formation | `?view=formation` |
| L13-04 | Export CSV | `?view=export` |
| L13-05 | Suppression RGPD | `?view=rgpd` |
| L13-06 | Lecteur : reprise « Bon retour » | `f3-suivi.html?view=resume` |
| L13-07 | Modale « Formations et structures » | `?view=gerer`, `?view=gerer-structures` |

## 2. Navigation et en-tête

- Dans la barre latérale, une section « Formation » contient l'entrée « Apprenants » (`GraduationCap`).
- `h1` « Apprenants » ; sous-titre « n apprenants · n formations · données des 12 derniers mois ».
- Actions : « Gérer les formations » (secondaire, ouvre L13-07), « Exporter CSV » (secondaire) et « Inviter des apprenants » (primaire). « Inviter » ouvre un menu qui fait choisir la formation, puis le lien personnalisé de cette formation.
- Le sous-titre ne cite une période que si elle est exacte : c'est la durée de rétention du plan, pas une valeur fixe.
- Deux onglets : « Tous les apprenants » et « Par formation », gardés dans `?tab=`.

## 3. Liste (L13-01)

- **Filtres** en puces : Formation, Statut, Structure. Recherche par nom ou e-mail. Tous sont gardés dans l'URL.
- **KPI** (4) : Terminé (héro, nombre et part), En cours (actifs 7 j), À relancer (inactifs ≥ 7 j), Score moyen au quiz (avec le seuil).
- **Tableau** :

  | Colonne | Contenu |
  |---|---|
  | Sélection | Case à cocher, et « Tout sélectionner » en en-tête |
  | Apprenant | Nom (lien vers la fiche), puis e-mail en `caption` |
  | Formations suivies | Pastilles prune pâle ; au-delà de 2, « +n » |
  | Progression | Barre et pourcentage moyen (`aria-label`) |
  | Score au quiz | Meilleur score, ou « — » |
  | Dernière activité | Relative (« il y a 12 j »), date exacte en infobulle |
  | Statut | Badge avec texte et icône |
  | Actions | Menu ⋯ |

- **Statuts**, toujours avec texte et icône, jamais en framboise :
  - **Terminé** (`Award`, pilule vert DSI) : toutes les formations suivies sont validées ;
  - **En cours** (`Clock`, info-soft) : activité depuis moins de 7 jours ;
  - **À relancer** (`BellRing`, fond warning-soft, bord orange) : aucune activité depuis 7 jours ou plus, et formation non terminée.
- **Sélection** : un bandeau prune pâle « n apprenants sélectionnés » propose Relancer, Exporter et Désélectionner.
- « Relancer les n » est en tête de carte quand le filtre est « À relancer ». Au plus une relance par personne toutes les 72 h (F3 §1).
- Tri sur chaque colonne (`aria-sort`), pagination de 50 lignes. Sous 1 024 px, défilement horizontal.
- Menu ⋯ : Voir la fiche, Relancer par e-mail, Accorder une tentative, Retirer l'accès.

## 4. Fiche d'un apprenant (L13-02)

- **Tiroir à droite** (520 px, `role="dialog"`, focus initial sur le titre, Échap pour fermer, retour du focus sur la ligne).
- **En-tête** : avatar, nom, e-mail, structure, date d'invitation ou d'identification, badge de statut avec la durée d'inactivité.
- **Structure** : liste déroulante sous l'en-tête, pour rattacher l'apprenant à la main.
- **Formations suivies** : une ligne par formation, avec le module courant, la barre et le badge.
- **Quiz** : par formation, état (« pas encore tenté », meilleur score, tentatives utilisées sur le maximum). Le détail des réponses par tentative se déplie.
- **Activité** : frise chronologique (étapes vues, relances, formations terminées, invitation acceptée).
- **Pied** : Relancer par e-mail (primaire), Accorder une tentative, Exporter ses données (droit d'accès), et à droite « Supprimer ses données » en lien danger.

## 5. Vue par formation (L13-03)

- **Cartes de formation** en grille de 3 : nom, nombre de modules, quiz, nombre d'apprenants. Une barre empilée montre la répartition Terminé / En cours / À relancer (vert, bleu, orange DSI), avec la légende écrite. La carte choisie a un contour prune.
- **KPI** de la formation : Terminé (héro), En cours (actifs 7 j), Réussite au quiz (et au premier essai), À relancer (lien vers la liste filtrée). La « Durée médiane » de la maquette reviendra quand la durée sera réellement mesurée : on n'affiche pas de valeur inventée.
- **Avancement par module** : une barre par module, une couleur DSI par module (règle D13), avec la valeur écrite (« 85 % · 121 sur 142 »). Une phrase signale le plus gros décrochage. Un clic sur un module ouvre la liste filtrée.
- « Exporter cette formation » ouvre l'export, pré-réglé sur la formation.

## 6. Export CSV (L13-04)

- Modale : lignes à exporter (Apprenants filtrés, Sélection, Tous ; ouverte depuis une formation ou une fiche, l'option « Cette formation » ou « Cet apprenant » s'ajoute et se coche), puis colonnes à cocher (identité, formations et statut, quiz, détail par module).
- Fichier UTF-8, séparateur point-virgule, compatible Excel.
- L'aide rappelle qu'il s'agit de données personnelles à stocker dans un espace protégé.
- Le bouton est compté (« Exporter 21 lignes »). L'export est tracé dans le journal du workspace.

## 7. Suppression RGPD (L13-05)

- Ouverte depuis la fiche. `alertdialog` qui liste ce qui est supprimé (progression, historique, réponses aux quiz, accès personnel, invitations).
- Il précise ce qui reste : les statistiques agrégées, sans données nominatives.
- La confirmation se fait en saisissant l'e-mail de l'apprenant. « Supprimer définitivement » reste désactivé tant que la saisie ne correspond pas.
- L'action est définitive et tracée (qui, quand, pour qui, sans conserver l'e-mail en clair).
- Accès réservé aux rôles propriétaire et admin.

## 8. Reprise « Bon retour » (L13-06)

Elle s'affiche dans le lecteur quand l'apprenant, identifié par son lien personnalisé, revient sur un module commencé et non validé.

- **Cadre** : celui du lecteur validé pour les écrans système (L11 : en-tête avec workspace et titre, capture voilée, carte centrée, feuille du bas sur mobile).
- **Carte** :
  - badge « Parcours en cours » (`Clock`, bleu pâle) ;
  - titre « Bon retour, {{prénom}} », qui reçoit le focus ;
  - phrase « Vous vous étiez arrêté à l'étape n sur N du module « … ». » ;
  - barre segmentée, une case par étape, en prune pour les étapes vues (`role="img"` et `aria-label` « Étape n sur N ») ;
  - si la formation a plusieurs modules, la liste des modules : Validé (`CircleCheck`, vert), en cours (`Play`, prune, fond prune pâle, « n / N »), verrouillé (`Lock`, « Après le module n ») ou « Pas commencé ».
- **Actions** : « Recommencer le module » (secondaire) et « Reprendre à l'étape n » (primaire, flèche). Elles passent l'une sous l'autre quand la place manque.
- Sans prénom, ou pour un module non commencé ou déjà validé, la carte n'apparaît pas et la démo démarre normalement.
- Les démos en brouillon ou supprimées ne figurent jamais dans la liste des modules.

## 9. Formations et structures (L13-07)

Modale large (880 px) ouverte par « Gérer les formations ». Titre « Formations et structures ». Deux onglets (`tablist`) : Formations et Structures. Pied : « Terminé » (primaire) ; à gauche, sur l'onglet Formations, « Supprimer la formation » en lien danger, avec confirmation.

**Onglet Formations** (maître-détail) :
- **À gauche**, la liste des formations en cartes (nom ; modules, quiz et apprenants). La carte choisie a un contour prune et le fond prune pâle. En dessous, un champ « Nom de la nouvelle formation » et le bouton « Créer une formation » (icône plus).
- **À droite**, dans un bloc `surface-sunken` :
  - champ « Nom » ;
  - champ « Description » (facultatif, 600 caractères) : intro de la page de la formation dans le centre (L14-05) et prise en compte par la recherche ;
  - interrupteur « Modules à suivre dans l'ordre », avec l'aide « Un module s'ouvre quand le précédent est validé » ;
  - liste ordonnée des modules : numéro en pastille prune, titre de la démo et méta (étapes, quiz et seuil), case « Obligatoire », puis Monter, Descendre et Retirer. Monter est désactivé sur le premier module, Descendre sur le dernier. Chaque bouton a un nom accessible qui cite le module ;
  - « Choisir une démo… » et « Ajouter un module » ;
  - l'aide sur la validation : un module sans quiz est validé à la dernière étape, un module avec quiz quand le quiz est réussi.
- Les modifications s'enregistrent aussitôt, et un toast confirme.

**Onglet Structures** :
- Une aide en tête : les structures regroupent les apprenants, et le rattachement se fait automatiquement par le domaine de l'e-mail.
- Une rangée par structure : nom et nombre d'apprenants ; champ à pastilles des domaines (`@domaine` en mono, retrait par pastille, ajout par Entrée ou virgule) ; bouton Supprimer (corbeille, danger, avec confirmation).
- Une rangée en pointillés pour « Nom de la nouvelle structure » et « Ajouter ».
- Les messageries grand public sont refusées, comme en L11. Un apprenant sans domaine connu reste « Sans structure » jusqu'à son rattachement depuis sa fiche.

**Droits** : propriétaire et admin. Les autres rôles ne voient pas le bouton.

## 10. Règles

- Données fictives uniquement (`*.example`). Icônes Lucide, aucun caractère utilisé comme icône.
- Le cadre et les composants sont ceux déjà validés (F3 : `st-badge`, `lp`, `fchip`, `kpis`). Contraste ≥ 4,5:1 sur tous les badges, en clair et en sombre.
- Les visiteurs anonymes ne sont jamais comptés comme apprenants.
