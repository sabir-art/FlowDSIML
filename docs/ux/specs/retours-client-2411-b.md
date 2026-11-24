# Retours client du 24/11, deuxième série : spec UX

Source : message du chef du 24/11 au soir (9 points). Priorité haute : §1 et §9.
Maquettes : `maquettes/refonte/retours-2411b/` (clair et sombre, 1440, et 390 pour §1 et §9).
Règle de fond, valable partout : **une action n'est pas forcément un bouton** (§0).

---

## §0 Règle ACTION-01 : la bonne forme pour chaque action

| Action | Forme | Exemple |
|---|---|---|
| Action principale de l'écran | Un seul bouton primaire, à un seul endroit | « Publier », « Créer une clé » |
| Action secondaire visible | Bouton secondaire (pilule) | « Ouvrir », « Remplacer… » |
| Bascule d'état | Bouton icône 32 px, `aria-pressed`, infobulle | Pause / reprise du temps réel |
| Action sur un élément d'une liste | Menu ⋯ de l'élément | Renommer, Révoquer, Supprimer |
| Réglage rare ou avancé | Ligne repliable (disclosure) | « Personnaliser l'adresse » |
| Modification d'une valeur | Clic sur la valeur (édition en place) | Nom d'une démo |

- Une même action n'apparaît **qu'une fois** à l'écran (cf. §3).
- Un bouton icône a toujours un `aria-label` et une infobulle (L44).

---

## §1 Partager en fenêtre (SHARE-02) — priorité haute

**Problème** : « Partager » ouvre une page à onglets (Lien, Intégrer, Liens personnalisés, Accès, Page publique). La personne a l'impression de quitter la démo, et l'accès n'est pas relié aux canaux (« Toute personne avec le lien », mais quel lien ?).

**Modèle à rendre visible** : l'**accès** (qui peut voir) est un réglage unique de la démo, qui s'applique à **tous** les moyens de partage. Il est **affiché en tête de chaque mode**, toujours au même endroit : c'est la réponse au « quel lien ? ». Principe tiré des captures de référence du client (fenêtre à deux volets, accès toujours visible), sans en reprendre l'aspect.

### 1.1 Ouverture
- Fenêtre (`dialog`, MODAL-01) **au-dessus de la démo**, ouverte par « Partager » (primaire) depuis la barre de la démo, quelle que soit la vue (§9), et depuis le menu ⋯ d'une carte de démo.
- 960 × 640 px (hauteur : fenêtre − 48 px au plus) ; à 390 : feuille plein écran (§1.6).
- Adresse : `?share=lien` (ou `integrer`, `perso`, `acces`, `exporter`) sur la vue courante ; l'ancienne route `/demos/:id/share` redirige vers `/demos/:id/edit?share=lien`.
- Fermeture : croix, Échap, clic sur le voile. Le focus revient au bouton « Partager ».

### 1.2 Deux volets (maquettes `partager2-*`)
- **À gauche (232 px)**, sur fond `surface-sunken` : en-tête (tuile Share2, « Partager « Démo CRM » », « Publiée le 24 nov. » ou « Pas encore publiée »), puis la liste des modes (`nav`, lien actif en `aria-current`) :
  - **Lien** · **Intégrer** · **Liens personnalisés** · **Accès** ;
  - groupe « Fichiers » : **Exporter** (PDF, GIF, vidéo).
  Pas de réseaux sociaux (retirés à la demande du client).
- **À droite** : en-tête du mode (h3, nom du mode) ; **pastille d'accès** « 🌐 Toute personne avec le lien · Modifier » (icône du mode d'accès, bouton « Modifier » qui ouvre le mode Accès) ; croix de fermeture. Puis le contenu du mode, qui défile seul.
- La pastille d'accès est présente dans **chaque** mode sauf Accès lui-même.

### 1.3 Contenu des modes
- **Lien** : encadré qui dit l'effet de l'accès (« Toute personne qui a ce lien ouvre la démo, sans compte. L'accès s'applique aussi à l'intégration et aux liens personnalisés. » — texte selon le mode d'accès) ; CopyField du lien + « Ouvrir » ; ligne « Envoyer » en boutons icône (E-mail, message prêt à copier, QR code) ; **vignette du lien** (aperçu 200 × 112, « Changer la vignette », « Télécharger ») ; lignes repliables « Personnaliser l'adresse » et « Adapter le texte au destinataire (paramètres d'URL) ».
- **Intégrer** : formats en cartes radio (Encadré dans la page · Bouton qui ouvre la démo · Plein écran) ; code (`pre`, monospace, passe à la ligne) ; « Copier le code » ; guides ; **aperçu en direct** de la démo intégrée dans le format choisi.
- **Liens personnalisés** : recherche, liste (destinataire, date, vues), « Créer un lien » **en bas** de la liste, « Importer (CSV) ».
- **Accès** : phrase « Le choix vaut pour le lien, l'intégration et les liens personnalisés. La page publique n'affiche que les démos en accès « Toute personne avec le lien ». » ; cartes radio (Toute personne avec le lien · Avec un mot de passe · Sur invitation · Par domaine e-mail) avec leurs champs ; seuls les modes autorisés par l'espace (Paramètres › Sécurité) ; « Voir ce que le visiteur verra » ; « Enregistrer l'accès ».
- **Exporter** : trois fichiers en cartes radio (PDF · GIF · Vidéo MP4) ; réglages du fichier choisi (langue, format, bulles sur les captures, étapes ; pour GIF et vidéo : résolution, images par seconde, délai entre étapes) ; note « Un fichier exporté n'applique pas l'accès choisi : toute personne qui l'a peut le lire. » ; un seul bouton « Exporter le PDF / le GIF / la vidéo ».
- La **page publique** n'est plus un mode : son réglage par démo (« Afficher sur la page publique de l'espace ») passe dans le menu ⋯ de la démo et dans Paramètres › Page publique.

### 1.4 Démo non publiée (maquette `partager2-nonpubliee-*`)
Bandeau `role="status"` en haut du volet droit : « La démo n'est pas publiée : le lien et le code fonctionneront après la publication. » + « Publier ». Lien grisé, « Ouvrir » désactivé avec la raison ; l'accès et l'export restent disponibles.

### 1.5 Ce qui sort de Partager
- La colonne de droite actuelle (aperçu, formation, chiffres de la semaine) disparaît : les chiffres sont dans **Analytics de la démo** (§9).
- « Diffuser » (SCORM, LMS, intranet) : question au client (fenêtre séparée ou mode « Diffuser » dans cette fenêtre). En attendant sa réponse, il reste une fenêtre séparée.

### 1.6 Mobile (390, maquettes `partager2-menu-*` et `partager2-lien-*-390`)
Feuille plein écran. Premier écran : la liste des modes (lignes de 52 px avec chevron). Un mode s'ouvre à la place, avec « ← » retour à la liste ; la pastille d'accès passe sur sa propre ligne sous le titre.

### 1.7 Recette
`partager.e2e` : ouverture depuis la barre de chaque vue et depuis la carte, `?share=` ; focus piégé et rendu ; chaque mode ; pastille d'accès présente partout sauf Accès, et mise à jour après « Enregistrer l'accès » ; copie ; export (fichier produit) ; non publiée ; 390 (liste puis mode, retour) sans défilement horizontal ; axe ; clair et sombre.

---

## §2 Logo dans Paramètres › Marque : contain, jamais de rognage

- L'aperçu du logo est une tuile de 72 × 72, fond en damier léger (pour voir la transparence), bordure 1 px, **`object-fit: contain`**, marge intérieure de 10 px. Une icône carrée tient entière.
- La règle vaut pour **tous** les aperçus de logo et d'image de l'app (MEDIA-01, médiathèque, centre de formation, page publique).
- Maquette : `param-entete-marque-*` (tuile du logo).

---

## §3 Clés d'accès : une seule action, page repensée

- **Une seule** « Créer une clé » à l'écran :
  - aucune clé : seulement dans l'état vide (le bouton de l'en-tête est retiré) ;
  - au moins une clé : seulement dans l'en-tête de la page.
- Deux onglets sous l'en-tête de page : **Clés** · **Utiliser l'API** (la documentation n'est plus sous la liste).
- État vide (maquette `param-cles-vide-*`) : icône, « Reliez un outil à TutoClick », trois étapes numérotées (Créez une clé · Copiez-la dans l'outil · L'outil lit vos données), un seul bouton.
- Liste : inchangée (§6.2 de la série précédente), plus la pastille d'état (Active, Expirée, Révoquée) à côté du nom.

---

## §4 Notifications

- **Mentions** : la ligne « On me mentionne (@) » de la fenêtre de préférences de la cloche est retirée. Dans Paramètres › Notifications, la ligne Mentions disparaît du tableau ; au-dessus du tableau, une phrase : « Les mentions (@) sont toujours notifiées dans l'app. » et sous le tableau, un interrupteur « Recevoir aussi les mentions par e-mail ».
- **Une seule source de réglages** : « Préférences » dans la cloche ouvre Paramètres › Notifications ; l'ancienne fenêtre de préférences est supprimée.
- **Résumé quotidien : on le fait.** Sous le tableau, « Fréquence des e-mails » en choix segmenté :
  - « Au fil de l'eau » (au plus un e-mail par heure, comportement actuel) ;
  - « Un résumé par jour » (à 9 h, heure de la personne ; fuseau du navigateur enregistré au profil, sinon Europe/Paris).
  Le résumé quotidien regroupe les événements cochés « Par e-mail » des 24 dernières heures ; pas d'e-mail s'il n'y a rien. Plus de « Bientôt ».

---

## §5 Temps réel (maquettes `temps-reel-*`, `temps-reel-filtre-*`)

- **Filtre Démo** : combobox avec recherche (`role="combobox"` + `listbox`), groupes « En direct » (avec le nombre de visiteurs) puis par dossier ; chaque démo porte la **pastille de couleur de son type** (jetons `--fd-type-*`). Tient avec des centaines de démos : 8 résultats visibles, « + n autres démos : tapez pour filtrer ».
- **Pause** : plus de gros bouton. Indicateur « En direct · actualisé il y a 3 s » (point vert ; sans animation si mouvement réduit) suivi d'un **bouton icône** Pause/Play (32 px, `aria-pressed`, infobulle « Mettre en pause l'actualisation » / « Reprendre »). En pause, l'indicateur devient « En pause » (point gris).
- **Interface vivante** :
  - indicateurs compacts sur une ligne (visiteurs en ce moment, vues sur 30 min, fins de démo du jour, leads du jour) ;
  - « Sur les démos maintenant » : une ligne par visiteur (pastille anonyme, lieu approximatif ou e-mail s'il s'est identifié par un lead, démo avec sa pastille de type, barre de progression « Étape n/N », durée) ;
  - « Fil d'activité » à droite : début, fin, lead, avec l'heure relative.
  Les nouvelles lignes apparaissent en fondu court (0,2 s ; aucun mouvement si mouvement réduit). Les changements sont annoncés une fois par minute au plus (`aria-live="polite"` sur le résumé, pas sur chaque ligne).
- Export : bouton icône Download avec infobulle.

---

## §6 En-tête de page des Paramètres (maquette `param-entete-marque-*`)

- **En-tête de page** en haut du contenu, identique sur toutes les pages des Paramètres : tuile d'icône 40 px (l'icône de la navigation), **titre h1** 22 px en 700 (le nom de la page, « Thème et couleurs »), phrase de description en `text-muted` (une ou deux lignes, 620 px au plus), filet en dessous.
- La barre du haut garde le fil d'Ariane (« Marque › Thème et couleurs ») **sans h1** et les actions « Annuler » / « Enregistrer ». Exception documentée à PAGE-01 pour les Paramètres : le h1 est dans l'en-tête de page.
- Les **sections** (h2, 15 px en 600) viennent ensuite, chacune séparée par un filet. Une section qui ne contient qu'un réglage ne répète pas son titre comme libellé du champ (fin du « Logo » en double).
- Contenu de chaque en-tête : une ligne par page dans `src/locales` (titre + description), relue par l'UX.

---

## §7 Page Extension (maquettes `extension-absente-*`, `extension-installee-*`)

- **Extension absente** (et publiée sur le Store) : bloc d'accueil — puce « Chrome et Edge », titre « Capturez votre logiciel en quelques clics », trois bénéfices, bouton primaire « Installer depuis le Chrome Web Store » (nouvel onglet, icône ArrowUpRight), aide « Déjà installée ? Rechargez cette page pour la relier à l'espace. », illustration maison (pas de capture du Store). Extension non publiée : état « Bientôt » actuel.
- **Extension présente** : carte d'état « L'extension est prête » (icône CircleCheck sur fond succès) + bouton primaire « Capturer une démo » ; trois faits : Version (« 0.3.0 · à jour » ou « Mise à jour disponible »), Dernière capture (« il y a 2 h · « Démo CRM » »), Raccourci clavier ; carte « Bien capturer » (trois conseils) et lien « Gérer l'extension dans le navigateur ».

---

## §8 Démo hors ligne (nouvelle fonction)

- **Où** : menu ⋯ de la barre de la démo, « Démo hors ligne… » (à côté des notes du présentateur), qui ouvre une petite fenêtre : taille estimée, avertissement d'accès, « Télécharger l'archive ».
- **Format** : archive `.zip` autonome, « demo-crm-hors-ligne-2026-11-24.zip » : `index.html` + lecteur + toutes les ressources (captures, images ajoutées incrustées, voix, vidéos, polices). S'ouvre par double-clic, sans réseau, dans Chrome, Edge, Firefox et Safari récents. Un `LISEZ-MOI.txt` explique l'ouverture.
- **Limites** : 300 Mo par archive (la fenêtre montre la taille estimée avant de générer) ; les liens externes et les pages HTML Sandbox liées à un site restent visibles mais ne s'ouvrent pas (« Disponible en ligne seulement ») ; les variables prennent leur valeur de repli ; pas de mise à jour automatique (refaire l'archive après une republication).
- **Accès** : l'archive contourne les modes d'accès (mot de passe, invitation) : génération réservée aux rôles qui peuvent « Diffuser », et seulement si « Exports hors de TutoClick » est autorisé (Paramètres › Sécurité). Avertissement avant la génération : « Toute personne qui a le fichier voit la démo, sans mot de passe. »
- **Données** : v1 **sans suivi** (aucune requête réseau, aucune donnée gardée) ; les formulaires de lead sont remplacés par « Laissez votre adresse sur notre stand » (texte réglable) ou masqués. Le suivi différé est une question pour le client (ci-dessous).
- **Recette** : archive générée, ouverte depuis le disque réseau coupé (Playwright `offline`), toutes les étapes, voix et vidéo ; aucune requête sortante ; taille affichée.

---

## §9 Analytics, Leads et Visiteurs dans la démo — priorité haute (maquettes `demo-analytics-*`)

**Problème** : depuis une démo, Analytics ou Leads ouvrent une page de l'app (barre latérale, fil d'Ariane) ; la personne sort de la démo.

- **Une barre de démo commune** à toutes les vues d'une démo : « ← Démos » (ou « ← Analytics » si l'on vient de là), nom et état de la démo, onglets **Édition · Aperçu · Analytics · Leads · Visiteurs**, puis « Partager » et « Publier ». La barre latérale de l'app n'apparaît pas.
- À droite de la barre : menu ⋯ (notes du présentateur, démo hors ligne §8, historique des versions §11, Diffuser), « Partager » en primaire.
- Routes : `/demos/:id/edit`, `/demos/:id/preview`, `/demos/:id/analytics`, `/demos/:id/leads`, `/demos/:id/visitors`. Changer d'onglet ne recharge pas la démo ; « Partager » ouvre la fenêtre §1 au-dessus de n'importe quelle vue.
- Contenu des vues, centré (1 200 px au plus), sur le fond de l'app (maquette `demo-analytics-*`) :
  - **Analytics** : sous-onglets **Général** · **Sessions** ; filtres en puces (Source, Visiteurs, Période) ; « Imprimer » et « Télécharger (CSV) » en boutons icône ; indicateurs (vues, visiteurs uniques, complétion, leads) ; vues par jour ; « Par moyen de partage » (mêmes noms que §1) ; parcours étape par étape ; **Localisation** (ville approximative, sans conserver l'adresse IP) ;
  - **Leads** : le tableau des leads de la démo, recherche, export CSV ;
  - **Visiteurs** : les sessions de la démo (visiteur anonyme ou identifié, date, source, progression, durée), filtre par source.
- À 390 : les onglets deviennent un bouton-menu « Analytics ▾ » ; « Partager » devient un bouton icône.
- L'Analytics global de l'espace garde ses pages ; cliquer sur une démo y ouvre `/demos/:id/analytics` avec « ← Analytics ».
- Recette : `demo-vues.e2e` : chaque onglet sans barre latérale ni changement de page complet, retour selon l'origine, focus sur le h1 de la vue, 390, axe, clair et sombre.

---

## §10 Liste des démos : extension et « Créé par »

- Tant que l'extension n'est pas installée (et qu'elle est publiée), un bouton secondaire **« Installer l'extension »** (icône Puzzle) s'affiche dans l'en-tête de la page Démos, à gauche de « Nouvelle démo ». Il ouvre la page Extension (§7) ; il disparaît dès que l'extension est détectée. Un seul primaire reste : « Nouvelle démo ».
- Filtre **« Créé par »** : menu avec recherche de membres, avatar (photo ou initiales) et nombre de démos par membre ; « Moi » en premier.

## §11 Historique des versions (à étudier)

Vu chez le concurrent dans le menu ⋯ de la démo. Non spécifié ici : à étudier après les priorités (liste des publications avec date et auteur, aperçu d'une version, « Restaurer cette version »). Je prépare une note si le chef le met au programme.

---

## Questions pour le client (via le chef, « À faire par vous »)

1. **§1** : « Diffuser » (SCORM, LMS, intranet) : fenêtre séparée, ou un mode de plus dans la fenêtre Partager ? (Les captures de référence sont reçues.)
2. **§9** : « Visiteurs » = la liste des sessions de la démo, est-ce bien ce qu'il attend ? Ou une vue par personne identifiée (leads, invités) ?
3. **§8** : sur un salon, veut-il **collecter des leads hors ligne** (enregistrés dans l'archive puis envoyés au retour du réseau, avec consentement) ? Cela suppose un suivi différé et un traitement RGPD : à confirmer avant de le spécifier.
4. **§4** : l'heure du résumé quotidien (9 h) lui convient-elle ?
