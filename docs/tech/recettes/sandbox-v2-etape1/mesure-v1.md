# Sandbox v2, étape 1 : banc et mesure de la v1

Point de départ chiffré de la v2 (`docs/tech/sandbox-v2.md` §4 et §6, étape 1), mesuré le 26/11 sur
le banc local, avec l'extension construite sans la permission `debugger` (comme la version de la
boutique) et chargée dans Chromium. Données fictives uniquement.

## Comment c'est mesuré

`apps/extension/e2e/banc/mesure-sandbox.cjs`, pour chaque site d'essai de `e2e/banc/serveur.cjs` :

1. le parcours du visiteur est joué sur le **site vivant** : il doit réussir entièrement, sinon le banc
   lui-même est faux ;
2. l'auteur **capture** le site avec l'extension (mêmes gestes que `etat-html.cjs`) ; une photo du site
   est prise à chaque page capturée, sans l'interface de capture ;
3. chaque page copiée est **relue comme le lecteur** : document `buildSrcdoc` de `player-core` (même
   CSP, même script), iframe `sandbox="allow-scripts"`, liens automatiques « même adresse capturée →
   même page » ;
4. le même parcours est joué sur la reprise.

| Mesure | Calcul |
|---|---|
| Interaction | gestes du parcours dont le résultat attendu (texte présent ou absent, champ vide, bonne page) est obtenu sur la reprise |
| Visuel | part des pixels identiques entre la photo du site et la reprise de la même page (écart de couleur ≤ 48) |
| Réponses rejouées | `replayed / (replayed + unreplayed)` sur les GET `fetch` et XHR lus par la page vivante |
| Plan | pages capturées sur pages du même site liées depuis les pages capturées |
| Sorties | requêtes émises pendant la reprise ; un témoin volontaire vérifie que le détecteur les voit |

Commande : `node e2e/mock-supabase.cjs`, `node e2e/banc/serveur.cjs`, build `WXT_E2E=1`, puis
`RAPPORT=rapport.md node e2e/banc/mesure-sandbox.cjs` (rapport JSON sur la sortie standard).

## Résultats de la v1

| Site d’essai | Pages | Interaction | Visuel | Réponses rejouées | Plan | Sorties |
|---|---|---|---|---|---|---|
| Site de plusieurs pages statiques | 3 | 3/4 | 100 % | 0/0 | 3/4 | 0 |
| Application à page unique (routes, liste chargée) | 3 | 3/4 | 100 % | 0/1 | 3/4 | 0 |
| Liste chargée par fetch, avec filtre | 2 | 2/4 | 99.9 % | 0/3 | 1/1 | 0 |
| Formulaire avec validation et envoi POST | 2 | 0/3 | 100 % | 0/0 | 1/1 | 0 |
| Application qui dépend de localStorage | 2 | 2/4 | 100 % | 0/0 | 1/1 | 0 |
| Mesure d’audience et widget de tiers | 2 | 1/3 | 99.5 % | 0/0 | 1/1 | 0 |
| Onglets chargés en différé (L60) | 3 | 1/3 | 100 % | 0/3 | 1/1 | 0 |
| Menu ouvert au survol (L60) | 3 | 3/3 | 100 % | 0/0 | 2/3 | 0 |
| **Total** | 20 | **53.6 %** | **99.9 %** | **0 %** | **81.3 %** | **0** |

### Gestes

- **Site de plusieurs pages statiques** : ✓ Offres · ✓ Équipe · ✗ Contact (page non visitée) · ✓ Retour à l’accueil
- **Application à page unique (routes, liste chargée)** : ✓ Clients (liste chargée) · ✓ Fiche client · ✗ Ajouter une note · ✓ Retour à l’accueil
- **Liste chargée par fetch, avec filtre** : ✓ Liste complète · ✗ Filtre « crm » · ✗ Filtre sans résultat · ✓ Filtre vidé
- **Formulaire avec validation et envoi POST** : ✗ Envoi sans nom : erreur · ✗ Envoi : la page avance · ✗ Retour : formulaire vide
- **Application qui dépend de localStorage** : ✓ Panier vide · ✗ Ajouter · ✗ Ajouter encore · ✓ Vider
- **Mesure d’audience et widget de tiers** : ✓ Tableau de bord · ✗ Ajouter une vente · ✗ Ajouter encore
- **Onglets chargés en différé (L60)** : ✗ Onglet Tarifs · ✗ Onglet Avis · ✓ Onglet Résumé
- **Menu ouvert au survol (L60)** : ✓ Survol de Produits · ✓ Page Logiciels · ✓ Retour au catalogue

### Critères de l’étape 1 (100 %)

- ✓ Chaque site d’essai est servi
- ✓ Chaque parcours passe entièrement sur le site vivant
- ✓ Chaque site est capturé sans erreur et mesuré
- ✓ Aucune sortie réseau de la reprise (détecteur vérifié par un témoin)

## Lecture

- **Interaction 53,6 %** : la v1 ne réussit que la navigation entre pages capturées (liens
  automatiques) et ce que le CSS fait seul (menu au survol). Tout ce qui demande un script échoue :
  validation et envoi du formulaire, filtre, panier, compteur, onglets, bouton « Ajouter une note ».
  Le taux compte aussi les gestes dont le résultat est déjà l'état capturé (« Vider » un panier
  resté à 0, « Onglet Résumé ») : ils réussissent sur la reprise sans que rien ne s'y passe.
- **Visuel 99,9 %** : le rendu des pages copiées est fidèle ; les écarts restants viennent surtout
  des scripts de tiers retirés (fenêtre de discussion, 99,5 % sur ce site).
- **Réponses rejouées 0 %** : la v1 ne garde aucune réponse réseau (7 GET lus sur le banc).
- **Plan 81,3 %** : la page Contact du site statique, le second client de l'application et la page
  Services du catalogue sont liés mais jamais visités pendant la capture.
- **Sorties 0** : aucune requête ne quitte la reprise.

Objectif de la première livraison v2 (note §4) : 90 % d'interaction sur ce banc, sorties toujours à 0.
