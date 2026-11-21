# AUTH-ILL : illustration des pages de connexion, d'inscription et d'invitation

> Retour client du 21/11 : le panneau de droite (fenêtre à barre latérale et boutons **bleus**) ressemble à la première version, inspirée d'un outil tiers, et pas à notre marque. On le refait aux couleurs de TutoClick, avec une version stylisée de **notre** app.
>
> **Maquette** : `maquettes/refonte/auth-illustration.html` (Avant / Après, Connexion / Inscription, Clair / Sombre). Captures à 1440 px dans `img/auth-illustration/` : `avant-*` pour l'app réelle sur dev-mvp fdbb6d3, `apres-*` pour la maquette (étapes 1/6 et 2/6 pour la connexion).

## 1. Panneau

- **Fond** :
  - clair : `--fd-prune-900` (#480F2A) ;
  - sombre : `--fd-prune-950` (#2A0C1A).
  - `--fd-lagoon-950` est remplacé. Il n'y a plus aucun bleu d'interface.
- **Mise en page** : padding de 64 × 56 px, la fenêtre en haut et l'accroche en bas (`justify-content: space-between`, gap de 48 px au moins).
- **Masqué sous 900 px**, comme aujourd'hui. `aria-hidden="true"` : c'est une illustration.

## 2. Fenêtre de l'app (stylisée)

- **Cadre** : 560 px de large au plus, rapport 16 / 9, rayon de 14 px, ombre `0 24px 48px rgb(0 0 0 / .32)`. Sans barre de navigateur.
- **Barre latérale NAV-02** (26 % de la largeur) :
  - fond `nav-bg` (#F7F7F8 en clair, #101317 en sombre), filet à droite ;
  - le symbole prune et une barre pour le nom ;
  - 5 éléments (icône de 8 px et barre), le premier actif sur `nav-active`.
- **Contenu** sur `content-bg` :
  - un titre (barre) et un bouton prune « Nouvelle démo » ;
  - 3 cartes de démo (vignette sur `surface-sunken`, deux barres de méta) ;
  - des lignes de liste.
- **Que des formes** : pas de texte lisible dans la fenêtre, hors de la bulle. Les gris viennent des neutres de la marque (#C9CED6 et #8A94A2 en clair, #3A424D et #6B7582 en sombre).
- **Hotspot** :
  - 14 px, prune (#A3195B en clair, #CF86A9 en sombre) ;
  - **contour blanc de 2 px**, pour rester visible sur le bouton prune ;
  - anneau qui pulse (`--fd-motion-duration-pulse`, 1 800 ms, `transform` et `opacity`).
- **Bulle** :
  - 196 px, fond blanc, rayon de 10 px ;
  - compteur « 1 / 6 », titre de 12 px en 600, texte de 11 px ;
  - bouton « Suivant » prune.
  - Étape 1 : « Créez votre première démo » sur le bouton « Nouvelle démo ».
  - Étape 2 : « Ouvrez la démo Acme CRM » sur la première carte.

## 3. Accroche

- **Connexion** :
  - titre « Montrez la procédure. Laissez‑la guider. », avec un trait d'union insécable entre « Laissez » et « la » ;
  - 30 px, 800, blanc : 15,2:1 sur prune-900, 18,3:1 sur prune-950 ;
  - sous-titre en 16 px, `--fd-prune-100` (#F3D3E2) : 11,0:1 et 13,3:1.
- **Inscription** :
  - titre « Capturez · Guidez · Diffusez », puis les 3 étapes existantes ;
  - pastilles numérotées de 28 px, fond blanc à 12 %, chiffre blanc ;
  - titre de l'étape en blanc, texte en prune-100.
- **Signature** : sous l'accroche, un trait de 56 × 2 px en prune-100 à 60 %, puis les **quatre points de la DSIML** (7 px, gap de 6 px : #D50D52, #2B95D2, #95C020, #F19103). Ils sont décoratifs, comme sur le logo. C'est le seul bleu du panneau, et il vient de la marque.

## 4. Mouvement (MOTION-01)

- **Pulsation** de l'anneau du hotspot, en continu.
- **Toutes les 4 s**, la bulle passe de 1/6 à 2/6 et inversement :
  - fondu de sortie de 120 ms ;
  - déplacement du hotspot et de la bulle en 320 ms `ease-standard` ;
  - fondu d'entrée.
  - En pause au survol du panneau et quand l'onglet est caché.
- **Mouvement réduit** : pas de pulsation (anneau fixe à 35 %), pas de changement d'étape. Tout reste figé sur 1/6. `getAnimations()` renvoie une liste vide (vérifié sur la maquette).
- **Implémentation** : un composant `AuthIllustration`, qui remplace `FakeDashboard` et la fenêtre actuelle. Il sert à la connexion, à l'inscription, à la page d'invitation et au mot de passe oublié.

## 5. Décision liée : invitation par e-mail (chef, 21/11)

- La case « Envoyer l'invitation par e-mail » **disparaît** de la modale « Inviter des membres ». L'e-mail part toujours.
- La confirmation propose **« Copier le lien »** en secours (lien d'invitation), au cas où l'e-mail n'arriverait pas.

## 6. Recette

- Couleurs calculées : fond du panneau, titre et sous-titre, avec les contrastes du §3, en clair et en sombre.
- Aucun bleu en dehors des 4 points : aucune couleur de teinte 190° à 250° dans le panneau, hors `.dots`.
- Fenêtre de 560 px au plus, hotspot visible sur le bouton (contour blanc), aucun débordement à 1440 et 1024 px. Panneau absent sous 900 px.
- Mouvement réduit : aucune animation.
- **Boutons des pages d'authentification** (bug d'accessibilité transmis par le chef) :
  - chaque bouton principal (« Se connecter », « Créer mon compte », « Accepter l'invitation »…) a son libellé visible **au repos** ;
  - texte `on-primary` sur `primary`, contraste de 4,5:1 au moins dans les deux thèmes ;
  - même chose au survol, au focus et désactivé.
