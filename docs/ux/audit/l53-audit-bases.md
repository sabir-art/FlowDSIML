# L53, audit des bases (composants.md §18)

> Audit du 21 novembre, sur `main` = `d33d5a1`. Fait sur la même version, servie en local avec le faux backend et des données fictives (aucun compte réel).
> Méthode (§18.5) :
> - captures réelles en clair et en sombre ;
> - styles calculés mesurés dans le navigateur ;
> - `docs/ux/ci/boutons-natifs.e2e.cjs` sur toutes les routes ;
> - écarts mesurés dans le corps de 15 modales.
>
> Liste unique, triée par impact : **A** (faux ou cassé, visible de tous), **B** (lisibilité et cohérence), **C** (finition).

## A. Bloquant

1. **L'extension n'est pas publiée, mais l'app explique comment l'installer** (§18.4). `VITE_EXTENSION_URL` est vide en production.
   - `components/ExtensionDialog.tsx` : la modale affiche les 3 étapes d'installation et « Voir l'article d'aide » (un bouton natif, voir A2). Il faut l'état « Bientôt disponible » : titre « Extension TutoClick » et « Bientôt disponible », une phrase, « Fermer » seul.
   - `pages/Onboarding.tsx` (l. 337 à 349) : sans URL, « Ajouter à Chrome » reste un bouton et ouvre un article d'aide. Il faut la phrase, puis « Continuer sans l'extension », sans bouton d'installation.
   - Checklist « Prise en main », ligne « Installer l'extension » : « Bientôt » en texte à la place de « Installer ».
   - « Nouvelle démo », source « Capturer avec l'extension » : désactivée, avec « Bientôt ».
2. **Boutons natifs du navigateur** (§18.1). Le contrôle CI en trouve 2, en clair et en sombre :
   - `ExtensionDialog.tsx`, « Voir l'article d'aide » (`.link-btn`) : police Arial, bordure `outset`, fond `rgb(239, 239, 239)`. La classe n'est pas chargée hors de `.mk` : il faut `.link-button` ;
   - `DemosPage` et `Sandbox`, colonne Dossiers, « Nouveau dossier » (`.fcol__new`) : police Arial. Il faut `font: inherit`.
   - Filet de sécurité dans `base.css` : `button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }`.
   - CI : copier `docs/ux/ci/boutons-natifs.e2e.cjs` dans `apps/web/e2e/` et l'ajouter au workflow.
3. **« Activer l'Assistance IA ? »** (`pages/settings/AiSettings.tsx`) : il y a **0 px** entre l'encadré (`.alert.ai-notice`) et « J'ai lu ces informations » (`.check`). Il en faut 16 au moins (§18.2). C'est la même modale pour « Activer la voix de synthèse » et « Activer les sous-titres automatiques ».
4. **Sous-navigation des Paramètres** (`nav.snav`, §18.3), mesures :
   - il n'y a que **16 px** de vide au-dessus du texte de chaque titre de groupe, contre 24 attendus ;
   - les éléments sont en `rgb(79, 89, 102)`, presque la couleur des titres (`rgb(95, 107, 120)`) : ils doivent passer en `text` ;
   - survol : fond `surface-sunken`, sans changement de graisse ;
   - actif : fond `surface`, graisse 600, ombre `0 1px 2px rgb(8 10 14 / .08)` ;
   - titres en `<h3>`, avec `cursor: default` et aucun survol.
   - L'écart de 6 px entre un titre et son premier élément est conforme.

## B. Lisibilité et cohérence

5. **Corps de modale serrés** (§18.2, §15.4 bis). Correctif global : `.dialog-body` et `.mk .modal-body` en `display: flex; flex-direction: column; gap: 16px`, avec les enfants à `margin: 0`. Une aide reste à 6 px de son champ, dans le même groupe. Mesures :
   | Modale | Écart mesuré | Attendu |
   |---|---|---|
   | Inviter des personnes (Partager › Accès) | 0 px entre `.field` (adresses et aide) et `.setting` (« Envoyer l'invitation par e-mail ») | 16 px |
   | Ajouter un webhook | 0 px entre le groupe d'événements (`.l23-fs`) et son aide « Format : … » | 6 px (aide du groupe) |
   | Traduire la démo | 0 px entre `.field` et l'aide « Une copie traduite est créée en brouillon… » | 6 px |
   | Nouvelle alerte | 14 px entre les champs (Démo, Segment, Prévenir par, Fréquence) | 20 px (champ → champ, modale) |
   | Installer l'extension | 14 et 13 px entre l'introduction, les étapes et le lien | 16 px (cette modale change avec A1) |
   - Les 6 autres modales mesurées sont conformes : Nouveau dossier, Inviter des membres, Ajouter un terme, Nouvelle variable, Exporter, Raccourcis clavier.
6. **Les titres de groupe diffèrent selon la navigation** (§18.3, une seule règle) :
   - barre latérale, « Formation » (`.fd-nav__section`) : 12 px en casse normale, 20 px au-dessus, 8 px en dessous ;
   - colonne Dossiers, « Dossiers de l'espace » (`.fcol__section`) : 11 px en capitales, 25 px au-dessus, 4 px en dessous ;
   - Paramètres : 11 px en capitales, 16 px au-dessus et 6 px en dessous.
   - Il faut partout 11 px 600 en capitales, `text-muted`, 24 px au-dessus et 6 px en dessous.
7. **Textes qui promettent ce qui n'existe pas, ou qui parlent technique** :
   - Paramètres › Équipe, `members.inviteHint` : « L'envoi automatique d'emails d'invitation nécessite un SMTP personnalisé (avant la bêta). En attendant, copiez le lien. » C'est un texte interne, montré à l'utilisateur. Il faut : « Envoyez ce lien à la personne invitée. » ; si l'envoi par e-mail doit venir, ajouter « Envoi par e-mail · Bientôt ». À la place, on peut brancher l'envoi via le service d'e-mails déjà configuré pour L39.
   - Partager, aperçu sur les réseaux, `share.ogHelp` : « Image générée automatiquement à la publication. », suivi d'un badge « Bientôt ». La phrase affirme ce que le badge dément. Il faut : « Bientôt : une image d'aperçu générée à la publication. », avec « Bientôt » en texte.
   - Vérifiés et exacts : rattachement automatique d'un apprenant à sa structure par le domaine (`suivi_apprenants.sql`), nouveaux essais des webhooks (1 min, 5 min, 30 min, 2 h, 6 h, puis pause), sous-titres automatiques et liaison automatique des liens du Sandbox. Les avertissements « aucune détection automatique » sur les images importées sont exacts.

## C. Finition

8. Préférences de notification : « Recevoir aussi par e-mail » porte un badge `fd-badge` « Bientôt ». Il faut « Bientôt » en texte gris à droite, comme dans les Paramètres (delta L48-A).
9. Éléments de la barre latérale inactifs en `rgb(79, 89, 102)` : passer en `text` pour suivre la règle des navigations groupées (§18.3). L'élément actif (fond `text`, texte blanc) est conforme.

## Ce qui est déjà conforme

- Aucun bouton natif hors des 2 cas de A2, sur toutes les routes, en clair et en sombre.
- Les états vides n'ont plus de pastille (82921e6).
- Hauteur des éléments de navigation : 36 px dans Paramètres, 44 px dans la barre latérale, 2 px entre deux éléments.
