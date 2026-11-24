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

**Modèle à rendre visible** : l'**accès** (qui peut voir) est un réglage de la démo, unique, qui s'applique à **tous** les canaux (lien, intégration, liens personnalisés, page publique). Les **canaux** sont seulement des façons de distribuer la même démo.

### 1.1 Ouverture
- Fenêtre (`dialog`, MODAL-01) **au-dessus de la démo**, ouverte par « Partager » depuis la barre de la démo (toutes les vues, §9), la carte d'une démo (menu ⋯) et le tableau de bord.
- Largeur 720 px, hauteur selon le contenu (max : fenêtre − 48 px, contenu qui défile). À 390 : feuille plein écran depuis le bas.
- Adresse : `?share=1` sur la vue courante (lien direct partageable en interne). L'ancienne route `/demos/:id/share` redirige vers `/demos/:id/edit?share=1`.
- Fermeture : croix, « Terminé », Échap, clic sur le voile. Le focus revient au bouton « Partager ».

### 1.2 Contenu, de haut en bas (maquette `partager-lien-*`)
1. **En-tête** : tuile Share2, « Partager « Démo CRM » », sous-titre d'état (« Publiée le 24 nov. à 10:12 » / « Pas encore publiée »).
2. **Qui peut voir la démo** (libellé de groupe) : carte de l'accès courant (icône, mode, phrase) + « Modifier ». Dessous, la ligne « Vaut pour » suivie de quatre puces : Lien, Intégration, Liens personnalisés, Page publique. C'est la réponse visuelle au « quel lien ? ».
3. **Comment la partager** (libellé de groupe) : onglets `tablist` Lien · Intégrer · Liens personnalisés · Page publique (flèches gauche/droite). À 390 : un bouton-menu à la place des onglets (pas de défilement horizontal).
4. **Panneau du canal** (§1.3).
5. **Pied** : « Ailleurs : » E-mail · GIF ou vidéo (boutons discrets) ; à droite « Terminé ».

### 1.3 Panneaux des canaux
- **Lien** : CopyField du lien public + « Ouvrir » (nouvel onglet). Aide : « Le lien ouvre la version publiée. Il ne change pas quand vous republiez. » Trois lignes repliables :
  - « Personnaliser l'adresse » (ancien champ d'adresse personnalisée, suffixe et redirection 90 jours inchangés) ;
  - « Adapter le texte au destinataire » (paramètres d'URL, code en monospace) ;
  - « Aperçu sur les réseaux » (l'ancienne carte d'aperçu ; « Bientôt » tant que l'image n'est pas générée).
- **Intégrer** (maquette `partager-integrer-*`) : trois formats en cartes radio avec mini-aperçu — « Encadré dans la page », « Bouton qui ouvre la démo », « Plein écran » ; code (`pre`, monospace, passe à la ligne) ; « Copier le code » (primaire dans ce panneau) ; lien « Guides : WordPress, Notion, intranet ».
- **Liens personnalisés** : la liste existante (nom du destinataire, date, vues) avec « Créer un lien » et « Importer (CSV) » ; chaque lien suit l'accès de la démo.
- **Page publique** : interrupteur « Afficher cette démo sur la page publique de l'espace » + lien « Régler la page publique » (Paramètres › Page publique). Si la page publique est coupée : la ligne le dit, interrupteur désactivé avec la raison.

### 1.4 Modifier l'accès (maquette `partager-acces-*`)
- Sous-vue **dans la même fenêtre** (flèche retour « Retour au partage », titre « Qui peut voir la démo », phrase : « Le choix vaut pour le lien, l'intégration, les liens personnalisés et la page publique. »).
- Cartes radio : Toute personne avec le lien · Avec un mot de passe · Sur invitation · Par domaine e-mail. Les champs du mode choisi s'ouvrent dans sa carte (mot de passe ; liste des invités ; domaines).
- Seuls les modes autorisés par l'espace (Paramètres › Sécurité) sont proposés ; un mode interdit n'est pas affiché (note en bas, icône Lock).
- « Voir ce que le visiteur verra » ouvre l'écran d'accès en aperçu.
- Pied : « Annuler » et « Enregistrer l'accès ». Échap revient d'abord à la vue principale.

### 1.5 Démo non publiée (maquette `partager-nonpubliee-*`)
- Bandeau `role="status"` : « La démo n'est pas publiée : les liens et le code ne fonctionneront qu'après la publication. » + « Publier » (primaire, dans le bandeau).
- Les canaux restent visibles ; le lien est grisé, « Ouvrir » désactivé avec la raison. L'accès se règle déjà.

### 1.6 Ce qui sort de Partager
- La colonne de droite actuelle (aperçu, formation, statistiques de la semaine) disparaît : les chiffres sont dans **Analytics de la démo** (§9), la formation dans « Diffuser ».
- « Diffuser » (SCORM, LMS, intranet, export) reste une fenêtre à part, ouverte depuis le menu ⋯ de la barre de la démo.

### 1.7 Recette
`partager.e2e` : ouverture depuis la barre, la carte et `?share=1` ; focus piégé et rendu ; chaque onglet ; copie ; sous-vue Accès (mot de passe, retour, Échap) ; non publiée ; 390 sans défilement horizontal ; axe sans violation ; clair et sombre.

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

- **Où** : fenêtre « Diffuser », nouvelle ligne « Hors ligne (salon, réseau faible) ».
- **Format** : archive `.zip` autonome, « demo-crm-hors-ligne-2026-11-24.zip » : `index.html` + lecteur + toutes les ressources (captures, images ajoutées incrustées, voix, vidéos, polices). S'ouvre par double-clic, sans réseau, dans Chrome, Edge, Firefox et Safari récents. Un `LISEZ-MOI.txt` explique l'ouverture.
- **Limites** : 300 Mo par archive (la fenêtre montre la taille estimée avant de générer) ; les liens externes et les pages HTML Sandbox liées à un site restent visibles mais ne s'ouvrent pas (« Disponible en ligne seulement ») ; les variables prennent leur valeur de repli ; pas de mise à jour automatique (refaire l'archive après une republication).
- **Accès** : l'archive contourne les modes d'accès (mot de passe, invitation) : génération réservée aux rôles qui peuvent « Diffuser », et seulement si « Exports hors de TutoClick » est autorisé (Paramètres › Sécurité). Avertissement avant la génération : « Toute personne qui a le fichier voit la démo, sans mot de passe. »
- **Données** : v1 **sans suivi** (aucune requête réseau, aucune donnée gardée) ; les formulaires de lead sont remplacés par « Laissez votre adresse sur notre stand » (texte réglable) ou masqués. Le suivi différé est une question pour le client (ci-dessous).
- **Recette** : archive générée, ouverte depuis le disque réseau coupé (Playwright `offline`), toutes les étapes, voix et vidéo ; aucune requête sortante ; taille affichée.

---

## §9 Analytics, Leads et Visiteurs dans la démo — priorité haute (maquettes `demo-analytics-*`)

**Problème** : depuis une démo, Analytics ou Leads ouvrent une page de l'app (barre latérale, fil d'Ariane) ; la personne sort de la démo.

- **Une barre de démo commune** à toutes les vues d'une démo : « ← Démos » (ou « ← Analytics » si l'on vient de là), nom et état de la démo, onglets **Édition · Aperçu · Analytics · Leads · Visiteurs**, puis « Partager » et « Publier ». La barre latérale de l'app n'apparaît pas.
- Routes : `/demos/:id/edit`, `/demos/:id/preview`, `/demos/:id/analytics`, `/demos/:id/leads`, `/demos/:id/visitors`. Changer d'onglet ne recharge pas la démo ; « Partager » ouvre la fenêtre §1 au-dessus de n'importe quelle vue.
- Contenu des vues, centré (1 200 px au plus), sur le fond de l'app :
  - **Analytics** : barre de période (7 j · 30 j · 90 j) et export (icône) ; indicateurs ; vues par jour ; « Par moyen de partage » (Lien, Intégration, Liens personnalisés, Page publique — mêmes noms que §1) ; parcours étape par étape ;
  - **Leads** : le tableau des leads de la démo, recherche, export CSV ;
  - **Visiteurs** : les sessions de la démo (visiteur anonyme ou identifié, date, source, progression, durée), filtre par source.
- À 390 : les onglets deviennent un bouton-menu « Analytics ▾ » ; « Partager » devient un bouton icône.
- L'Analytics global de l'espace garde ses pages ; cliquer sur une démo y ouvre `/demos/:id/analytics` avec « ← Analytics ».
- Recette : `demo-vues.e2e` : chaque onglet sans barre latérale ni changement de page complet, retour selon l'origine, focus sur le h1 de la vue, 390, axe, clair et sombre.

---

## Questions pour le client (via le chef, « À faire par vous »)

1. **§1** : envoyer les captures de référence annoncées ; et confirmer que « Diffuser » (SCORM, intranet, export) reste une fenêtre séparée de « Partager ».
2. **§9** : « Visiteurs » = la liste des sessions de la démo, est-ce bien ce qu'il attend ? Ou une vue par personne identifiée (leads, invités) ?
3. **§8** : sur un salon, veut-il **collecter des leads hors ligne** (enregistrés dans l'archive puis envoyés au retour du réseau, avec consentement) ? Cela suppose un suivi différé et un traitement RGPD : à confirmer avant de le spécifier.
4. **§4** : l'heure du résumé quotidien (9 h) lui convient-elle ?
