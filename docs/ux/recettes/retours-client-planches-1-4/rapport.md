# Recette réelle : retours client, planches 1 à 4 (+ réserve du lot E)

**Banc** :
- branche `claude/dev-mvp` à 52c523d, avec 4b06ad2, 365cb46, 5949f01, c0dc17a, 9c880e6 et 49a0435 ;
- app locale (vite 5173) lancée comme la CI, avec `VITE_EXTENSION_ID` ;
- faux Supabase, données fictives (acme, example.com, adresse Slack factice `T000FICTIF`) ;
- Chromium, à 1440 et 390 px, en clair et en sombre.

Les captures sont dans ce dossier.

| Planche | e2e (clair / sombre) | Verdict |
| --- | --- | --- |
| 1 · Accès › Avec un mot de passe | acces-mot-de-passe 28/28 · 28/28 | **VERT** |
| 2 · Partager › Lien | partager-lien 30/30 · 30/30 | **ROUGE** : infobulles invisibles dans la fenêtre Partager |
| 3 · Pilule « Auto » de l'assistant | assistant-modele 15/15 · 15/15 | **VERT** |
| 4 · Fenêtre Slack | l48f-integrations 45/45 · 45/45 | **VERT**, 2 remarques non bloquantes |
| Lot E · capture-etapes (réserve) | 38/38 · 38/38 | **réserve levée** |

## Planche 1 · Accès › Avec un mot de passe : VERT

- Champ de 40 px, clé à gauche, Afficher et Copier dans le champ.
- Au focus, la suggestion s'ouvre à 4 px sous le champ, avec « Mot de passe fort · n caractères » et l'étiquette « Suggéré ». Une nouvelle suggestion est proposée à chaque ouverture (ex. « Clair-Atlas-18-Comete »).
- « Générer » et le bloc bleu ont disparu. « Enregistrer le mot de passe » est à droite, désactivé sous 8 caractères.
- Conforme en clair et en sombre, à 1440 et 390 px. Captures : `p1-mdp-1440-clair.png`, `p1-mdp-390-clair-sombre.png`.

## Planche 2 · Partager › Lien : ROUGE

Conforme :
- ordre bandeau d'accès → Lien de la démo → Adresse personnalisée → Paramètres d'URL, avec 24 px entre sections et 8 px entre libellé et contrôle ;
- 3 boutons icône de 40 px, 12 px sous le champ et 8 px entre eux, avec leurs noms accessibles ;
- préfixe de l'adresse au-dessus sous 600 px ;
- `aria-disabled` en « Sur invitation » et quand la démo n'est pas publiée.

Captures : `p2-lien-1440-clair-sombre.png`, `p2-lien-390-clair-sombre.png`.

**Défaut bloquant : l'infobulle ne s'affiche jamais à l'écran.**
- La fenêtre Partager est un `<dialog>` ouvert en modale (`.shd-dialog`, `:modal` = vrai), donc dans la couche supérieure du navigateur.
- L'infobulle (`packages/ui/src/tooltip.ts`) est ajoutée à `document.body` : elle passe **sous** la modale, quel que soit son z-index (2147483000).
- Mesure au survol de « Envoyer par e-mail » à 1440 : l'infobulle est dans le DOM (445, 351, 136 × 30 px ; opacité 1), mais l'élément visible à cet endroit est le champ du lien (`elementFromPoint` → `INPUT.fd-copy__input`). Elle n'apparaît sur aucune capture : `p2-infobulle-invisible-1440.png`, `p2-envoi-grise-390.png`.
- Conséquence : les boutons icône n'ont pas de nom visible, et la raison d'un envoi impossible (« Accès sur invitation : invitez les personnes depuis Accès. », « Publiez la démo pour envoyer son lien. ») n'est jamais lue par un utilisateur voyant. C'était le cœur de la planche.
- L'e2e passe, car il lit le texte de `.fd-tooltip` sans vérifier qu'elle est visible.

**Correction attendue** :
1. Dans `tooltip.ts`, monter l'infobulle dans la modale ouverte qui contient l'ancre (`container ?? anchor.closest('dialog[open]') ?? doc.body`). L'option `container` existe déjà.
2. Ajouter un contrôle e2e de visibilité : `elementFromPoint` au centre de l'infobulle doit renvoyer l'infobulle elle-même. Le contrôle vaut pour les autres fenêtres qui ont des infobulles (Partager, MODAL-01).

## Planche 3 · Pilule « Auto » : VERT

- Pilule de 32 px dans le champ, juste avant Envoyer, avec 4 px d'écart.
- Menu de 288 px : Auto coché (« Équilibre la vitesse, l'effort et le coût »), section Recommandé avec Claude Sonnet et Claude Opus, puis « Autres modèles › ». Ce sous-menu contient « Modèles OpenAI » en « Bientôt », avec la phrase sur les Paramètres › Assistance IA.
- Clavier : Entrée choisit, Échap ferme, le focus revient sur la pilule. Pied de réponse : « Généré par IA (Auto · Claude Sonnet), à vérifier ».
- Captures : `p3-assistant-1440-clair.png`, `p3-menu-clair.png`, `p3-autres-modeles-sombre.png`.

Écarts à juger, tous acceptés :
1. Pas de micro dans l'assistant aujourd'hui : rien ne l'annonce, donc rien ne trompe l'utilisateur.
2. Modèles fixés à Sonnet et Opus jusqu'à la Console L41 : accepté, à reprendre avec L41.
3. Tuile du fournisseur en monogramme : conforme à ICON-01, qui exclut les logos de marque dans les menus.

## Planche 4 · Fenêtre Slack : VERT

- MODAL-01 : sous-titre d'une ligne ; étiquette « Connecté » à 8 px du titre.
- Événements dans un encadré de rayon 12 : lignes de 56 px, tuile de 32 px, colonne d'état de 64 px, interrupteur pour les Alertes, « Bientôt » pour Leads et Commentaires.
- Lien « Comment obtenir l'adresse ? » (nouvel onglet) ; champ de 40 px ; aide « Elle est masquée une fois enregistrée. ».
- Un test refusé s'affiche sous le champ (« Slack n'a pas accepté le message de test. Vérifiez l'adresse. »), et rien n'est gardé.
- État connecté :
  - adresse masquée en lecture seule (`hooks.slack.com/services/T000…/••••`) ;
  - à 1440 px, Déconnecter à gauche, Envoyer un test et Enregistrer à droite ;
  - Enregistrer n'est actif qu'après un changement de l'interrupteur ;
  - à 390 px, Déconnecter passe dessous ;
  - la confirmation « Déconnecter Slack ? » s'affiche bien.
- Captures : `p4-slack-1440-etats.png` (vide, refus, connecté en clair, connecté en sombre) et `p4-slack-390-etats.png`.

Remarques non bloquantes, à faire avec un prochain lot :
- L'aide sous le champ est à **12 px**, contre 8 px dans Partager › Lien (planche 2). Je demande 8 px partout.
- « Déconnecter » est un lien de **21 px** de haut. À 390 px, il passe le critère WCAG 2.5.8 grâce à l'espace autour (8 px sous Enregistrer), mais il reste petit au doigt. Demande : hauteur de 40 px au pied mobile, comme les autres boutons du pied.

## Réserve du lot E · capture-etapes : levée

Avec `VITE_EXTENSION_ID` au démarrage de vite, comme en CI, le test passe à 38/38 en clair et en sombre. Le bandeau « Capture en cours dans l'extension · 0 étape · elles arriveront à la fin. » s'affiche, avec « Revenir à la capture » et « Annuler l'ajout » (`lotE-bandeau-capture-sombre.png`).

Remarque de texte, non bloquante : « à la fin » peut se lire comme « à la fin de la démo », alors que le repère de la liste dit « Les nouvelles étapes arriveront ici », c'est-à-dire après l'étape 1. Je propose « elles arriveront à la fin de la capture. ».

## Rectificatif du 26/11 · planche 1 : alignement des options d'accès

**Mon VERT de la planche 1 sur 52c523d était une erreur.** Sur ma propre capture (`p1-mdp-1440-clair.png`), le bloc gris déplié sous « Avec un mot de passe » était décalé de 30 px vers la droite par rapport à la carte rose. C'est le défaut que le client avait signalé deux fois. Le verdict juste sur 52c523d était **ROUGE**. J'ai jugé le contenu du champ et de la suggestion, sans contrôler le bord du bloc par rapport à sa carte. Désormais, je mesure les bords de chaque bloc déplié par rapport à sa carte.

**Contre-recette sur 8414cab : VERT.**
- L'option ouverte est une seule carte rose : l'en-tête, un filet, puis les réglages, aux bords exacts de la carte.
- Le retrait de 30 px et le fond gris ont disparu.
- C'est vérifié pour Mot de passe, Sur invitation et Par domaine e-mail, à 1440 et 390 px, en clair et en sombre : `p1-alignement-8414cab-1440.png` et `p1-alignement-8414cab-390.png`.
- e2e `acces-options-alignement` : 28/28 en clair comme en sombre ; `acces-mot-de-passe` : 28/28.
- Autres listes d'options dépliables de l'app : la recherche dans les styles montre que ce motif (carte d'option avec réglages dépliés) n'existe que dans Accès. Rien d'autre à corriger.

Demandes concernées : Accès › Avec un mot de passe (champ, suggestion, alignement du bloc déplié) · alignement des options d'accès ouvertes (Mot de passe, Sur invitation, Par domaine e-mail).
