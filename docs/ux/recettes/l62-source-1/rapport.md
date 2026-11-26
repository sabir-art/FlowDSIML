# Recette du §6 « source de la voix », commit 1/3 (b7bbe4e) : ROUGE léger

Recette du 26/11 sur `claude/dev-mvp` (b7bbe4e), app locale avec faux backend. J'ai comparé l'app à `propositions/l62/planche-l62-source.png` et à la spec `specs/l62-voix-off.md` §6, en clair et en sombre.

## Ce qui marche

- **e2e** :

  | e2e | Clair | Sombre |
  |---|---|---|
  | voix-off | 47/47 | 47/47 |
  | voix-sous-titres-ia | 69/69 | 69/69 |
  | formation-outils | 28/28 | 28/28 |

- **Segmenté** : « Générée · Enregistrée · Fichier » est toujours visible. Le point vert est sur la source en place, et le panneau s'ouvre sur cet onglet (`source-clair-sombre.png`, 1re et 2e vues).
- **Changer d'onglet ne supprime rien** : la voix reste la même, et la transcription est gardée.
- **Carte « Voix en place »** : elle affiche « Fichier · 0:02 », le lecteur rond et le menu ⋯.
- **« Remplacer… »** a disparu, ainsi que « Garder la voix actuelle ».
- **Sombre** : tout est lisible et les contrastes sont justes.

## Écarts avec la planche et la spec

1. **Ligne de 44 px dans un autre onglet** (`source-clair-sombre.png`, 3e et 4e vues).
   - Aujourd'hui, l'ordre est : point vert, « Voix en place », **bouton lecture au milieu de la ligne**, puis « 0:00 / 0:02 ». La source n'est pas dite.
   - **Attendu** (spec §6 et planche, vue 2) :
     - le bouton **Lecture en tête**, à gauche ;
     - puis, sur 2 lignes, « Voix en place » et, en gris 12 px, « Enregistrée · 0:12 » (ou « Fichier · 0:02 », ou « Générée · Antoine · 0:11 ») ;
     - la durée à droite.
   - Le point vert reste sur l'onglet, pas dans la ligne. Sans la source, on ne sait pas quelle voix on garderait en restant dans cet onglet.
2. **Icône de la carte** : la carte affiche une onde générique pour toutes les sources. **Attendu** : l'icône de la source, en Lucide :
   - `Upload` pour Fichier ;
   - `Mic` pour Enregistrée ;
   - `Sparkles` pour Générée (la même que dans le segmenté et les e2e de la planche).
3. **Libellé du segmenté** : « Source de la voix » manque au-dessus du segmenté (spec §6 et planche). Il faut le mettre en libellé de champ, 13 px demi-gras. Le segmenté le prend aussi comme nom accessible.

## Remarque (non bloquante)

« Générer : désactivé par l'espace. » s'affiche sous le segmenté dans tous les onglets, parce que l'e2e coupe la génération dans cet espace. C'est utile, puisque l'onglet Générée est grisé. Mais il vaut mieux mettre cette phrase en infobulle de l'onglet Générée grisé, pour ne pas ajouter une ligne dans les onglets Fichier et Enregistrée.

## Pour le VERT

Les points 1 à 3. Ils peuvent être livrés avec le commit 2/3, puisque les trois commits s'intègrent ensemble. Je recetterai le 2/3 avec ces trois points.
