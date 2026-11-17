# Décisions projet FlowDSIML

Arbitrages du chef d'équipe, après le feu vert du client (« lancez-vous, développez tout de A à Z »).
Quand le client n'a pas tranché, la valeur ci-dessous est un **choix par défaut** : elle reste révisable.

| # | Sujet | Décision |
|---|---|---|
| D1 | Stack | **GitHub + Supabase uniquement** (projet `ffzlhlxfratcbitkuvli`, eu-west-1). Front en SPA Vite, hébergée sur GitHub Pages ; Supabase pour la DB, Auth, Storage et les Edge Functions. |
| D2 | Nom du produit | **FlowDSIML** (provisoire). |
| D3 | Cible | **Révisé le 17/11 (client)** : priorité à la **FORMATION à un outil**, c'est-à-dire des tutoriels interactifs pour former les conseillers et équipes des Missions Locales aux outils du **SI partagé de France Travail**, dans le cadre du **projet Convergence** (accompagnement au changement). Ordre : F1 parcours guidés → F2 quiz → F3 suivi des apprenants → F4 centre de formation → F5 exports (PDF, vidéo, hors ligne) → F6 diffusion → F7 capture vidéo et mobile. Les usages marketing et sales restent couverts. |
| D4 | Capture MVP | **Screenshots + métadonnées** (extension Chrome MV3). Le modèle de données reste prêt pour la capture HTML en V2. |
| D5 | Langues | Interface **FR + EN** (i18n dès le départ), FR par défaut. |
| D6 | Paiement | Plans et limites **modélisés en base**. L'intégration Stripe est repoussée (hors stack actuelle). |
| D7 | Emails | SMTP intégré de Supabase en dev. Un SMTP perso sera nécessaire avant la bêta. |
| D8 | Rôles | Workspace : `owner`, `admin`, `editor`, `viewer`. |
| D9 | Domaine | GitHub Pages par défaut. Un domaine perso est requis avant la bêta, pour isoler le player. |
| D10 | Charte | Charte officielle **DSI des Missions Locales** (docs/ux/brand-dsi/), style « dashboard moderne » validé par le client. |
| D12 | Contexte Convergence | Les captures du SI partagé peuvent contenir des **données personnelles de jeunes accompagnés** : floutage renforcé (détection automatique des champs nom, NIR, email, téléphone, adresse, date de naissance), partage **restreint par défaut** (domaine email / invitation), pas de lien public par défaut, mention RGPD. L'app ne reprend **jamais** le logo ni la marque France Travail. |
| D11 | Périmètre | Parité avec le tableau de tarifs Guideflow : voir docs/product/matrice-fonctionnalites.md (vagues A, B, C). |

## Organisation Git
- Branche d'intégration : `claude/dazzling-lamport-bu517g`, gérée par le chef d'équipe.
- Chaque membre travaille sur sa propre branche, créée à partir de la branche d'intégration, et le chef d'équipe fusionne.
- Le code applicatif appartient au développeur. Le design system (`packages/ui/src/tokens*`, `docs/ux/`) appartient à la Lead UX.
