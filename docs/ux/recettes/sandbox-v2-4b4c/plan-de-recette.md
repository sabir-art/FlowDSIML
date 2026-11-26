# Plan de recette réelle : Sandbox v2, étapes 4b/4c (pages liées et capture en série)

Préparé le 26/11, avant la livraison, pour que la recette puisse se faire dès que le dev pousse. Référence : `docs/ux/propositions/sandbox-v2-pages-liees/spec.md` (§1 à §5, liens refusés dans le plan) et sa planche.

## Banc

- `claude/dev-mvp` à la pointe livrée.
- Extension construite avec `WXT_E2E=1 WXT_DEBUGGER=1` et le faux Supabase local (`e2e/mock-supabase.cjs`).
- Serveur du banc : `node e2e/banc/serveur.cjs` (:54410), site **/multi**. Il a 7 pages sur deux niveaux et des pièges qui comptent leurs visites :
  - une ancre ;
  - un autre site ;
  - un lien e-mail ;
  - une déconnexion ;
  - une suppression de compte ;
  - un PDF.
- App locale (5173) et lecteur (5174). Faux backend, données fictives seulement (acme, example.com). Aucun compte réel.
- Chromium à 1440 × 900, en clair et en sombre. La barre de capture est mesurée dans son shadow DOM (`[data-fd-ui]`).
- Le compteur de visites des pièges sert de preuve : **0 visite** attendue pour chaque piège pendant toute la recette.

## Points à vérifier (un VERT ou un ROUGE chacun)

| # | Point | Comment je mesure | VERT si |
| --- | --- | --- | --- |
| 1 | **Bouton « Pages liées »** dans la barre | Capture de /multi, page d'accueil | Il remplace « Chaque page visitée est ajoutée ». Badge = nombre de pages à capturer, absent à 0. `aria-expanded` suit le panneau. |
| 2 | **Panneau** | Ouverture, mesure, fermeture par la croix puis Échap | 400 px de large, liste de 340 px au plus avec défilement. Même style que la carte « Étape capturée » (rayon 12, ombre, `--fdb-*`). Après Échap, le focus revient sur le bouton. |
| 3 | **Résumé et groupes** | Texte et ordre des groupes | Ordre : À capturer, Capturées, Laissées, Jamais ouvertes, En erreur. « À capturer » est en couleur de marque. Chaque ligne a son action selon le tableau du §1. |
| 4 | **Jamais ouvertes** | Déconnexion, suppression, PDF, autre site et lien e-mail | Pastille « Refusée » et raison en clair. Aucune action. **0 visite** au compteur du banc. |
| 5 | **Laisser / Reprendre** | Laisser une page, puis la reprendre | La ligne change de groupe, et le badge et le résumé se mettent à jour tout de suite. Le total de couverture suit (point 12). |
| 6 | **Capture en série** | « Capturer les {n} pages liées » | Même site, un niveau, 20 pages au plus. Les pages s'ouvrent une à une dans l'onglet. La jauge fait 96 px. « Pages liées : {i} sur {n} · {titre} » s'affiche avec `role="status"`, annoncé à chaque page et non à chaque tic de la jauge. La pastille « {n} pages » augmente. |
| 7 | **Panneau pendant la série** | Panneau ouvert pendant la série | Ligne en cours « En cours… » sur un fond de marque léger ; les suivantes « En attente ». |
| 8 | **Arrêter** | Arrêt après 2 pages | La page en cours se termine. Carte « Arrêté : 2 pages liées capturées », « {r} restent à capturer. Vos pages sont gardées. », avec « Reprendre » et « Vérifier et envoyer ». Les pages déjà capturées sont gardées. |
| 9 | **Fin de passe et plafond** | Passe complète, puis un site de plus de 20 liens si le banc le permet | Carte « {k} pages liées capturées · {e} en erreur » et « {total} pages en tout. Rien n'est encore envoyé. ». Au-delà de 20 pages : « 20 pages capturées, la limite d'une passe. {r} restent : relancez une passe. » |
| 10 | **En erreur** | Lien vers une page 404 du banc | « page introuvable (404) » avec « Réessayer ». Réessayer la renvoie dans la série. |
| 11 | **Vers « Vérifier avant l'envoi »** | « Vérifier et envoyer » | « Pages copiées » indique « dont {k} capturées en série depuis les pages liées ». Le groupe « Pages liées non capturées » ({n}) est juste après, avec ses pastilles et « Pourquoi ? », sans action. |
| 12 | **Couverture dans le plan (4a)** | Envoi en Sandbox vivant, puis plan dans l'éditeur | « {c} pages sur {t} liens » avec une jauge de 120 px. t = capturées + à capturer : les laissés et **les refusés sont hors du total**, avec « · {l} laissé(s) » et « · {r} refusé(s) » en gris. À 100 % : « Toutes les pages liées sont capturées ({c}) ». |
| 13 | **Liens refusés dans le plan** | « Liens sans page » | Bouclier et « Jamais ouverte par sécurité » à la place de « Capturer cette page ». « Ouvrir la page » porte l'infobulle « Ouvre la page sur votre site : cela peut vous déconnecter ou agir sur votre compte. » (décision du chef, lot 4b/4c). Relier / Laisser restent. |
| 14 | **Clavier et lecteur d'écran** | Tab dans la barre et dans le panneau | Ordre logique. Focus visible (FIELD-01) sur le bouton, les lignes et les actions. Les pastilles sont lues avec leur raison. |
| 15 | **Clair et sombre** | Toutes les captures en double | Contrastes ≥ 4,5:1 pour le texte et ≥ 3:1 pour les contours. Rien de prune pâle sur un état désactivé : gris, comme le reste de l'app. |
| 16 | **Sécurité** | DOM, réseau et compteur du banc | Aucun piège visité. Aucune donnée réelle. Aucune clé dans les réponses. |

## Captures prévues

- Barre avec badge, puis panneau ouvert (clair et sombre).
- Série en cours avec le panneau ouvert, carte « Arrêté », carte de fin de passe.
- « Vérifier avant l'envoi » avec le groupe « Pages liées non capturées ».
- Plan : couverture à moins de 100 % et à 100 %, liens refusés avec l'infobulle d'« Ouvrir la page ».

## Ce que je ne pourrai pas juger sur le banc

- Le comportement sur un vrai site client : la recette reste sur le site d'essai, et la liste de contrôle du client couvre le reste.
- La lenteur réelle d'un site : le banc répond vite. Je ralentirai une page du banc (délai serveur) pour voir l'état « En cours… » et le « délai dépassé », si le banc le permet.
