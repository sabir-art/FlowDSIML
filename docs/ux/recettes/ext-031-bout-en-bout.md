# Recette de bout en bout — app en ligne + extension 0.3.1 (Chrome Web Store)

À faire par l'utilisateur sur son poste, avec l'extension installée depuis la boutique, puis à rapporter étape par étape (OK, ou ce qui diffère, avec une capture).

Règles :
- Données fictives uniquement : une page publique de test ou `https://example.com`.
- Aucun vrai client et aucune vraie adresse dans les démos créées.
- Les leads se testent avec une adresse `@example.com` seulement.
- Démos de recette : nommées « Recette 0.3.1 — … » ; à supprimer à la fin (étape 12).

| # | Étape | Attendu |
|---|---|---|
| 1 | Ouvrir l'app › Extension | « Installée », version 0.3.1 · à jour, raccourci affiché ; plus de « Mise à jour disponible » |
| 2 | Cliquer l'icône de l'extension sur une page quelconque | Popup B : connecté à l'espace, choix « Captures d'écran » / « Page HTML » / « Vidéo » |
| 3 | Captures : lancer, cliquer 3 fois sur `https://example.com`, terminer | Barre de capture avec le nombre de pages ; vérification, puis la démo s'ouvre dans l'éditeur avec 3 étapes |
| 4 | Cadrage par clic (EXT-02 §5) pendant une capture : Page / Élément / Zone | Cadre visible, zone choisie appliquée à l'étape |
| 5 | Dans l'éditeur, « Capturer de nouvelles étapes » après l'étape 2 | La fenêtre détecte l'extension ; la barre affiche la pastille « {démo} · après l'étape 2 » ; les nouvelles étapes s'insèrent au bon endroit, marquées « Nouveau » |
| 6 | Même chose en « Page HTML » (ajout HTML, 0.3.1) | La barre de capture HTML porte la même pastille de cible ; l'étape HTML s'insère après l'étape 2 |
| 7 | « Annuler l'ajout » depuis la popup pendant un ajout | Capture annulée, cible effacée, rien n'est inséré |
| 8 | Publier la démo, ouvrir le lien public | Lecteur : captures puis étape HTML, même bulle et même cadre ; à 390 px (outils de développement, mode mobile) la feuille du guide est en bas |
| 9 | Vidéo : enregistrer 10 s d'écran | Vérification du masquage avant l'envoi, puis démo vidéo dans l'éditeur |
| 10 | Mouvement réduit du système activé | App, popup et lecteur sans animation de déplacement ; indicateurs de chargement en battement d'opacité |
| 11 | Mode sombre du système | Popup, barres de capture et app en sombre, contrastes lisibles |
| 12 | Supprimer les démos « Recette 0.3.1 — … » | Plus rien de la recette dans Démos |

À rapporter : le numéro de chaque étape, OK ou KO, et une capture pour tout KO. Les captures ne doivent contenir ni adresse e-mail, ni nom réel, ni jeton.
