# L64 — Extension : menu •••, destination, rédaction automatique, apparence

Ce document complète L60 (`l60-capture-bout-en-bout.md`). Planche : `docs/ux/propositions/l64/planche-l64-extension.png` (popup de 360 px, clair et sombre, plus la barre de capture claire et sombre).

## 1. Menu ⋯ (en-tête du popup)

Le menu fait 280 px, avec un rayon de 16 et l'ombre de menu. Il contient, dans l'ordre :

1. **Espace de travail** : un titre de section de 12 px gris, puis une ligne par espace (`menuitemradio`). Chaque ligne montre une tuile de 28 px avec l'initiale teintée, le nom de l'espace et l'aide « {n} membres · {rôle} ». L'espace courant est coché.
   - Changer d'espace met à jour la destination (« Dans {espace} · {dossier} ») et revient aux modes.
   - Un espace où la personne est Lecteur est grisé, avec l'aide « Lecteur : capture impossible ».
2. Un filet, puis **Ouvrir TutoClick**, **Réglages de capture** et **Aide**.
3. Un filet, puis **Se déconnecter**, en couleur de danger, avec l'adresse du compte en aide (« camille@acme.example »).
   - Pendant une capture, la déconnexion demande une confirmation : « Arrêter la capture et se déconnecter ? Les étapes non envoyées sont perdues. »

## 2. Destination (« Changer » dans le popup)

C'est une vue du popup, avec un bouton Retour et le titre « Destination ». Les choix s'appliquent tout de suite et sont mémorisés.

- **Démo** : un segmenté avec **Nouvelle démo** et **Ajouter à une démo**.
- **Dossier** (avec Nouvelle démo) : un arbre des dossiers de l'espace (`role="tree"`).
  - Chaque nœud fait 36 px, avec une icône Dossier, le nom et le nombre de démos à droite. Les sous-dossiers sont décalés de 24 px.
  - Le dossier choisi a un fond teinté de marque. Par défaut, c'est le dernier utilisé, sinon « Toutes les démos ».
  - Aide : « Le dossier est mémorisé pour les prochaines captures. »
- **Ajouter à une démo** : un champ de recherche de 40 px, puis la liste des démos modifiables (titre, et « {dossier} · {n} étapes »). La démo choisie est cochée.
  - Aide : « Les nouvelles étapes s'ajoutent à la fin. Pour insérer après une étape précise, partez de l'éditeur (« Capturer de nouvelles étapes »). »
- En bas de la vue, la ligne **Espace** (tuile et nom) avec « Changer », qui ouvre la liste du menu ⋯.
- Dans la vue des modes, la ligne de destination devient « Dans **Acme** · Ventes · Nouvelle démo ». Le texte est tronqué avec des points de suspension.

## 3. Rédaction automatique

Le nom est générique, en français, sous notre marque. Aucun nom de fournisseur ni de modèle n'apparaît dans l'extension (l'ancien nom de travail « AI Copilot » est abandonné).

C'est un réglage, en tête de la vue Réglages, dans un encadré teinté de marque (rayon 12) : icône Sparkles, « Rédaction automatique », et un interrupteur.

- Aide : « L'IA de TutoClick rédige le titre et le texte de chaque étape pendant la capture. Vous relisez dans l'éditeur. »
- Sous les réglages : « La rédaction automatique utilise le quota IA de l'espace (1 crédit par étape). Désactivée si l'espace n'autorise pas l'IA. »
- Le modèle utilisé est choisi par le propriétaire de la plateforme dans la Console (L41, page « Modèles IA »).
- Si l'espace n'autorise pas l'IA, l'encadré reste visible, avec l'interrupteur désactivé et « Désactivé par l'espace ».
- **Pendant la capture** : la carte « Étape n capturée » ajoute une ligne « Texte proposé : « … » », précédée de l'icône Sparkles.
  - Le texte arrive en moins de 2 s. En attendant, la ligne affiche « Rédaction… » avec un battement d'opacité (MOTION-01).
  - S'il échoue, la ligne disparaît sans message, et l'étape garde le libellé du clic.
- **Dans l'éditeur** : chaque texte rédigé par IA porte « Généré par IA, à vérifier » (règle L63), jusqu'à sa première modification.
- **Données** : seuls sont envoyés le libellé du clic, le titre de la page et le texte visible de l'élément cliqué. Jamais la capture d'écran, et jamais une donnée floutée par F1.

## 4. Apparence (thème clair)

- Le réglage **Apparence** (Système, Clair ou Sombre) s'applique au popup, à la barre de capture et aux écrans de vérification. Par défaut : Système.
- **Barre claire** :
  - fond blanc, contour de 1 px à 8 % et ombre de menu ;
  - le segment actif est sombre (#1d2433) avec un texte blanc ;
  - Terminer est en couleur de marque ;
  - la carte « Étape capturée » est blanche, elle aussi.
- **Barre sombre** : celle de L60. Elle reste lisible sur tous les sites, et c'est le choix conseillé sur des pages claires chargées.
- Les deux barres ont la même géométrie : 48 px de haut, contrôles de 36 px sur le même centre.

## 5. Hauteur du popup (toutes les vues L60 et L64)

- Le popup s'arrête à la hauteur du contenu : aucune hauteur fixe ni minimale, 600 px au plus (avec défilement du corps au-delà).
- Le pied a 12 px au-dessus et **16 px en bas**, comme les 16 px du haut du corps : il n'y a pas de vide sous « Réglages · Données vérifiées ».
- Vérifié dans toutes les vues de la planche (Modes, Menu, Destination, Ajouter à une démo, Réglages), en clair et en sombre.

## 6. e2e

- Menu ⋯ : les espaces sont listés et le courant est coché. Changer d'espace met à jour la destination. Se déconnecter pendant une capture demande une confirmation.
- Destination : le dossier choisi est mémorisé après une nouvelle ouverture du popup. « Ajouter à une démo » ajoute les étapes à la fin de la démo choisie.
- Rédaction automatique :
  - avec l'IA désactivée dans l'espace, l'interrupteur est désactivé et visible ;
  - avec l'IA activée (faux fournisseur), la carte montre le texte proposé, et l'étape arrive avec le texte et la mention IA ;
  - aucune image n'est envoyée au fournisseur.
- Apparence : Clair, Sombre et Système s'appliquent à la barre. Mêmes mesures dans les deux thèmes.
- Hauteur : la hauteur du document du popup est égale à celle de son contenu (pas de bande vide sous le pied), et le pied a 16 px en bas.
- Aucun nom de fournisseur (Anthropic, OpenAI, Claude, ChatGPT, ElevenLabs) dans les textes de l'extension.
