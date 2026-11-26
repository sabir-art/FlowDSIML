# Recette du §6 complet, b7bbe4e → 4a90c32 (avec 0541adb) : ROUGE

Recette du 26/11 sur `claude/dev-mvp` (4a90c32), app locale avec faux backend. J'ai comparé l'app à `propositions/l62/planche-l62-source.png` et à `specs/l62-voix-off.md` §6, en clair et en sombre.

## Ce qui marche

- **e2e** :

  | e2e | Clair | Sombre |
  |---|---|---|
  | voix-off | 53/53 | 53/53 |
  | voix-sous-titres-ia | 76/76 | 76/76 |
  | formation-outils | 28/28 | 28/28 |

- **Commits 1/3 et 2/3**, conformes, avec les écarts corrigés :
  - le segmenté et son libellé, le point vert, la ligne de 44 px, l'icône de la source ;
  - aucun remplacement d'office ;
  - le toast avec Annuler.
- **Carte « Nouvelle voix »** (0541adb) : une seule forme pour les 3 sources.
  - En tête : l'icône, « Nouvelle voix », puis « Enregistrée · 0:01 » ou « Générée · Antoine · 0:04 », et l'étiquette « À écouter » à droite.
  - Les actions sont dans la carte, à 12 px du bord (`nouvelle-voix-clair-sombre.png`).
- **« Générer la voix depuis ce texte »** (4a90c32) : sous la transcription d'un enregistrement, un bouton de 40 px.
  - Son aide dit « Avec Antoine (français). Votre enregistrement reste en place… ».
  - Le résultat arrive dans la carte « Nouvelle voix » de l'onglet Générée, et l'enregistrement reste en place jusqu'au choix (`depuis-texte-clair-sombre.png`, 1re et 3e vues).

## Ce qui bloque (ROUGE)

**Dans l'onglet Générée, quand une voix générée est en place, le panneau montre deux « Texte lu » et deux boutons de génération** (`generee-en-place-doublon-sombre.png`, et `depuis-texte-clair-sombre.png`, 2e et 4e vues).

Du haut vers le bas, on voit :
- la carte « Voix en place · Générée · Antoine · 0:04 » ;
- « Texte lu (repris de la transcription) », avec « Bienvenue chez {{company}}… », puis Voix, puis le bouton principal **« Générer la voix »** ;
- puis un second **« Texte lu (sert aussi de transcription) »**, avec un autre contenu (« Bienvenue chez votre entreprise… », où la variable est remplacée), puis **« Régénérer depuis ce texte »**.

Pour l'utilisateur :
- deux champs portent le même nom mais n'ont pas le même texte ;
- deux boutons font presque la même chose ;
- il ne peut pas savoir lequel compte, ni ce que lira la voix.

**Attendu** (planche, vue 4, et spec §6) : quand la voix en place est **générée**, l'onglet Générée a **un seul** texte et **une seule** action :
- la carte « Voix en place » ;
- « Texte lu (sert aussi de transcription) » : c'est le texte de la voix, avec ses variables (`{{company}}`) gardées comme dans l'éditeur ;
- la liste « Voix » ;
- **« Régénérer la voix »** (bouton secondaire, icône Sparkles). L'aide dit « À faire après une modification du texte ou de la voix. ». Le résultat arrive dans la carte « Nouvelle voix ».

Le bloc « Générer la voix » repris de la transcription ne s'affiche que si la voix en place n'est **pas** générée (Enregistrée ou Fichier), comme dans la vue 2 de la planche.

**Variables** : la transcription d'une voix générée doit garder `{{company}}`, et pas sa valeur par défaut. Les sous-titres affichent alors la valeur du visiteur, comme le reste de la démo. La voix, elle, lit la valeur par défaut, et l'aide le dit déjà.

**e2e à ajouter** : voix générée en place, onglet Générée. Le contrôle : un seul champ « Texte lu », un seul bouton de génération, et `{{company}}` toujours présent dans le texte.

## Gêne (non bloquante, avec le correctif)

**Actions de la carte « Nouvelle voix »** : elles s'empilent sur 3 lignes (« Recommencer », puis « Garder l'actuelle », puis « Utiliser cette voix »).
- **Attendu** : « Garder l'actuelle » et « Utiliser cette voix » côte à côte, sur une ligne alignée à droite, et le lien « Recommencer » ou « Régénérer » au-dessus, à gauche. Les deux boutons tiennent dans 263 px de large.
- Le texte « Générée · Antoine · 0:04 » passe aussi sur 2 lignes. Il doit rester sur une seule ligne, avec « … » si besoin.

## Pour le VERT

Le point bloquant, plus la gêne si elle est faite dans le même commit.
