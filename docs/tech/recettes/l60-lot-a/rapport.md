# L60, lot A : fiabilité des copies HTML — rapport « à la place de l'utilisateur »

Date : 25/11. Extension construite (`WXT_E2E=1`) et chargée dans Chromium, banc de sites fictifs
(`apps/extension/e2e/banc`). Les pages copiées sont relues **sans aucun script**, comme le lecteur les
affiche. Limite de ce rapport : les copies ne sont pas encore ouvertes dans l'app elle-même (éditeur,
plan, lecteur) ; c'est l'objet du lot B.

## Ce que j'ai fait

Pour chaque site, le parcours d'un utilisateur, capture HTML démarrée depuis l'extension :

1. **Application à page unique** : Accueil, clic sur « Clients » (liste chargée après coup), clic sur
   « Atelier Durand ».
2. **Formulaire** : saisie du nom, « Envoyer la demande », écran de confirmation.
3. **Scripts de tiers** : tableau de bord, « Ajouter une vente », « Capturer cette page ».
4. **Onglets différés** : onglet « Tarifs », puis « Avis ».
5. **Menu au survol** : survol de « Produits », « Capturer cette page », clic sur « Logiciels ».
6. **Fiche avec données personnelles fictives** : un nom, une adresse e-mail, un bouton, un lien.

## Ce que j'ai obtenu

| Site | Avant le lot A | Après le lot A |
|---|---|---|
| Application à page unique | bouton « Ajouter une note » flouté à tort | 3 écrans sur 3, nommés « Accueil », « Clients », « Atelier Durand » |
| Formulaire | bouton « Envoyer la demande » flouté à tort | 2 écrans sur 2, « Demande de contact », « Demande envoyée » |
| Scripts de tiers | 2 sur 2 | 2 sur 2 (le bouton de chat du tiers reste un décor mort : Sandbox v2) |
| Onglets différés | **1 écran sur 3** | 3 sur 3, « Fiche produit · Résumé », « · Tarifs », « · Avis » |
| Menu au survol | 3 sur 3 | 3 sur 3 |
| Données personnelles | — | nom et adresse e-mail **toujours remplacés**, bouton et lien lisibles |

Captures (relecture des copies) : `banc-formulaire-page1.png` (bouton net), `banc-spa-page3.png`,
`banc-onglets-page2.png` (onglet Tarifs copié seul), `banc-menu-page2.png` (menu ouvert),
`banc-donnees-page1.png` (données remplacées, commandes lisibles).

## Ce qui n'allait pas, et ce que j'ai corrigé

1. **Flou à tort** : le texte de l'élément précédent servait de libellé. Une phrase cachée « Indiquez
   votre nom. » faisait du bouton suivant une « valeur de nom ». Désormais un bouton, un lien, un onglet
   ou une entrée de menu n'est jamais une valeur, et l'élément précédent n'est un libellé que s'il est
   affiché et en a la forme (pas une phrase, pas un couple « libellé : valeur », quatre mots au plus).
   Les motifs (adresse e-mail, téléphone…) restent cherchés partout.
2. **Onglets non copiés** : choisir un onglet remplace un panneau sans changer d'adresse ni de titre ;
   ce changement est maintenant une copie automatique, une fois le contenu chargé.
3. **Noms des étapes** : l'étape prenait le libellé du clic fait en quittant la page (l'accueil
   s'appelait « Clients »). Elle prend le nom de l'écran copié : son titre principal, suivi de l'onglet
   choisi.

## Ce qui reste

- « Ville : Lyon » : la ville est remplacée (règle « adresse »). C'est voulu par la règle actuelle, et
  « Garder » existe dans l'écran de vérification ; à trancher si une ville seule doit rester lisible.
- Le décor laissé par un script de tiers (bouton de chat) et tout ce qui demande des scripts vivants :
  Sandbox v2.
- Menu au survol : rien ne dit à l'utilisateur de capturer menu ouvert (barre L60, lot D).
- Vidéo : non couverte ici (faux flux d'onglet, lot B).

## Verdict du dev

Lot A : critères atteints sur le banc (tous les états retrouvés, aucun flou à tort, aucun nom
technique, données personnelles masquées). Contrôle ajouté à la CI de l'extension. À recetter par l'UX
avec l'extension chargée.
