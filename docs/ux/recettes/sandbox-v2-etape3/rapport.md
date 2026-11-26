# Recette réelle UX : Sandbox v2, étape 3 (capture vivante de bout en bout)

**Banc** : branche `claude/dev-mvp` à 7ab43e0. Montage complet :
- l'extension construite (`WXT_E2E=1`) et chargée dans Chromium ;
- le faux Supabase de l'extension ;
- le banc (8 sites d'essai, données fictives) ;
- l'app et le lecteur en serveurs de développement (5173 et 5174).

## Verdict : VERT

### 1. Bout en bout : capture, app, aperçu du lecteur

`bout-en-bout-v2.cjs` passe à **32/32**, avec **89,3 %** des gestes réussis et **0 sortie**.

Pour chacun des 8 sites :
- la capture en Sandbox envoie toutes les pages vivantes ;
- le réglage « Sandbox vivant » est activé dans l'éditeur ;
- le parcours du visiteur est joué dans le vrai lecteur ;
- aucune requête de la page ne sort ;
- l'app ne lève aucune erreur.

| Ce qui a été parcouru | Résultat |
| --- | --- |
| **Formulaire** | L'envoi sans nom affiche l'erreur. L'envoi reçoit un succès fictif et la page avance. Au retour, le formulaire est vide. |
| **Filtre** (liste chargée par fetch) | La liste complète s'affiche, le filtre « crm » marche, et vider le filtre aussi. |
| **Panier** (localStorage) | Vide, puis Ajouter, Ajouter encore, Vider. |
| **Onglets** | Tarifs et Avis marchent. |
| **Application à page unique, menu au survol, tableau de bord** | Tout se parcourt comme le vrai site. |

Les 3 gestes manqués portent sur du contenu jamais capturé : la page Contact, le filtre « zzz » et l'onglet Résumé, resté sur « Chargement… ». Ils relèvent de l'étape 4 (pages liées).

Captures : `apercu-6-sites.png`.

### 2. Scripts bloqués puis rétablis (contrôle fait par moi)

Sur le site « Mesure d'audience et widget de tiers », j'ai fait deux captures.

| Capture | Scripts | Aperçu | Sorties | Gestes |
| --- | --- | --- | --- | --- |
| Par défaut | chat.js et analytics.js **bloqués** | le widget « Discuter avec nous » est **absent** | 0 | 3/3 |
| « Garder » sur chat.js (pages 1 et 2) dans l'écran de vérification | chat.js passe à **Rejoué** | le widget « Discuter avec nous » **apparaît** | 0 | 3/3 |

Dans le second cas, analytics.js reste bloqué. Dans les deux cas, aucune requête ne sort et aucune erreur n'apparaît.

Captures : `tiers-chat-bloque.png`, `verification-chat-garde.png`, `tiers-chat-garde.png`.

### 3. Lecteur publié, réglage de l'éditeur, Sécurité

Tous les e2e passent, en clair comme en sombre :

| e2e | Résultat | Ce qu'il vérifie |
| --- | --- | --- |
| `player-sandbox-vivant` | 11/11 | Lecteur publié en mode vivant : CSP `connect-src 'none'`, scripts par empreintes, script bloqué non exécuté, formulaire avec succès fictif, repli inerte si l'enregistrement est illisible, aucune requête vers l'extérieur. |
| `sandbox-vivant-reglages` | 8/8 | Réglage « Sandbox vivant » de l'éditeur, aperçu vivant ; Paramètres › Sécurité › « Autoriser le Sandbox vivant » : l'admin interdit, puis le réglage de la démo est désactivé avec sa raison. |
| `html-player` | 34/34 | Non-régression. |
| `html-sandbox` | 25/25 | Non-régression. |

Captures : `editeur-securite-lecteur.png`, `securite-clair.png`.

### Limite du banc

Le lecteur publié est vérifié par l'e2e `player-sandbox-vivant`, sur un manifeste préparé. La capture réelle, elle, est rejouée dans l'aperçu du lecteur, qui fait tourner le même lecteur. Une publication réelle de bout en bout, à travers le vrai serveur, sera à refaire sur l'environnement en ligne.

## Écarts notés, sans ROUGE

1. **Écran « Vérifier avant l'envoi » en mode vivant** : la planche UX (0a0c403) n'est pas encore intégrée. On y lit toujours « copie fixe », « Scripts non copiés » et le groupe « Scripts de la page — Non copiés ». C'est attendu.
2. **Lecteur et aperçu d'une page vivante** : le bouton « Zones cliquables 0 » reste affiché, alors que la page réagit elle-même ; il laisse croire qu'il n'y a rien à cliquer. Je propose de le masquer quand la page est vivante.
3. **Éditeur, Réglages du sandbox** : « Clic sur un élément non relié » reste proposé alors que l'encart n'apparaît plus sur une page vivante (5edc7db). Je propose de le griser quand « Sandbox vivant » est activé, avec l'aide « Sans effet sur une page vivante : elle réagit elle-même. ».

Demandes concernées : Sandbox v2 · capture vivante dans l'extension · réglage « Sandbox vivant » de la démo · aperçu et lecteur publié en mode vivant · scripts d'autres sites bloqués puis rétablis · aucune sortie réseau · garde-fou admin Paramètres › Sécurité · écran « Vérifier avant l'envoi » en mode vivant (non intégré, noté).
