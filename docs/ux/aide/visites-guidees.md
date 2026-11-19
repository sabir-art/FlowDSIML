# Visites guidées et parcours « Apprendre TutoClick » : scénarios

> **Source de vérité** : `docs/ux/aide/help-tours.json` (même contenu, au format du manifeste). Ce document en est la lecture humaine.
> **Production** (arbitrage du chef d'équipe) : démos statiques embarquées dans l'app (`apps/web/public/help/`), captures générées par le développeur avec Playwright sur l'app et des données fictives.
> **Spec** : `specs/l26-aide-modeles.md`, §3.3 (visites guidées) et §3.4 (parcours).


## 0. Règles d'enregistrement

- **Lecture** : le lecteur existant ouvre le manifeste embarqué, en modale, sans statistique.
- **Données fictives uniquement**, dans un espace de démonstration préparé avant l'enregistrement :
  - workspace « Acme » ;
  - démos « Créer un rapport en 2 minutes » et « Démo CRM » ;
  - membres « Camille Fictive » et « Alice Exemple » ;
  - domaines `.example` ;
  - aucun nom réel, e-mail réel, numéro ou identifiant de personne.
- **Fenêtre** : 1 440 × 900, thème clair, zoom du navigateur à 100 %.
- **Bulles** :
  - le texte ci-dessous, mot pour mot ;
  - 25 mots au plus ;
  - le verbe d'action en tête (« Cliquez », « Choisissez », « Saisissez ») ;
  - aucune durée annoncée.
- **Hotspot** : sur l'élément exact. Pour un bouton plus large que 44 px, l'anneau entoure tout le bouton (L21 §5).
- **Écran de fin de chaque visite** :
  - titre « C'est à vous » ;
  - texte « Retrouvez cette visite dans l'aide (touche F1). » ;
  - bouton « Fermer ».
- **Floutage** : la vérification des données reste active. Rien ne doit être flouté, puisque tout est fictif. Si un flou apparaît, la donnée de l'espace de démonstration est à corriger.
- **Accessibilité** : les règles du lecteur s'appliquent (titres, focus, annonces). Chaque bulle se comprend sans l'image.

## 1. Visites « Sur cette page »

### V-DEMOS · Page Démos · clé `page:demos`
| # | Écran | Cible | Bulle |
|---|---|---|---|
| 1 | Démos | En-tête « Démos » | **Vos démos** · Toutes les démos de l'espace sont ici, triées par dernière modification. |
| 2 | Démos | « Nouvelle démo » | Cliquez sur « Nouvelle démo » pour capturer, importer des images ou partir d'un modèle. |
| 3 | Démos | Champ de recherche | Cherchez une démo par son titre ou une étiquette. |
| 4 | Démos | Filtres « Statut » | Filtrez les brouillons, les démos publiées ou celles qui ont des modifications non publiées. |
| 5 | Démos | Menu ⋯ d'une carte | Le menu ⋯ permet de dupliquer, déplacer, présenter ou archiver une démo. |
| 6 | Fin | — | C'est à vous. |

### V-EDITEUR · Éditeur · clé `page:editor`
| # | Écran | Cible | Bulle |
|---|---|---|---|
| 1 | Éditeur | Liste des étapes | **Les étapes** · Glissez une étape pour la déplacer. Les chapitres regroupent les étapes. |
| 2 | Éditeur | Hotspot du canevas | Cliquez sur le canevas pour placer le point que le visiteur devra cliquer. |
| 3 | Éditeur | Texte de la bulle | Saisissez le texte de la bulle. {{first_name}} se remplace par le prénom du visiteur. |
| 4 | Éditeur | Outil Flou | L'outil Flou masque une zone sensible, sur cette étape ou sur toutes. |
| 5 | Éditeur | Onglet Design | L'onglet Design règle le style, le cadre du navigateur et le mode de lecture. |
| 6 | Éditeur | « Aperçu » | Aperçu montre la démo comme un visiteur la verra. |
| 7 | Éditeur | « Publier » | Publiez pour rendre vos modifications visibles. Le brouillon reste modifiable. |
| 8 | Fin | — | C'est à vous. |

### V-PARTAGER · Partager · clé `page:share`
| # | Écran | Cible | Bulle |
|---|---|---|---|
| 1 | Partager | Onglet « Lien » | **Le lien** · Copiez le lien public de la démo. |
| 2 | Partager | Onglet « Accès » | Protégez la démo par mot de passe, par expiration ou par domaine e-mail. |
| 3 | Partager | Onglet « Liens personnalisés » | Créez un lien par destinataire, avec ses variables et sa page personnalisée. |
| 4 | Partager | Onglet « Page publique » | Activez une page publique pour présenter la démo avec un titre et un bouton d'action. |
| 5 | Fin | — | C'est à vous. |

### V-DIFFUSION · Diffusion · clé `page:distribution`
| # | Écran | Cible | Bulle |
|---|---|---|---|
| 1 | Diffusion | Onglet « Plateforme de formation » | **SCORM** · Générez un paquet SCORM pour votre plateforme de formation. |
| 2 | Diffusion | Version SCORM | Choisissez SCORM 1.2 ou 2004, selon votre plateforme. |
| 3 | Diffusion | Onglet « Intranet » | Intégrez la démo dans une page de l'intranet, en cadre ou en pop-up. |
| 4 | Diffusion | Onglet « Où elle est diffusée » | Retrouvez chaque diffusion et sa version. Régénérez celles qui sont anciennes. |
| 5 | Fin | — | C'est à vous. |

### V-ANALYTICS · Analytics · clé `page:analytics`
| # | Écran | Cible | Bulle |
|---|---|---|---|
| 1 | Analytics | KPI | **Les chiffres clés** · Vues, visiteurs, récurrents, complétion et leads sur la période choisie. |
| 2 | Analytics | Filtres du haut | Filtrez par démo, par source et par période. |
| 3 | Analytics | « Parcours étape par étape » | Repérez l'étape où les visiteurs abandonnent. |
| 4 | Analytics | Onglet « Sessions » | Chaque session indique la source, la durée et la progression du visiteur. |
| 5 | Analytics | « Mesure des visites » | Réglez ici la reconnaissance des visiteurs qui reviennent. |
| 6 | Fin | — | C'est à vous. |

### V-APPRENANTS · Apprenants · clé `page:learners`
| # | Écran | Cible | Bulle |
|---|---|---|---|
| 1 | Apprenants | Liste | **Le suivi** · Les apprenants identifiés et leur progression par formation. |
| 2 | Apprenants | Une fiche | Ouvrez une fiche pour voir les modules suivis et les scores aux quiz. |
| 3 | Apprenants | « Exporter » | Exportez le suivi en CSV. |
| 4 | Fin | — | C'est à vous. |

### V-CENTRE · Centre de formation · clé `page:center`
| # | Écran | Cible | Bulle |
|---|---|---|---|
| 1 | Centre | Aperçu | **Le centre** · Une page qui rassemble les formations publiées de l'espace. |
| 2 | Centre | Réglages, adresse | Choisissez l'adresse, le logo et les couleurs du centre. |
| 3 | Centre | Formations visibles | Choisissez les formations affichées et leur ordre. |
| 4 | Fin | — | C'est à vous. |

### V-PARAMETRES · Paramètres · clé `page:settings`
| # | Écran | Cible | Bulle |
|---|---|---|---|
| 1 | Paramètres | « Marque » | **Votre marque** · Logo, couleurs et style par défaut des démos. |
| 2 | Paramètres | « Membres » | Ajoutez des membres avec un lien d'invitation et choisissez leur rôle. |
| 3 | Paramètres | « Général » > Contact d'aide | Indiquez le contact du support affiché dans l'aide. |
| 4 | Paramètres | « Confidentialité » | Réglez la mesure des visites et la conservation des données. |
| 5 | Fin | — | C'est à vous. |

## 2. Parcours « Apprendre TutoClick » (6 modules)

Le nombre d'étapes affiché dans l'aide est lu dans le manifeste (écran de fin non compté). Les nombres ci-dessous sont les cibles des scénarios.

### M1 · Capturer une démo · clé `learn:capture` · 7 étapes
1. Barre du navigateur, icône de l'extension : « Cliquez sur l'icône TutoClick pour ouvrir l'extension. »
2. Popup, carte « Captures à chaque clic » : « Choisissez « Captures à chaque clic » pour un tutoriel étape par étape. »
3. Popup, « Démarrer la capture » : « Démarrez. Chaque clic dans la page devient une étape. »
4. App de démo, bouton « + Nouvelle opportunité » : « Faites le geste à montrer, comme d'habitude. »
5. Barre de capture, « Terminer » : « Cliquez sur « Terminer » quand le geste est fini. »
6. Vérification des données : « Vérifiez les zones floutées avant l'envoi. Ajoutez-en si besoin. »
7. Fin : « Votre démo s'ouvre dans l'éditeur. »

### M2 · Modifier une étape · clé `learn:edit` · 7 étapes
1. Liste des étapes : « Choisissez une étape dans la liste. »
2. Hotspot : « Déplacez le point pour qu'il tombe sur l'élément à cliquer. »
3. Texte de la bulle : « Réécrivez la bulle. Une phrase, le verbe en tête. »
4. « Variable » : « Insérez {{first_name}} pour saluer le visiteur par son prénom. »
5. Position de la bulle : « La bulle se place seule. Vous pouvez la fixer d'un côté. »
6. « Ajouter une étape » : « Ajoutez une pop-up, un quiz ou un écran de fin entre deux captures. »
7. Fin.

### M3 · Flouter les données · clé `learn:blur` · 6 étapes
1. Outil Flou : « Choisissez l'outil Flou dans la barre du canevas. »
2. Canevas : « Tracez un rectangle sur la donnée à masquer. »
3. Panneau, type de masque : « Choisissez flou, pixels ou aplat. L'aplat ne laisse rien deviner. »
4. Panneau, « Toutes les étapes » : « Appliquez le masque à toutes les étapes où la zone apparaît. »
5. « Publier », modale RGPD : « Avant de publier, cochez les deux confirmations du bilan. »
6. Fin.

### M4 · Publier et partager · clé `learn:share` · 6 étapes
1. « Publier » : « Publiez la démo. Les visiteurs voient la version publiée. »
2. « Partager » : « Ouvrez Partager. »
3. Onglet Lien, « Copier » : « Copiez le lien et envoyez-le. »
4. Onglet Accès : « Ajoutez un mot de passe si la démo est interne. »
5. Onglet Liens personnalisés : « Créez un lien par destinataire pour suivre ses visites. »
6. Fin.

### M5 · Diffuser (intranet, SCORM) · clé `learn:distribute` · 8 étapes
1. « Partager » > « Diffusion » : « Ouvrez Diffusion depuis Partager. »
2. Onglet « Plateforme de formation » : « Choisissez « Plateforme de formation » pour un paquet SCORM. »
3. Version et seuil : « Choisissez la version SCORM et le seuil de réussite. »
4. « Générer le paquet » : « Générez, puis téléchargez le fichier .zip. »
5. Onglet « Intranet » : « Pour l'intranet, choisissez cadre ou pop-up. »
6. Code à copier : « Copiez le code et collez-le dans la page de l'intranet. »
7. Onglet « Où elle est diffusée » : « Suivez chaque diffusion et régénérez les versions anciennes. »
8. Fin.

### M6 · Lire les statistiques · clé `learn:analytics` · 5 étapes
1. Analytics, KPI : « Les chiffres clés de la période. »
2. « Parcours étape par étape » : « L'étape en orange fait perdre le plus de visiteurs : relisez sa consigne. »
3. Onglet Sessions : « Ouvrez une session pour voir le parcours d'un visiteur. »
4. Onglet Leads : « Les leads arrivent ici, et dans vos webhooks. »
5. Fin.

## 3. Articles de l'aide (§3.2)

Un article par clé de page, plus deux articles transverses :
- `donnees-et-floutage` : « Données personnelles et floutage » ;
- `accessibilite-des-demos` : « Accessibilité des démos ».

Le format (front matter, clés) est à fixer avec le développeur. Les textes seront rédigés par la Lead UX selon les mêmes règles : phrases courtes, vocabulaire de l'app, aucune donnée réelle, aucune durée.
