# Vague B : fonctions « Bientôt disponible »

> Ces fonctions dépendent d'une clé, d'un compte tiers ou d'une offre d'hébergement : IA, CRM, e-mailing, enrichissement, SSO / SAML. **Règle absolue : jamais présentées comme actives.** Aucune donnée n'est envoyée à un tiers tant qu'une fonction n'est pas réellement livrée et activée par un admin.
>
> Maquette : `docs/ux/maquettes/refonte/vague-b.html` (`?view=ia|crm|sso`, `&theme=dark`).
> Microcopie FR/EN (24 clés) : `soon.*`.

## 1. Composant « carte à venir »

- Carte à bordure **pointillée**, sans ombre : elle se distingue visuellement des fonctions actives.
- En-tête : puce d'icône, titre, badge **« Bientôt disponible »** (pilule neutre bordée avec l'icône `Clock`, texte `text-muted`, jamais en couleur d'accent).
- Description, puis 2 à 3 points de ce que fera la fonction (liste `text-muted`).
- **Contrôle désactivé** (`disabled`, opacité 0,55, curseur interdit), qui montre où la fonction prendra place, sans fausse interaction.
- **Encadré « Pourquoi et en attendant »** (`surface-sunken`) : la dépendance (fournisseur d'IA, OAuth, offre SAML, analyse RGPD) et l'alternative disponible aujourd'hui, avec un lien actif quand elle existe (par exemple « Utiliser les webhooks »).

## 2. Emplacements

| Fonction | Où | Alternative actuelle |
|---|---|---|
| Générer une démo, traduire, sous-titres et voix off, assistant de rédaction | Éditeur (menu ⋯ « Assistance IA ») et page « Fonctions à venir » | Rédaction manuelle, import `.vtt` (F7) |
| Transcription automatique | Panneau Vidéo (F7 §3) : badge seul | Import `.vtt` |
| CRM, e-mailing | Intégrations (A5 §1) et page « Fonctions à venir » | Webhooks signés (A5 §2) |
| Enrichissement des visiteurs | Page « Fonctions à venir » seulement | Aucune : non prévu sans analyse juridique |
| SSO / SAML, SCIM | Paramètres → Sécurité, Intégrations | Invitation par e-mail, domaines autorisés |
| Domaine personnalisé | Partager → Lien (A1 §2) : `fd-help` avec badge | Adresse `demos.<domaine>/<workspace>/` |

- Bandeau d'information en tête de la section IA : « Elles ne sont pas actives. Aucune donnée n'est envoyée à un service d'IA, et leur activation demandera l'accord d'un admin du workspace. »

## 3. Interdits

- Pas de bouton « Essayer », de liste d'attente ou de formulaire qui laisserait croire à une activation.
- Pas de fausse démonstration (résultat d'IA simulé) dans l'interface réelle.
- Pas de couleur d'accent, d'animation ni de mot « Nouveau » sur ces cartes.

## 4. Accessibilité

- Le badge est du texte réel ; les contrôles désactivés sont annoncés comme indisponibles ; l'encadré « Pourquoi » est lu après le contrôle.
- Le contraste du texte `text-muted` est vérifié à au moins 4,5:1 sur `surface`, en clair et en sombre.
