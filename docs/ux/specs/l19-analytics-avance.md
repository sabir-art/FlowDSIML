# L19 : analytics avancées (temps réel, sondages et tests, segments, alertes)

> **Maquette** : `reference/analytics-avance.html`, dérivée de `analytics.html` (ANA, conforme).
> États par `?etat=` : `live` · `live-vide` · `tests` · `segments` · `alertes` · `alerte-nouvelle`.
>
> **Base** : `specs/a4-analytics.md`. Cette spec en reprend les règles et précise les écarts.
>
> **Déjà couvert** :
> - Sessions : A4-03, par ANA-07 ;
> - Appareils : A4-04, par ANA-05.
>
> **Données** : fictives (Acme, `.example`). Seuls des apprenants ou des leads identifiés apparaissent avec leur e-mail.

## 1. Structure

- Les quatre nouveaux onglets s'ajoutent après Vue d'ensemble, Sessions et Leads :
  - **Temps réel** : le point vert placé avant le libellé est décoratif (`aria-hidden`) ;
  - **Sondages et tests** ;
  - **Segments** ;
  - **Alertes**, avec un compteur des alertes actives.
- L'onglet ouvert est gardé dans l'URL (`?tab=`).
- Les filtres du haut (démo, source, période) s'appliquent à tous les onglets, sauf Temps réel (toujours en direct) et Alertes.
- **Écart avec A4 §0** : il n'y a pas de page d'analytics par démo avec un en-tête propre. Le choix de la démo passe par le select existant. Une alerte ou un segment porte sur une démo ou sur toutes.

## 2. États et codes

| Code | État | `?etat=` | Remplace |
|---|---|---|---|
| L19-01 | Temps réel | `live` | A4-02 |
| L19-02 | Temps réel, personne en ce moment | `live-vide` | A4-02 |
| L19-03 | Sondages et tests (A/B, recommandation, menu de choix) | `tests` | A4-05 |
| L19-04 | Segments : filtres actifs, constructeur, segments enregistrés | `segments` | A4-06 |
| L19-05 | Alertes : liste | `alertes` | A4-01 |
| L19-06 | Modale « Nouvelle alerte » | `alerte-nouvelle` | A4-01 |

## 3. Temps réel (L19-01, L19-02)

- **Démo** :
  - le temps réel porte sur **une démo** à la fois ;
  - avec « Toutes les démos », la démo la plus vue du jour est choisie et nommée en tête (« Créer un rapport en 2 minutes · actualisé toutes les 10 s ») ;
  - un select permet d'en changer.
- **4 KPI** :
  - Visiteurs en ce moment : carte héro en couleur principale, avec un point qui pulse (immobile si les animations sont réduites) ;
  - Vues des 30 dernières minutes ;
  - Clics CTA aujourd'hui ;
  - Leads aujourd'hui.
- **« Visiteurs actifs »** : tableau des 20 visiteurs les plus récents, puis « n autres visiteurs anonymes ». Colonnes :
  - Visiteur : initiales, ou « V1 », « V2 »… ;
  - Lieu et appareil : ville approximative, ou « Autres » sous 5 visites ;
  - Source : badge ;
  - Progression : mini-barre par étape, avec `aria-label` « n étapes vues sur N », puis « Étape n · titre » ;
  - Depuis.
- **Identité du visiteur** :
  - e-mail seulement pour un **apprenant identifié** (F3) ou un **lead** ;
  - sinon « Visiteur anonyme », avec « Nouveau » ou « Récurrent » ;
  - le nom des apprenants n'est visible que pour les rôles qui voient le suivi nominatif (F3 §4). Les autres voient « Apprenant identifié ».
- **Rafraîchissement** :
  - toutes les 10 s au plus (présence en temps réel) ;
  - « Mettre en pause » fige la liste (bouton à bascule, `aria-pressed`) ;
  - le tableau est en `aria-live="off"` ;
  - les KPI sont annoncés au plus une fois par minute, et seulement s'ils changent.
- **Vide (L19-02)** :
  - KPI à 0, sauf ceux de la journée ;
  - texte « Personne sur la démo en ce moment », puis « Les visiteurs apparaissent ici dès qu'ils ouvrent la démo, avec l'étape où ils en sont. »
- **Vie privée** :
  - l'adresse IP n'est jamais conservée ;
  - la phrase est rappelée sous le tableau.

## 4. Sondages et tests (L19-03)

- **Test A/B** : les mêmes cartes que l'éditeur (L18-02), en lecture seule, avec « Ouvrir dans l'éditeur ». Il y a une carte par test en cours ou terminé dans la période.
- **Recommandation** :
  - score de −100 à +100 en grand, suivi de sa définition écrite (« part des notes 9 et 10, moins part des notes 0 à 6 ») ;
  - histogramme de 0 à 10 : piste pâle de 0 à 6, orange de 7 à 10 ;
  - `role="img"` avec une synthèse, et un tableau de valeurs masqué pour les lecteurs d'écran ;
  - sous 20 réponses, le score n'est pas calculé. Le texte devient « n réponses : pas encore assez pour un score ».
- **Réponses écrites** : lien « Voir les n réponses écrites », qui ouvre un tiroir. Chaque réponse est affichée avec sa date, sans identité, sauf pour un apprenant identifié vu par un rôle qui y a droit.
- **Menu de choix** :
  - barres horizontales (libellé, barre, pourcentage écrit) ;
  - en dessous : « Complétion après le choix », pour chaque choix.
- **Vide** : « Aucun sondage, test ou menu de choix dans cette démo. »

## 5. Segments (L19-04)

- **Barre de filtres** (au-dessus du contenu, sur tous les onglets sauf Temps réel) :
  - puces « Critère : **valeur** », chacune avec un bouton × nommé « Retirer le filtre {{critère}} » ;
  - « Ajouter un filtre » ouvre un popover avec les critères d'A4 §5 ;
  - « Enregistrer comme segment » ouvre le constructeur prérempli.
- **Constructeur** :
  - nom (60 caractères) ;
  - « Toutes (ET) / Au moins une (OU) » ;
  - une ligne par condition : connecteur (« Si », « et », « ou »), critère, opérateur, valeur, et un bouton × nommé « Supprimer la condition n » ;
  - « Ajouter une condition », jusqu'à 8 conditions ;
  - compteur « n visiteurs correspondent » en `aria-live="polite"`, recalculé au plus toutes les 500 ms ;
  - « Annuler » et « Enregistrer le segment ».
- **Segments enregistrés** (colonne de droite) :
  - nom en lien, qui applique le segment, et effectif ;
  - menu ⋯ : Renommer, Dupliquer, Supprimer.
- **Règles d'A4 §5 conservées** :
  - critères de formation réservés aux apprenants identifiés et aux rôles autorisés ;
  - sous 5 visiteurs, seuls les chiffres agrégés s'affichent.

## 6. Alertes (L19-05, L19-06)

- **Liste (L19-05)** : une ligne par alerte, avec :
  - icône ;
  - déclencheur en gras ;
  - dessous : périmètre (démo ou segment), canaux, fréquence ;
  - badge « Active » ou « En pause » ;
  - interrupteur nommé « Activer l'alerte {{déclencheur}} » ;
  - un clic sur la ligne ouvre la modale en modification.
- **Vide** : « Aucune alerte. Créez-en une pour être prévenu d'un nouveau lead ou d'une baisse de complétion. »
- **Modale « Nouvelle alerte » (L19-06)** :
  - **Quand** : les 7 déclencheurs d'A4 §6 ;
  - **Seuil (%)** ou **Seuil (vues)** : seulement si le déclencheur en a un ;
  - **Démo** : une démo, ou « Toutes les démos » ;
  - **Segment** : facultatif ;
  - **Prévenir par** :
    - **Dans l'app** : cloche des notifications (L22) ;
    - **Webhook** : actif si un webhook du workspace est abonné à `alert.triggered` (L23). Le domaine du webhook est affiché. Sans webhook, l'option est grisée avec le lien « Configurer dans Intégrations » ;
    - **E-mail** et **Slack** : **« Bientôt »**, désactivés. **Écart avec A4 §6** : l'envoi d'e-mails n'est pas arbitré et Slack est en « Bientôt » (L23).
  - **Fréquence** : Immédiate, Résumé quotidien (9 h), Hebdomadaire (lundi 9 h) ;
  - aide anti-bruit : au plus une alerte immédiate du même type toutes les 10 minutes par démo. Au-delà, elles sont regroupées (« 5 nouveaux leads »).
- **Conséquence pour L23** : à la livraison de L19, l'événement `alert.triggered` passe de « Bientôt » à actif dans la création d'un webhook.

## 7. Accessibilité

- Chaque graphique a sa valeur écrite (barres, pourcentages) ou une synthèse en `aria-label`. L'orange n'est jamais utilisé pour du texte.
- Les puces, les conditions et les menus se pilotent au clavier, et chaque bouton × est nommé.
- Les popovers (filtre, dates) et les tiroirs sont rendus en portail.

## 8. Hors périmètre

- Replay vidéo des sessions.
- Envoi des alertes par e-mail ou Slack (« Bientôt »).
- Segments imbriqués (ET dans OU).
