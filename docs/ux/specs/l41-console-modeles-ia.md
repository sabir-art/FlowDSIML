# L41 — Console propriétaire › Modèles IA

Planche : `docs/ux/propositions/l41-modeles-ia/planche-console-modeles-ia.png` (à 1440, clair et sombre). Elle montre la page complète, l'état vide, l'ajout d'une clé, et le côté espace client.

La page est réservée à l'équipe TutoClick (rôle de plateforme). C'est un nouvel onglet **Modèles IA** de la Console, après « Équipe et journal », à l'adresse `#/console/modeles`. Un compte Lecture seule voit tout, mais avec les actions désactivées, comme dans le reste de la Console.

## 1. En-tête

- Titre : « Modèles IA ». Sous-titre : « Fournisseurs et modèles utilisés par les fonctions IA de TutoClick, pour tous les espaces. »
- À droite, le bouton **Historique des changements**, qui ouvre le journal d'audit filtré sur « Modèles IA ». Chaque changement y est journalisé : clé ajoutée, remplacée ou testée, modèle changé, liste de l'assistant modifiée.
- Dès qu'une fonction a un problème, un bandeau d'attention orange s'affiche sous l'en-tête et nomme les fonctions concernées. Par exemple : « 2 fonctions demandent votre attention : Traduction (modèle retiré) et Transcription (clé OpenAI manquante). »

## 2. Fournisseurs

C'est une carte qui contient une liste de lignes de 64 px. Chaque ligne a 4 colonnes alignées sur toute la liste : une tuile de 40 px, le nom et l'usage, l'état (130 px), puis les actions (alignées à droite).

| Fournisseur | Usage | Actions |
|---|---|---|
| Anthropic | Modèles Claude · assistant, rédaction, cohérence, traduction | Tester · Remplacer la clé |
| OpenAI | Modèles GPT · transcription | Ajouter la clé |
| ElevenLabs | Voix de synthèse | Tester · Remplacer la clé |
| Autres fournisseurs | Ajoutés au fil des besoins | « Bientôt », en gris, sans action |

- **États** :
  - **Connecté** (vert, avec Check) : la date d'ajout de la clé s'affiche à côté (« Clé ajoutée le 12 nov. ») ;
  - **Clé manquante** (orange) ;
  - **Clé refusée** (framboise) : le dernier test a échoué, et l'aide dit la cause (« Le fournisseur refuse la clé (401) »).
- La tuile porte l'initiale du fournisseur. Les logos officiels pourront la remplacer si leurs conditions d'usage le permettent.
- **La clé ne s'affiche jamais** : ni en clair, ni masquée, ni par ses derniers caractères.
- **Ajouter ou Remplacer la clé** ouvre une fenêtre MODAL-01 de taille sm :
  - le champ « Clé d'API », de type mot de passe, sans bouton Afficher ;
  - l'aide « Collée une seule fois : elle est chiffrée et ne s'affichera plus. Elle est testée avant d'être enregistrée. » ;
  - les boutons Annuler, puis **Tester et enregistrer**. Si le test échoue, l'erreur s'affiche sous le champ et rien n'est enregistré.
- **Tester** envoie une demande minimale. Le résultat s'affiche en toast : « Anthropic répond (320 ms) », ou bien l'erreur.

## 3. Modèle par fonction

C'est une liste de lignes de 64 px, en 3 colonnes : la fonction (nom et aide), une liste de 40 px, puis l'état.

| Fonction | Aide | Exemple de défaut |
|---|---|---|
| Assistant IA de l'éditeur | Réponses et propositions dans l'éditeur | Auto (§4) |
| Rédaction automatique | Textes des étapes pendant la capture (extension) | Claude Haiku |
| Vérification de cohérence | Titres, textes et pauses de toute la démo | Claude Sonnet |
| Traduction | Démo traduite dans une autre langue | Claude Sonnet |
| Voix | Voix off générée | ElevenLabs · voix multilingue |
| Transcription | Texte d'une voix enregistrée ou importée | OpenAI · transcription |

- **Contenu de la liste** : les modèles des fournisseurs **connectés** qui savent faire la fonction. Chaque option a la marque du fournisseur (tuile de 20 px), le nom du modèle et une aide (vitesse, coût relatif). Un fournisseur sans clé apparaît grisé, avec « Clé manquante ».
- **États de la ligne** :
  - **Actif** (vert) ;
  - **Modèle retiré** : la liste a une bordure orange, et le message dit « Modèle retiré : repli sur {modèle} ». Le service bascule de lui-même sur le modèle de repli (le premier modèle connecté du même fournisseur) jusqu'au prochain choix ;
  - **Clé manquante** : la liste est grisée, avec « Clé {fournisseur} manquante : coupée ». La fonction est coupée dans tous les espaces, et ceux-ci voient « Indisponible pour le moment » ;
  - **Fonction coupée** (neutre) : aucun modèle disponible.
- Un changement de modèle s'applique aux demandes suivantes, sans confirmation. Il est journalisé et annoncé par un toast avec **Annuler**.

## 4. Assistant IA : modèles proposés

C'est une carte en deux colonnes : la liste et les règles d'« Auto » à gauche, l'aperçu du menu à droite (300 px).

- **Liste** : une ligne par modèle. Chaque ligne contient :
  - une poignée de glisser-déposer, avec Monter et Descendre au clavier ;
  - une case **Proposer** ;
  - le nom et le fournisseur ;
  - une liste « Étiquette » : Sans étiquette, Recommandé ou Bêta ;
  - les boutons Monter et Descendre.
  - L'ordre de la liste est celui du menu. Les modèles d'un fournisseur sans clé sont grisés, avec « Ajoutez la clé {fournisseur} ».
- **Ce que fait « Auto »** : 3 règles, chacune sur une ligne « situation → liste de 40 px » :
  - « Demandes courtes (une étape, un texte) » → un modèle coché ;
  - « Analyse de toute la démo, traduction » → un modèle coché ;
  - « Modèle indisponible ou quota atteint » → « Le suivant de la liste » ou un modèle donné.
  - Aide : « Le modèle réellement utilisé s'affiche sur chaque réponse (« Auto · Claude Sonnet »). »
- **Aperçu** : le menu tel que les utilisateurs le voient (planche 3 des retours du 25/11) : Auto, puis « Recommandé » avec les modèles cochés et étiquetés, puis « Autres modèles ». Il se met à jour en direct.
- Il faut au moins un modèle coché. Décocher le dernier est refusé, avec l'aide « Gardez au moins un modèle. »

## 5. Côté espace client : Paramètres › Assistance IA

- La section « Modèles proposés dans l'assistant » remplace l'ancienne section « Modèles » (L63 §4).
- Elle liste **seulement** les modèles cochés dans la Console, dans le même ordre :
  - Auto en tête, toujours coché et désactivé, avec « Toujours proposé » ;
  - puis une case par modèle, avec son étiquette et son aide.
- Aide : « La liste est définie par TutoClick. Vous pouvez retirer des modèles pour votre espace, pas en ajouter. » Puis : « Gardez au moins un modèle coché. Les nouveaux modèles ajoutés par TutoClick arrivent décochés. »
- Un modèle retiré de la Console disparaît de l'espace. Si c'était le seul modèle coché de l'espace, Auto prend le relais.
- Les admins de l'espace voient la section en lecture seule, avec « Réservé aux propriétaires ». Les autres rôles ne la voient pas.
- **Aucun nom de fournisseur dans l'extension** (L64) ; dans l'app, les noms de modèle restent visibles (menu de l'assistant, mention sur les réponses).

## 6. Données et sécurité

- Les clés sont stockées chiffrées côté serveur (coffre de secrets). Elles ne sont jamais renvoyées au navigateur : l'API ne renvoie que l'état, la date d'ajout et le résultat du dernier test.
- Seul le rôle de plateforme **admin** peut écrire. **Lecture seule** voit tout, sans actions.
- Le journal (§1) garde l'auteur, la date, l'objet et l'ancienne et la nouvelle valeur (jamais la clé).

## 7. e2e

- Un client ne voit pas l'onglet, et `#/console/modeles` le renvoie à l'accueil.
- Une clé ajoutée n'est jamais visible : ni dans le DOM, ni dans les réponses du faux serveur.
- Tester et enregistrer : en cas d'échec, l'erreur s'affiche et rien n'est enregistré.
- Clé manquante : la fonction est coupée, et l'espace client voit « Indisponible pour le moment ».
- Modèle retiré : le bandeau et la bordure orange s'affichent, et le repli s'applique.
- Liste de l'assistant :
  - l'ordre et les étiquettes se reflètent dans l'aperçu ;
  - décocher le dernier modèle est refusé ;
  - l'espace client ne voit que les modèles cochés et ne peut pas en ajouter.
- Lecture seule : actions désactivées.
- Tout est vérifié en clair et en sombre, à 1440.
