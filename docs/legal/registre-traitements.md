# Registre des traitements (RGPD, article 30)

> **Projet à faire relire par un juriste avant toute diffusion.** Les éléments entre crochets sont à
> compléter par l'éditeur. Les faits techniques (données, durées, hébergement) décrivent le produit tel
> qu'il est dans ce dépôt ; ils doivent être revus à chaque lot qui ajoute une donnée personnelle.

TutoClick tient deux rôles, et le registre a deux parties :

- **Partie A — TutoClick responsable de traitement** : comptes et espaces de ses clients.
- **Partie B — TutoClick sous-traitant** (article 30.2) : données que les clients font traiter par
  TutoClick (visiteurs des démos, leads, apprenants, contenu des captures). Le client est responsable de
  traitement ; le cadre contractuel est le DPA ([modele-dpa.md](./modele-dpa.md)).

## Identification

| Rubrique | Valeur |
|---|---|
| Responsable / sous-traitant | [Raison sociale], [adresse], [n° SIREN] |
| Représentant légal | [Nom, fonction] |
| Délégué à la protection des données | [Nom ou « non désigné »], [adresse de contact dédiée] |
| Date de création du registre | 2026-11-19 |
| Dernière mise à jour | 2026-11-19 (lot L28) |

## Hébergement et sous-traitants ultérieurs

| Sous-traitant | Rôle | Localisation des données | Encadrement |
|---|---|---|---|
| Supabase | Base de données, authentification, stockage des fichiers, fonctions serveur, envoi des e-mails d'authentification | Union européenne (région Irlande) | DPA du fournisseur ; clauses contractuelles types pour tout accès depuis un pays tiers [à vérifier] |
| GitHub (Pages) | Hébergement des fichiers statiques de l'application et du lecteur (aucune donnée de compte) | États-Unis | Journaux techniques d'accès (adresse IP) tenus par le fournisseur ; DPA et clauses contractuelles types [à vérifier] |
| Anthropic (API Claude) | Assistance IA (L30) : propositions de textes, traductions, suggestions, à la demande d'un éditeur, seulement si l'espace l'a activée | États-Unis | DPA du fournisseur et clauses contractuelles types [à vérifier] ; entrées et sorties de l'API non utilisées pour l'entraînement par défaut (conditions commerciales et centre de confidentialité du fournisseur ; aucun programme d'entraînement volontaire ni bouton de retour utilisé par TutoClick) [à confirmer par le juriste] |

Aucun autre service tiers n'est appelé par le produit : pas de paiement en ligne, d'outil d'analyse
tiers ni d'enrichissement de données à ce jour. Les intégrations sortantes (webhooks) sont configurées
par le client vers ses propres outils, sous sa responsabilité.

---

## Partie A — TutoClick responsable de traitement

### A1. Gestion des comptes et des espaces de travail

| Rubrique | Contenu |
|---|---|
| Finalité | Créer et gérer les comptes, les espaces de travail, les membres et leurs rôles ; authentifier |
| Base légale | Exécution du contrat (CGU) |
| Personnes concernées | Utilisateurs de l'application (propriétaires, administrateurs, éditeurs, lecteurs) ; personnes invitées |
| Données | Adresse e-mail, nom affiché, langue, préférences (thème, notifications), rôle dans chaque espace, dates de connexion, invitations envoyées (adresse de l'invité) |
| Destinataires | Personnel habilité de TutoClick ; membres du même espace (nom, e-mail, rôle) ; sous-traitants ci-dessus |
| Durée de conservation | Pendant la vie du compte. Suppression immédiate à la demande (« Supprimer mon compte » : profil, préférences, rôles ; commentaires gardés et signés « Ancien membre » ; espaces dont la personne est le seule membre supprimés avec leurs fichiers, les fichiers non effacés étant inscrits pour une purge différée) ; invitations non acceptées : [durée à fixer] |
| Sécurité | Authentification gérée par Supabase ; mots de passe jamais stockés en clair ; cloisonnement par espace en base (sécurité au niveau des lignes) ; accès restreint par dossier (plan Enterprise) |
| Transferts hors UE | Non pour les données de compte (voir GitHub Pages pour les journaux techniques) |

### A2. Collaboration dans l'application

| Rubrique | Contenu |
|---|---|
| Finalité | Commentaires internes sur les étapes, mentions, notifications dans l'application, présence en temps réel dans l'éditeur |
| Base légale | Exécution du contrat |
| Personnes concernées | Membres des espaces |
| Données | Texte des commentaires, auteur, mentions, notifications (type, lecture), présence (nom, étape ouverte, non conservée) |
| Durée de conservation | Commentaires : vie de la démo ; notifications : [durée à fixer] ; présence : non conservée |

### A3. Aide intégrée et prise en main

| Rubrique | Contenu |
|---|---|
| Finalité | Afficher l'aide, mesurer l'utilité des articles, suivre la prise en main de l'espace |
| Base légale | Intérêt légitime (amélioration du service) |
| Données | Avis « utile / pas utile » sur un article, étapes de prise en main faites, préférence « masquer » |
| Durée de conservation | Vie du compte |

### A4. Sécurité et prévention des abus

| Rubrique | Contenu |
|---|---|
| Finalité | Limiter les essais de mot de passe sur les démos protégées et les accès aux centres de formation ; journal d'audit des actions sensibles |
| Base légale | Intérêt légitime (sécurité du service) |
| Données | Tentatives d'accès (date, résultat, identifiant de démo ou de centre), journal d'audit (auteur, action, cible). L'adresse IP n'est utilisée qu'en mémoire pour la limitation de débit et n'est pas enregistrée |
| Durée de conservation | Tentatives : [durée à fixer] ; journal d'audit : [durée à fixer] |

---

## Partie B — TutoClick sous-traitant (pour le compte des clients)

Pour chaque catégorie ci-dessous, le **client** (l'espace de travail) est responsable de traitement. Il
détermine la finalité et la base légale (information des personnes, consentement le cas échéant).
TutoClick traite sur instruction documentée (DPA).

### B1. Contenu des démos (captures d'écran et textes)

| Rubrique | Contenu |
|---|---|
| Catégories de traitement | Hébergement, édition, publication et diffusion des démos |
| Données possibles | Toute donnée visible à l'écran au moment de la capture (noms, e-mails, numéros, données de tiers) |
| Mesures propres au produit | Détection automatique des données sensibles à la capture et floutage incrusté dans les pixels publiés ; bilan avant toute publication en accès public (zones floutées, détections non floutées, images importées non vérifiées) avec deux confirmations obligatoires ; données d'exemple fictives recommandées |
| Durée de conservation | Vie de la démo ; suppression de la démo par le client |

### B2. Statistiques de consultation des démos

| Rubrique | Contenu |
|---|---|
| Données | Identifiant de visiteur pseudonyme (stockage local du domaine du lecteur), identifiant de session, événements (étape vue, clic, fin), domaine d'origine, pays déduit de l'en-tête du réseau de diffusion. Ni cookie tiers ni adresse IP enregistrée |
| Durée de conservation | Événements bruts purgés chaque nuit selon le plan : 30 jours (Free), 365 jours (Pro), 730 jours (Business), 1 095 jours (Enterprise) |

### B3. Leads (formulaires des démos)

| Rubrique | Contenu |
|---|---|
| Données | Adresse e-mail, champs du formulaire choisis par le client, case de consentement, démo et lien d'origine, date |
| Destinataires | Membres de l'espace ; outils du client via les webhooks qu'il configure |
| Durée de conservation | Jusqu'à suppression par le client [une purge automatique configurable reste à décider] |

### B4. Suivi des apprenants et centre de formation

| Rubrique | Contenu |
|---|---|
| Données | Nom, adresse e-mail, structure de rattachement, progression par module, résultats de quiz, attestations, relances, accès au centre de formation |
| Durée de conservation | Jusqu'à suppression par le client [durée par défaut à décider] |

### B5. Personnalisation et liens par destinataire

| Rubrique | Contenu |
|---|---|
| Données | Valeurs des variables (par exemple prénom, entreprise) attachées à un lien personnalisé ; jeux de données publiés avec une démo |
| Durée de conservation | Vie du lien ou de la démo |

### B6. Assistance IA (L30)

| Rubrique | Contenu |
|---|---|
| Finalité | Proposer des textes (rédaction, traduction, suggestions, plan de démo, données fictives, graphique) que l'éditeur applique ou ignore |
| Base | Exécution du contrat avec le client ; activation explicite par un propriétaire ou un administrateur de l'espace (désactivée par défaut) |
| Données envoyées au fournisseur | Textes nécessaires à la demande (titres, textes des bulles, plan) ; données personnelles détectées remplacées par un repère avant l'envoi (Edge Function `ai`). Jamais : images, zones floutées, commentaires internes, leads, données des apprenants, identité de l'utilisateur |
| Données conservées par TutoClick | Compteurs seulement (table `ai_usage` : espace, utilisateur, jour, nombre de demandes, jetons) ; aucun texte de demande ni de réponse, aucun journal du contenu |
| Durée de conservation | Compteurs : vie de l'espace [durée à fixer] ; chez le fournisseur : selon ses conditions de conservation de l'API [à vérifier] |
| Sous-traitant ultérieur | Anthropic (États-Unis) |

---

## Droits des personnes

- **Utilisateurs (partie A)** : accès, rectification (profil), portabilité (« Exporter mes données » :
  fichier .zip préparé et téléchargé dans le navigateur, rien n'est conservé sur le serveur), effacement (« Supprimer mon compte », lot L28), opposition et limitation via
  [adresse de contact].
- **Personnes des parties B** : les demandes sont transmises sans délai au client concerné, qui y répond.
  TutoClick l'assiste (export, suppression d'un lead ou d'un apprenant depuis l'application).

## Points ouverts

1. Durées de conservation marquées « à fixer » (invitations, notifications, tentatives d'accès, journal
   d'audit, leads, apprenants).
2. Vérifier les documents contractuels des fournisseurs (DPA, clauses contractuelles types).
3. Désigner ou non un délégué à la protection des données.
4. Analyse d'impact : à évaluer pour le suivi des apprenants à grande échelle.
5. Assistance IA : informer les clients de l'ajout d'Anthropic à l'annexe 2 du DPA (article 5 : droit
   d'opposition) ; vérifier le DPA et la durée de conservation de l'API du fournisseur.
