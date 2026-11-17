# F2 : quiz de validation (implémentation)

- Spec UX : `docs/ux/specs/f2-quiz.md` (branche de la Lead UX).
- Migration : `20261117131200_quiz.sql`.

## Modèle

| Où | Rôle |
| --- | --- |
| `quiz_questions` | Questions d'un module : `single`, `multiple` ou `truefalse` ; énoncé (200 car.) ; réponses `[{id, label, correct}]` (2 à 6) ; explication ; étape liée (même module) ; points. RLS : lecture viewer, écriture editor. |
| `demos.settings.quiz` | `{ mode: quiz \| survey, threshold, attempts (0 = illimitées), feedback: each \| end, shuffle, required }`. |
| `quiz_attempts` | Tentatives des visiteurs. Lecture editor+ (données d'apprenants) ; écriture uniquement via `submit_quiz_attempt`. |
| `submit_quiz_attempt(p_batch)` | Recalcule le score **côté serveur** à partir du quiz de la version publiée (le client n'est pas cru). Choix multiples en tout ou rien. Limite les tentatives par visiteur (`NO_ATTEMPTS_LEFT`), avec un plafond de 50 par jour en mode illimité. |
| `quiz_stats(p_demo)` | Statistiques agrégées par question (taux de bonnes réponses, répartition des choix), lisibles par tout membre, sans donnée nominative. |
| `publish_demo` | Ajoute `quiz` au manifeste. Refuse la publication si une question est incomplète (`QUIZ_INVALID:n`). |
| `duplicate_demo` | Copie les questions en remappant l'étape liée. |

**Sondages** : le même moteur sert en `mode: survey` (pas de bonne réponse ni de seuil). Seul le modèle est prêt : l'interface « Sondage » (NPS, étoiles, réponse libre) relève d'A2 §4.

## Player (spec §3 à §5)

- **Ouverture** :
  - le quiz s'ouvre après la dernière étape (bouton « Passer au quiz ») ;
  - un quiz obligatoire conditionne `demo_complete`, envoyé à la réussite.
- **Question** :
  - `fieldset` / `legend`, avec des `input` radio ou case dans des `label` (52 px) ;
  - Vrai / Faux côte à côte ;
  - sans réponse, message `role="alert"` et focus sur la première option.
- **Correction** :
  - par texte et icône : « Bonne réponse », « Votre réponse », « Bonne réponse non cochée » ;
  - explication en `role="status"` ;
  - « Revoir l'étape n » ouvre l'étape, puis « Revenir au quiz » ramène à la même question.
- **Résultat** :
  - anneau décoratif avec trait de seuil ;
  - badge « Module validé » (vert DSI, texte noir) ou « Pas encore validé » (neutre) ;
  - phrase de score lue par le lecteur d'écran, focus sur le `h2` ;
  - détail des réponses avec « Revoir », tentatives restantes.
- **« Tester le quiz »** : l'aperçu s'ouvre sur le quiz (`startQuiz`) et rien n'est enregistré.

## Éditeur (spec §2)

- Page `/demos/:id/quiz`, ouverte par le bouton « Quiz » de la barre de l'éditeur. Elle a trois colonnes, une seule sous 1 100 px.
- **Liste des questions** : réordonnable au glisser-déposer et avec Alt + flèches. Un point framboise signale une question incomplète.
- **Question** :
  - type en segmenté (le passage en choix unique garde la première bonne réponse et l'annonce) ;
  - réponses, avec la bonne réponse en contour vert et `CircleCheck` ;
  - explication, étape liée, points.
- **Validation du module** :
  - seuil (pas de 5, `aria-valuetext`), tentatives, correction, mélange, quiz obligatoire ;
  - statistiques par question (`quiz_stats`).
- **Publication** : bloquée côté client et côté serveur tant qu'une question est incomplète. Le message donne le numéro de la question.

## Tests

- pgTAP : `supabase/tests/quiz.test.sql` (17) ; les autres suites restent vertes.
- Unitaires : `apps/player/src/logic.test.ts` (score, partiel, mélange) et `apps/web/src/pages/editor/quizValidation.test.ts`.
- e2e : `quiz-player.e2e.cjs` et `quiz-editor.e2e.cjs`.
- Captures : `docs/tech/captures/f2/`.
