# Sandbox v2, étape 4b/4c : pages liées et capture en série (extension)

Planche : `planche-pages-liees.png`. Elle est faite sur la barre de capture réelle (extension construite, site d'essai du banc, données fictives), en clair et en sombre. **À montrer au client avant tout code.**

Principe : on garde la barre commune et le popup. La barre gagne **un** bouton « Pages liées », qui ouvre un panneau au-dessus d'elle. Ce panneau est au même endroit et dans le même style que la carte « Étape capturée » (`--fdb-*`, rayon 12, ombre de la barre).

## 1. Bouton et panneau « Pages liées » (4b)

- **Bouton dans la barre** : icône de lien, « Pages liées », et un badge de marque qui compte les pages **à capturer**. Il prend la place de la phrase « Chaque page visitée est ajoutée ». Sans page à capturer, il n'y a pas de badge. `aria-expanded` reflète l'état du panneau.
- **Panneau** :
  - 400 px de large, liste de 340 px au plus, qui défile ;
  - fermeture par la croix ou Échap, et le focus revient sur le bouton.
- **En-tête** : « Pages liées » et « Liens de {site} vus sur vos pages · {hôte} ».
- **Résumé** : capturées · **à capturer** (en couleur de marque) · laissées · jamais ouvertes · en erreur.
- **Groupes, dans cet ordre** :

| Groupe | Ligne | Action |
| --- | --- | --- |
| À capturer | titre du lien, chemin et origine (« lien « Équipe » », « lien du pied de page ») | « Laisser » |
| Capturées | coche verte, « page n » | — |
| Laissées par vous | « ne compte pas dans la couverture » | « Reprendre » |
| Jamais ouvertes | pastille « Refusée », avec la raison : adresse de déconnexion, de suppression ou de désabonnement, fichier à télécharger, autre site | aucune : jamais ouverte, même en série |
| En erreur | « page introuvable (404) », « délai dépassé » | « Réessayer » |

- **Pied** :
  - bouton primaire « Capturer les {n} pages liées » ;
  - texte d'aide : « Même site, un niveau, 20 pages au plus. Les pages s'ouvrent une à une dans cet onglet. Rien n'est envoyé avant la vérification. »
- La liste se met à jour à chaque page capturée, puisque de nouveaux liens apparaissent.

## 2 et 3. Capture en série, progression, arrêt (4c)

- **Pendant la série** :
  - la barre montre une jauge de 96 px et « Pages liées : {i} sur {n} · {titre} », avec « Arrêter » (icône carré) à la place du bouton « Pages liées » ;
  - si le panneau est ouvert, la ligne en cours affiche « En cours… » sur un fond de marque léger, et les suivantes « En attente » ;
  - la pastille « {n} pages » de la barre augmente à chaque page.
- **Arrêter**, à tout moment : la page en cours se termine, puis la série s'arrête. Une carte s'affiche :
  - « Arrêté : {k} page(s) liée(s) capturée(s) » ;
  - « {r} restent à capturer. Vos pages sont gardées. » ;
  - boutons « Reprendre » et « Vérifier et envoyer ».
- **Fin de passe** : une carte s'affiche :
  - « {k} pages liées capturées · {e} en erreur » ;
  - « {total} pages en tout. Rien n'est encore envoyé. » ;
  - boutons « Voir » (rouvre le panneau) et « Vérifier et envoyer » (même action que « Terminer »).
- **Plafond de 20 pages** : la carte dit « 20 pages capturées, la limite d'une passe. {r} restent : relancez une passe. »
- **Pour les lecteurs d'écran** : la progression est dans une région `role="status"` polie, à chaque page et non à chaque tic de la jauge.

## 4. Passage vers « Vérifier avant l'envoi »

- « Pages copiées » : « Prêtes à l'envoi · dont {k} capturées en série depuis les pages liées ».
- **Nouveau groupe** « Pages liées non capturées » ({n}) : « Elles ne sont pas dans la démo : le visiteur verra « Page non disponible ». ». Il se place juste après « Pages copiées ».
- Chaque ligne donne la raison, avec la pastille « En erreur », « Laissée » ou « Refusée », et « Pourquoi ? ». Il n'y a pas d'action : on reprend une page depuis l'extension, ou plus tard depuis l'éditeur (« Capturer »).

## 5. Couverture dans le plan (4a)

- **Sous le titre du plan**, à la place du sous-titre :
  - « {c} pages sur {t} liens », avec une jauge de 120 px ;
  - puis « · {l} laissé(s) » en gris ;
  - et le lien « Voir les liens », qui ouvre la liste existante des liens sans page (Capturer, Relier, Laisser le message).
- Les liens laissés ne comptent pas dans le total (décision du chef) : t = capturées + à capturer.
- À 100 % : « Toutes les pages liées sont capturées ({c}) ». La jauge est pleine, et « Voir les liens » disparaît s'il n'y a ni lien laissé ni lien refusé.
- **Liens refusés dans le plan (ajout du 26/11, remarque du dev ; livré dans ab5c870 sous la forme décidée par le chef : bouclier et « Jamais ouverte par sécurité », sans pastille ni raison détaillée ; « Ouvrir la page » reste, geste volontaire)** : un lien que la série ne capture jamais (adresse de déconnexion, de suppression de compte ou de désabonnement, fichier à télécharger, autre site, mêmes règles qu'au §1) garde dans le plan l'état qu'il a dans la barre de capture :
  - dans la liste « Voir les liens », la ligne porte la pastille « Refusée » et la raison en clair (« Se déconnecter · adresse de déconnexion », « Supprimer mon compte · adresse de suppression de compte ») ;
  - **pas d'action « Capturer cette page »**, ni dans la liste, ni dans le menu du hotspot, ni dans le panneau du lien. Les deux actions restantes sont « Relier à une étape » (par exemple vers un écran de fin) et « Laisser le message » (« Page non disponible ») ;
  - au survol ou au focus de la pastille, l'infobulle dit : « Jamais ouverte, pour ne pas agir sur votre compte. Reliez-la à une étape si besoin. » ;
  - ces liens ne comptent pas dans la couverture (comme les liens laissés) : t = capturées + à capturer. La ligne sous le titre ajoute « · {r} refusé(s) » en gris, après les laissés ;
  - un lien refusé ne passe jamais à « à capturer », même par « Tout capturer ».
- e2e : dans le plan, « Se déconnecter » et « Supprimer mon compte » ont la pastille « Refusée », aucun bouton « Capturer cette page », et ne comptent pas dans « {c} pages sur {t} liens ».

## Textes (FR)

`Pages liées` · `Liens de {{site}} vus sur vos pages` · `{{n}} capturées` · `{{n}} à capturer` · `{{n}} laissée(s)` · `{{n}} jamais ouvertes` · `{{n}} en erreur` · `Laisser` · `Reprendre` · `Réessayer` · `Refusée` · `adresse de déconnexion` · `autre site` · `page introuvable (404)` · `Capturer les {{n}} pages liées` · `Pages liées : {{i}} sur {{n}} · {{titre}}` · `Arrêter` · `En cours…` · `En attente` · `Arrêté : {{k}} page liée capturée` · `Vérifier et envoyer` · `Pages liées non capturées` · `{{c}} pages sur {{t}} liens` · `Voir les liens` · `{{r}} refusé(s)` · `Relier à une étape` · `Jamais ouverte, pour ne pas agir sur votre compte. Reliez-la à une étape si besoin.`.

## e2e proposés

1. Le badge vaut le nombre de pages à capturer, et le panneau se ferme avec Échap, le focus revenant sur le bouton.
2. Une adresse de déconnexion et un autre site sont « Refusée » et ne sont jamais ouverts pendant la série (aucune navigation vers eux).
3. La série respecte même site, un niveau et 20 pages au plus. « Arrêter » garde les pages déjà capturées.
4. « Laisser » retire la page du total de couverture, et « Reprendre » l'y remet.
5. « Vérifier avant l'envoi » affiche le groupe « Pages liées non capturées ».
6. Axe, en clair et en sombre.
