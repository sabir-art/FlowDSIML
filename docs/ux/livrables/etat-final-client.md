# TutoClick : état final (novembre 2026)

> Version reformulée pour le client par la Lead UX, à partir de `docs/tech/etat-final.md` (main, a01f2ed). Le fichier de `docs/tech` reste la version de l’équipe technique ; à reporter si le chef d'équipe le décide.

Ce document résume ce qui a été livré, ce qui a des limites et ce qui attend une décision de votre part.

Le tableau de suivi du projet donne le détail écran par écran : 352 écrans et états, dont 339 validés. Les 13 autres attendent une décision de votre part (voir « Décisions en attente »).

## Ce que vous pouvez faire avec TutoClick

### Créer une démo
- **Capture**
  - Une extension pour le navigateur Chrome enregistre chaque écran pendant que vous utilisez votre logiciel. Elle enregistre au choix des captures d'écran, une vidéo ou la page elle-même, modifiable ensuite.
  - Elle fonctionne aussi sur plusieurs onglets et en format mobile.
  - Avant tout envoi, les données personnelles visibles (noms, adresses e-mail, numéros) sont repérées et floutées. Un écran vous permet de vérifier ce floutage.
- **Import** : sans l'extension, vous pouvez partir d'images (captures d'écran existantes) ou d'un modèle prêt à l'emploi.
- **Édition**
  - **Construction des étapes** : vous placez les étapes, les bulles d'explication et les zones à cliquer, puis les regroupez en chapitres.
  - **Variantes et parcours** : vous pouvez proposer des choix au visiteur, montrer un « avant / après » ou insérer une vidéo avec pauses et sous-titres.
  - **Voix et termes métier** : une voix off peut accompagner chaque étape, et le glossaire explique les termes métier.
  - **Travail en équipe** : les commentaires internes ne sont jamais publiés, et vous pouvez annuler ou rétablir une modification.
  - **Présentation** : vous appliquez les styles à vos couleurs.

### Montrer et diffuser une démo
- **Lecteur** : visite guidée pas à pas, mise en avant d'une zone, liste des étapes, lecture automatique, thème clair ou sombre, sous-titres et navigation au clavier. L'arabe s'affiche de droite à gauche.
- **Partage**
  - par un lien, protégé ou non par un mot de passe, avec une date d'expiration au besoin ;
  - par une page de présentation de la démo ;
  - par un centre qui regroupe vos démos.
- **Intégration** : la démo s'insère dans un intranet ou un site, avec des consignes prêtes pour WordPress, SharePoint, Moodle et Notion.
- **Plateformes de formation** : un fichier au format SCORM, le standard des plateformes de formation, transmet la progression des apprenants.
- **Exports** : PDF, GIF animé, vidéo MP4, et une version accessible au lecteur d'écran (page web).

### Former
Quiz et sondages, suivi des apprenants, parcours de formation, centre de formation et attestations de suivi.

### Mesurer
- **Statistiques** : tableau de bord, statistiques par démo, visiteurs en direct, regroupements de visiteurs et visiteurs qui reviennent.
- **Tests et alertes** : comparaison de deux versions d'une étape, et alertes quand un seuil est franchi.
- **Envoi vers vos outils** : les événements peuvent être transmis automatiquement à vos autres outils.

### Organiser l'espace de travail
- **Rôles** : propriétaire, administrateur, éditeur et lecteur.
- **Accès** : dossiers réservés à certains membres, règles de partage communes à tout l'espace.
- **Accompagnement** : mode présentateur pour les réunions, aide intégrée et prise en main guidée.
- **Données personnelles** : chacun peut télécharger ses données ou supprimer son compte.

### Assistance IA
Elle est désactivée par défaut, et seul un administrateur peut l'activer.

- **Fonctions** :
  - rédaction et traduction des textes ;
  - suggestions d'amélioration ;
  - création d'une démo à partir d'un plan ;
  - données fictives et graphiques ;
  - assistant dans l'éditeur ;
  - voix de synthèse et sous-titres automatiques.
- **Fournisseurs** :
  - **Anthropic (Claude)** : textes ;
  - **ElevenLabs** : voix et sous-titres. Ce fournisseur s'active séparément, avec sa propre confirmation.
- **Garanties** :
  - aucune proposition n'est appliquée sans votre validation ;
  - un quota mensuel limite l'usage ;
  - les zones floutées et les images ne sont jamais envoyées.

### Qualité
- **Langues** : l'interface est en français et en anglais.
- **Accessibilité** : audit selon le référentiel officiel (RGAA) et déclaration d'accessibilité publiée.
- **Sécurité** : plus de 900 tests vérifient que chacun n'accède qu'à ce que son rôle autorise.
- **Tests du parcours** : des tests automatiques rejouent les parcours complets dans un navigateur.

## Limites connues

- **Interdiction des exports**
  - La règle « Téléchargement des exports » masque les exports dans l'application.
  - Comme les fichiers sont fabriqués sur l'ordinateur de l'utilisateur, une personne techniquement avertie qui contourne volontairement l'application pourrait encore en produire un.
  - Une garantie stricte demanderait de fabriquer les exports sur nos serveurs.
- **Voix de synthèse**
  - 6 voix, qui parlent plusieurs langues, mais sans voix dédiée à chaque langue.
  - Une voix ou une transcription dure 2 minutes au plus.
- **Capture** : il n'y a pas d'application à installer sur l'ordinateur (Mac ou Windows). La capture passe par l'extension Chrome.
- **Démo sur le vrai logiciel** : faire tester directement votre logiciel réel est hors périmètre. La page modifiable capturée par l'extension sert d'alternative.

## Points techniques restant ouverts

Ces points n'empêchent pas l'utilisation. Le détail est dans `docs/tech/dettes.md`, pour l'équipe technique.

- **Suppression automatique des vidéos inutilisées**
  - Elle démarrera dès que deux réglages de sécurité auront été créés sur l'hébergement.
  - En attendant, ces vidéos comptent dans l'espace de stockage.
- **Ancienne copie d'une démo** : une copie peut rester en mémoire chez l'hébergeur. Une seule démo, fictive, est concernée.
- **Identification de l'adresse des visiteurs** : elle sert à limiter les abus à l'ouverture des démos. Son réglage reste à confirmer dans les journaux techniques.
- **Envoi automatique des événements vers vos outils** : deux contrôles sont traités séparément. Le risque est faible et des limites sont en place.

## Décisions en attente de votre part

1. **Envoi d'e-mails par TutoClick**, avec un serveur d'envoi à fournir.
   - Il débloque l'accès sur invitation, l'accès réservé à un domaine e-mail (par exemple toutes les adresses de votre structure) et les liens personnels.
   - 11 écrans sont prêts et affichés « Bientôt ».
2. **Connexion de TutoClick à d'autres logiciels (API)** : clés d'accès pour vos scripts, pilotage du lecteur depuis une autre page, accès par jeton depuis un intranet. Ces fonctions sont reportées et affichées « Bientôt ».
3. **Adresse web propre au lecteur.** Héberger les démos publiées sur une adresse séparée de l'application renforce la sécurité. C'est nécessaire avant une ouverture à un large public.
4. **Garantie de non-conservation chez ElevenLabs.** Le fournisseur supprime déjà chaque élément juste après la génération. L'inscrire dans le contrat demande son offre Entreprise.
5. **Paiement en ligne.** Les offres et leurs limites sont prêtes. Le moyen de paiement reste à brancher.
6. **Hors périmètre convenu** :
   - connexion aux outils de gestion de la relation client ;
   - enrichissement des contacts ;
   - connexion unique avec le compte de votre organisation ;
   - adresse web personnalisée par client ;
   - images générées par IA.

## Vitesse d'affichage et accessibilité

Mesures faites avec l'outil Lighthouse de Google, sur mobile, en simulant un réseau et un téléphone lents. Les notes vont de 0 à 100 ; 90 et plus est considéré comme bon.

| Page | Vitesse | Accessibilité |
|---|---|---|
| Connexion | 94 | 100 |
| Tableau de bord | 74 | 100 |
| Éditeur | 75 | 100 |
| Lecteur (démo publiée) | 97 | 100 |

**Déjà amélioré** : les polices et les icônes se chargent plus vite, et rien ne se décale pendant l'affichage.

**Pages encore sous 90**
- Le tableau de bord et l'éditeur attendent plusieurs réponses du serveur l'une après l'autre (connexion, espace de travail, puis contenu) avant d'afficher l'essentiel.
- Les regrouper en une seule demande au démarrage est en cours. Pendant ce chargement, une silhouette grise de la page s'affichera.
