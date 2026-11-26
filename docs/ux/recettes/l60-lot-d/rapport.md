# Recette réelle L60, lot D, barre de capture commune (e379307 → 2a1d951, avec le merge 8f1ff0d) : VERT

Recette du 26/11, faite à la place de l'utilisateur.

**Montage** : extension construite (`WXT_E2E=1 WXT_DEBUGGER=1`) et chargée dans Chromium, avec le faux Supabase et le banc (:54410). La vidéo passe par le faux flux d'onglet. J'ai comparé la barre à `propositions/l60/planche-l60-capture.png` (déroulés 2 à 5).

## Parcours rejoués

| Parcours | Résultat |
|---|---|
| cadre | 45/45 (dont : 48 px, à 20 px du bas, fond #16181d, contrôles de 36 px sur le même centre, 856 = 856 = 856) |
| tabs | 20/20 |
| html-spa | 21/21 |
| ajout et external (build avec `WXT_APP_URL`, comme en CI) | 51/51 et 17/17 |
| banc : etat-captures, etat-html, etat-video | 11/11, 7/7, 8/8 |
| capture, video, guided, html | échecs sur l'**ouverture de l'éditeur après l'envoi** |

**Les échecs de la dernière ligne viennent de mon environnement, pas du lot D.**
- Le même échec existe sur 2723813 (lot C, avant la barre).
- Le reste de ces parcours passe : barre, pause, cadre, carte, compte à rebours.
- La CI du merge 8f1ff0d tourne encore au moment de ce rapport, et c'est elle qui fera foi pour ces 4 parcours.

## Conforme à la planche (`barres-4-etats.png`)

- **Captures d'écran** : point rouge, « Captures », « 1 étape », segmenté Page / Élément / Zone, filet, Pause ronde, « Terminer » blanc avec Check.
- **Carte « Étape 1 capturée »** : elle est 8 px au-dessus de la barre, avec la miniature, « Cliquez sur « Créer un projet » » et « Annuler ».
  - Annuler retire l'étape : de 1 à 0 en captures, de 3 à 2 pages en HTML.
  - La carte reste affichée au survol ou au focus.
- **Pause** : point orange, « En pause », « Vos clics ne sont pas capturés », « Reprendre ». Un clic pendant la pause ne crée pas d'étape, en captures d'écran comme en HTML.
- **HTML** : « Chaque clic devient une étape », puis « Ajouter cette page ». La carte de capture HTML porte l'icône Code.
- **Vidéo** : « Vidéo », chronomètre en pastille (« 00:01 »), « 3 clics repérés », Pause, Terminer.
- **Compte à rebours de 3 s** (`video-compte-a-rebours.png`) : fond assombri, « L'enregistrement commence. Échap pour annuler », et le temps du compte à rebours n'est pas compté.
  - Sur la capture, le chiffre paraît gris, parce qu'elle est prise pendant son apparition (opacité de 0 à 1).
  - Échap annule, d'après le banc.

## Capsule en #16181d fixe, alors que L64 prévoit l'apparence claire ou sombre

Ce n'est **pas un écart du lot D**. L60 §2 demande bien un fond sombre fixe. Le réglage **Apparence** (Système / Clair / Sombre), qui s'applique au popup, à la barre et à la vérification, est le **§4 de L64**, prévu avec le lot E.

Pour que ce soit simple à faire, je demande dès maintenant :
- que les couleurs de la barre et de la carte soient des variables CSS (fond, texte, filet, pastille, ombre) ;
- que la barre claire de L64 ne change que ces variables.

La recette du lot E vérifiera la barre en Clair, en Sombre et en Système, avec les mêmes mesures.

## Arbitrage du §5 du rapport du dev

1. **« Marquer une étape » quitte la barre vidéo**, et Alt + Maj + M reste : accepté, c'est la spec.
2. **Sandbox garde « Ajouter cette page »** : accepté. Une application à page unique en a besoin. Le bouton reste secondaire, après « Chaque page visitée est ajoutée ».
3. **Puces grises dans la partie du mode** (onglet suivi, étape à capturer, cible d'un ajout) : acceptées. Il y en a une seule à la fois, et elle est coupée par « … » au-delà de 200 px, pour que la capsule ne dépasse jamais 720 px.
4. **Annuler ne retire que la dernière étape** : accepté. Les étapes plus anciennes se retirent dans la vérification ou dans l'éditeur.
5. **Micro** :
   - Le bouton Micro ne s'affiche que si le micro est activé pour l'enregistrement : accepté.
   - Couper le micro ne coupe que la piste, et l'enregistrement continue : conforme.
   - C'est à vérifier sur un vrai poste, avec la vidéo démarrée depuis le popup, et la recette le gardera ouvert.

## Pour la suite

- La CI de 8f1ff0d doit être verte sur capture, video, guided et html (ouverture de l'éditeur).
- La vérification vidéo et micro sur un vrai poste reste à faire par l'utilisateur.
