# Extension 0.3.3 : retours du client en test réel

Planches :
- `planche-retours-1-3-4.png` (points 1, 3, 4) : à brancher sans attendre ;
- `planche-2-vue-du-mode.png` (point 2) : **à valider par le client**, via le chef.

Toutes les captures viennent du vrai popup (extension construite, 360 px), en clair et en sombre.

## 1. Une liste s'ouvre collée à son champ (toute l'extension)

**Constat** (reproduit) : dans Réglages › « Cadre par défaut », la liste s'ouvre **346 px** sous son champ, en bas du popup.

Cause : `.sel-list` est en `position: absolute`, avec `left` et `right` à 16 px mais sans `top`. Sa place dépend donc du flux, pas du bouton. Comme le popup grandit à l'ouverture (`body.minHeight`), la liste finit en bas.

**Règle EXT-LIST-01**, valable pour toute liste ou tout menu de l'extension (popup, barre de capture, écrans de vérification) :
1. La liste est ancrée à **son** champ :
   - même bord gauche et même largeur que le champ (au moins 200 px pour un menu) ;
   - **4 px** sous le champ s'il y a la place ;
   - sinon **4 px** au-dessus ;
   - jamais ailleurs.
2. « La place » se mesure dans la zone visible du popup (600 px au plus) :
   - dessous si la hauteur de la liste, plus 4 px, tient sous le champ ;
   - sinon dessus si elle y tient ;
   - sinon, du côté le plus grand, avec un défilement interne (240 px au plus) et la liste toujours collée au champ.
3. **Menu d'actions** (⋯) : 4 px sous son bouton, aligné sur le bord du bouton le plus proche du bord du popup (à droite pour le ⋯ de l'en-tête), avec sa largeur de menu. Il ne sort jamais du popup (arbitrage du 26/11).
4. La liste suit son champ : si la vue défile, elle se recalcule, ou elle se ferme.
5. Le popup ne grandit plus pour montrer une liste. Le `minHeight` ajouté au `body` est la cause du décalage : on le retire.
6. Mise en œuvre suggérée : `position: fixed`, avec `top` ou `bottom` calculés depuis `getBoundingClientRect()` du bouton à l'ouverture, au redimensionnement et au défilement. Pas de valeur de `left` / `right` fixe.

**e2e d'ancrage** (nouveau, `liste-ancrage.e2e.cjs`), en clair et en sombre :
1. Pour chaque `[aria-haspopup=listbox]` et `[aria-haspopup=menu]` du popup (Cadre par défaut, Espace, menu ⋯), et pour chaque liste de la barre de capture et des écrans de vérification :
   - ouvrir, avec le champ en haut puis en bas de la vue ;
   - vérifier `|liste.top − (champ.bottom + 4)| ≤ 1` ou `|champ.top − 4 − liste.bottom| ≤ 1` ;
   - vérifier `|liste.left − champ.left| ≤ 1` et, pour une liste, `|liste.width − champ.width| ≤ 1` ;
   - vérifier que la liste est entièrement dans la fenêtre.
2. Le test échoue sur l'état actuel : il mesure 346 px.

## 2. Un clic ouvre la vue du mode, puis « Démarrer » (à valider par le client)

Le client revient sur « un clic démarre ».
- Cliquer un mode (ou Entrée sur ce mode) ouvre **la vue du mode** :
  - en-tête ← et le nom du mode ;
  - la tuile, la phrase et la page (« Sur Page test · localhost:54400 ») ;
  - la **destination** (ligne « Dans {espace} · {démo} · Changer ») ;
  - les **réglages utiles** au mode, déjà remplis avec les valeurs mémorisées ;
  - au pied, un seul bouton principal pleine largeur, « Démarrer la capture » (Vidéo : « Démarrer l'enregistrement »), avec l'indication « Entrée ».

| Mode | Réglages |
| --- | --- |
| Captures d'écran | Rédaction automatique · Taille de l'onglet (Actuelle, 1440, Mobile) · Suivre les nouveaux onglets · Cadre par défaut |
| HTML | Rédaction automatique · Taille (Mobile grisé : « captures d'écran seulement ») · Suivre les nouveaux onglets |
| Vidéo | Taille (Mobile grisé) · Micro · Webcam dans un coin · Flouter en direct |
| Sandbox | Taille (Mobile grisé) · Suivre les nouveaux onglets |

- Les aides qui ne faisaient que nommer le mode (« Vidéo. », « Captures et HTML. ») disparaissent dans ces vues.
- Un changement de réglage est mémorisé comme aujourd'hui.
- ← ou Échap revient à la liste des modes, avec le focus sur le mode quitté.
- Entrée sur la liste ouvre la vue du **dernier mode**, avec le focus sur « Démarrer » ; un second Entrée démarre.
- L'aide sous la liste devient « Choisissez un mode pour voir ses réglages. Entrée ouvre votre dernier choix. » (remplace « Un clic démarre la capture. »).
- Le nom accessible d'un mode devient « {mode}, {phrase} » (sans « Démarrer : »).
- La vue Réglages du pied garde l'apparence et les réglages communs. Les réglages propres à un mode y restent aussi, pour ne rien enlever.

## 3. Choisir une démo ou un dossier ramène à la vue précédente

**Constat** (reproduit) : après un clic sur une démo, on reste sur Destination avec une coche.

Règle :
- Un clic, ou Entrée, sur une démo (« Ajouter à une démo ») ou sur un dossier (« Nouvelle démo ») **choisit et revient** tout seul à la vue d'où l'on venait : liste des modes aujourd'hui, vue du mode si le point 2 est validé.
- La ligne destination est à jour, par exemple « Dans Acme · Prise en main » (« Dans {espace} · {démo ou dossier} »). Elle est surlignée 1,2 s (fond `--fd-color-primary-soft`, bord `--fd-color-primary`), et le focus va sur « Changer ».
- Changer d'onglet (Nouvelle démo / Ajouter à une démo) ou chercher ne ramène pas en arrière : seul un choix le fait.
- e2e : clic sur une démo, puis on vérifie que `#setup` est visible, que `#dest-text` contient le titre de la démo et que le focus est sur `#dest-change` ; même contrôle pour un dossier.

## 4. Pied en pause : deux actions, Annuler au-dessus

**Constat** (reproduit) : 3 boutons (121 + 122 + 108 px plus les écarts) pour 328 px utiles. « Annuler la capture » est coupé à gauche, en clair comme en sombre.

Règle :
- Le pied a **2 actions de même largeur** : « Reprendre » (ou « Pause » pendant la capture) et « Terminer » (primaire). À 360 px, chacune fait 160 px.
- « Annuler la capture » devient un **lien rouge** (icône corbeille, 13 px, cible de 28 px) sous le compteur « n étapes capturées ».
- Le lien ouvre la confirmation actuelle, inchangée : « Annuler la capture ? Les captures seront effacées de ce navigateur. », « Continuer la capture », « Oui, annuler ».
- Aucun libellé coupé jusqu'à 320 px.
- e2e : en capture et en pause, le pied compte 2 boutons visibles, aucun ne déborde (`scrollWidth ≤ clientWidth`), et tous deux sont dans le popup ; le lien « Annuler la capture » ouvre `#cancel-ask`.
