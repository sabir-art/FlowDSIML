# Recette réelle des 4 gênes du lot B L60 (99da476, 9975891, 6d3ef4f, ca1dac1) : VERT

Recette du 26/11, faite à la place de l'utilisateur, sur `claude/dev-mvp` à ca1dac1.

**Montage** :
- extension construite (`WXT_E2E=1 WXT_DEBUGGER=1`) et chargée dans Chromium ;
- faux Supabase et banc (:54410) ;
- app (:5173) et lecteur (:5174).

**Bout-en-bout** : **155 / 155**. Capture : `4-genes.png`.

| Gêne (rapport l60-lot-b-correctif, §3) | Vu | Verdict |
|---|---|---|
| 1. Encart « Aucune zone cliquable » sur la dernière étape guidée | Dernière étape du formulaire (2/2) : la page, sans encart (en haut à gauche) | conforme |
| 2. Menu ouvert au survol, non relié d'office | Plan du Sandbox : 3 pages reliées (Catalogue → Catalogue · menu Produits → Logiciels), aucune alerte de page isolée (en haut à droite) | conforme |
| 3. Cadre « Barre d'adresse » par défaut | Aperçus guidés et Sandbox : l'adresse s'affiche dans le cadre (« localhost:54410/tiers ») | conforme |
| 4. Éléments ajoutés par un script d'un autre site | « Discuter avec nous » est listé dans « Scripts de la page » comme « Non copié », avec « Garder ». Gardé sur la page 1 (c'est le parcours du test), retiré des autres pages (en bas) | conforme |

## Points du dev

1. **La note « n scripts » compte aussi les éléments retirés.**
   - À changer : les deux ne sont pas de même nature, et « 8 scripts » trompe sur ce qui manque à l'écran.
   - La note et la tuile disent : « 7 scripts et 1 élément ajouté par un script ne sont pas copiés ».
   - La tuile « Scripts non copiés » compte les scripts seuls, et l'élément a sa ligne dans la liste, avec une icône `PanelTop`.
   - Non bloquant : pour le prochain lot de la capture.
2. **Faux positif possible sur un toast d'application** : accepté.
   - « Garder » le rattrape, et les trois critères le rendent rare : un toast de l'application vient d'un script du même site, donc il n'est pas retiré.
   - Si un client le signale, on ajoutera une liste d'exceptions par espace.
3. **Source illisible, donc rien n'est retiré** : accepté. Dans le doute on garde, comme pour les données personnelles.

## Limite

Le faux serveur ne rejoue pas l'assainissement de `html-ingest` : « Sécurité de la page » affiche toujours « pas de rapport ».
