# Modèle de déclaration d'accessibilité (RGAA 4.1)

> **Mode d'emploi** :
> - ce modèle suit la structure attendue par l'administration : modèle de déclaration du RGAA 4.1, publié par la DINUM ;
> - les zones `[entre crochets]` sont à remplir par l'organisme qui publie le service ;
> - les taux restent vides tant que l'audit complet n'est pas fait (`audit-rgaa-l24.md` §5) ;
> - la déclaration se publie sur une page dédiée, reliée depuis le pied de chaque page par le lien « Accessibilité : partiellement conforme » ;
> - côté centre de formation, ce lien est le réglage « Lien vers la déclaration » (L14-08).
>
> **À propos de l'état de conformité** (à faire valider par la personne référente accessibilité) :
> - le RGAA définit trois mentions : « totalement conforme » (100 % des critères respectés), « partiellement conforme » (au moins 50 %) et « non conforme » (moins de 50 %, ou aucun audit) ;
> - la mention « partiellement conforme » demandée ici n'est donc fondée qu'une fois un premier audit mesuré à 50 % au moins ;
> - d'ici là, la page doit afficher « Accessibilité : non conforme » ou « non évaluée » (réglage par défaut du centre, L14-08), et non « partiellement conforme ».

---

# Déclaration d'accessibilité

**[Nom de l'organisme]** s'engage à rendre ses sites internet, intranet, extranet et ses progiciels accessibles, conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005.

À cette fin, elle met en œuvre la stratégie et les actions suivantes :

- schéma pluriannuel de mise en accessibilité : [lien vers le schéma pluriannuel] ;
- plan d'action de l'année en cours : voir la section « Plan d'action » ci-dessous.

Cette déclaration d'accessibilité s'applique à **TutoClick, plateforme de tutoriels interactifs et de formation de [Nom de l'organisme]** : [adresse du service, par exemple https://formation.[domaine].example].

## État de conformité

**TutoClick** est **partiellement conforme** avec le référentiel général d'amélioration de l'accessibilité (RGAA), version 4.1, en raison des non-conformités et des dérogations énumérées ci-dessous.

## Résultats des tests

L'audit de conformité réalisé par **[nom de l'entité ou du prestataire qui a fait l'audit]** révèle que :

- **[n] %** des critères du RGAA version 4.1 sont respectés ;
- le taux moyen de conformité du service en ligne s'élève à **[n] %**.

## Contenus non accessibles

### Non conformité

Liste des non-conformités relevées lors de l'audit manuel préliminaire (lot L24). La liste définitive sera celle de l'audit complet.

- Le titre de la page ne décrit pas l'écran affiché dans l'application d'administration (critère 8.6).
- Lors d'un changement d'écran, le focus n'est pas replacé et le changement n'est pas annoncé (critères 7.1, 12.8).
- Dans le lecteur de démonstration :
  - le passage à l'étape suivante n'est pas annoncé et le focus se perd (critères 7.1, 7.5, 12.8) ;
  - certains boutons n'ont pas de focus visible (critère 10.7) ;
  - la page n'a pas de titre principal ni de zone de contenu principal (critères 9.1, 12.6) ;
  - l'alternative des captures d'écran n'est pas pertinente (critère 1.3).
- La hiérarchie des titres saute un niveau sur certaines pages (critère 9.1).
- Certains attributs ARIA font référence à des éléments absents, et un identifiant est dupliqué (critère 8.2).
- En thème clair, certains textes discrets, certaines bordures de champs et l'indicateur de focus n'ont pas un contraste suffisant (critères 3.2, 3.3, 10.7).
- Les exports PDF ne sont pas balisés (titres, textes alternatifs). Ils renseignent le titre et la langue du document. Une version accessible au format HTML, avec le même contenu, est proposée à chaque export.

### Dérogations pour charge disproportionnée

[Aucune. Ou : description du contenu, de la raison et de l'alternative proposée.]

### Contenus non soumis à l'obligation d'accessibilité

- Les captures d'écran de logiciels tiers affichées dans les tutoriels reproduisent l'interface de ces logiciels. Le texte de chaque étape (bulle) en donne l'information utile.
- [Contenus de tiers non financés ni développés par l'organisme, le cas échéant.]

## Établissement de cette déclaration d'accessibilité

Cette déclaration a été établie le **[JJ/MM/AAAA]**. Elle a été mise à jour le **[JJ/MM/AAAA]**.

### Technologies utilisées pour la réalisation du site

- HTML5
- CSS
- JavaScript
- WAI-ARIA
- SVG

### Environnement de test

Les vérifications de restitution de contenus ont été réalisées sur la base de la combinaison fournie par la base de référence du RGAA 4.1, avec les versions suivantes :

| Agent utilisateur | Technologie d'assistance |
|---|---|
| Firefox [version] | NVDA [version] |
| Chrome [version] | JAWS [version] |
| Safari [version] (macOS) | VoiceOver |
| Safari [version] (iOS) | VoiceOver |

### Outils pour évaluer l'accessibilité

- axe-core (audit automatique, intégré aux tests)
- Colour Contrast Analyser, ou calcul de contraste sur les jetons de couleur
- Inspecteur d'accessibilité du navigateur
- Navigation au clavier seul

### Pages du site ayant fait l'objet de la vérification de conformité

1. Connexion : [adresse]
2. Tableau de bord (liste des démonstrations) : [adresse]
3. Éditeur d'une démonstration : [adresse]
4. Partage d'une démonstration : [adresse]
5. Suivi des apprenants : [adresse]
6. Réglages du centre de formation : [adresse]
7. Lecteur d'une démonstration (page publique) : [adresse]
8. Centre de formation, accueil (page publique) : [adresse]
9. Centre de formation, page d'une formation (page publique) : [adresse]
10. [Paramètres, inscription, page d'erreur : à ajouter pour l'audit complet]

## Retour d'information et contact

Si vous n'arrivez pas à accéder à un contenu ou à un service, vous pouvez contacter le responsable du service pour être orienté vers une alternative accessible ou obtenir le contenu sous une autre forme :

- envoyer un message à [adresse e-mail dédiée, par exemple accessibilite@[domaine].example] ;
- ou utiliser le formulaire de contact : [adresse du formulaire] ;
- ou contacter [service et adresse postale].

Nous essayons de répondre dans les [n] jours ouvrés.

## Voies de recours

Cette procédure est à utiliser dans le cas suivant : vous avez signalé au responsable du site internet un défaut d'accessibilité qui vous empêche d'accéder à un contenu ou à un des services du portail, et vous n'avez pas obtenu de réponse satisfaisante.

Vous pouvez :

- écrire un message au Défenseur des droits (formulaire en ligne sur defenseurdesdroits.fr) ;
- contacter le délégué du Défenseur des droits dans votre région ;
- envoyer un courrier par la poste (gratuit, ne pas mettre de timbre) : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.

---

## Plan d'action [année]

| Priorité | Action | Critères | Référence | Échéance |
|---|---|---|---|---|
| 1 | Annoncer le changement d'étape dans le lecteur et y garder le focus | 7.1, 7.5, 12.8 | A11Y-03 | [date] |
| 1 | Titre de page propre à chaque écran, et focus replacé au changement d'écran | 8.6, 12.8 | A11Y-01, A11Y-02 | [date] |
| 1 | Focus visible sur tous les boutons du lecteur | 10.7 | A11Y-04 | [date] |
| 2 | Structure du lecteur (titre principal, zone principale) et alternatives des captures | 9.1, 12.6, 1.3 | A11Y-05, A11Y-06 | [date] |
| 2 | Contrastes du thème clair : texte discret, bordures, focus | 3.2, 3.3, 10.7 | A11Y-11 à A11Y-13 | [date] |
| 3 | Hiérarchie des titres, identifiants uniques, références ARIA | 9.1, 8.2 | A11Y-07 à A11Y-09 | [date] |
| 3 | Valeurs écrites sur tous les graphiques | 3.3 | A11Y-14 | [date] |
| 4 | PDF exportés accessibles : dérogation documentée avec alternative (version accessible HTML proposée à chaque export, lot L29) | 13.3 | A11Y-10 | fait |
| — | Audit complet des 106 critères, avec restitutions vocales réelles, puis publication du taux | — | Audit §5 | [date] |
| — | Formation des personnes qui créent les démos : titres d'étapes explicites, texte de bulle autoportant, floutage des données | — | — | [date] |
