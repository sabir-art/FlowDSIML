# Recette réelle L60, lot B (15ee068 et 756b5f0) : ROUGE

Recette du 26/11, faite à la place de l'utilisateur.

**Montage** :
- extension construite (`WXT_E2E=1`) et chargée dans Chromium ;
- faux Supabase ;
- banc (:54410), app (:5173) et lecteur (:5174).

**Parcours rejoués** : `bout-en-bout.cjs` (les 7 sites) et `etat-video.cjs` (faux flux d'onglet). Ensuite, lecture des écrans d'arrivée comme le ferait un utilisateur : éditeur, plan du Sandbox, aperçu.

## 1. Ce qui marche

- **Bout-en-bout** : **111 contrôles sur 111**. Chaque page capturée arrive dans l'app, à son rang. Elle est rendue comme sur le site (couleurs, logo, mise en page), sans aucun script.
- **Sandbox** (application à page unique, onglets, menu) :
  - le plan relie les pages dans l'ordre du parcours ;
  - dans l'aperçu, un clic capturé mène à la page suivante ;
  - le menu capturé ouvert reste ouvert.
- **Données** : le formulaire arrive vidé, la fiche contact arrive masquée, et « Ville : Lyon » reste lisible.
- **Vidéo** (faux flux) :
  - l'enregistrement démarre ;
  - la vidéo est réelle (1,8 s, webm) ;
  - chaque clic devient un repère avec un libellé lisible ;
  - la revue affiche la vidéo (`banc-video-revue.png`).

## 2. Ce qui bloque (ROUGE)

1. **La démo guidée HTML ne guide pas.** En « Démo guidée », le clic capturé (« Envoyer la demande », « Ajouter une vente ») ne devient ni un point chaud ni une bulle.
   - Dans l'aperçu, le visiteur voit la page, sans rien qui dise où cliquer, et n'avance qu'avec les flèches (`b-formulaire-apercu.png`).
   - Dans l'éditeur, l'étape n'a aucun point chaud (`b-formulaire-editeur.png`).
   - Une démo guidée sans guide n'est qu'un diaporama. **Attendu**, comme pour les captures d'écran :
     - chaque clic capturé crée sur l'élément cliqué un point chaud et une bulle « Cliquez sur « {libellé} » » ;
     - dans le lecteur, un clic sur l'élément mène à l'étape suivante.
2. **On ne reconnaît pas les étapes dans la liste.**
   - Les vignettes sont toutes des icônes « <> » identiques, sans aperçu de la page.
   - Les noms sont tronqués : « Fiche produit… » trois fois, « Demande de… », et même « Catalogu », coupé sans points de suspension (`b-onglets-editeur.png`, `b-menu-plan.png`).
   - Sur une démo de 20 pages, l'utilisateur ne s'y retrouve plus.
3. **Des étapes portent le même nom.** « Catalogue » apparaît deux fois (menu), et « Tableau de bord » deux fois (avant et après « Ajouter une vente », `b-tiers-editeur.png`). Dans la liste comme dans le plan, rien ne les distingue (§3, gêne 1).

## 3. Arbitrage des 4 gênes du rapport du dev

1. **Deux étapes du même nom.** Le nom d'un état se distingue d'après ce qui l'a créé :
   - menu ouvert : « Catalogue · menu Produits » ;
   - après un clic qui garde le même titre d'écran : « Tableau de bord · après « Ajouter une vente » » ;
   - onglet : « Fiche produit · Tarifs », comme aujourd'hui ;
   - si rien ne les distingue, on ajoute un numéro : « Catalogue (2) ».

   Le nom reste modifiable dans l'éditeur.
2. **« Liens sans page » en double.**
   - Une seule ligne par **destination** (adresse), avec le texte du lien et « Sur 2 pages : Catalogue, Logiciels ».
   - Une seule action « Capturer cette page ».
   - Le compteur « Liens sans page (n) » compte les destinations, pas les liens.
3. **Noms tronqués dans la liste des étapes.**
   - **Vignette** : un vrai aperçu réduit de la page (image générée à l'envoi, ou rendu réduit de la copie), comme pour les captures d'écran. L'icône « <> » passe en petite pastille dans le coin de la vignette.
   - **Nom** : sur 2 lignes au plus, avec des points de suspension en fin (`line-clamp: 2`), et le nom complet en infobulle.
   - Pour les noms « Écran · Partie », c'est la partie qui distingue les étapes qu'on garde visible :
     - la 1re ligne montre l'écran (« Fiche produit », en 12 px gris) ;
     - la 2e ligne montre la partie (« Tarifs », en 14 px).
   - Correctif : plus aucune coupe nette sans points de suspension (« Catalogu »).
4. **Barre d'adresse vide dans l'aperçu d'une démo guidée.**
   - Le cadre de navigateur du lecteur affiche l'adresse de la page capturée, en lecture seule, réduite au domaine et au chemin (comme dans l'éditeur : « localhost:54410/formulaire »).
   - Dans l'éditeur, le panneau de l'étape a un champ **Adresse affichée**. Il est prérempli et modifiable, pour masquer une adresse interne (par exemple « crm.acme.example/opportunites »).
   - Le Sandbox prend le même cadre, avec l'adresse de la page courante, qui change à chaque navigation.
   - Le réglage de thème « Cadre de navigateur » (Avec adresse / Sans cadre) vaut pour les deux types de démo.

## 4. À livrer pour le VERT

- Les points chauds et les bulles des démos guidées HTML (§2.1). Contrôles dans `bout-en-bout` :
  - point chaud présent sur l'élément cliqué ;
  - bulle avec son libellé ;
  - un clic dans l'aperçu fait avancer.
- Vignettes réelles et noms sur 2 lignes (§3.3).
- Noms distincts (§3.1) et liens sans page regroupés (§3.2).
- Adresse affichée (§3.4).

**Limite de cette recette** : le faux serveur ne rejoue pas l'assainissement de `html-ingest`, donc le panneau « Sécurité de la page » affiche « pas de rapport ». Il faudra le vérifier sur l'environnement en ligne.
