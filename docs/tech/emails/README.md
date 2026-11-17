# E-mails d'authentification TutoClick (FR)

`auth-templates-fr.json` contient les objets et contenus HTML (confirmation, lien magique, réinitialisation, invitation, changement d'adresse), au format de l'API de gestion Supabase (`PATCH /v1/projects/{ref}/config/auth`).

**Bloquant :** Supabase refuse de modifier les modèles d'e-mail sur le plan gratuit avec l'envoi par défaut (`entitlement_required`).
Prérequis : configurer un **SMTP personnalisé** (Authentication → Emails → SMTP Settings) ou passer au plan Pro. Il suffit ensuite d'appliquer le JSON tel quel.
