# Plan : L62 §6, « Passer d'une source à l'autre sans rien perdre »

Spécification : `docs/ux/specs/l62-voix-off.md` §6 (branche UX), planche `planche-l62-source.png`.
Code concerné : `apps/web/src/pages/editor/voice/VoiceFields.tsx` (panneau voix, environ 750 lignes),
`VoiceGenerate.tsx` (onglet Générée), `AudioLine.tsx` (lecteur de 40 px).

## Aujourd'hui

- Sans voix : segmenté Générer · Enregistrer · Importer.
- Avec une voix : la carte « Voix en place » remplace le segmenté. Pour changer de source, il faut passer
  par « Remplacer… ».
- Une voix générée, réenregistrée ou importée remplace la voix en place dès « Utiliser » ou « Garder »,
  sans possibilité d'annuler.

## Découpage en 3 commits testables

### Commit 1 : source toujours visible, voix en place jamais perdue

- Le segmenté « Source de la voix » (Générée · Enregistrée · Fichier, 40 px) reste toujours affiché. La
  source de la voix en place porte un point vert, nommé pour les lecteurs d'écran (« Voix en place »).
- « Remplacer… » disparaît. Changer d'onglet ne supprime rien.
- La carte « Voix en place » (rayon 12) se lit ainsi :
  - icône de la source ;
  - « Voix en place » ;
  - une ligne grise « Enregistrée · 0:12 » ou « Générée · {voix} · 0:11 » ;
  - le lecteur de 40 px ;
  - un menu ⋯ (Télécharger, Supprimer la voix).
- Dans un autre onglet, la carte se réduit à une ligne de 44 px (Lecture, nom, durée), au-dessus de l'outil.

Tests :
- e2e `voix-off` et `voix-sous-titres-ia` mis à jour ;
- nouveaux contrôles : le segmenté est visible avec une voix en place, le point est sur la bonne source,
  changer d'onglet laisse `voice_path` intact, la carte réduite fait 44 px ;
- axe, en clair et en sombre, à 1440.

### Commit 2 : nouvelle voix « À écouter », Utiliser ou Garder l'actuelle, Annuler

- Toute nouvelle voix (générée, réenregistrée, importée) arrive dans une carte à bordure de marque :
  étiquette « À écouter », lecteur, **Utiliser cette voix** (primaire), **Garder l'actuelle** (fantôme).
- La voix en place n'est remplacée qu'à « Utiliser cette voix ». Le toast « Voix remplacée par la voix
  {générée | enregistrée | importée} » porte **Annuler**, qui remet l'ancienne voix : chemin, durée,
  transcription et options. Le fichier de l'ancienne voix n'est supprimé qu'à l'expiration du toast.
- « Garder l'actuelle » retire le fichier de la nouvelle voix (bucket voices).

Tests (e2e) :
- générer avec une voix en place : `voice_path` reste inchangé jusqu'à « Utiliser » ;
- après « Utiliser » : toast avec « Annuler », qui remet l'ancien chemin ;
- « Garder l'actuelle » : le fichier de la nouvelle voix est retiré ;
- mêmes contrôles pour l'enregistrement et l'import.

### Commit 3 : transcription → voix en un clic

- Sous la transcription d'une voix enregistrée ou importée : bouton secondaire de 40 px **Générer la voix
  depuis ce texte** (icône Sparkles), avec l'aide « Avec {voix} ({langue}). Votre enregistrement reste en
  place jusqu'à ce que vous choisissiez la nouvelle voix. »
  - Un clic lance la génération avec la voix retenue pour la démo, sinon la voix recommandée de la langue.
  - Le résultat arrive dans la carte « À écouter » du commit 2.
- Une fois une voix générée en place, le bouton devient **Régénérer depuis ce texte**, avec l'aide « À faire
  après une modification de la transcription ».
- Dans l'onglet Générée :
  - le texte lu est repris de la transcription, ce qui est indiqué à droite du libellé ;
  - l'aide rappelle « La voix en place n'est pas touchée tant que vous n'avez pas choisi. »

Tests (e2e) :
- un clic envoie la tâche `voice` avec le texte de la transcription et la voix attendue ;
- la carte « À écouter » s'affiche ;
- le libellé passe à « Régénérer » quand une voix générée est en place ;
- aucune donnée réelle n'est utilisée (faux service de voix).

## Hors périmètre

- L'Orbe (§7) : en attente du choix du client.
- Lecteur côté visiteur : inchangé.
