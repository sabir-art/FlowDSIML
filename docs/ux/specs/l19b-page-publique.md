# L19b : page publique d'une démo

> **Maquettes** :
> - `reference/partage-page.html` (`?etat=onglet|onglet-off`) : onglet « Page publique » de Partager ;
> - `reference/page-publique.html` (`?etat=page|off`) : la page vue par un visiteur, en 1 440 et 390 px.
>
> **Base** : `specs/a1-partage.md` §6, `refonte/demo-page.html`.
>
> **Données** : fictives (Acme, `.example`).

## 1. États et codes

| Code | État | Maquette | Remplace |
|---|---|---|---|
| L19b-01 | Partager > Page publique, page activée | `partage-page.html?etat=onglet` | A1-04 |
| L19b-02 | Partager > Page publique, page désactivée | `partage-page.html?etat=onglet-off` | A1-04 |
| L19b-03 | Page publique (ordinateur) | `page-publique.html?etat=page` | A1-12 |
| L19b-04 | Page publique (mobile, 390 px) | `page-publique.html?etat=page` | A1-12 |
| L19b-05 | Page indisponible | `page-publique.html?etat=off` | A1-12 |

## 2. Onglet « Page publique » (L19b-01, L19b-02)

- Cinquième onglet de Partager (icône `globe`), après Accès. L'onglet est gardé dans l'URL (`?tab=page`).
- **Interrupteur principal** « Page publique » : **désactivé par défaut**. Une phrase d'usage l'accompagne.
- **Champs** (visibles quand la page est activée) :
  - **Adresse de la page** : `/p/{{slug}}`, en lecture seule, avec « Copier ». Le slug est celui de la démo (Partager > Lien) ;
  - **Titre de la page** : 70 caractères au plus. Par défaut, le titre de la démo. Il sert aussi pour `<title>` et Open Graph ;
  - **Description** : 200 caractères au plus, avec un compteur. Elle sert aussi pour `meta description` ;
  - **Texte du bouton d'action** (40 caractères) et **Lien du bouton** : `https://` obligatoire, sinon erreur. Les deux sont facultatifs ensemble : sans eux, la carte d'action n'est pas affichée ;
  - **Style de la page** : Style de la démo (par défaut), Clair, Sombre ;
  - **Proposer d'autres démos du workspace** : désactivé par défaut. Jusqu'à 3 démos publiques sous le lecteur, choisies parmi celles qui ont aussi une page publique ;
  - **Indexation par les moteurs de recherche** : **désactivée par défaut**. Désactivée, la page porte `noindex`.
- « Voir la page publique » ouvre la page dans un nouvel onglet ; la mention est écrite à côté du bouton.
- **Désactivée (L19b-02)** : les champs sont masqués. Une alerte info indique : « La page publique est désactivée. Son adresse affiche « Cette page n'est pas disponible ». Le lien de la démo et les intégrations ne changent pas. »
- **Démo non publiée** : l'onglet affiche la note « démo non publiée » de Partager (PRT-01). L'interrupteur peut être activé, mais la page reste indisponible jusqu'à la publication.
- **Accès restreint** (mot de passe, invitation, domaine) : la page publique hérite de la protection. Le lecteur demande le mot de passe dans la page, comme partout ailleurs.

## 3. La page (L19b-03, L19b-04)

- **En-tête** : logo et nom du workspace, bouton d'action en pilule (masqué sous 640 px, car la carte d'action le reprend).
- **Héros** :
  - titre en `h1` (800, 40 px ; 30 px sur mobile) ;
  - description (18 px, `stone-600`) ;
  - badges « n étapes » et « Mis à jour le … ». **Pas de durée estimée** (« Environ n min ») tant qu'elle n'est pas mesurée sur de vraies sessions (règle « pas de texte faux »).
- **Lecteur** :
  - 16:9 avec un rayon de 20 px (4:5 et 16 px sur mobile) ;
  - couverture assombrie et bouton « Lancer la démo » ;
  - c'est le vrai lecteur (`/e/{{slug}}`), avec ses règles d'accessibilité (titre, focus, annonces).
- **Carte d'action** :
  - vert DSI (#C5E86C) et texte #12210A (12,1:1), avec un bouton pilule noir ;
  - titre et texte : les textes de l'écran de fin de la démo, sinon le texte du bouton seul ;
  - sous 900 px, elle passe en colonne.
- **Pied de page** :
  - « Créé avec TutoClick » ;
  - lien vers la politique de confidentialité du workspace ;
  - lien « Accessibilité : … » vers la déclaration du workspace (L14-08), avec la mention réglée par le workspace (« non conforme » par défaut, voir `a11y/declaration-accessibilite.md`).
- **Thème** : la page n'hérite jamais du thème de l'app (comme le lecteur). « Sombre » est un choix explicite de l'onglet.
- **Largeur** : 1 120 px au plus, marges de 24 px (16 px sur mobile).

## 4. Page indisponible (L19b-05)

- Cas : page désactivée, démo archivée ou supprimée, workspace suspendu.
- Icône `eyeOff`, `h1` « Cette page n'est pas disponible », puis « Elle a été désactivée ou la démo a été retirée. Si quelqu'un vous a envoyé ce lien, demandez-lui une nouvelle adresse. »
- Statut HTTP 404 et `noindex`. **Le message est le même dans tous les cas**, pour ne pas révéler si la démo existe.

## 5. SEO et partage

- `<title>` : « {{titre}} · {{workspace}} ». `meta description` : la description.
- Open Graph :
  - `og:title` et `og:description` ;
  - `og:image` : capture de l'étape 1, **après floutage** ;
  - `og:url`.
- `noindex` par défaut ; l'indexation n'est permise que si l'interrupteur est activé.
- Pas de traceur tiers sur la page. Les statistiques suivent celles du lecteur, avec la source « Page publique ».

## 6. Accessibilité

- Un seul `h1` par page. La zone du lecteur est nommée (« Démo interactive : {{titre}} »).
- Les boutons pilules ont un focus visible : anneau #1F7FB6, décalé de 2 px.
- La carte d'action est un vrai lien. Le bouton « Lancer la démo » place le focus dans le lecteur.

## 7. Hors périmètre

- Domaine personnalisé pour la page (`demos.<domaine>`) : « Bientôt » (vague B).
- Plusieurs pages par démo, ou pages de campagne.
