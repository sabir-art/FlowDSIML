# L65 — Partager : accès, mot de passe, lien, adresse, liens personnalisés

Retour de l'utilisateur du 25/11 (tests réels). Planche : `docs/ux/propositions/l65/planche-l65.png`. Elle montre Accès et Lien, aujourd'hui puis proposés, en clair et en sombre. La structure de la fenêtre Partager (navigation à gauche, contenu à droite) ne change pas.

## 1. Accès : réglages dans la carte choisie

- Le bloc de réglages d'une option (mot de passe, invitations, domaines) est **dans la carte de l'option choisie**. Il n'est plus décalé à droite sous la carte.
  - La carte s'agrandit vers le bas.
  - Le bloc est séparé de l'en-tête de la carte par un filet, avec un retrait de 16 px aligné sur le bord gauche de la carte.
  - Carte choisie : bordure et contour intérieur de 1 px en couleur de marque.
- **Information** (aujourd'hui le bloc bleu) : elle vient **dans** ce bloc, pleine largeur, sous les champs.
  - Fond `--fd-bleu-500` à 10 %, texte `--fd-bleu-800` (en sombre : bleu-200), rayon 10, icône Info.
  - Exemples : « Communiquez le mot de passe séparément du lien (par téléphone, par exemple). », ou « Chaque personne invitée reçoit son propre lien ; il ne fonctionne que pour elle. »
- Les mêmes règles valent pour « Sur invitation » et « Par domaine e-mail ».

## 2. Mot de passe

- **Champ** : 40 px, rayon 10. **L'œil est dans le champ**, à droite, comme sur la page de connexion : bouton icône de 32 px, rayon 8, `aria-pressed`, et nom « Afficher le mot de passe » ou « Masquer le mot de passe ». Un bouton **Copier** est juste à côté de l'œil, dans le champ. Plus de boutons collés hors du champ.
- **« Générer » devient « Proposer un mot de passe »** : bouton secondaire de 32 px avec l'icône RefreshCw, sous le champ, à gauche.
  - Il remplit le champ avec un mot de passe lisible, du type « Rapide-Cactus-48 » : trois parties, 14 caractères au moins.
  - Le mot de passe est affiché en clair (œil actif), et un toast confirme « Mot de passe proposé. Copiez-le avant d'enregistrer. »
- **Enregistrer le mot de passe** : primaire de 32 px, à droite sur la même ligne. Il est désactivé (`aria-disabled`) tant que le champ est vide ou trop court.
- **Aide** sous le champ : « 8 caractères au moins. Le changer oblige les visiteurs à saisir le nouveau. »
- **« Demander aussi l'e-mail du visiteur »** : il reste dans le bloc, en ligne de réglage avec un interrupteur. Tant qu'il n'est pas disponible, il porte « Bientôt » en gris.

## 3. Lien

- **Accès en résumé** : la pastille « Toute personne avec le lien · Modifier » quitte l'en-tête de la fenêtre. Elle devient la **première ligne du contenu** :
  - un bandeau `surface-sunken`, rayon 12 ;
  - à gauche, l'icône de l'accès dans une tuile de 36 px, puis le nom de l'accès en demi-gras et une ligne d'aide (« Accès libre, sans identification ») ;
  - à droite, le bouton secondaire **Changer l'accès**, qui ouvre la section Accès.

  Le même bandeau est en tête de « Intégrer », « Liens personnalisés » et « Page de la démo ».
- **Adresse** : champ en lecture seule de 40 px avec Copier dans le champ, plus un bouton carré de 40 px « Ouvrir dans un nouvel onglet ».
- **Envoyer le lien** : les 3 icônes deviennent **trois boutons libellés** de 32 px, avec icône et texte : **E-mail**, **Message**, **QR code**. Aide : « E-mail et Message ouvrent votre messagerie avec le lien prêt à envoyer. Le QR code se télécharge en PNG. »
  - Quand un envoi n'est pas possible (démo non publiée, ou accès « Sur invitation »), le bouton est `aria-disabled` et la raison est écrite sous la rangée. Par exemple : « Publiez la démo pour envoyer son lien. », ou « Avec l'accès Sur invitation, envoyez plutôt des invitations depuis Accès. »
  - Jamais d'icônes grisées sans explication.
- **Adresse personnalisée** : groupe à préfixe de 40 px, rayon 10 **aux deux bouts** (RADIUS-01).
  - Le préfixe (`demos.tutoclick.example/acme-analytics/`) est sur fond `surface-sunken` et prend 55 % de la largeur au plus. S'il est trop long, il est tronqué **par la gauche** (« …/acme-analytics/ »), pour garder visible la fin utile.
  - La partie modifiable prend le reste. Son texte ne sort jamais du champ : il défile dans le champ, avec `min-width: 0` et `overflow: hidden`. Le bord droit est arrondi.
  - Aide : « Lettres minuscules, chiffres et tirets. L'ancienne adresse redirige vers la nouvelle. »
- « Paramètres d'URL » reste un dépli, sous l'adresse personnalisée.

## 4. Nouveau lien personnalisé (fenêtre)

- La fenêtre a le gabarit standard, comme « Inviter des membres » :
  - en-tête en bande, avec une tuile d'icône (Link) de 40 px, le titre « Nouveau lien personnalisé » et la croix de fermeture ;
  - filet, corps, filet, puis le pied avec « Annuler » et « Créer le lien ».
- **Aucun nom technique de variable** : les champs portent leur libellé en clair, **Prénom**, **Entreprise**, **Adresse e-mail (facultatif)**, et non `{{first_name}}` ou `{{company}}`.
  - Aide sous le groupe : « Ces valeurs remplacent les variables Prénom et Entreprise dans la démo pour ce destinataire. »
  - Dans la liste des liens, la ligne affiche « Léa · Globex », comme aujourd'hui.
- **Expiration** : liste de 40 px (« Jamais », « 7 jours », « 30 jours », « Date… »).
- **Après création** : toast « Lien créé et copié ». La nouvelle ligne est mise en évidence 2 s dans la liste, par un fond `surface-selected` qui s'efface en 600 ms (rien en mouvement réduit).

## 5. e2e

En clair et sombre, à 1440 et 390 :
- l'œil et Copier sont dans le champ du mot de passe ;
- Proposer remplit un mot de passe de 14 caractères au moins et l'affiche ;
- le bloc de réglages est dans la carte choisie, à 16 px de son bord gauche ;
- les boutons d'envoi ont un libellé, et s'ils sont désactivés, la raison est visible ;
- l'adresse personnalisée ne déborde pas et a ses deux bords arrondis ;
- le bandeau d'accès est en tête de Lien, et il n'y a plus de pastille d'accès dans l'en-tête ;
- la fenêtre « Nouveau lien personnalisé » ne contient aucun `{{`.
