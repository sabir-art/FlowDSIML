# Sandbox v2, étape 3c : publication, lecteur et réglages

Vérifié le 26/11 avec l'app et le lecteur en serveurs de développement, un faux Supabase et des
données fictives.

## Ce qui est livré

- **Publication** (migration `20261201360000_sandbox_v2_publication.sql`) :
  - `publish_demo` publie l'enregistrement vivant d'une page (`assets/<étape>-l-<md5>.json`) et le
    déclare dans le manifeste, dans `step.html.live = { url, keep }` (scripts gardés par l'auteur) ;
  - ceci seulement si la démo est un Sandbox « vivant » (`sandbox.live`) et si l'espace l'autorise
    (`sandbox_live_allowed`), sinon la page reste inerte ;
  - la copie se fait depuis le bucket `html_live`, et aucune adresse du site d'origine n'est publiée ;
  - pgTAP 9/9 et suite complète de 98 fichiers sans échec.
- **Manifeste** : `htmlStepSchema.live` (absent : page inerte, par défaut).
- **Lecteur** (`HtmlStep`), pour une page vivante :
  - les enregistrements de la démo sont lus une fois par visite ;
  - la page est construite par `buildLiveSrcdoc` avec les scripts gardés et les réponses de toute la
    démo (`mergeResponses`) ;
  - une navigation de la page (`nav`) mène à la page capturée de même adresse (`pageKey`) ;
  - vers elle-même, la page est rechargée avec un stockage neuf ; vers une page absente, le lecteur
    affiche « Aucun lien à cet endroit » ;
  - un enregistrement illisible donne la copie inerte (repli).
- **Aperçu de l'éditeur** : même rendu, avec des adresses signées de `html_live`. Une étape dupliquée
  reste inerte.
- **Réglages** :
  - Éditeur › Réglages du Sandbox › « Sandbox vivant » : proposé dès qu'une page a son
    enregistrement, désactivé avec sa raison si l'espace l'interdit ;
  - Paramètres › Sécurité › « Sandbox vivant » : garde-fou d'espace, autorisé par défaut, modifiable
    par un propriétaire ou un administrateur (RPC journalisée), en lecture seule pour les autres rôles.

## Contrôles

| e2e | Résultat |
|---|---|
| `player-sandbox-vivant` (clair et sombre) | 11/11 |
| `sandbox-vivant-reglages` (clair et sombre) | 8/8 |
| Non-régression : html-player, html-sandbox, guide-sandbox, l49-reglage | 34, 25, 42, 25 |

Détail de `player-sandbox-vivant` :
- page vivante dans une iframe `allow-scripts`, CSP sans sortie, scripts désignés par empreintes ;
- script bloqué non exécuté ;
- liste d'une application à page unique chargée avec une réponse relevée sur l'autre page ;
- route interne ;
- lien vers une autre page capturée ;
- formulaire : validation, succès fictif, puis formulaire vide au retour ;
- repli inerte ;
- **aucune requête de la page vers l'extérieur**.

`sandbox-vivant-reglages` vérifie :
- le réglage de la démo, enregistré ;
- l'aperçu, où le script réagit (compteur) ;
- le garde-fou : interdiction, RPC et journal ;
- le réglage de la démo désactivé avec sa raison ;
- la lecture seule pour un éditeur.

## Reste pour l'étape 3d

- Recette UX de bout en bout : capture réelle, puis éditeur, publication et lecteur public.
- Planche UX de l'écran « Vérifier avant l'envoi » pour un Sandbox vivant (voir le rapport 3b).
