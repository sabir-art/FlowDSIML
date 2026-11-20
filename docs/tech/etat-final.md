# TutoClick : état final (novembre 2026)

> Version pour le client, reformulée par la Lead UX : [docs/ux/livrables/etat-final-client.md](../ux/livrables/etat-final-client.md).
> Ce fichier reste la version de l'équipe technique.

Synthèse pour le client. Le suivi écran par écran est dans le tableau de suivi du projet : 352 écrans et
états, dont 339 conformes. Les 13 autres attendent une décision du client (voir plus bas).

## Fonctionnalités livrées

- **Capture** : extension Chrome (captures d'écran, vidéo, capture HTML, plusieurs onglets, redimensionnement,
  émulation mobile). Détection et floutage des données personnelles avant l'envoi, avec un écran de vérification.
- **Éditeur** : étapes, bulles et zones cliquables, chapitres, choix et embranchements, avant/après, vidéo
  (pauses, sous-titres), pages HTML et sandbox, voix off, variables, glossaire, formulaires de contact,
  commentaires internes, historique (annuler et rétablir), styles de marque, modèles.
- **Lecteur** : visite guidée, spotlight, pop-up, checklist, lecture automatique, mode clair et sombre,
  sous-titres, clavier, lecture de droite à gauche (arabe), version accessible en HTML.
- **Partage et diffusion** : lien public, mot de passe, expiration, page de démo, Demo Center, intégration
  (iframe, WordPress, SharePoint, Moodle, Notion), paquet SCORM pour les LMS, exports PDF, GIF, MP4 et HTML.
- **Formation** : quiz et sondages, suivi des apprenants, parcours, centre de formation, attestations.
- **Analyse** : tableau de bord, statistiques par démo, temps réel, segments, visiteurs récurrents, tests A/B,
  alertes, webhooks.
- **Espace de travail** : rôles (propriétaire, administrateur, éditeur, lecteur), dossiers à accès restreint,
  règles de partage, mode présentateur, aide intégrée, prise en main guidée, export et suppression du compte.
- **Assistance IA** (désactivée par défaut, activée par un administrateur) : rédaction, traduction,
  suggestions, génération d'une démo à partir d'un plan, données fictives, graphiques, assistant de l'éditeur
  (Claude, Anthropic), voix de synthèse et sous-titres automatiques (ElevenLabs). Rien n'est appliqué sans
  validation, et un quota mensuel s'applique.
- **Qualité** : interface en français et en anglais, accessibilité (audit RGAA, déclaration d'accessibilité),
  revue de sécurité (droits en base vérifiés par plus de 900 tests), tests automatiques de bout en bout.

## Limites connues

- Les exports (PDF, MP4, HTML, SCORM) sont produits dans le navigateur. La règle « Téléchargement des
  exports » bloque l'interface, mais un membre qui contourne volontairement l'application peut encore
  produire un fichier. Une garantie stricte demanderait de générer les exports sur le serveur.
- Voix de synthèse : 6 voix multilingues, sans voix propres à chaque langue de démo. 2 minutes au plus par
  voix et par transcription.
- Pas d'application de bureau (Mac, Windows) : la capture passe par l'extension Chrome.
- Démo « en direct » (accès à l'application réelle) : hors périmètre. La sandbox HTML la remplace.

## Dettes techniques

Le détail est dans docs/tech/dettes.md. Les points encore ouverts :

- Purge automatique des vidéos inutilisées : elle démarre dès que les deux secrets de l'envoi planifié sont
  créés dans Supabase Vault. En attendant, ces vidéos comptent dans le quota de stockage.
- Cache du CDN pour des démos publiées avant le passage au stockage privé : une seule démo fictive concernée.
- En-tête d'adresse IP utilisé par la fonction d'ouverture des démos : à confirmer dans les journaux.
- Webhooks : contrôle de l'adresse cible et envoi résolus séparément (risque faible, limites en place).

## Décisions client en attente

1. **Envoi d'e-mails** (serveur SMTP) : il débloque l'accès sur invitation, par domaine e-mail et par lien
   personnel (11 écrans prêts, affichés « Bientôt »).
2. **API et intégrations** (clés d'API, pilotage du lecteur, accès par jeton) : 2 écrans, plus le mode
   « Par jeton », reportés.
3. **Domaine personnalisé** pour isoler le lecteur et les contenus publiés, requis avant une ouverture large.
4. **Conservation zéro chez ElevenLabs** : les éléments sont déjà supprimés chez le fournisseur juste après
   chaque génération. Une garantie contractuelle demande l'offre Entreprise du fournisseur.
5. **Paiement** : les plans et leurs limites sont en base ; l'intégration d'un moyen de paiement est reportée.
6. **Hors périmètre convenu** : connexion aux CRM (OAuth), enrichissement des contacts, SSO, domaines
   personnalisés par client, images générées par IA.

## Performance et accessibilité (Lighthouse, mobile)

Builds de production, audit mobile avec ralentissement simulé du réseau et du processeur, données fictives
(script : apps/web/e2e/lighthouse.cjs).

| Page | Performance | Accessibilité |
|---|---|---|
| Connexion | 95 | 100 |
| Tableau de bord | 81 | 100 |
| Éditeur | 75 | 100 |
| Lecteur (démo publiée) | 97 | 100 |

Corrections faites :

- polices chargées sans chaîne d'imports ;
- icônes regroupées en un seul fichier ;
- aucun décalage de mise en page ;
- tableau de bord et éditeur lus en une seule requête au démarrage (au lieu de 8 lectures successives) ;
- boîtes Exporter et Diffuser chargées à l'ouverture ;
- code de la page d'arrivée demandé dès le démarrage.

Dans un navigateur réel, le contenu principal s'affiche en moins d'une seconde (0,7 s pour le tableau de
bord, 0,9 s pour l'éditeur). Les scores mobiles restent sous 90 à cause du volume de code chargé avant le
premier affichage, environ 250 Ko compressés, dont les textes de l'interface en français. Pour aller plus
loin, il faudrait découper les textes par page et alléger la vue mobile de l'éditeur, qui n'affiche qu'un
message et la liste des étapes. Ce chantier reste à planifier.
