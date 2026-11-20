# E-mails d'authentification TutoClick (L39)

Voici les 4 e-mails envoyés par Supabase Auth, en français, avec le vouvoiement, et habillés aux couleurs de TutoClick.

Gabarits : `supabase-templates/`. Aperçus avec des données fictives : `apercus/` (clair, sombre, et mobile à 375 px).

## Objets et fichiers

| E-mail | Fichier | Clé `config.toml` | Objet |
|---|---|---|---|
| Confirmation d'inscription | `confirmation.html` | `[auth.email.template.confirmation]` | Confirmez votre adresse e-mail pour TutoClick |
| Lien de connexion | `magic_link.html` | `[auth.email.template.magic_link]` | Votre lien de connexion à TutoClick |
| Réinitialisation du mot de passe | `recovery.html` | `[auth.email.template.recovery]` | Réinitialisez votre mot de passe TutoClick |
| Invitation dans un espace | `invite.html` | `[auth.email.template.invite]` | Invitation à rejoindre un espace TutoClick |

Exemple pour `supabase/config.toml` (local) :

```toml
[auth.email.template.confirmation]
subject = "Confirmez votre adresse e-mail pour TutoClick"
content_path = "./supabase/templates/confirmation.html"
```

Sur le projet hébergé, les objets et les contenus se collent dans Authentication > Email Templates, ou s'envoient par l'API de gestion. `supabase db push` ne transmet pas les gabarits.

## Intégration (dev)

1. **Gabarits** : copier les 4 fichiers de `docs/ux/emails/supabase-templates/` dans `supabase/templates/`. Ils sont livrés ici parce que mon périmètre se limite à `docs/ux` et `packages/ui`.
2. **Logo** : copier `docs/ux/emails/logo-tutoclick-email.png` dans `apps/web/public/email/logo-tutoclick.png`.
   - GitHub Pages le servira à l'adresse que les gabarits utilisent : `https://sabir-art.github.io/FlowDSIML/email/logo-tutoclick.png`.
   - Si le site passe sur un domaine personnalisé, changer cette adresse dans les 4 fichiers.
   - Format : PNG de 352 × 124 px, affiché en 176 × 62 px (pour les écrans haute densité). Le logo est posé sur un pavé blanc arrondi : il reste lisible quand la messagerie inverse les couleurs, ce que font Gmail et Outlook en mode sombre.
3. **Durée des liens** : le texte « Ce lien est valable 1 heure » correspond à `otp_expiry = 3600` dans `config.toml`.
   - Le projet hébergé doit avoir la même valeur (Authentication > Providers > Email > Email OTP Expiration).
   - Si la durée change, changer la phrase dans les 4 fichiers. Sinon, retirer « valable 1 heure et ».
4. **Nom de l'espace dans l'invitation** : `invite.html` affiche « l'espace “{{ .Data.workspace_name }}” » si la donnée existe, sinon « un espace ».
   - Pour l'afficher, passer `data: { workspace_name }` à `auth.admin.inviteUserByEmail`.
   - Les invitations actuelles de l'app (lien copié, `AcceptInvite`) ne passent pas par cet e-mail.
5. **SMTP** : ces e-mails ne partent pour de vrai qu'avec un SMTP personnalisé (`[auth.email.smtp]`). Les tests se font avec Inbucket ou Mailpit en local, et uniquement avec des adresses `@example.com`.

## Variables utilisées

| Variable | Usage |
|---|---|
| `{{ .ConfirmationURL }}` | Bouton, et lien en clair sous le bouton |
| `{{ .Email }}` | Rappel de l'adresse concernée, dans le texte et dans la mention de bas de page |
| `{{ .SiteURL }}` | Lien du logo et lien de bas de page |
| `{{ .Data.workspace_name }}` | Invitation seulement, facultatif (voir point 4) |

## Choix de conception

- **Structure** :
  - tableaux de mise en page et styles en ligne ;
  - largeur de 600 px (100 % sous 620 px) ;
  - une seule colonne ;
  - polices système (Segoe UI, Arial), car les polices web ne sont pas fiables dans les messageries.
- **Bouton** :
  - bouton en table, de couleur primaire `#A3195B` avec un texte blanc (contraste 7,4:1) ;
  - variante VML arrondie pour Outlook sous Windows ;
  - lien complet en texte sous le bouton.
- **Mode sombre** :
  - `color-scheme: light dark`, puis `@media (prefers-color-scheme: dark)` pour Apple Mail, Outlook pour Mac et iOS ;
  - `[data-ogsc]` et `[data-ogsb]` pour Outlook.com ;
  - couleurs sombres reprises des jetons du design system : fond `#0B0D10`, carte `#15191F`, texte `#F3F5F8`, liens `#CF86A9` ;
  - Gmail inverse lui-même les couleurs : le pavé blanc du logo garde celui-ci lisible.
- **Confidentialité** :
  - aucun pixel de suivi, aucun paramètre de suivi dans les liens ;
  - aucune image en dehors du logo, avec un texte alternatif « TutoClick » s'il n'est pas affiché ;
  - aucun lien externe en dehors du lien d'action et de `{{ .SiteURL }}`.
- **Textes** :
  - chaque e-mail dit ce qui se passe si l'on ignore le message ;
  - le bas de page explique pourquoi on reçoit cet e-mail (« Vous recevez cet e-mail parce que… ») ;
  - les espaces insécables sont placés avant « : ; ? ! » et à l'intérieur des guillemets ;
  - aucun texte genré : « Une invitation vous attend ».
- **Pré-en-tête** : un texte caché, lu dans l'aperçu de la boîte de réception, résume chaque e-mail.

## Recette

- Rendu vérifié dans Chromium : clair, sombre, et 375 px sans défilement horizontal.
- À vérifier dans les vraies messageries, avant l'activation en production (outil de test de rendu ou boîtes de test) :
  - Gmail web et Android, en sombre ;
  - Outlook 2016 et Outlook 365 sous Windows (bouton VML) ;
  - Outlook.com ;
  - Apple Mail, sur iOS et macOS.
