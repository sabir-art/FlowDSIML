# Sandbox v2, étape 3d : de bout en bout (capture → app → lecteur)

Vérifié le 26/11 à la place de l'utilisateur, avec :
- l'extension construite et chargée ;
- les 8 sites d'essai du banc (données fictives) ;
- l'app et le lecteur en serveurs de développement.

Script : `apps/extension/e2e/banc/bout-en-bout-v2.cjs`. Pour chaque site :

1. capture en mode Sandbox, écran « Vérifier avant l'envoi », envoi ;
2. ouverture dans la vraie app avec exactement ce que l'extension a envoyé (copies inertes,
   enregistrements vivants, étapes, réglages) ;
3. éditeur : réglage « Sandbox vivant » activé ;
4. aperçu : le parcours du visiteur est joué dans le vrai lecteur (navigation, scripts, réponses).

## Résultat

| Site d’essai | Gestes réussis dans l’aperçu du lecteur |
|---|---|
| Site de plusieurs pages statiques | 3/4 |
| Application à page unique (routes, liste chargée) | 4/4 |
| Liste chargée par fetch, avec filtre | 3/4 |
| Formulaire avec validation et envoi POST | 3/3 |
| Application qui dépend de localStorage | 4/4 |
| Mesure d’audience et widget de tiers | 3/3 |
| Onglets chargés en différé (L60) | 2/3 |
| Menu ouvert au survol (L60) | 3/3 |
| **Total** | **89.3 %** |

- **Site de plusieurs pages statiques** : ✓ Offres · ✓ Équipe · ✗ Contact (page non visitée) · ✓ Retour à l’accueil
- **Application à page unique (routes, liste chargée)** : ✓ Clients (liste chargée) · ✓ Fiche client · ✓ Ajouter une note · ✓ Retour à l’accueil
- **Liste chargée par fetch, avec filtre** : ✓ Liste complète · ✓ Filtre « crm » · ✗ Filtre sans résultat · ✓ Filtre vidé
- **Formulaire avec validation et envoi POST** : ✓ Envoi sans nom : erreur · ✓ Envoi : la page avance · ✓ Retour : formulaire vide
- **Application qui dépend de localStorage** : ✓ Panier vide · ✓ Ajouter · ✓ Ajouter encore · ✓ Vider
- **Mesure d’audience et widget de tiers** : ✓ Tableau de bord · ✓ Ajouter une vente · ✓ Ajouter encore
- **Onglets chargés en différé (L60)** : ✓ Onglet Tarifs · ✓ Onglet Avis · ✗ Onglet Résumé
- **Menu ouvert au survol (L60)** : ✓ Survol de Produits · ✓ Page Logiciels · ✓ Retour au catalogue

Contrôles : 32/32 réussis.

Fidélité d'interaction :

| Étape | Interaction |
|---|---|
| Copie inerte (v1) | 53,6 % |
| Lecture v2 sur pages préparées (étape 2) | 89,3 % |
| Capture v2, relecture directe (étape 3b) | 89,3 % |
| **De bout en bout, dans le vrai lecteur (étape 3d)** | **89,3 %** |

Les 3 gestes manqués portent sur du contenu que l'auteur n'a pas capturé : la page Contact jamais
visitée, le filtre « zzz » jamais tapé, l'onglet Résumé jamais rechargé. C'est le travail de
l'étape 4 (pages liées). Aucune requête de la page ne sort du lecteur, sur les 8 sites.

## Corrigé pendant cette recette

1. **Clic capturé devenu lien.** En v1, le clic capturé entre deux pages devient un lien vers la page
   suivante. Sur une page vivante, ce lien prenait le pas sur le comportement de la page : « Ajouter
   au panier » menait à la page 2 au lieu d'ajouter. Désormais, quand l'enregistrement vivant est
   accepté, ce lien n'est pas créé : la page réagit elle-même, et ses vrais liens mènent aux pages
   capturées. Sans enregistrement, rien ne change.
2. **Encart « Aucune zone cliquable » dans l'aperçu.** Il recouvrait la page vivante, alors que
   celle-ci réagit elle-même. Il n'est plus affiché pour une page vivante.

Non-régression : html-player 34, player-sandbox-vivant 11, html-sandbox 25,
sandbox-vivant-reglages 8.

Captures (aperçu du lecteur, dernier geste de chaque site) : `v2-<site>-apercu.png`, produites par le
script avec `SHOTS_DIR`.
