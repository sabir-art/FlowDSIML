# Spec A4 : analytics avancées

> Lot A4 de la parité (Analyze) : temps réel, sessions, appareils, segments et filtres, visiteurs récurrents, alertes, résultats des sondages et des tests A/B. Le lot est **relié au suivi des apprenants (F3)** : une session d'un apprenant identifié mène à sa fiche, et les segments peuvent porter sur les critères de formation.
>
> Maquette : `docs/ux/maquettes/refonte/analytics-avance.html`, avec `?view=live|sessions|devices|surveys|segments|alerts` et `&theme=dark`.
> Microcopie FR/EN (118 clés) : `analytics.advanced.*`.
> Base : `refonte.md` §4 (analytics), §15.7 (overlays). Les données personnelles suivent F3 §4.

## 0. Structure de la page « Analytics » d'une démo

- **En-tête** : bouton retour, titre de la démo, « Analytics · publiée, version n ». À droite : « Alertes · n » (`Bell`, ouvre l'onglet Alertes) et « Exporter » (CSV de la vue courante).
- **Onglets** (`.fd-tabs`, gardés dans `?tab=`) : Vue d'ensemble (existant), Temps réel, Sessions, Appareils, Sondages et tests, Segments.
- **Barre de filtres**, commune à tous les onglets sauf Temps réel :
  - période en segmenté (7 j, 30 j, 90 j, Dates avec `Calendar`, sélecteur de dates en portail) ;
  - filtres actifs en **puces** « Critère : **valeur** » avec un bouton × (`aria-label` « Retirer le filtre … ») ;
  - « Ajouter un filtre », qui ouvre un popover en portail avec les critères de §5 ;
  - « Enregistrer comme segment » ;
  - à droite, les segments enregistrés en liens.

  Les filtres sont gardés dans l'URL, ce qui permet de partager une vue.

## 1. Temps réel

- **4 KPI** :
  - Visiteurs en ce moment (carte héro, avec un point « en direct » qui pulse ; immobile avec `prefers-reduced-motion` ; sur la carte héro, le point est noir) ;
  - Vues des 30 dernières minutes ;
  - Clics CTA du jour ;
  - Leads du jour.
- **Liste « Visiteurs actifs »** : avatar (initiales ou « V1 »…), identité (e-mail si apprenant ou lead identifié, sinon « Visiteur anonyme »), ville approximative, appareil, source, mini-progression par étape (étapes vues en orange, étape courante en noir) + « Étape n · titre », « depuis … ».
- Données via **Supabase Realtime Presence** sur le canal de la démo, rafraîchies au plus toutes les 10 s. « Mettre en pause » fige la liste. La liste a `aria-live="off"` pour ne pas spammer le lecteur d'écran ; les KPI sont annoncés seulement s'ils changent et au plus une fois par minute.
- **État vide** : `live.empty`.

## 2. Sessions

- **Tableau** :
  - colonnes : Visiteur, Début, Durée, Progression (barres par étape avec `aria-label` « n étapes sur N »), Issue (badge : Lead + CTA, Abandon étape n, Terminée) ;
  - tri, pagination de 50, export CSV.
- **Détail de la session sélectionnée** (colonne de droite ; tiroir sous 1 100 px) :
  - en-tête : identité, appareil, navigateur, ville, source ;
  - **timeline** verticale : ouverture, étapes, formulaire, choix, clic CTA, avec le temps relatif. Puces d'icônes : CTA en vert héro, lead en prune ;
  - si le visiteur est un **apprenant identifié** : bouton « Voir dans le suivi des apprenants » (F3, fiche de la personne), plus « Visite n° n · visiteur récurrent ».
- Pas de replay vidéo de la session : la timeline suffit et respecte la vie privée.

## 3. Appareils

- **3 cartes à barres horizontales** (libellé, barre, pourcentage écrit) : Appareils (avec le taux de complétion par type), Navigateurs, Villes (top 3 + Autres).
- **Visiteurs récurrents** : pourcentage, avec la définition : même navigateur revenu après 30 min, ou apprenant identifié déjà venu.
- **Vie privée** : la ville et le pays sont déduits à la volée (en-tête de géolocalisation du CDN ou base GeoLite côté Edge Function). **L'adresse IP n'est jamais stockée** (`geoHelp`). Une ville avec moins de 5 visites est regroupée dans « Autres ».

## 4. Sondages et tests (résultats de A2 §4–6)

- **Recommandation (NPS)** : score de −100 à +100 écrit en grand avec sa définition, histogramme de 0 à 10 (barres 0–6 en piste pâle, 7–10 en orange), tableau de valeurs masqué pour les lecteurs d'écran. Lien vers les réponses libres.
- **Note, choix unique ou multiple** : barres horizontales comme dans §3.
- **Menu de choix** : répartition des choix, puis complétion après chaque choix.
- **Test A/B** :
  - 2 cartes (Variante A ou B, nombre de visiteurs, valeur de l'objectif) ; la meilleure variante a une bordure de 2 px de sa couleur ;
  - la phrase prudente d'A2 §6, et le badge « En cours · J+n ».

## 5. Segments et filtres

- **Onglet Segments** : constructeur à gauche, aide et segments enregistrés à droite.
- **Constructeur** :
  - nom du segment ;
  - conditions : une ligne `surface-sunken` par condition, avec le connecteur « Si / et / ou » en prune, puis 3 selects (critère, opérateur, valeur) et un bouton ×. Sous 1 100 px, les selects s'empilent ;
  - « Ajouter une condition », et un segmenté « Toutes (ET) / Au moins une (OU) » (pas d'imbrication dans cette version) ;
  - compteur en direct « n visiteurs correspondent » (badge, `aria-live="polite"`, mis à jour au plus toutes les 500 ms) ;
  - « Annuler » et « Enregistrer le segment ».
- **Critères** :

  | Groupe | Critères |
  |---|---|
  | Visite | Source, lien personnalisé, variable d'URL, date, nouveau ou récurrent |
  | Appareil | Type, navigateur, système, langue, pays et ville (approximatifs) |
  | Parcours | Étape atteinte, dernière étape vue, choix fait, durée, démo terminée |
  | Actions | Clic CTA, lead envoyé, réponse à un sondage, variante A/B |
  | Formation | Structure, équipe, statut du module, score au quiz. **Apprenants identifiés seulement**, et visible seulement des rôles qui voient le suivi nominatif (F3 §4) |

- **Opérateurs** selon le type : est / n'est pas / est l'une de (listes), avant / après / égal (étapes et dates), plus de / moins de (nombres), contient (texte).
- Les **segments enregistrés** sont partagés dans le workspace, utilisables sur toutes les démos, dans les alertes (§6) et les exports. Menu ⋯ : renommer, dupliquer, supprimer.
- Un segment de moins de 5 visiteurs affiche les chiffres agrégés, mais pas de liste nominative ni de détail de ville.

## 6. Alertes

- **Liste** : une ligne par alerte (puce d'icône, déclencheur, canal et fréquence en `caption`, badge Active / En pause, interrupteur). « Nouvelle alerte » en primaire.
- **Formulaire** :
  - **Quand** : nouveau lead, clic CTA, lien personnalisé ouvert, taux de complétion sous un seuil, vues au-dessus d'un seuil, **apprenant qui échoue au quiz à sa dernière tentative** (F2), **structure sous l'objectif de formation** (F3) ;
  - seuil, si le déclencheur en a un ; segment optionnel ;
  - **Prévenir par** : dans l'app (centre de notifications, A6), e-mail, Slack et webhook (configurés dans A5 ; si rien n'est configuré, lien « Configurer dans Intégrations ») ;
  - **Fréquence** : immédiate, résumé quotidien (9 h) ou hebdomadaire (lundi 9 h).
- **Anti-bruit** : au maximum 1 alerte immédiate du même type toutes les 10 minutes par démo. Au-delà, elles sont regroupées (« 5 nouveaux leads »).

## 7. Accessibilité

- Chaque graphique a un équivalent texte : valeurs écrites, tableau masqué pour les lecteurs d'écran ou `aria-label` de synthèse. Pas d'information portée par la couleur seule ; l'orange n'est jamais utilisé pour du texte.
- Puces de filtres et segments utilisables au clavier, et chaque bouton × est nommé.
- Les popovers (filtre, dates, menu ⋯) sont en portail (§15.7).

## 8. Recette prévue

- **Temps réel** : 2 navigateurs sur la démo, apparition et départ dans la liste.
- **Sessions** : timeline complète, lien vers F3.
- **Segments** : ET et OU, compteur, réutilisation dans une alerte.
- **Alertes** : déclenchement immédiat, regroupement anti-bruit, résumé quotidien.
- **Vie privée** : aucune adresse IP stockée, ville regroupée sous 5 visites.
- Contrôles communs : 1 440, 1 024 et 390 px, en clair et en sombre.
