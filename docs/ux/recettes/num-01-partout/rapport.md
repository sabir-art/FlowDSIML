# Recette réelle : NUM-01 partout (dev-mvp 6734e6a)

**Banc** :
- `claude/dev-mvp` à 6734e6a ;
- app locale lancée comme en CI, faux backend, données fictives ;
- Chromium, en clair et en sombre.

**Méthode** :
1. Lecture des 66 textes modifiés (34 FR, 32 EN), caractère par caractère.
2. Recherche des oublis : dans les fichiers de langue, dans le code qui compose des valeurs et dans les textes du lecteur.
3. Relevé en direct de chaque texte visible pendant les e2e de l'échantillon : présentateur (presenter-l66), Médiathèque (media-page), analytics (analytics, analytics-avance), notifications (notifications, parametres-notifications) et voix off (voix-off). Le relevé cherche une espace ordinaire entre un nombre et son unité, ou après « sur ». Il mesure aussi les lignes occupées par chaque nombre et son unité.
   - À la taille de chaque e2e : 7 e2e, tous verts.
   - Forcé à 390 px : Médiathèque, notifications et analytics. Le présentateur et l'éditeur (voix off) ne s'utilisent pas à 390 px : leurs e2e s'arrêtent à cette taille. Ils sont mesurés à 1440 px.

## Verdict : ROUGE léger

| Point | Verdict |
| --- | --- |
| Aucun mot touché par erreur | **VERT** |
| Textes traduits avec une unité (Mo, Ko, %, s, min, h, ms) | **VERT** |
| À 390 px, aucun nombre séparé de son unité en fin de ligne (Médiathèque, notifications, analytics) | **VERT** |
| Voix off (éditeur, à 1440 px) | **VERT** : seule trouvaille, « Étape 1 sur 2 » du lecteur (point 3 plus bas) |
| Valeurs composées dans le code et « sur N » | **ROUGE** |

### Ce qui est conforme

- **Aucun mot touché par erreur.** Les 66 modifications remplacent toutes une seule espace, celle entre un nombre (ou `{{x}}`) et son unité : Mo, Ko, MB, KB, %, s, min, h. Aucune autre lettre n'a bougé. Les unités écrites en toutes lettres (« 2 minutes », « 14 jours », « 8 caractères ») sont laissées telles quelles, comme le demande la règle.
- **À 390 px, rien ne se coupe.** Médiathèque : « PNG, JPEG, WebP, SVG ou WOFF2, 5 Mo / au plus » passe à la ligne après l'unité ; « 6 Ko sur 500 Mo » est sur une seule ligne. Notifications : « Un résumé par jour à 9 h » et « À 9 h, à votre heure » sont entiers. Le relevé n'a trouvé aucune espace ordinaire sur ces pages.
- **Les 7 e2e de l'échantillon passent**, en clair comme en sombre.

Capture : `390-mediatheque-notifications.png`.

### Ce qui reste : des espaces ordinaires hors des fichiers de langue

Le test `num01.test.ts` ne lit que `fr.json` et `en.json`, et ne vise pas « sur ». Le relevé à l'écran trouve encore :

1. **Présentateur, valeurs écrites par le code** (`present.ts` `spoken()`, `PresentReport.tsx` `minSec()`) :
   - « 16 min 21 » et « 9 min 58 » (vus à l'écran), ainsi que « n s » sous une minute (écrit de la même façon dans le code) ;
   - « Dépassée de 1 min 21 », qui est dans une étiquette étroite.

   À 1440 px, rien ne se coupe aujourd'hui, mais rien ne l'empêche dans l'étiquette ou dans la colonne Durée de l'historique. Capture : `presentateur-durees-codees.png`.
2. **« sur N »**, que la règle couvre aussi (« même chose dans 2 sur 6 », COMP-01 §21) :
   - le minuteur « sur 15:00 » (`present.ofTotal`) ;
   - 9 textes FR : `password.count_*`, `editor.window.stepOf`, `distribute.offline.progress`, `present.timerName`, `present.ofTotal`, `ai.suggest.limited`, `videoImport.sending`, `videoImport.quota.title`.
   - D'autres textes ont déjà l'insécable, par exemple `media.quota` (« {{used}} sur {{total}} Mo »).
3. **Lecteur** (`apps/player/src/i18n.ts`) : 20 espaces ordinaires, dont « Étape {{n}} sur {{total}} », lu sur chaque démo publiée. Ce fichier n'est pas couvert par le test.
4. **Autres valeurs écrites par le code** :
   - axe des taux « 100 % » / « 0 % » (`KpiTabs.tsx` l. 294-295) ;
   - « {{w}} × {{h}} px » dans l'export (`ExportDialog.tsx` l. 443 et 1429) ;
   - « (n %) » dans la progression des apprenants (`learners/progress.ts` l. 373) ;
   - les `valueText` des curseurs, lus seulement par les lecteurs d'écran (Projecteur, Flou, colonnes).

### Correction attendue

- Une fonction `unit(n, u)` (ou `nbsp`) dans `lib/format.ts`, utilisée par `spoken()`, `minSec()` et les autres valeurs composées dans le code.
- L'insécable après « sur » quand il est suivi d'un nombre ou de `{{x}}`, dans `fr.json` et dans le lecteur.
- Le test `num01.test.ts` étendu :
  - au motif `sur \d` / `sur {{` ;
  - à `apps/player/src/i18n.ts` ;
  - et à un contrôle des gabarits `` `${…} unité` `` dans `src` et `packages` (même motif que le §22.5 de COMP-01).

Demandes concernées : NUM-01 partout (textes FR et EN, présentateur, Médiathèque, analytics, notifications, voix off).
