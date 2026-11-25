# INVITE-01 — Page Invitation : expliquer la raison, permettre de redemander

Retour de l'utilisateur du 25/11 : la page d'un lien d'invitation (`/#/invite/:jeton`) n'affiche que « Invitation introuvable. ». Elle doit dire pourquoi et, quand c'est possible, permettre de demander une nouvelle invitation à la personne qui a invité.

Le gabarit des pages d'accès ne change pas : logo, colonne de gauche, illustration à droite, pied (langue, mentions). Seul le contenu sous le logo change. Les boutons suivent RADIUS-01.

Planche (6 états, clair et sombre, 1440 et 390) : `docs/ux/propositions/invite-01/planche-invite-01.png`.

## 1. Anatomie commune

De haut en bas, sous le logo :
1. **Tuile d'icône** : 40 × 40 px, rayon 10 px (`--fd-radius-control`), icône Lucide de 20 px, 16 px au-dessus du titre. Teinte selon le cas :
   - avertissement : fond à 14 % de `--fd-color-warning` ;
   - réussite : fond à 14 % de `--fd-color-success` ;
   - neutre : `--fd-color-surface-muted`.

   La tuile est décorative (`aria-hidden`).
2. **Titre** : le h1 de la page, propre au cas, au style actuel des pages d'accès. Le mot « Invitation » seul disparaît.
3. **Phrase** : 15 px, `--fd-color-text-muted`, 8 px sous le titre. Elle dit la raison, puis ce qu'on peut faire.
4. **Encadré de contexte** (cas a, b, d et confirmation) :
   - liste de définitions `dl`, surface, bordure, rayon 12 px (`--fd-radius-surface`), lignes séparées par un filet ;
   - libellé à gauche en gris, valeur à droite en 500 ;
   - 20 px sous la phrase.
5. **Actions** : 24 px plus bas.
   - Bouton principal pleine largeur de la colonne, 44 px.
   - Action secondaire : en lien centré sous le bouton (« Retour à l'accueil »), ou en bouton secondaire pleine largeur quand c'est une vraie action (« Se déconnecter »).
6. Le pied de page actuel est inchangé.

À 390 px, l'ordre et les espacements sont les mêmes, sur toute la largeur moins 32 px. L'illustration est masquée comme aujourd'hui.

## 2. Les cas

| Cas | Icône | Titre | Phrase | Contexte | Actions |
|---|---|---|---|---|---|
| a) Expirée (plus de 14 jours) | Clock, avertissement | Cette invitation a expiré | Elle était valable jusqu'au {date}. Demandez-en une nouvelle à {Prénom I.} : {il/elle → « cette personne » si le genre n'est pas connu} recevra votre demande dans l'app et par e-mail. | Espace, Invité par, Adresse (masquée) | **Demander une nouvelle invitation** · lien « Retour à l'accueil » |
| b) Annulée par un admin | Ban, avertissement | Cette invitation a été annulée | L'espace {Espace} l'a retirée. Si c'est une erreur, demandez-en une nouvelle à {Prénom I.}. | Espace, Invité par, Adresse | **Demander une nouvelle invitation** · lien « Retour à l'accueil » |
| c) Déjà acceptée | CircleCheck, réussite | Vous avez déjà rejoint {Espace} | Cette invitation a été acceptée le {date} avec votre compte. | — | **Ouvrir l'espace** (bascule sur cet espace et ouvre Démos) |
| d) Mauvais compte connecté | UserX, avertissement | Cette invitation est adressée à un autre compte | Elle a été envoyée à {adresse masquée}. Vous êtes connecté avec {votre adresse masquée}. | Espace, Invité par | **Changer de compte** (déconnecte puis ouvre la connexion avec l'invitation en attente) · bouton secondaire « Se déconnecter » |
| e) Lien inconnu ou abîmé | Link2Off, neutre | Ce lien n'est pas valide | Il a peut-être été copié en partie. Demandez un nouveau lien à la personne qui vous a invité. | — (rien n'est révélé) | lien « Retour à l'accueil » |
| Confirmation (après a ou b) | Send, réussite | Demande envoyée à {Prénom I.} | Vous recevrez un nouvel e-mail d'invitation dès que {cette personne} l'aura renvoyée. Vous pourrez redemander dans 24 h si rien n'arrive. | Espace, Adresse | lien « Retour à l'accueil » |

Remarques sur les textes :
- **Genre** : il n'est pas connu. La phrase du cas a et la confirmation emploient « cette personne » ou une tournure neutre, comme « Demandez-en une nouvelle à Camille M. : votre demande lui arrivera dans l'app et par e-mail. » Pas de « elle » ni de « il ».
- **Dates** : au format long sans année si c'est l'année en cours (« 12 novembre »), sinon avec l'année.
- **Demande déjà envoyée** (moins de 24 h, même invitation) : la page s'ouvre directement sur la confirmation. La phrase devient « Vous avez déjà demandé une nouvelle invitation le {date} à {heure}. Vous pourrez redemander à partir de {heure} demain. »
- **Pendant l'envoi** : le bouton passe en chargement. En cas d'échec, une erreur s'affiche sous le bouton : « La demande n'a pas pu être envoyée. Réessayez dans un instant. », et le bouton reste actif.

## 3. « Demander une nouvelle invitation »

- **Destinataire** : la personne qui avait invité, si elle est encore membre propriétaire ou admin de l'espace. Sinon, tous les propriétaires et admins.
- **Dans l'app** : une notification dans la cloche, « {Adresse masquée} demande une nouvelle invitation à {Espace} ». Elle porte un bouton « Renvoyer l'invitation », qui renvoie avec le même rôle et un nouveau jeton, puis un toast « Invitation renvoyée ».
- **Par e-mail** : envoi par le service existant (au plus un e-mail par heure, budget commun). Objet : « Demande d'invitation à {Espace} ». Le corps reprend la phrase de la notification et le bouton « Renvoyer l'invitation », qui ouvre Paramètres › Équipe avec la ligne de l'invitation en surbrillance.
- **Limites** :
  - une demande par invitation toutes les 24 h ;
  - au plus 5 demandes par adresse IP et par heure, tous jetons confondus ;
  - au-delà : « Trop de demandes depuis cette connexion. Réessayez dans une heure. »
- **Réglage** : la notification est un nouvel événement « Demandes d'invitation » dans Paramètres › Notifications (dans l'app, et par e-mail). Elle est cochée par défaut pour les propriétaires et admins.

## 4. Sécurité

- **Jeton inconnu** : cas e, sans aucun détail. Même temps de réponse et même message qu'un jeton mal formé, pour ne pas permettre de deviner des jetons.
- **Jeton connu** : on n'affiche que trois éléments.
  - Le prénom et l'initiale de la personne qui a invité (« Camille M. »).
  - Le nom de l'espace.
  - L'adresse invitée masquée : première lettre, quatre points, domaine complet (`c••••@acme.example`). Dans le cas d, l'adresse du compte connecté est masquée de la même façon.
- **Jamais affichés** : aucune adresse complète, aucun nom de famille, aucun rôle, aucun nombre de membres.
- **Requête de demande** : elle ne prend que le jeton, et le serveur déduit tout le reste. Elle est limitée par jeton et par IP (§3), et journalisée.
- **Page** : `noindex`. Le jeton n'apparaît dans aucune requête vers un tiers.

## 5. Accessibilité

- Le h1 reçoit le focus à l'arrivée.
- La confirmation et les erreurs sont annoncées : `role="status"`, ou `role="alert"` pour les erreurs.
- L'encadré de contexte est un `dl`, lu comme une liste « libellé : valeur ».
- Les tuiles d'icône sont `aria-hidden`.

## 6. e2e

Nouveau test `invitation-etats.e2e.cjs`, avec le faux Supabase, en clair et sombre, à 1440 et 390. Pour chacun des 5 cas :
- le titre, la phrase et les actions attendues sont affichés ;
- aucune adresse complète n'apparaît dans le DOM ;
- pour le cas e, aucun nom d'espace ni de personne n'apparaît dans le DOM.

Le test vérifie aussi :
- **Demande** : un clic sur « Demander une nouvelle invitation » mène à la confirmation et crée la notification. Un second clic dans les 24 h mène à la confirmation « déjà demandé ».
- **Limite par IP** : le message apparaît au-delà de 5 demandes.
- **Rayons** : les boutons ont `--fd-radius-control`.
