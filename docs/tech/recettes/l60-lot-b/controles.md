# L60 lot B : captures ouvertes dans l’app (contrôles générés)

Généré par `apps/extension/e2e/banc/bout-en-bout.cjs` : extension construite, parcours du banc
(pages fictives locales), envoi depuis « Vérifier avant l’envoi », puis ouverture dans l’app
avec exactement les étapes et les pages envoyées. Ne pas modifier à la main.

Résultat : 111 contrôles réussis sur 111.

## Application à page unique

Démo « Application à page unique », Sandbox.

| Rang | Nom dans la liste | Nom affiché | Page rendue |
| --- | --- | --- | --- |
| 1 | Accueil | oui | oui |
| 2 | Clients | oui | oui |
| 3 | Atelier Durand | oui | oui |

Ce qu’on doit y lire :

- Accueil : oui
- Liste des clients (chargée en différé) : oui
- Fiche du client (bouton lisible) : oui
- Ville seule lisible : oui

Plan : une carte par page oui, noms oui, départ oui, 1 lien(s) vers une page non capturée (signalé).

> Plan du sandbox : Accueil mène à Clients ; Clients mène à Atelier Durand et Accueil ; Atelier Durand mène à Accueil et Clients ; 1 lien mène à une page non capturée

Aperçu du lecteur sur la première page : oui ; passage à la page suivante : oui.

## Formulaire envoyé (POST)

Démo « Formulaire envoyé (POST) », démo guidée.

| Rang | Nom dans la liste | Nom affiché | Page rendue |
| --- | --- | --- | --- |
| 1 | Demande de contact | oui | oui |
| 2 | Demande envoyée | oui | oui |

Ce qu’on doit y lire :

- Formulaire : oui
- Confirmation après envoi : oui

Aperçu du lecteur sur la première page : oui ; passage à la page suivante : oui.

## Scripts de tiers (mesure d’audience, chat)

Démo « Scripts de tiers (mesure d’audience, chat) », démo guidée.

| Rang | Nom dans la liste | Nom affiché | Page rendue |
| --- | --- | --- | --- |
| 1 | Tableau de bord | oui | oui |
| 2 | Tableau de bord | oui | oui |

Ce qu’on doit y lire :

- Tableau de bord : oui
- Après « Ajouter une vente » : oui

Aperçu du lecteur sur la première page : oui ; passage à la page suivante : oui.

## Onglets chargés en différé

Démo « Onglets chargés en différé », Sandbox.

| Rang | Nom dans la liste | Nom affiché | Page rendue |
| --- | --- | --- | --- |
| 1 | Fiche produit · Résumé | oui | oui |
| 2 | Fiche produit · Tarifs | oui | oui |
| 3 | Fiche produit · Avis | oui | oui |

Ce qu’on doit y lire :

- Onglet Résumé : oui
- Onglet Tarifs : oui
- Onglet Avis : oui

Plan : une carte par page oui, noms oui, départ oui.

> Plan du sandbox : Fiche produit · Résumé mène à Fiche produit · Tarifs ; Fiche produit · Tarifs mène à Fiche produit · Avis

Aperçu du lecteur sur la première page : oui ; passage à la page suivante : oui.

## Menu ouvert au survol

Démo « Menu ouvert au survol », Sandbox.

| Rang | Nom dans la liste | Nom affiché | Page rendue |
| --- | --- | --- | --- |
| 1 | Catalogue | oui | oui |
| 2 | Catalogue | oui | oui |
| 3 | Logiciels | oui | oui |

Ce qu’on doit y lire :

- Catalogue : oui
- Menu ouvert (liens visibles) : oui
- Page Logiciels : oui

Plan : une carte par page oui, noms oui, départ oui, 1 lien(s) vers une page non capturée (signalé).

> Plan du sandbox : Catalogue mène à Logiciels ; Catalogue mène à Logiciels ; Logiciels mène à Catalogue ; Catalogue n’est reliée à aucune page ; 2 liens mènent à des pages non capturées

Aperçu du lecteur sur la première page : oui ; passage à la page suivante : oui.

## Données personnelles et commandes

Démo « Données personnelles et commandes », démo guidée.

| Rang | Nom dans la liste | Nom affiché | Page rendue |
| --- | --- | --- | --- |
| 1 | Fiche contact | oui | oui |

Ce qu’on doit y lire :

- Commandes lisibles (bouton et lien) : oui
- Lien lisible : oui

Aperçu du lecteur sur la première page : oui.

## Page piège (aucune donnée personnelle)

Démo « Page piège (aucune donnée personnelle) », démo guidée.

| Rang | Nom dans la liste | Nom affiché | Page rendue |
| --- | --- | --- | --- |
| 1 | Offres | oui | oui |

Ce qu’on doit y lire :

- En-têtes du tableau : oui
- Mots collés : oui
- En-têtes en blocs : oui
- Ville seule lisible : oui
- Avis signé : oui
- Lignes du tableau : oui

Aperçu du lecteur sur la première page : oui.
