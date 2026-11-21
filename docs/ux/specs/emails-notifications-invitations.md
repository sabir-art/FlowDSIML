# E-mails : résumé des notifications (fiche 122) et invitations d'équipe

> Backlog validé par le chef le 21 novembre (priorités 4 et 5), après la purge RGPD des leads (1), le guide du Sandbox (2) et la génération depuis une capture HTML (3).
> État relevé sur `main` (ea2d63c) :
> - préférences de notification : « Recevoir aussi par e-mail » (`notifications.p_email`) est affiché en « Bientôt » ;
> - Paramètres › Équipe : l'invitation crée une ligne dans `invitations` et donne un lien à transmettre (« Envoyez ce lien à la personne invitée. »). Aucun e-mail n'est envoyé.
>
> Envoi : Brevo, SMTP configuré dans Supabase Auth en prod depuis le 20/11 (expéditeur TutoClick, gabarits FR), selon le chef.
> Charte des e-mails : `docs/ux/emails/README.md`. Données fictives uniquement (Acme, `@example.com`).

## 1. Contraintes du chef (non négociables)

- **Quota** : Brevo gratuit, 300 envois par jour, **partagés avec l'authentification** (confirmation, lien de connexion, mot de passe, accès aux démos par e-mail).
- **Notifications** :
  - par e-mail **sur demande de chaque personne** (opt-in) ;
  - en **résumé groupé**, au plus **1 e-mail par heure** et par personne ;
  - avec un **lien de désinscription**.
- **Invitations** :
  - **20 par heure et par espace** au plus ;
  - aucune donnée personnelle dans l'e-mail au-delà du **nom de l'espace** et du **nom de l'invitant**.
- **Tests** : **aucun envoi réel**. Les e2e passent par un faux transport, et tout lien vers une adresse se fait avec `@example.com`.

## 2. Budget d'envoi commun (confirmé par le chef le 21 novembre)

- Un compteur journalier partagé (table `email_budget`, remise à zéro à minuit, heure de Paris) compte **tous les envois faits par l'app** : résumés et invitations.
- **Plafond de l'app : 150 par jour.** Les 150 autres restent pour l'authentification, qui ne doit jamais être bloquée par un résumé.
- Plafond atteint :
  - les **résumés** sont reportés à l'heure suivante, puis au lendemain. Rien n'est perdu, et tout reste visible dans l'app ;
  - les **invitations** retombent sur le lien à copier (§4.3).
- La page Paramètres › Utilisation affiche une ligne « E-mails envoyés aujourd'hui : {n} sur 150 », visible par les admins, en 14 px, sans jauge colorée.

## 3. Résumé des notifications par e-mail (fiche 122)

### 3.1 Préférence (Paramètres › Notifications)
- « Recevoir aussi par e-mail » devient un interrupteur actif (retirer « Bientôt »). Il est **désactivé par défaut**, pour chacun.
- L'aide dessous dit : « Un e-mail au plus par heure, qui regroupe vos notifications non lues. Lien de désinscription dans chaque e-mail. »
- L'interrupteur ne concerne que les notifications que la personne a déjà choisi de recevoir dans l'app (mentions, réponses, commentaires, résolutions, alertes). Les démos coupées restent coupées.

### 3.2 Regroupement
- Une tâche planifiée (pg_cron, toutes les 15 minutes) prend les personnes qui remplissent toutes ces conditions :
  - l'option e-mail est activée ;
  - elles ont au moins une notification **non lue** et pas encore envoyée par e-mail ;
  - leur dernier résumé date d'**au moins 60 minutes**.
- Un seul e-mail par personne : **au plus 10 lignes**, les plus récentes d'abord, puis « Et {n} autres dans TutoClick » si besoin.
- Une notification lue dans l'app avant l'envoi n'est pas envoyée.

### 3.3 Contenu de l'e-mail
- **Objet** : « {n} nouvelles notifications dans TutoClick » (« 1 nouvelle notification… » au singulier).
- **Pré-en-tête** : le texte de la première ligne.
- **Corps** :
  - une ligne par notification, avec le texte déjà utilisé dans l'app (`notifications.k_*`, `alert_*`), par exemple « Camille a commenté « Créer un rendez-vous » · étape 3 » ;
  - un seul bouton, « Ouvrir les notifications » (`#/notifications`, ou l'app avec le tiroir ouvert).
- **Bas de page** : « Vous recevez cet e-mail parce que vous avez activé les notifications par e-mail dans TutoClick. », puis le lien « Ne plus recevoir ces e-mails ».
- Charte de `emails/README.md` : tableaux, 600 px, une colonne, bouton `#A3195B`, mode sombre, aucun pixel de suivi, aucun lien externe en dehors des liens de l'app.
- Pas de contenu de commentaire dans l'e-mail : seulement l'auteur, la démo et l'étape. Le texte du commentaire se lit dans l'app.

### 3.4 Désinscription
- Le lien « Ne plus recevoir ces e-mails » est une adresse avec un jeton à usage unique, valable 90 jours, propre à la personne. Il désactive l'option **sans connexion**, puis affiche une page simple : « Vous ne recevrez plus de notifications par e-mail. Vous pouvez les réactiver dans Paramètres › Notifications. »
- L'e-mail porte aussi les en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, qui mènent à la même action.

### 3.5 Envoi technique (décidé par le chef le 21 novembre)
- Ce n'est pas un e-mail d'authentification. Une Edge Function `notify-email` l'envoie par l'**API HTTP transactionnelle de Brevo** : `POST https://api.brevo.com/v3/smtp/email`, avec l'en-tête `api-key`. Pas de connexion SMTP depuis Deno.
- Secret : `BREVO_API_KEY`, demandé au client par le chef. On ne l'écrit jamais dans le dépôt ni dans les journaux.
- Les en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post` passent dans le champ `headers` de l'appel.
- **Sans le secret**, P2 se dégrade proprement :
  - « Recevoir aussi par e-mail » reste affiché en « Bientôt », désactivé, comme aujourd'hui ;
  - la tâche planifiée ne fait rien ;
  - aucune erreur n'est visible ;
  - P1 (invitations) n'en dépend pas.

## 4. Invitations d'équipe par e-mail

### 4.1 Modale « Inviter des membres » (Paramètres › Équipe)
- **Décision du chef du 21/11 : la case « Envoyer l'invitation par e-mail » est retirée.** L'e-mail part toujours ; le bouton principal est « Envoyer les invitations ».
- Après l'envoi, la confirmation dit « {n} invitations envoyées. » et propose **« Copier le lien »** en secours, pour chaque invitation créée. La liste « Invitations en attente » garde aussi « Copier le lien ». On peut toujours transmettre le lien soi-même.

### 4.2 Contenu de l'e-mail
- On réutilise le gabarit `invite.html` de Supabase Auth (objet « Invitation à rejoindre un espace TutoClick »), avec deux variables passées en `data` : le nom de l'espace et le nom de l'invitant.
- Texte : « {invitant} vous invite à rejoindre l'espace « {espace} » sur TutoClick. »
- Rien d'autre : ni rôle, ni liste de membres, ni adresse de l'invitant.
- Le lien d'action mène à l'acceptation de l'invitation (le jeton existant de `invitations`). L'invitation expire au bout de 14 jours, comme aujourd'hui : l'e-mail le dit.
- **Personne qui a déjà un compte TutoClick** (confirmé par le chef le 21 novembre) : Supabase Auth ne renvoie pas d'invitation à un compte existant. L'invitation apparaît alors dans **ses notifications de l'app** (« {invitant} vous invite à rejoindre « {espace} » »), avec Accepter et Refuser. Elle part aussi dans son résumé par e-mail, s'il est activé. Aucun autre e-mail.

### 4.3 Limites et repli
- Plafond : **20 invitations par heure et par espace** (comptées à l'envoi). Au-delà, les invitations sont créées sans e-mail et la raison est écrite dans la confirmation : « 20 invitations par heure au plus. Vous pourrez en envoyer d'autres à {heure}. Les liens restent disponibles. »
- Budget du jour atteint (§2), ou envoi en échec : l'invitation est **créée quand même**, et la modale affiche, au lieu du toast : « L'e-mail n'a pas pu partir. Copiez le lien et envoyez-le vous-même. », avec les liens à copier.
- Le texte actuel `members.inviteHint` (« Envoyez ce lien à la personne invitée. ») ne s'affiche plus que dans ce repli.

## 5. Textes (fr)

| Clé | Texte |
|---|---|
| `notifications.p_email` | Recevoir aussi par e-mail |
| `notifications.p_emailHelp` | Un e-mail au plus par heure, qui regroupe vos notifications non lues. Lien de désinscription dans chaque e-mail. |
| `email.digest.subject_one` | 1 nouvelle notification dans TutoClick |
| `email.digest.subject_other` | {{count}} nouvelles notifications dans TutoClick |
| `email.digest.more` | Et {{count}} autres dans TutoClick |
| `email.digest.open` | Ouvrir les notifications |
| `email.digest.why` | Vous recevez cet e-mail parce que vous avez activé les notifications par e-mail dans TutoClick. |
| `email.digest.unsubscribe` | Ne plus recevoir ces e-mails |
| `unsubscribe.done` | Vous ne recevrez plus de notifications par e-mail. Vous pouvez les réactiver dans Paramètres › Notifications. |
| `members.sendByEmail` | (retiré le 21/11 : l'e-mail part toujours) |
| `members.sendInvites` | Envoyer les invitations |
| `members.createInvites` | Créer les invitations |
| `members.sent_one` | 1 invitation envoyée. |
| `members.sent_other` | {{count}} invitations envoyées. |
| `members.rateLimit` | 20 invitations par heure au plus. Vous pourrez en envoyer d'autres à {{time}}. Les liens restent disponibles. |
| `members.emailFailed` | L'e-mail n'a pas pu partir. Copiez le lien et envoyez-le vous-même. |
| `notifications.k_invite` | {{actor}} vous invite à rejoindre « {{workspace}} » |
| `usage.emailsToday` | E-mails envoyés aujourd'hui : {{n}} sur 150 |

## 6. Découpage

| Paquet | Contenu | Recette |
|---|---|---|
| **P1, budget et invitations** | `email_budget`, plafond de 20 par heure, case dans la modale, e-mail par `invite.html` avec `data`, repli sur le lien, invitation dans l'app pour un compte existant | recette 1 à 4, 8 |
| **P2, résumé** | préférence, tâche planifiée, `notify-email` (API HTTP Brevo, `BREVO_API_KEY`), contenu, désinscription à un clic, ligne Utilisation ; sans le secret, l'option reste en « Bientôt » | recette 5 à 9 |

## 7. Recette (aucun envoi réel : faux transport, adresses `@example.com`)

1. Inviter `marie@acme.example` et `paul@acme.example`, avec la case cochée : 2 invitations sont créées, le faux transport reçoit 2 e-mails, et le toast dit « 2 invitations envoyées. ». L'e-mail ne contient que le nom de l'espace, le nom de l'invitant et le lien.
2. La 21e invitation dans l'heure : la case est désactivée avec la raison, et l'invitation est créée avec son lien.
3. Faux transport en échec : l'invitation est créée, et la modale affiche le message de repli avec le lien.
4. Inviter l'adresse d'un compte existant : aucun e-mail d'invitation, une notification « … vous invite à rejoindre « Acme » » avec Accepter et Refuser.
5. Option e-mail activée, 3 notifications non lues : un seul e-mail groupé de 3 lignes. Une 4e notification 20 minutes plus tard ne part qu'au résumé suivant, au moins 60 minutes après le premier.
6. Une notification lue dans l'app avant l'envoi n'est pas dans le résumé. Option désactivée : aucun e-mail.
7. « Ne plus recevoir ces e-mails » : l'option est désactivée sans connexion, la page de confirmation s'affiche, et les en-têtes `List-Unsubscribe` sont présents.
8. Budget : à 150 envois de l'app dans la journée, plus aucun résumé ni aucune invitation ne part (repli sur le lien), et l'authentification n'est pas touchée. La ligne Utilisation affiche « 150 sur 150 ».
9. Sans `BREVO_API_KEY` : « Recevoir aussi par e-mail » reste en « Bientôt », désactivé, et la tâche planifiée n'appelle pas Brevo. Avec le secret (faux serveur Brevo en test) : l'appel part avec l'en-tête `api-key` et les en-têtes de désinscription, et la clé n'apparaît dans aucun journal.
