# Recette réelle : extension (retours client 1, 3, 4) et « Vérifier avant l'envoi » en Sandbox vivant

**Banc** : branche `claude/dev-mvp` à 8c74b6a. J'ai testé l'extension construite (`WXT_E2E=1`) et chargée dans Chromium, comme le ferait le client, avec le faux Supabase et le banc. Données fictives, en clair et en sombre.

| e2e | Résultat |
| --- | --- |
| `listes-ancrage` | 12/12 |
| `popup` | 112/112 |
| `html-verification` (copie inerte) | 52/52 |
| `banc/verification-vivant` | 27/27 |

J'ai aussi mesuré moi-même sur le vrai popup. Captures : `A-extension-popup.png` et `B-verification-vivant.png`.

## A. Extension : VERT

### (1) EXT-LIST-01 : VERT

**Liste « Cadre par défaut »** :
- champ en haut de la vue : 4 px **dessous** ;
- champ en bas de la vue : 4 px **dessus** ;
- même bord gauche (0) et même largeur (0) que le champ, toujours dans la fenêtre ;
- après un défilement de la molette, la liste reste collée au champ (4 px). Avant, elle était à 346 px.

**Menu ⋯, écart du dev accepté** : le menu est à 4 px sous son bouton, aligné sur son bord **droit**, et garde sa largeur de menu (232 px au moins). Un menu d'actions n'est pas une liste de valeurs attachée à un champ. Aligné à gauche, il sortirait du popup, puisque le bouton est dans le coin droit. C'est le comportement attendu d'un menu ⋯ (Jakob). Je l'ajoute à la règle :

> EXT-LIST-01 : un menu d'actions s'aligne sur le bord de son bouton le plus proche du bord du popup, à 4 px.

### (3) Retour automatique : VERT

Après le choix d'une démo, on revient aux modes, avec « Dans Acme · Prise en main du CRM ». Après le choix d'un dossier, on revient avec « Dans Acme · Ventes · Nouvelle démo ». Dans les deux cas :
- le focus va sur « Changer » ;
- la ligne de destination est surlignée (fond rose doux), puis redevient transparente après 1,4 s, en clair comme en sombre.

### (4) Pied en pause : VERT

- Pied : « Reprendre » et « Terminer », 160 px chacun, sans aucun débordement.
- « Annuler la capture » est un lien rouge avec une corbeille, sous le compteur : 28 px de haut, non coupé. Il ouvre la confirmation actuelle, qui ne change pas.
- **À 320 px** : le popup a une largeur fixe de 360 px (`style.css`). Une fenêtre de 320 px montre donc les 360 px, coupés à droite. Chrome dimensionne le popup sur son contenu, ce cas n'arrive pas dans l'extension, et à 360 px rien n'est coupé.
- **Ce que je recommande** : si un jour le popup devient fluide, les deux boutons doivent passer en `flex: 1` au lieu d'une largeur de 160 px. Ce n'est pas bloquant.

**Encore visible, attendu** : « Un clic démarre la capture. » sous les modes. Le point 2 (vue du mode) attend la validation du client.

## B. « Vérifier avant l'envoi » en Sandbox vivant : VERT

L'écran est conforme à la planche 0a0c403, sur les sites « tiers » et « spa », en clair et en sombre :
- l'introduction du mode vivant, sans aucun texte de la copie inerte ;
- les compteurs : Pages · Scripts rejoués · Scripts bloqués · Gardés par vous ;
- un seul groupe « Scripts » ;
- les réponses du site dans leur propre groupe ;
- les éléments ajoutés par un script qui suivent leur script (Absent, puis Affiché) ;
- « Gardé » en orange, comme seul choix de l'auteur.

| Arbitrage | Verdict | Raison |
| --- | --- | --- |
| a) Auteur d'un élément déduit du script ; en cas de doute, « Ajouté par un script de {site} » | **VERT** | On ne devine pas, et la mention reste vraie. L'élément est « Affiché » si l'un des scripts de ce site est gardé : c'est cohérent. |
| b) Cadres retirés entre Formulaires et Liens externes | **VERT** | L'ordre va du contenu de la page vers ce qui en sort, et les liens externes restent en dernier. |
| c) Pastille « Simulé » sur les formulaires, avec `whyForms` | **VERT** | « Simulé » dit vrai : le formulaire réagit, rien ne part. Le texte de `whyForms` convient et reprend le sous-titre « Envoi simulé : succès fictif, rien ne part vers le site ». |
| d) « Gardés par vous » compte +1 et non +2 | **VERT** | Conforme à la règle de la planche : on compte les choix de l'auteur. L'élément « Affiché » n'en est que la conséquence. |

Écarts sans conséquence :
- une page sans enregistrement (l'enregistreur a échoué) garde ses groupes de copie inerte en fin d'écran. C'est acceptable, et ce cas n'arrive pas sur le banc ;
- analytics.js est rangé dans « Script d'un autre site » sur localhost : c'est propre au banc.

Demandes concernées : extension 0.3.3 · listes déroulantes collées à leur champ (EXT-LIST-01) · Ajouter à une démo : retour automatique après le choix · pied du popup en pause · Sandbox v2 · écran « Vérifier avant l'envoi » en mode vivant.
