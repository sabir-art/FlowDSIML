# Spec A5 : intégrations et API

> Lot A5 de la parité (Integration, API) : webhooks signés avec journal et rejeu, Slack, clés d'API, snippets d'intégration, relais vers les outils d'analytics, pilotage du player à distance. CRM et SSO restent en **vague B** : on les affiche « Bientôt disponible », jamais comme actifs.
>
> Maquette : `docs/ux/maquettes/refonte/integrations.html`, avec `?view=hub|webhooks|slack|keys|snippets|remote` et `&theme=dark`.
> Microcopie FR/EN (111 clés) : `integrations.*`.

## 0. Accès et navigation

- Nouvelle entrée **« Intégrations »** (`Plug`) dans la section Workspace de la barre latérale. Elle est visible pour les **propriétaires et admins** seulement. Les autres rôles ne voient pas l'entrée ; une URL directe affiche une page « Accès réservé ».
- Onglets : Vue d'ensemble, Webhooks, Slack, Clés d'API, Snippets, Pilotage. L'onglet est gardé dans `?tab=`.

## 1. Vue d'ensemble

Trois sections de cartes, chacune avec puce d'icône, titre, badge d'état, description et bouton :

| Section | Cartes |
|---|---|
| **Automatiser** | Webhooks (« n actifs »), Slack (« Connecté »), Clés d'API (« n clés »), Zapier / Make / n8n (renvoie au guide des webhooks : aucun compte à relier) |
| **Intégrer et mesurer** | Snippets, Outils d'analytics, Pilotage du player |
| **Bientôt disponible** (vague B) | CRM et SSO / SAML : badge neutre, bouton désactivé (`aria-disabled`), aucun formulaire |

## 2. Webhooks

- **Liste** des webhooks (URL, événements, état), plus « Ajouter un webhook ».
- **Détail** sur 2 colonnes :
  - **gauche** :
    - URL ;
    - **événements à cocher** : `lead.created`, `demo.completed`, `demo.published`, `learner.module_validated`, `learner.quiz_failed`, `alert.triggered` ;
    - **secret de signature** : champ pilule masqué (`whsec_…`), « Afficher » / « Masquer », « Renouveler » (`ConfirmDialog` `rotateConfirm` ; l'ancien secret reste valable 24 h) ;
    - aide sur l'en-tête `Tutoclic-Signature: t=…, v1=…` (HMAC-SHA256 de `t.corps`, tolérance de 5 min contre le rejeu malveillant) et lien vers la doc.
  - **Journal des envois** (7 jours) : statut HTTP en pastille mono (vert pour 2xx, framboise pâle pour 4xx/5xx, orange pâle pour « … » en attente), événement en mono, date, durée ou « nouvel essai dans … », bouton « Rejouer » sur les échecs.
  - **Actions** : « Envoyer un test » (événement `ping`), « Mettre en pause », « Supprimer » (`ConfirmDialog`).
  - **droite** (envoi sélectionné) : statut, « essai n sur 6 », politique de nouvel essai, **corps JSON** (bloc de code), **réponse** (code et 2 Ko au maximum), « Rejouer maintenant » en primaire, avec un toast `replayed`.
- **Nouveaux essais automatiques** : 1 min, 5 min, 30 min, 2 h, 6 h. Après 6 échecs, le webhook est mis en pause (`pausedAuto`) et une notification va aux admins (A6).
- **Sécurité** :
  - HTTPS obligatoire ; les adresses privées ou internes sont refusées à l'enregistrement **et** à l'envoi, contre le SSRF (`urlHelp`) ;
  - délai de 10 s par envoi ;
  - les champs de données personnelles ne sont envoyés que pour les événements qui les concernent (`lead.created` : e-mail et champs du formulaire).
- **Format** : `{ id, type, created_at, data }`, avec un identifiant d'événement stable pour l'idempotence côté client. Les « REST hooks » (abonnement par API) utilisent le même format, pour Zapier.

## 3. Slack

- Champ « URL du webhook entrant » (en mono, masqué après l'enregistrement), avec l'aide pour le créer côté Slack.
- **Envoyer dans Slack** (cases) : nouveaux leads, alertes (A4), modules validés, résumé hebdomadaire.
- **Aperçu** du message : symbole, nom Tutoclic, heure, encadré avec un filet prune de 4 px, lien « Voir dans Tutoclic ».
- « Envoyer un message de test » ; « Déconnecter ».

## 4. Clés d'API

- **Tableau** : nom, clé tronquée en mono (`tc_live_…x2pa`), droits en badges, dernière utilisation, expiration, « Révoquer » (`ConfirmDialog` `revokeConfirm`).
- **Création** (modale) : nom, droits (lecture analytics, lecture démos, écriture démos, lecture du suivi des apprenants), expiration (30 j, 90 j, 1 an, jamais).
- **Une seule fois**, après la création : encadré vert pâle avec bordure verte (`role="status"`), « Copiez-la maintenant : elle ne sera plus affichée », et la clé complète avec « Copier ». On ne stocke que son empreinte.
- Une clé n'a jamais plus de droits que la personne qui l'a créée. Limite : 60 requêtes par minute (réponse 429 avec `Retry-After`).
- **API** : Edge Functions REST, en lecture des analytics (même agrégats que A4, avec le seuil des 5 visiteurs) et en workflow (publier, dépublier, lister). Documentation publique à part, hors périmètre de cette spec.

## 5. Snippets et relais d'analytics

- **Snippets** : select de l'outil (WordPress, Webflow, Notion, Confluence, SharePoint, Google Sites, HTML générique). Le code iframe et l'instruction courte s'adaptent au choix. Bloc de code avec « Copier » (le slug est surligné).
- **Relais vers un outil d'analytics** : segmenté **Matomo** (en premier, l'outil courant dans le public), GA4, Segment, Mixpanel, Amplitude. Script d'écoute des `postMessage` du player, avec **vérification de l'origine** et de `source: 'tutoclic'`.
- Le texte d'aide précise que Tutoclic n'ajoute aucun cookie ni traceur : le relais utilise l'outil déjà installé (et consenti) sur la page hôte.

## 6. Pilotage du player

- Objet `Tutoclic.get(slug)` exposé par le script d'intégration (A1 §5) :
  - méthodes `open({ step, variables, mode })`, `goTo(n)`, `next()`, `prev()`, `close()` ;
  - événements `ready`, `step`, `choice`, `lead`, `cta`, `complete`, `quiz`.
- Tableau méthode / rôle, exemple de code.
- **Sécurité** : fonctionne seulement depuis les sites autorisés (A1). Un événement `lead` signale qu'un lead est arrivé, **sans** l'e-mail ni les champs.

## 7. Accessibilité

- Cartes de la vue d'ensemble : le bouton est nommé par le titre de la carte (« Gérer les webhooks »). Les cartes désactivées sont annoncées comme indisponibles.
- Statuts HTTP : code écrit + couleur, jamais la couleur seule. Le tableau du journal a de vrais en-têtes, et la ligne sélectionnée porte `aria-selected`.
- Blocs de code : bouton « Copier » nommé, annonce « Copié » en `aria-live`, et le code ne passe jamais sous le bouton.

## 8. Recette prévue

- **Webhook vers un récepteur de test** (serveur local, ou webhook.site avec des données fictives) :
  - vérifier la signature avec un script d'exemple ;
  - échec en 500, puis nouveaux essais, puis pause après 6 échecs ;
  - rejeu manuel ;
  - refus d'une URL `http://` et d'une IP privée.
- **Clé d'API** : affichée une seule fois, droits respectés (403 hors droits), 429 au-delà de la limite.
- **Slack** : message de test dans un espace de test.
- **Relais Matomo** : événements reçus dans une instance de test.
- **Pilotage** : `open` puis `goTo` depuis une page autorisée, refus depuis une page non autorisée.
- Contrôles communs : 1 440, 1 024 et 390 px, en clair et en sombre.
