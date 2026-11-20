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
- **Qualité** : interface en français et en anglais, accessibilité (WCAG 2.2 AA vérifié automatiquement,
  PDF balisés, déclaration d'accessibilité ; audit RGAA complet à faire),
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
   Aperçu Open Graph : attend un domaine personnalisé (décision client).
4. **Conservation zéro chez ElevenLabs** : les éléments sont déjà supprimés chez le fournisseur juste après
   chaque génération. Une garantie contractuelle demande l'offre Entreprise du fournisseur.
5. **Paiement** : les plans et leurs limites sont en base ; l'intégration d'un moyen de paiement est reportée.
6. **Hors périmètre convenu** : connexion aux CRM (OAuth), enrichissement des contacts, SSO, domaines
   personnalisés par client, images générées par IA.

## Robustesse du lecteur public (L36)

Test : apps/web/e2e/player-robustesse.e2e.cjs, en intégration continue.

| Cas | Comportement |
|---|---|
| Réseau coupé ou serveur indisponible à l'ouverture | Écran « Connexion impossible » avec « Réessayer », au lieu de « Démo introuvable ». Nouvel essai automatique quand le navigateur retrouve le réseau. |
| Réseau lent | « La connexion est lente, le chargement continue… » après 5 s. Sans réponse au bout de 20 s, écran « Connexion impossible ». |
| Démo supprimée pendant la lecture | Les captures déjà chargées restent. Une capture absente laisse un message et « Réessayer » ; points chauds et navigation restent utilisables. Les statistiques refusées ne bloquent rien. |
| Vidéo absente | « La vidéo n'a pas pu être chargée. », avec « Réessayer » et « Suivant ». |
| Démo de 200 étapes | Ouverture en moins de 0,5 s, environ 80 éléments dans la page, environ 6 ms par étape au clavier, progression juste, sans défilement horizontal (ordinateur et téléphone). |

## Performance et accessibilité (Lighthouse, mobile)

Builds de production, audit mobile avec ralentissement simulé du réseau et du processeur, données fictives
(script : apps/web/e2e/lighthouse.cjs).

| Page | Performance | Accessibilité |
|---|---|---|
| Connexion | 95 | 100 |
| Tableau de bord | 90 à 92 | 100 |
| Éditeur (vue mobile) | 91 à 93 | 100 |
| Lecteur (démo publiée) | 97 | 100 |

Scores relevés sur plusieurs passages (le simulateur varie d'un point). Avant L33 : 81 pour le tableau de
bord, 75 pour l'éditeur.

Accessibilité (L24, L34, L35 ; détail dans docs/tech/accessibilite.md) :

- audit axe-core WCAG 2.0, 2.1 et 2.2 de niveaux A et AA : 97 écrans × 2 thèmes, soit 194 audits, aucune
  violation ; il tourne en intégration continue ;
- 77 contrôles clavier et focus automatisés : focus visible et jamais masqué, fenêtres modales,
  annonces, zoom 200 %, animations réduites, parcours complets de l'éditeur et du lecteur au clavier ;
- alternative au glisser pour chaque action (WCAG 2.5.7) ;
- PDF exportés balisés (structure, titres, texte alternatif des captures, langue) ;
- déclaration d'accessibilité (docs/ux/a11y/declaration-accessibilite.md) : « non conforme » au sens du
  RGAA tant que l'audit complet n'est pas fait ; elle liste ce qui a été vérifié et ce qui ne l'a pas été
  (lecteurs d'écran réels, validation PDF/UA, contenus des auteurs).

Corrections faites :

- polices chargées sans chaîne d'imports ;
- icônes regroupées en un seul fichier ;
- aucun décalage de mise en page ;
- tableau de bord et éditeur lus en une seule requête au démarrage (au lieu de 8 lectures successives) ;
- boîtes Exporter et Diffuser chargées à l'ouverture ;
- code de la page d'arrivée demandé dès le démarrage ;
- squelettes de chargement à la géométrie de la page finale (tableau de bord et éditeur), visibles
  seulement au-delà de 200 ms ; message à 10 s, carte d'erreur avec « Réessayer » à 30 s.

L33 (code chargé au premier affichage) :

- textes de l'interface en deux parties : le socle (connexion, coquille, tableau de bord, 9 Ko compressés
  au lieu de 60) et la suite, chargée avec les autres pages ; le socle est recalculé à chaque build à partir
  du code du démarrage, et un garde-fou signale en développement tout texte affiché trop tôt ;
- sur écran étroit, une page légère (avis et commentaires) remplace l'éditeur complet ;
- code de la page d'arrivée préchargé dès le HTML ;
- boîtes de dialogue du tableau de bord (nouvelle démo, modèles, génération, accès au dossier) et cloche des
  notifications chargées après le premier affichage ;
- polices servies par l'app (Fontsource, licence OFL) au lieu de Google Fonts, et Plus Jakarta Sans réduite
  aux caractères de l'interface (17 Ko au lieu de 27, apps/web/src/assets/fonts/README.md).

Code chargé au premier affichage (compressé) : tableau de bord 217 Ko de JS au lieu de 281, vue mobile de
l'éditeur 213 Ko au lieu de 405. Ce qui reste est surtout React (67 Ko) et le client Supabase (58 Ko).
