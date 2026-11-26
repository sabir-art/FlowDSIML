# Recette réelle du correctif L60 lot B (0d50a0d) : VERT

Recette du 26/11, faite à la place de l'utilisateur, sur `claude/dev-mvp` à 0d50a0d.

**Montage** :
- extension construite (`WXT_E2E=1`) et chargée dans Chromium ;
- faux Supabase ;
- banc (:54410), app (:5173) et lecteur (:5174).

**Parcours rejoués** : `bout-en-bout.cjs` (les 7 sites), `etat-html` et `etat-captures`. Ensuite, lecture des écrans d'arrivée comme le ferait un utilisateur : liste des étapes, panneau de l'étape, plan du Sandbox, aperçu.

| Contrôle | Résultat |
|---|---|
| bout-en-bout | **150 / 150** |
| etat-html | 7 / 7 |
| etat-captures | 5 / 5 |

## 1. Les 4 points du ROUGE sont corrigés

1. **La démo guidée guide.**
   - Sur l'élément cliqué, une bulle « Cliquez sur « Envoyer la demande » » s'affiche, avec un anneau (`b-formulaire-apercu.png`).
   - Même chose pour « Ajouter une vente » (`b-tiers-apercu.png`).
   - Un clic sur l'élément mène à l'étape suivante (contrôlé par le banc). La bulle de l'étape 1 disparaît bien, même quand les deux pages ont le même titre.
2. **On reconnaît les étapes.**
   - Les vignettes sont de vrais aperçus réduits, avec la pastille « <> » dans le coin.
   - Les noms tiennent sur 2 lignes : l'écran en 12 px gris, la partie en 14 px (« Fiche produit » / « Résumé », « Tarifs », « Avis », `b-onglets-editeur.png`).
   - Il n'y a plus aucune coupe nette : « Catalogu » a disparu, car les actions sont passées sur la ligne des icônes.
3. **Les noms sont distincts** : « Catalogue · menu Produits » (`b-menu-plan.png`), « Tableau de bord · après « Ajouter une vente » » (`b-tiers-editeur.png`).
4. **Les liens sans page sont regroupés et l'adresse est affichée.**
   - « Liens sans page (1) » : une seule ligne « Services », avec « Sur 2 pages : Catalogue, Catalogue · menu Produits » et une seule action « Capturer cette page ».
   - Le cadre du lecteur affiche l'adresse.
   - Le champ « Adresse affichée » est prérempli et modifiable. Remplacée par « crm.acme.example/demandes », l'adresse s'affiche bien dans l'aperçu (`b-formulaire-editeur.png`, `b-formulaire-apercu.png`).
   - Le Sandbox suit la page courante (`b-spa-apercu-suite.png`).

## 2. Arbitrage du §6 du rapport du dev

1. **Réglage « Cadre de navigateur »** : on garde le réglage de thème tel qu'il est. Il ne faut pas le redessiner, car ses deux styles (Aucun et Barre d'adresse) couvrent le besoin, et il vaut pour les deux types de démo. Seule demande : le style « Barre d'adresse » est celui par défaut des démos HTML et Sandbox, puisque l'adresse sert de repère au visiteur.
2. **Partie du nom sur une ligne, avec « … » et le nom complet en infobulle** : accepté (« après « Ajouter… », `b-tiers-editeur.png`). La liste garde des lignes de hauteur stable, et le nom se lit en entier dans le panneau de l'étape.
3. **« Discuter avec nous » ajouté par un script tiers** : on le retire de la copie.
   - Un bouton inerte trompe le visiteur : il clique, et rien ne se passe.
   - Règle : à la copie, on retire ce qu'un script d'un **autre domaine** a ajouté à la page (lanceurs de discussion, bandeaux de cookies, pastilles d'aide). C'est compté dans « Scripts non copiés » de « Vérifier avant l'envoi », avec « Garder » pour le remettre.
   - Ce n'est pas bloquant : c'est pour le prochain lot de la capture (ou Sandbox v2).

## 3. Gênes vues pendant la recette (non bloquantes, pour le prochain lot)

1. **« Aucune zone cliquable sur cette étape » sur la dernière étape d'une démo guidée** (`b-formulaire-apercu-suite.png`).
   - La dernière étape (« Demande envoyée ») n'a naturellement pas de clic : c'est la fin.
   - L'encart pousse l'auteur à ajouter une zone inutile.
   - **Attendu** : pas d'encart sur la dernière étape. Sur les autres étapes sans zone, l'encart reste.
2. **Plan du Sandbox « Menu ouvert au survol »** (`b-menu-plan.png`).
   - L'alerte « « Catalogue · menu Produits » n'est reliée à aucune page : les visiteurs ne peuvent pas l'atteindre » s'affiche juste après la capture, alors que l'utilisateur n'a rien fait de travers.
   - La capture sait que ce menu s'est ouvert en survolant « Produits » sur Catalogue.
   - **Attendu** : relier d'office « Produits » (sur Catalogue) à l'état « menu Produits ». Le plan montre alors les 3 pages reliées, sans alerte.

**Limite de cette recette** : le faux serveur ne rejoue pas l'assainissement de `html-ingest`, donc « Sécurité de la page » affiche « pas de rapport ». Il faudra le vérifier sur l'environnement en ligne.
