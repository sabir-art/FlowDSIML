# L60, capture de bout en bout : état des lieux et plan par lots

Mesures du 25/11, faites avec l'extension **construite et chargée** dans Chromium sur le banc de sites
d'essai (`apps/extension/e2e/banc/serveur.cjs`, données fictives). Le parcours est celui d'un
utilisateur ; chaque page copiée est ensuite relue comme dans le lecteur (sans aucun script) pour juger
ce qu'on y voit. Script : `apps/extension/e2e/banc/etat-html.cjs`.

## 1. Mode HTML (et Sandbox actuel, qui repose sur lui)

| Cas du banc | Pages copiées | États retrouvés | Ce qui casse |
|---|---|---|---|
| Application à page unique (routes internes, liste chargée après coup) | 3 sur 3 | 2 sur 3 | la fiche est copiée, mais « Ville : Lyon » et le bouton « Ajouter une note » sont **floutés à tort** |
| Formulaire envoyé (POST) | 2 sur 2 | 1 sur 2 | le bouton « Envoyer la demande » est **flouté à tort** ; la confirmation est bien copiée |
| Scripts de tiers (mesure d'audience, chat) | 2 sur 2 | 2 sur 2 | le bouton de chat du tiers reste dans la copie, **mort** ; aucun script ne peut être rétabli |
| Onglets chargés en différé (même adresse) | **1 sur 3** | **1 sur 3** | changer d'onglet **ne copie rien** : deux états perdus sans que rien ne le dise |
| Menu ouvert au survol | 3 sur 3 | 3 sur 3 | seulement si l'on pense à « Capturer cette page » menu ouvert |

Ce qui marche : styles, couleurs, police et images sont conformes sur les 11 pages copiées ; les
changements d'adresse sans rechargement sont copiés seuls, après la fin du chargement ; le lien proposé
entre deux pages est le bon.

Causes :

1. **Faux positifs de la détection de données personnelles** (`apps/extension/lib/scan.ts`,
   `contextLabel`). Le texte de l'élément **précédent** sert de libellé s'il fait 30 caractères au plus :
   une phrase cachée « Indiquez votre nom. » fait du bouton suivant une « valeur de nom », et une ligne
   « Ville : Lyon » fait du bouton suivant une « adresse ». Le texte est remplacé et flouté. C'est le
   défaut le plus visible (« pages mal capturées ») et il touche aussi les captures d'écran : l'UX a
   relevé « Nom » sur 8 captures d'une page sans donnée personnelle.
2. **Changement d'écran sans changement d'adresse** (`lib/screenChange.ts`) : il faut un nouveau titre
   principal ou une grande surface modifiée. Un panneau d'onglet remplacé ne passe pas le seuil.
3. **Aucun script** dans la copie, par conception (v1 inerte) : rien ne réagit, et ce que les scripts de
   tiers ont ajouté à la page reste comme un décor mort.
4. **Titres** : l'étape prend le libellé du clic fait *en quittant* la page (la page d'accueil s'appelle
   « Clients »), et toutes les pages d'une application à page unique ont le même titre d'onglet : le
   plan est difficile à lire.
5. **États au survol** : rien n'indique à l'utilisateur qu'il doit capturer menu ouvert ; un menu
   purement CSS (`:hover`) ne survit pas à la copie.

## 2. Captures d'écran

Les e2e existants passent (capture, ajout, cadre, guidé, onglets : étapes créées, envoyées, au bon
endroit). Défauts connus : la même détection de données personnelles (cause 1) ; les libellés de clic
(corrigés par L63) ; le parcours de démarrage en 4 à 6 décisions (spec L60 §1) ; aucun retour après
chaque clic (spec L60 §2) ; la vérification affichée même sans détection (spec L60 §3).

## 3. Vidéo

Les e2e couvrent la barre, les repères, la revue et les masques, **pas l'enregistrement** : le flux de
l'onglet n'existe pas dans un Chromium sans écran. Tant qu'un faux flux n'est pas dans le banc, la
vidéo n'est pas testée de bout en bout. Défauts connus : masques automatiques non retirables (L64),
titres des pauses (corrigés par L63).

## 4. Sandbox

Aujourd'hui : les mêmes pages inertes, reliées entre elles. Les trois reproches du client viennent des
causes 1 (pages « mal capturées »), 2 (pages absentes du plan) et 3 (scripts bloqués). La v2 est décrite
dans `sandbox-v2.md`.

## 5. Plan par lots

Chaque lot est livré avec : e2e sur le banc avec l'extension chargée, parcours réels jugés dans l'app,
et le rapport « à la place de l'utilisateur » avec captures.

| Lot | Contenu | Critère (100 %) |
|---|---|---|
| **A. Fiabilité des copies** | détection de données personnelles : un bouton, un lien ou un onglet n'est jamais une valeur, un libellé caché ou une phrase n'est pas un libellé ; copie automatique d'un onglet ou d'un panneau remplacé ; titre d'étape = titre de la page copiée ; éléments ajoutés par un tiers bloqué retirés de la copie | sur le banc : tous les états retrouvés, aucun flou à tort, aucun titre technique |
| **B. Banc de bout en bout** | le banc pousse ses captures dans l'app et les ouvre dans l'éditeur et le lecteur ; rapport de recette généré avec captures ; faux flux d'onglet pour la vidéo | chaque page ou clic capturé apparaît dans l'app, au bon endroit du plan |
| **C. Popup L60** | « Que voulez-vous capturer ? », un clic démarre, dernier mode mémorisé (Entrée), destination en une ligne, Réglages, avertissement HTML une fois | e2e du §5 de la spec |
| **D. Barre commune** | même barre dans les 4 modes, carte « Étape n capturée » avec Annuler, Pause, compte à rebours vidéo | idem |
| **E. Terminer et arrivée** | panneau d'envoi, vérification seulement s'il y a des détections, toast « Démo prête », étiquette « Nouvelle », arrivée en direct | idem |
| **F. Sandbox v2** | étapes 1 à 6 de `sandbox-v2.md` | toutes les pages au plan, scripts rétablissables |

Ordre proposé : A, B, puis C à E, F en parallèle dès que B existe (il en a besoin pour sa mesure).
