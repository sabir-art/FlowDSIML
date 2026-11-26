# Re-recette réelle avant mise en ligne : correctifs 4c0e62c, f3b201f, 1cc2126, 67af58f

**Banc** : branche `claude/dev-mvp` à 67af58f. App locale lancée comme en CI, faux Supabase, données fictives. Chromium à 1440 et 390 px, en clair et en sombre.

## Verdict : VERT

Les 7 e2e du lot passent en clair et en sombre :

| e2e | Contrôles |
| --- | --- |
| partager-lien | 30/30 |
| l48f-integrations | 47/47 |
| capture-etapes | 38/38 |
| presenter-l66 | 27/27 |
| acces-options-alignement | 28/28 |
| acces-mot-de-passe | 28/28 |
| assistant-modele | 15/15 |

### a) Infobulles dans les fenêtres modales (ROUGE de la planche 2) : levé

J'ai mesuré au survol, à l'écran : `elementFromPoint` au centre de l'infobulle renvoie bien l'infobulle, qui est montée dans la fenêtre ouverte. Captures : `infobulles-dans-les-fenetres.png`.

| Fenêtre | Infobulle | 1440 clair | 390 sombre |
| --- | --- | --- | --- |
| Partager › Lien | « Envoyer par e-mail » | vue | vue |
| Partager › Lien | « Envoyer par message » | vue | vue |
| Partager › Lien | « Télécharger le QR code (PNG) » | vue | vue |
| Partager › Lien, accès « Sur invitation » | « Accès sur invitation : invitez les personnes depuis Accès. » | vue | vue |
| Partager › Lien, démo non publiée | « Publiez la démo pour envoyer son lien. » | vue | vue |
| Partager | « Fermer » | vue | vue |
| Slack | « Fermer » | vue | vue |
| Présenter | « Fermer » | vue | vue |

### b) Slack : conforme

- L'aide est à **8 px** sous le champ, à 1440 comme à 390.
- « Déconnecter » fait **32 px** de haut à 390, sous Envoyer un test et Enregistrer. À 1440, c'est un lien de 21 px à gauche du pied, avec de l'espace autour : c'est acceptable.

Capture : `slack-390-sombre-et-l66-fenetre.png`.

### c) Lot E : conforme

Le bandeau dit « Capture en cours dans l'extension · 0 étape · elles arriveront à la fin de la capture. », et le repère « Les nouvelles étapes arriveront ici » reste en place dans la liste. Vérifié par l'e2e, en clair et en sombre.

### d) L66 : conforme

- 24 px entre la ligne Commencer à / Minuteur et les options.
- Sans historique, le pied affiche seulement Annuler et Lancer la présentation. Avec un historique, il affiche « Historique (1) ».
- Les seuils du verdict sont testés : moins de 80 % donne « Plus courte que prévu », de 80 à 100 % donne « Dans les temps », au-delà donne « Dépassée de … ».

Demandes concernées : Partager › Lien (infobulles des boutons d'envoi, raison de l'envoi grisé) · fenêtre Slack (aide sous le champ, Déconnecter en mobile) · bandeau « Capture en cours » du lot E · L66 Présenter (écart sous Commencer à / Minuteur, Historique masqué à 0, seuil « Plus courte que prévu ») · Accès › Avec un mot de passe et alignement des options d'accès (non-régression) · pilule Auto de l'assistant (non-régression).
