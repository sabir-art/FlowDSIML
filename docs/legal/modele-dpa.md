# Modèle d'accord de traitement des données (DPA, RGPD article 28)

> **Modèle à faire relire par un juriste avant signature.** Les éléments entre crochets sont à compléter.
> Ce modèle complète les conditions générales d'utilisation de TutoClick ; en cas de contradiction sur la
> protection des données, il prévaut.

**Entre**

- [Raison sociale du client], [adresse], représenté par [nom, fonction], ci-après « le Responsable de
  traitement » ;
- [Raison sociale de l'éditeur de TutoClick], [adresse], représenté par [nom, fonction], ci-après « le
  Sous-traitant ».

## 1. Objet

Le présent accord fixe les conditions dans lesquelles le Sous-traitant traite des données personnelles
pour le compte du Responsable de traitement, dans le cadre du service TutoClick (création, publication et
diffusion de démos interactives et de parcours de formation).

## 2. Description du traitement

| Rubrique | Contenu |
|---|---|
| Nature des opérations | Hébergement, stockage, édition, publication, diffusion, mesure d'audience, collecte de formulaires, suivi de progression, export, suppression |
| Finalités | Celles du Responsable de traitement : former ses équipes, documenter des procédures, présenter un logiciel, collecter des contacts |
| Personnes concernées | Visiteurs des démos ; personnes remplissant un formulaire (leads) ; apprenants ; personnes visibles dans les captures |
| Catégories de données | Contenu des captures et des textes ; identifiant pseudonyme de visiteur et événements de consultation ; e-mail et champs de formulaire ; nom, e-mail, structure, progression, résultats de quiz et attestations des apprenants ; valeurs de personnalisation |
| Données sensibles (article 9) | Aucune n'est attendue. Le Responsable de traitement s'engage à ne pas en capturer ou à les flouter avant publication |
| Durée | Durée du contrat, puis restitution et suppression (article 10) |

Le registre des traitements tenu par le Sous-traitant détaille ces catégories
([registre-traitements.md](./registre-traitements.md), partie B).

## 3. Obligations du Sous-traitant

Le Sous-traitant s'engage à :

1. traiter les données uniquement sur instruction documentée du Responsable de traitement ; le paramétrage
   de l'espace de travail et l'usage des fonctions du service valent instructions ;
2. informer le Responsable de traitement si une instruction lui paraît contraire à la réglementation ;
3. garantir la confidentialité des données : les personnes autorisées sont soumises à une obligation de
   confidentialité ;
4. mettre en œuvre les mesures de sécurité de l'annexe 1 ;
5. ne pas recourir à un autre sous-traitant sans l'information préalable du Responsable de traitement
   (article 5) ;
6. aider le Responsable de traitement à répondre aux demandes d'exercice des droits (article 6) ;
7. aider le Responsable de traitement pour la sécurité, les notifications de violation et les analyses
   d'impact (articles 7 et 8) ;
8. tenir à disposition les informations nécessaires pour démontrer le respect du présent accord et
   permettre des audits (article 9).

## 4. Obligations du Responsable de traitement

Le Responsable de traitement :

1. dispose d'une base légale pour chaque traitement et informe les personnes concernées ;
2. recueille le consentement lorsqu'il est requis (formulaires, mesure d'audience selon le contexte de
   diffusion) ;
3. vérifie les captures avant publication et utilise les outils de floutage ; il reste seul responsable du
   contenu qu'il publie ;
4. paramètre les accès (liens publics, mot de passe, règles de partage, accès par dossier) selon la
   sensibilité des contenus.

## 5. Sous-traitants ultérieurs

Le Responsable de traitement autorise le recours aux sous-traitants listés à l'annexe 2. Le
Sous-traitant informe le Responsable de traitement de tout ajout ou remplacement au moins [30] jours à
l'avance ; le Responsable de traitement peut s'y opposer pour un motif légitime et, à défaut d'accord,
résilier le service concerné. Le Sous-traitant impose à ses sous-traitants les mêmes obligations.

## 6. Droits des personnes concernées

Le Sous-traitant transmet au Responsable de traitement, dans un délai de [5] jours ouvrés, toute demande
reçue d'une personne concernée. Le service permet au Responsable de traitement d'exporter et de supprimer
les leads, les apprenants et les démos.

## 7. Violation de données

Le Sous-traitant notifie au Responsable de traitement toute violation de données personnelles dans les
[48] heures après en avoir pris connaissance, avec les informations disponibles : nature de la violation,
catégories et nombre approximatif de personnes et d'enregistrements, conséquences probables, mesures
prises ou envisagées.

## 8. Analyse d'impact et consultation préalable

Le Sous-traitant fournit au Responsable de traitement les informations utiles à une analyse d'impact ou
à une consultation de l'autorité de contrôle.

## 9. Audits

Le Sous-traitant met à disposition la documentation de sécurité et répond aux questionnaires
raisonnables. Un audit sur place est possible une fois par an, avec un préavis de [30] jours, aux frais du
Responsable de traitement, par un auditeur tenu au secret.

## 10. Fin du contrat

À la fin du contrat, le Responsable de traitement peut exporter ses données pendant [30] jours. Le
Sous-traitant supprime ensuite les données et leurs copies, sauf obligation légale de conservation, et en
fournit l'attestation sur demande. Les sauvegardes sont effacées au terme de leur cycle de rotation
([durée à préciser]).

## 11. Transferts hors de l'Union européenne

Les données sont hébergées dans l'Union européenne. Tout transfert hors de l'Union est encadré par une
décision d'adéquation ou par les clauses contractuelles types de la Commission européenne.

## 12. Droit applicable

Le présent accord est soumis au droit français. [Juridiction compétente.]

Fait à [lieu], le [date], en deux exemplaires.

| Pour le Responsable de traitement | Pour le Sous-traitant |
|---|---|
| [Nom, fonction, signature] | [Nom, fonction, signature] |

---

## Annexe 1 — Mesures techniques et organisationnelles

- **Cloisonnement** : chaque espace de travail est isolé en base par des règles de sécurité au niveau des
  lignes ; les fonctions serveur vérifient le rôle de l'appelant ; les dossiers peuvent être restreints à
  des membres choisis (plan Enterprise).
- **Contrôle d'accès** : rôles propriétaire, administrateur, éditeur, lecteur ; règles de partage de
  l'espace (modes d'accès permis, durée maximale des liens, rôle requis pour publier, exports) ;
  démos protégées par mot de passe avec limitation des essais.
- **Données sensibles dans les captures** : détection automatique et floutage incrusté dans les images
  publiées ; bilan obligatoire avant publication en accès public.
- **Minimisation** : identifiant de visiteur pseudonyme, pas de cookie tiers, adresse IP non enregistrée ;
  événements bruts purgés selon la durée du plan.
- **Isolation du contenu diffusé** : lecteur servi depuis un domaine distinct de l'application ; contenus
  HTML capturés affichés dans des cadres isolés (sandbox) sans exécution de script.
- **Chiffrement** : échanges en HTTPS ; secrets d'intégration (webhooks) stockés hors des tables
  accessibles aux utilisateurs.
- **Traçabilité** : journal d'audit des actions sensibles.
- **Organisation** : accès de production limité aux personnes habilitées ; [politique de sauvegarde] ;
  [procédure de gestion des incidents].

## Annexe 2 — Sous-traitants ultérieurs autorisés

| Sous-traitant | Prestation | Localisation |
|---|---|---|
| Supabase | Base de données, authentification, stockage, fonctions serveur | Union européenne (Irlande) |
| GitHub (Pages) | Hébergement des fichiers statiques de l'application et du lecteur, sans donnée du Responsable de traitement | États-Unis (journaux techniques uniquement) |
