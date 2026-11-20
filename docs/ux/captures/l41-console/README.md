# Console propriétaire (L41) : parcours complet

Maquette cliquable : `docs/ux/maquettes/refonte/l41-console.html`. Une barre en bas de page permet de passer d'une étape à l'autre, d'activer le mode « Lecture seule » et de basculer en sombre. Adresse directe d'une étape : `?step=N`, et `&theme=dark` pour le thème sombre.
Toutes les données sont fictives : comptes `@tutoclick.example`, espaces « Acme Formation », « Mission Locale Exemple » et « Globex », tickets sur un dépôt d'exemple.
Captures en 1 440 × 900 (densité 2) ; chaque capture existe aussi en sombre (`-dark`).

| # | Capture | Ce que l'on voit |
|---|---|---|
| 1 | `01-connexion.png` | Connexion d'une propriétaire TutoClick. C'est l'écran de connexion habituel : il n'y a pas d'accès séparé. |
| 2 | `02-menu-du-compte.png` | Menu du compte : l'entrée « Console propriétaire » apparaît dans un groupe « Équipe TutoClick », visible des propriétaires seulement. Les clients voient « Nouveautés ». |
| 3 | `03-vue-d-ensemble.png` | Onglet Vue d'ensemble : 4 chiffres (satisfaction, réponses, commentaires nouveaux, éléments à trier), 3 articles à surveiller, activité de l'équipe. |
| 4 | `04-retours.png` | Onglet Retours : commentaires anonymes de tous les espaces, avec « Créer un élément », « Rattacher à… » et « Classer sans suite ». |
| 5 | `05-creer-un-element.png` | Un commentaire devient un élément du backlog (titre, priorité, article lié, ticket GitHub facultatif). |
| 6 | `06-rattacher-a.png` | Un second commentaire sur le même sujet rejoint l'élément avec « Rattacher à… ». |
| 7 | `07-backlog.png` | Onglet Backlog en colonnes À trier, Planifié, En cours et Fait. L'élément compte « 2 retours ». Les éléments rejetés sont à part. |
| 8 | `08-fiche-passage-a-fait.png` | Fiche de l'élément : statut, priorité, article, ticket GitHub (lien seulement), note interne, retours regroupés, historique. L'élément passe à Fait. |
| 9 | `09-annoncer.png` | Au passage à Fait : « Annoncer cette amélioration ? ». |
| 10 | `10-nouveautes.png` | Onglet Nouveautés : l'annonce publiée, liée à l'élément, avec un lien vers l'article d'aide. |
| 11 | `11-equipe-et-journal.png` | Onglet Équipe et journal : comptes propriétaires (rôles Admin et Lecture seule), et journal d'audit qui trace chaque action du parcours. |
| 12 | `12-client-point-de-nouveaute.png` | Côté client : un point sur l'avatar et sur « Nouveautés » dans le menu du compte. |
| 13 | `13-client-page-nouveautes.png` | Côté client : la page Nouveautés ; le point disparaît une fois la page ouverte. |
