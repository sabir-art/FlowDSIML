# Sandbox v2, étape 3b : capture vivante dans l'extension

Capture réelle du 26/11, sur le banc local, avec l'extension construite (sans `debugger`, comme en
boutique) et chargée dans Chromium. Pour chaque site d'essai, le parcours est le suivant :

1. capture en mode Sandbox ;
2. passage par l'écran « Vérifier avant l'envoi » ;
3. envoi au faux Supabase ;
4. relecture de chaque enregistrement **tel qu'il a été envoyé** avec `buildLiveSrcdoc`, puis le
   parcours du visiteur.

Données fictives uniquement.

## Ce qui est livré

- **Enregistreur dans le monde de la page** (`lib/liveRecorder.ts`) :
  - injecté par `scripting.executeScript({ world: 'MAIN' })` avec la barre de capture, seulement pour
    un Sandbox ;
  - il copie les **lectures** (GET de `fetch` et XHR) au format texte, 1 Mo au plus par réponse ;
  - jamais d'en-têtes ni le corps d'une écriture ;
  - il transmet à la barre par un évènement dont le nom est tiré au hasard à chaque injection.
- **Lectures antérieures** : ce que la page a lu avant l'enregistreur est retrouvé par `performance` et
  relu en GET par le service de fond. Le genre `data` de `assetPolicy` est réservé aux types JSON,
  texte et XML, avec 1 Mo au plus et les cookies seulement vers le site.
- **Document source** (`lib/liveCapture.ts`) :
  - c'est la page telle que le serveur l'a envoyée ;
  - les CSS et les images sont intégrés ;
  - les scripts sont remplacés par des marques à leur place et téléchargés (genre `js`) ;
  - les données JSON de la page restent ;
  - `base`, `meta http-equiv`, les cadres et les médias sont retirés.
- **Classement des scripts** : même classement que l'écran de vérification, plus « autre port, donc
  autre origine ». Les scripts de la page sont gardés ; ceux d'un autre site et la mesure d'audience
  sont bloqués et rétablissables.
- **Données personnelles**, remplacées à l'envoi :
  - dans le document, les scripts écrits dans la page et les réponses ;
  - avec les mêmes valeurs neutres que la copie inerte ;
  - les clés JSON servent de libellés ;
  - une valeur que la copie inerte affiche telle quelle reste lisible, pour que la démo rejouée montre
    ce que montre la copie ;
  - une donnée gardée par l'auteur n'est pas remplacée.
- **Écran de vérification** : nouveau groupe « Sandbox vivant », présent seulement pour un Sandbox. Il
  contient une ligne par script (Rejoué / Bloqué, Garder / Bloquer, « Pourquoi ? ») et les « Réponses
  du site » de chaque page.
- **Envoi** :
  - une seconde requête `html-ingest` par page envoie l'enregistrement (étape 3a) ;
  - l'étape reçoit `html_live_path` et `html_meta.live` ;
  - la nouvelle démo reçoit `sandbox.live = true` ;
  - un refus (espace qui l'interdit, taille) laisse la copie inerte seule.
- **Lecteur** : `mergeResponses` (player-core) rejoue dans une page ses réponses, puis celles des
  autres pages de la démo. Une application à page unique capturée avant un clic ne connaît pas encore
  la liste que ce clic charge.

## Mesure (`apps/extension/e2e/banc/capture-v2.cjs`)

| Site d’essai | Pages vivantes | Scripts | Réponses | Interaction | Écritures fictives | Sorties |
|---|---|---|---|---|---|---|
| Site de plusieurs pages statiques | 3/3 | – | 0 | 3/4 | 0 | 0 |
| Application à page unique (routes, liste chargée) | 3/3 | page:gardé, page:gardé, page:gardé | 2 | 4/4 | 0 | 0 |
| Liste chargée par fetch, avec filtre | 2/2 | page:gardé, page:gardé | 3 | 3/4 | 0 | 0 |
| Formulaire avec validation et envoi POST | 2/2 | page:gardé, page:gardé | 0 | 3/3 | 1 | 0 |
| Application qui dépend de localStorage | 2/2 | page:gardé, page:gardé | 0 | 4/4 | 0 | 0 |
| Mesure d’audience et widget de tiers | 2/2 | third:bloqué, page:gardé, third:bloqué, third:bloqué, page:gardé, third:bloqué | 0 | 3/3 | 0 | 0 |
| Onglets chargés en différé (L60) | 3/3 | page:gardé, page:gardé, page:gardé | 3 | 2/3 | 0 | 0 |
| Menu ouvert au survol (L60) | 3/3 | page:gardé, page:gardé | 0 | 3/3 | 0 | 0 |
| **Total** | | | | **89.3 %** | | **0** |

### Gestes

- **Site de plusieurs pages statiques** : ✓ Offres · ✓ Équipe · ✗ Contact (page non visitée) · ✓ Retour à l’accueil
- **Application à page unique (routes, liste chargée)** : ✓ Clients (liste chargée) · ✓ Fiche client · ✓ Ajouter une note · ✓ Retour à l’accueil
- **Liste chargée par fetch, avec filtre** : ✓ Liste complète · ✓ Filtre « crm » · ✗ Filtre sans résultat · ✓ Filtre vidé
- **Formulaire avec validation et envoi POST** : ✓ Envoi sans nom : erreur · ✓ Envoi : la page avance · ✓ Retour : formulaire vide
- **Application qui dépend de localStorage** : ✓ Panier vide · ✓ Ajouter · ✓ Ajouter encore · ✓ Vider
- **Mesure d’audience et widget de tiers** : ✓ Tableau de bord · ✓ Ajouter une vente · ✓ Ajouter encore
- **Onglets chargés en différé (L60)** : ✓ Onglet Tarifs · ✓ Onglet Avis · ✗ Onglet Résumé
- **Menu ouvert au survol (L60)** : ✓ Survol de Produits · ✓ Page Logiciels · ✓ Retour au catalogue

### Critères

- ✓ Chaque site est capturé sans erreur
- ✓ Chaque page capturée a son enregistrement vivant, envoyé et rattaché à son étape ; démo « live »
- ✓ « Sandbox vivant » dans l’écran de vérification
- ✓ Scripts à leur place (marques) dans chaque enregistrement
- ✓ b) Scripts d’un autre site bloqués par défaut (fiche envoyée, rétablissable), ceux de la page gardés
- ✓ c) Aucune sortie réseau depuis la lecture (témoin vérifié)
- ✓ d) L’envoi du formulaire reçoit un succès fictif, la page avance
- ✓ Aucune donnée personnelle saisie lisible dans l’envoi

Comparaison :

| Étape | Interaction |
|---|---|
| Copie inerte (v1) | 53,6 % |
| Lecture v2 sur pages préparées (étape 2) | 89,3 % |
| Capture v2 réelle (étape 3b) | 89,3 % |

Les 3 gestes manqués sont du contenu que l'auteur n'a pas capturé (page Contact, filtre « zzz »,
onglet Résumé). Ils relèvent des pages liées (étape 4).

Non-régression : banc de bout en bout 156/156, html-verification 52, html 43, html-spa 21,
etat-html 7/7.

## À trancher (UX)

- L'introduction de l'écran (« Votre démo est une copie fixe des pages… ») et le groupe « Scripts de la
  page — Non copiés : la démo n'en a pas besoin » restent vrais pour la copie inerte, mais
  contredisent un Sandbox vivant. Il faut une planche pour l'écran de vérification d'un Sandbox
  vivant.

## Suite (3c)

- Publication : copie de l'enregistrement et manifeste `step.html.live`.
- Lecteur `HtmlStep` en mode vivant (navigation par adresse, `mergeResponses`).
- Aperçu de l'éditeur, et réglage « Sandbox vivant » de la démo.
