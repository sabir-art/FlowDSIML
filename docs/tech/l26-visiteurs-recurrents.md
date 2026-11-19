# L26-06 à 08 : visiteurs récurrents (implémentation)

Spec UX : `docs/ux/specs/l26-aide-modeles.md` §5 (branche de la Lead UX). Migration :
`supabase/migrations/20261120090000_visiteurs_recurrents.sql`, schéma validé par le chef d'équipe.

## Identifiant du visiteur (lecteur, `apps/player/src/visitor.ts`)

- Il est aléatoire et propre à l'espace. La clé est `fd.vid.<espace>`, ou `fd.vid.c.<centre>` pour un centre de formation, qui appartient à un seul espace.
- Il est daté et gardé **13 mois au plus**, puis renouvelé.
- Il ne contient aucune donnée personnelle, n'est jamais partagé avec un autre site, et ce n'est pas un cookie.
- **Refus** : « Ne pas mesurer mes visites » se trouve dans le bouton « Informations » du lecteur. Il supprime les identifiants et garde le drapeau `fd.nomeasure`. Ensuite, un identifiant propre à la session (onglet) est utilisé.
- **Global Privacy Control** : il est traité comme un refus. Rien n'est gardé, et le lecteur l'explique.
- **Mesure désactivée par l'espace** (`workspaces.visit_measure = false`) :
  - `open-demo` renvoie `visitMeasure: false` et le lecteur ne crée aucun identifiant ;
  - côté serveur, le trigger `events_visit_measure` remplace tout `visitor_id` reçu par `s:<session>`. Les identifiants existants sont donc ignorés, quel que soit le lecteur.
- **Intégration sur un autre site** : le navigateur cloisonne le stockage, donc un même visiteur est compté une fois par site.

## Calcul (base)

- **Clé du visiteur** : l'apprenant identifié (`learner_visitors`) s'il existe, sinon l'identifiant du lecteur.
- **Historique** : 13 mois au plus.
- **Nouvelle visite** : une session qui démarre plus de `visit_gap_minutes` (30 ou 1 440) après la fin de la précédente.
- **Récurrent** sur une période : au moins une session de la période porte un numéro de visite ≥ 2.
- **Lecture** (rôle viewer et plus) : trois RPC.
  - `workspace_returning` : agrégats seulement.
  - `session_visits` : numéros de visite des sessions affichées, 200 au plus, de l'espace demandé.
  - `live_visits` : temps réel.
- **Segment** : critère `returning` (est, booléen).
- **Réglage** : réservé aux propriétaires et administrateurs (RLS `ws_update` et grant de colonnes).

## Texte proposé pour la déclaration de confidentialité

> **Mesure des visites des démos.** Pour reconnaître les visiteurs qui reviennent sur une démo, le lecteur TutoClick garde dans votre navigateur un identifiant aléatoire, propre à l'espace qui publie la démo, pendant 13 mois au plus. Cet identifiant ne contient aucune donnée personnelle, n'est pas un cookie tiers et n'est jamais partagé avec un autre site. Vous pouvez refuser à tout moment avec « Ne pas mesurer mes visites », dans le bouton « Informations » du lecteur : l'identifiant est alors supprimé. Le signal Global Privacy Control de votre navigateur est respecté de la même façon. L'espace peut aussi désactiver cette mesure.

Ce texte est à reprendre dans la politique de confidentialité, à la charge du chef d'équipe et du juridique (page `/legal/privacy`, encore « en cours de rédaction » dans l'app). La conformité (exemption de consentement de la CNIL) reste **à faire valider par le DPO**.

## Article d'aide

La même information sera reprise dans l'aide intégrée (L26-02 et 03, articles Markdown livrés avec l'app), dans l'article « Visiteurs récurrents : comment c'est mesuré » :

- la durée de 13 mois ;
- l'identifiant propre à l'espace ;
- le refus dans le lecteur ;
- la prise en compte de GPC ;
- le réglage « Mesure des visites » ;
- le comptage par site dans une intégration.

En attendant, l'information figure dans la modale « Mesure des visites » et dans les informations du lecteur.
