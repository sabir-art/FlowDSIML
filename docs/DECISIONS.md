# Décisions projet FlowDSIML

Arbitrages du chef d'équipe, après le feu vert du client (« lancez-vous, développez tout de A à Z »).
Quand le client n'a pas tranché, la valeur ci-dessous est un **choix par défaut** : elle reste révisable.

| # | Sujet | Décision |
|---|---|---|
| D1 | Stack | **GitHub + Supabase uniquement** (projet `ffzlhlxfratcbitkuvli`, eu-west-1). Front en SPA Vite, hébergée sur GitHub Pages ; Supabase pour la DB, Auth, Storage et les Edge Functions. |
| D2 | Nom du produit | **FlowDSIML** (provisoire). |
| D3 | Cible MVP | Équipes **marketing et sales** : démos interactives pour landing pages et prospects. La formation et le support viendront ensuite. |
| D4 | Capture MVP | **Screenshots + métadonnées** (extension Chrome MV3). Le modèle de données reste prêt pour la capture HTML en V2. |
| D5 | Langues | Interface **FR + EN** (i18n dès le départ), FR par défaut. |
| D6 | Paiement | Plans et limites **modélisés en base**. L'intégration Stripe est repoussée (hors stack actuelle). |
| D7 | Emails | SMTP intégré de Supabase en dev. Un SMTP perso sera nécessaire avant la bêta. |
| D8 | Rôles | Workspace : `owner`, `admin`, `editor`, `viewer`. |
| D9 | Domaine | GitHub Pages par défaut. Un domaine perso est requis avant la bêta, pour isoler le player. |

## Organisation Git
- Branche d'intégration : `claude/dazzling-lamport-bu517g`, gérée par le chef d'équipe.
- Chaque membre travaille sur sa propre branche, créée à partir de la branche d'intégration, et le chef d'équipe fusionne.
- Le code applicatif appartient au développeur. Le design system (`packages/ui/src/tokens*`, `docs/ux/`) appartient à la Lead UX.
