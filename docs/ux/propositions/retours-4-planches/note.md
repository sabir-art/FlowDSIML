# Retours client sur 4 planches : propositions reprises

Proposition pour validation du client. **Aucun code avant validation.**

Planches (avant / après, 1440 et 390, clair et sombre) :
1. `1-mot-de-passe.png`
2. `2-lien.png`
3. `3-assistant-ia.png`
4. `4-slack.png`

Toutes les données sont fictives (acme, example).

**Mesures communes, relevées sur les maquettes** :
- libellé → contrôle : 8 px (`--fd-space-2`) ;
- contrôle → aide : 8 px (`--fd-space-2`) ;
- section → section : 24 px (`--fd-space-6`) ;
- aucun débordement à 1440 ni à 390.

Les rayons suivent RADIUS-01 : contrôle 10, petit contrôle 8, surface 12, menu 16.

## 1. Accès › Avec un mot de passe

Le modèle est celui d'un gestionnaire de mots de passe.

- **Champ** de 40 px :
  - une icône Clé à gauche ;
  - à droite, **Afficher** (œil, `aria-pressed`) puis **Copier**, deux boutons icône de 32 px, tous deux dans le champ.
- **Suggestion au focus** : une petite liste s'ouvre juste sous le champ, à 4 px.
  - Elle contient une option : icône Cadenas, le mot de passe proposé (« Rapide-Cactus-48-Lune », quatre parties, 16 caractères au moins), la ligne « Mot de passe fort · {n} caractères » et l'étiquette verte **Suggéré**.
  - Un clic ou Entrée remplit le champ et ferme la liste.
  - Si l'on tape, la liste se ferme et le visiteur garde son propre mot de passe. Échap ferme aussi la liste.
  - Accessibilité : le champ porte `role="combobox"` avec `aria-autocomplete="list"`, et la liste est un `listbox`.
  - La suggestion change à chaque ouverture tant que le champ est vide.
- **Retirés** : le bouton « Proposer un mot de passe » et le bloc bleu d'information.
  - Celui de la carte est retiré.
  - Celui du bas de page est retiré aussi : il répète la phrase « Vaut pour le lien, l'intégration… » du haut.
- **Gardés** :
  - l'aide « 8 caractères au moins. Communiquez-le séparément du lien. » ;
  - **Enregistrer le mot de passe** (primaire de 32 px, aligné à droite), désactivé tant que le champ a moins de 8 caractères.

## 2. Partager › Lien

- **Rythme** : libellé → contrôle → aide (8 / 8), et 24 px entre les sections. L'ordre des sections :
  1. bandeau d'accès ;
  2. Lien de la démo ;
  3. Adresse personnalisée ;
  4. Paramètres d'URL.
- **Envoi** : on revient à **trois boutons icône seuls** de 40 px (E-mail, Message, QR code), alignés sur le bord gauche du champ, à 12 px sous le champ et à 8 px l'un de l'autre.
  - Il n'y a ni libellé ni phrase d'explication.
  - Chaque bouton a un nom accessible et une **infobulle** au survol et au focus : « Envoyer par e-mail », « Envoyer par message », « Télécharger le QR code (PNG) ».
  - L'infobulle s'affiche sur le côté quand la place manque au-dessus.
- **Envoi impossible** (démo non publiée, ou accès « Sur invitation ») : les boutons ont `aria-disabled`, et l'infobulle donne la raison (« Publiez la démo pour envoyer son lien. »).
- **Adresse personnalisée** :
  - le préfixe est tronqué **par la gauche** (« …ample/acme-analytics/ »), pour garder la fin utile ;
  - il prend 55 % de la largeur au plus ;
  - les deux bouts sont arrondis.
- **Sous 600 px** :
  - le préfixe passe **au-dessus** du champ, en une ligne de texte discret (12 px, gris, 4 px au-dessus du champ) ;
  - le slug prend toute la largeur, dans un champ de 40 px ;
  - dans le bandeau d'accès, « Changer l'accès » devient un **lien** sous l'aide, à la place du bouton, et le bandeau tient en 3 lignes au plus.

## 3. Assistant IA

L'éditeur est réservé aux écrans de 1024 px et plus : il n'y a pas de vue à 390.

- **Retiré** : le sélecteur « Modèle » en haut du panneau.
- **Pilule du modèle** dans le champ de saisie, en bas à droite, juste avant Micro et Envoyer.
  - Les trois contrôles font 32 px, ont le même centre et sont à 4 px l'un de l'autre.
  - La pilule est un bouton fantôme 13 px / 500, avec un chevron. Elle affiche « Auto » par défaut.
  - Ouverte, elle prend le fond `surface-sunken` et `aria-expanded="true"`.
- **Menu** (288 px, rayon 16) : il s'ouvre au-dessus de la pilule, aligné sur le bord droit du panneau. Il contient, dans l'ordre :
  1. **Auto**, coché : « Équilibre la vitesse, l'effort et le coût ». L'assistant choisit le modèle selon la demande, parmi ceux autorisés.
  2. Un filet, puis le titre de section **Recommandé**, puis une ligne par modèle autorisé :
     - la marque du fournisseur, dans une tuile de 24 px (un monogramme dans la maquette ; le logo officiel en production) ;
     - le nom (« Claude Sonnet », « Claude Opus ») ;
     - une ligne d'aide ;
     - une étiquette **Bêta** facultative (bleu doux, BADGE-01), seulement si le fournisseur marque le modèle comme préversion.
  3. Un filet, puis **Autres modèles ›**, un sous-menu qui s'ouvre sur le côté. Il liste les autres modèles autorisés. Pour l'instant :
     - « Modèles OpenAI », grisé, avec « Bientôt » ;
     - l'aide « Le propriétaire choisit les modèles dans Paramètres › Assistance IA ».
- Le menu ne montre **que les modèles autorisés par le propriétaire** : Opus et Sonnet aujourd'hui, OpenAI plus tard.
  - Les lignes de modèle ont `role="menuitemradio"` et le modèle courant est coché.
  - Le texte de toutes les lignes est aligné : « Autres modèles » a une tuile vide.
- **Sur chaque résultat**, le pied garde le modèle : « Généré par IA (Auto · Claude Sonnet), à vérifier ». Avec Auto, il dit le modèle réellement utilisé.
- Le reste de la spec L63 ne change pas : cartes avant/après, Tout appliquer, section Modèles des Paramètres.

## 4. Fenêtre Slack

Elle suit le gabarit des autres fenêtres d'intégration (MODAL-01).

- **En-tête standard** :
  - une tuile de 40 px avec le logo ;
  - le titre « Slack » ;
  - **une ligne** de sous-titre : « Les alertes de l'espace dans un canal. » (c'est l'intro, raccourcie) ;
  - la croix de fermeture ;
  - une fois connecté, l'étiquette verte **Connecté** à côté du titre.
- **Ce qui arrive dans le canal** : une liste encadrée (rayon 12, filets), avec des lignes de 56 px.
  - Chaque ligne a une icône dans une tuile de 32 px, un libellé et une aide d'une ligne.
  - À droite, une **colonne d'état** de 64 px, alignée à droite : un interrupteur, ou « Bientôt » en gris 13 px.
  - Alertes analytics : interrupteur.
  - Nouveaux leads et Commentaires : « Bientôt ».
- **Adresse du webhook entrant** :
  - le libellé, avec à droite le lien **Comment obtenir l'adresse ?** (icône lien externe ; il ouvre la page d'aide de Slack dans un nouvel onglet). Sous 600 px, le lien passe sous le libellé, à 4 px ;
  - un champ de 40 px, avec l'exemple en texte indicatif ;
  - une aide d'une ligne qui ne répète pas cet exemple : « Elle est masquée une fois enregistrée. » ;
  - l'erreur d'hôte reste sous le champ.
- **Pied, non connecté** : Annuler, puis **Connecter**. Connecter vérifie l'adresse et envoie un message de test ; en cas d'échec, l'erreur s'affiche sous le champ.
- **État connecté** :
  - le champ est remplacé par une ligne en lecture seule (fond `surface-sunken`, icône Cadenas) qui affiche l'adresse **masquée** : `hooks.slack.com/services/T000…/••••` ;
  - aide : « Pour changer de canal, déconnectez Slack puis reconnectez-le. » ;
  - pied : **Déconnecter** à gauche (texte de danger, avec une confirmation), puis **Envoyer un test** et **Enregistrer** à droite. Enregistrer est désactivé tant qu'aucun interrupteur n'a changé ;
  - à 390 : Envoyer un test et Enregistrer se partagent la ligne, et Déconnecter passe dessous, centré.
