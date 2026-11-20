# L23 : Paramètres > Intégrations (webhooks)

> **Maquette** : `docs/ux/maquettes/reference/parametres-integrations.html`, états par `?etat=` :
> `liste` · `vide` · `creer` · `secret` · `detail` · `test` · `pause`.
>
> **Structure** : celle de `reference/parametres.html` (navigation `.snav` en `role="tablist"`, sections `form-sec`, `.card`, `.table`, `.modal-backdrop`). L'onglet « Intégrations » (icône Lucide `plug`) s'ajoute après « Variables ».
>
> **Base fonctionnelle** : `specs/a5-integrations.md` (événements, signature, nouveaux essais). Cette spec la remplace sur trois points, signalés « Change » ci-dessous.
>
> **Données** : toutes fictives (`acme.example`). Le secret affiché dans la maquette est un faux, avec le préfixe `tcsec_` (et non `whsec_`, réservé à un autre éditeur et repéré par les scanners de secrets).

## 1. Accès

- L'onglet est visible pour les propriétaires et les admins. Pour les autres rôles, il est absent de la navigation, et l'adresse directe affiche « Vous n'avez pas accès à cette page » avec un retour vers « Général ».
- Le titre de la page suit A11Y-01 : « Intégrations · Paramètres · TutoClick ». Au détail : « Webhook hooks.acme.example · TutoClick ».

## 2. États et codes

| Code | État | `?etat=` | Contenu |
|---|---|---|---|
| L23-01 | Liste | `liste` | Carte « Webhooks » : tableau (adresse et nom, événements, état, dernier envoi, menu). Carte « Autres intégrations » : 6 cartes « Bientôt ». |
| L23-02 | Vide | `vide` | Même page, le tableau est remplacé par un état vide avec « Ajouter un webhook ». Les cartes « Bientôt » restent. |
| L23-03 | Créer | `creer` | Modale : adresse, nom facultatif, événements, puis « Créer le webhook ». Erreur affichée : adresse en `http://`. |
| L23-04 | Secret | `secret` | `alertdialog` : secret en clair une seule fois, « Copier », case « J'ai copié le secret » qui active « Terminé », « Envoyer un test ». |
| L23-05 | Détail et journal | `detail` | En-tête (adresse, état, auteur), événements, secret masqué, journal des envois et panneau de l'envoi sélectionné. |
| L23-06 | Test en échec | `test` | Bandeau d'erreur avec le code HTTP et un conseil, ligne « ping · Test » en tête du journal. |
| L23-07 | En pause | `pause` | Bandeau de mise en pause automatique, bouton principal « Réactiver ». |

## 3. Liste (L23-01, L23-02)

- **Adresse** : en police mono, une ligne, coupée par des points de suspension au-delà de 280 px (adresse complète dans `title` et sur le détail). C'est le lien vers le détail. Le nom (facultatif) s'affiche dessous en légende.
- **Événements** : 2 pastilles au plus, puis « +n ».
- **État** :
  - « Actif » (`badge-success`) ;
  - « En pause » (`badge-warning`), avec « n échecs » dessous : mise en pause automatique ;
  - « Désactivé » (badge neutre) : mis en pause à la main.
- **Dernier envoi** : pastille de statut HTTP (§6) et date relative. « Jamais » si aucun envoi.
- **Menu** « Actions pour {{hôte}} » : Envoyer un test, Désactiver ou Réactiver, Modifier, Supprimer.
- **Vide** : icône `webhook`, « Aucun webhook », une phrase d'usage, bouton principal. Pas d'exemple d'outil réel dans le texte.
- Tri : par date de création, le plus récent en haut. Pas de pagination (limite de 20 webhooks par workspace, message au-delà : « Limite de 20 webhooks atteinte »).

## 4. Créer et modifier (L23-03)

- **Adresse de réception** (obligatoire), validée à la perte du focus et à l'envoi :
  - doit commencer par `https://` ;
  - refus des adresses internes : `localhost`, IP privées et réservées, `.local`, `.internal` (protection SSRF, faite aussi côté serveur au moment de chaque envoi, après résolution DNS) ;
  - message unique et relié par `aria-describedby` : « L'adresse doit commencer par https://. Les adresses internes (localhost, réseau privé) sont refusées. »
- **Nom** (facultatif, 60 caractères).
- **Événements** : `fieldset` avec `legend`, cases à cocher en deux colonnes. Libellé en français, nom technique en mono dessous :
  - Nouveau lead · `lead.created` (seul événement qui transporte un e-mail, dit dans la légende) ;
  - Démo terminée · `demo.completed` ;
  - Démo publiée · `demo.published` ;
  - Module validé · `learner.module_validated` ;
  - Quiz échoué · `learner.quiz_failed` ;
  - Alerte déclenchée · `alert.triggered`.
- Au moins un événement : sinon « Créer le webhook » reste `aria-disabled` et un message s'affiche à l'envoi : « Choisissez au moins un événement ».
- Aide sous la liste : format `{ id, type, created_at, data }`, délai de 10 s par envoi, données personnelles limitées aux événements qui les concernent.
- **Modifier** rouvre la même modale (titre « Modifier le webhook »), sans le secret. Changer l'adresse ne change pas le secret.

## 5. Secret (L23-04) et renouvellement

- **Change par rapport à A5** : le secret n'est **plus jamais réaffiché** après la création. Pas de bouton « Afficher ». Sur le détail, il est masqué (`tcsec_••••…3f9a`, 4 derniers caractères) avec « Renouveler ».
- Modale de création : `role="alertdialog"`, pas de bouton Fermer ni d'Échap tant que la case n'est pas cochée. « Copier » donne un toast « Secret copié » (`role="status"`).
- « Envoyer un test » est proposé dans la même modale (résultat en toast : « Test envoyé · HTTP 200 en 180 ms », ou bascule vers L23-06 en cas d'échec après « Terminé »).
- **Renouveler** : confirmation « Renouveler le secret ? ». Le nouveau secret s'affiche une seule fois (même modale que L23-04). L'ancien reste valable 24 h, et les envois portent les deux signatures pendant ce délai.
- Signature : en-tête `TutoClick-Signature: t=…, v1=…`, HMAC-SHA256 de `t.corps`, tolérance de 5 min. Lien « Vérifier la signature » vers la doc.

## 6. Détail, journal et rejeu (L23-05)

- **En-tête** : adresse complète en mono (`h2`), état, « créé le … par … ». Actions : « Envoyer un test », « Désactiver » (icône `pause`), menu « Plus d'actions : modifier, supprimer ».
- **Journal des envois · 7 jours** : tableau avec `caption` masqué, filtre « Tous les statuts / Échecs ». Colonnes : Statut, Événement, Date, Durée.
  - Statut en pastille mono : 2xx vert (`success-soft`), 4xx et 5xx framboise pâle (`danger-soft`), « … » orange pâle pour un envoi en attente de nouvel essai. Le code est toujours écrit (pas d'information par la couleur seule).
  - Durée : temps de réponse, ou « essai n sur 6 » pour un échec, ou « essai dans 4 min » pour une attente.
  - Ligne sélectionnable (clic ou Entrée), `aria-selected="true"` et fond `surface-selected`.
  - **Change par rapport à A5** : pas de bouton « Rejouer » dans chaque ligne ; le rejeu se fait depuis le panneau, pour éviter un double envoi accidentel.
- **Panneau de l'envoi** (`aside` nommé « Envoi sélectionné ») : statut, événement, numéro d'essai, rappel du calendrier des essais, corps envoyé (JSON indenté), réponse (code et 1 Ko de corps au plus), bouton « Rejouer maintenant ». Résultat en toast : « Envoi rejoué · HTTP 200 en 190 ms ».
- Les e-mails dans le corps restent visibles (c'est l'utilité du journal) mais ne sont gardés que 7 jours.

## 7. Test en échec (L23-06)

- Le test envoie l'événement `ping` (`{ id, type: "ping", created_at, data: {} }`).
- Échec : bandeau `alert-danger` en `role="alert"` : « Le test a échoué : HTTP 404 en 210 ms. » puis un conseil selon le cas :
  - 404 ou 410 : « L'adresse ne répond pas. Vérifiez qu'elle est correcte et accessible depuis Internet, puis relancez le test. » ;
  - 401 ou 403 : « Votre outil refuse l'envoi. Vérifiez qu'il attend bien des appels de TutoClick. » ;
  - 5xx : « Votre outil a rencontré une erreur. Réessayez dans quelques minutes. » ;
  - délai dépassé : « Pas de réponse en 10 s. » ;
  - certificat ou DNS : « Adresse injoignable : certificat ou nom de domaine invalide. »
- La ligne du test apparaît en tête du journal avec un badge « Test ». Un test ne compte pas dans les échecs consécutifs.

## 8. Mise en pause automatique (L23-07)

- Nouveaux essais après un échec : 1 min, 5 min, 30 min, 2 h, 6 h (6 essais au total).
- Après 6 échecs consécutifs, le webhook passe « En pause ». Bandeau `alert-warning` (`role="status"`) : date et heure, « après 6 échecs consécutifs », « les événements suivants n'ont pas été envoyés », conseil.
- Actions : « Réactiver » devient le bouton principal ; « Envoyer un test » et « Désactiver » sont masqués.
- Après la réactivation, les envois en échec restent rejouables un par un depuis le journal. Pas de rejeu groupé automatique.
- Notification aux propriétaires et admins dans la cloche (L22) : « Le webhook automate.acme.example a été mis en pause ». Pas d'e-mail (envoi d'e-mails non arbitré).

## 9. Autres intégrations : « Bientôt »

- Carte « Autres intégrations », grille de 3 colonnes (1 colonne sous 1 100 px).
- Six cartes non cliquables (`aria-disabled="true"`), chacune avec une icône Lucide générique, le nom, le badge « Bientôt » et une phrase :
  - Slack (`hash`) : recevoir les nouveaux leads et les commentaires dans un canal ;
  - Zapier (`zap`) : relier TutoClick à vos autres applications, sans code ;
  - Google Analytics (`chart`) : envoyer les événements du lecteur à votre propriété GA4 ;
  - Matomo (`chart`) : mesure d'audience hébergée par votre organisation ;
  - Microsoft Teams (`message`) : notifications de leads et de commentaires dans une équipe ;
  - CRM (`building`) : synchroniser les leads avec votre outil de relation usagers.
- **Pas de logos de marque** : icônes Lucide uniquement (dépôt public, pas de droits sur les logos).
- Sous-titre : « Ces connexions arrivent. En attendant, un webhook peut alimenter la plupart de ces outils. »

## 10. Accessibilité

- Modales : focus sur le premier champ (création) ou sur « Copier » (secret), piège du focus, retour sur le déclencheur.
- Erreur d'adresse : `aria-invalid` et message relié. Focus sur le champ à l'envoi.
- Tableaux : `caption`, `th`. Boutons d'icône nommés (« Actions pour hooks.acme.example »).
- Pastilles de statut : code écrit, contraste vérifié dans les deux thèmes.
- Bloc JSON : fond sombre fixe, contraste de 15:1, retour à la ligne (pas de défilement horizontal).

## 11. Hors périmètre

- Intégrations natives (Slack, Zapier, etc.) : « Bientôt ».
- Clés d'API publiques et SSO.
- Envoi d'e-mails sur la mise en pause.
- Filtres par démo ou par formation sur un webhook.
