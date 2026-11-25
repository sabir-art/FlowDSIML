# ALERT-01 — Canaux des alertes analytics : E-mail et Slack

Décisions UX du 25/11 (levée des « Bientôt »). Écran : Analytics avancé › Alertes, cases de canal d'une alerte.

## E-mail

1. **Destinataire** : la personne qui a créé l'alerte, à l'adresse de son compte. Aucun champ d'adresse libre.
2. **Envoi** : par le résumé par e-mail existant (au plus un e-mail par heure, budget commun de 150 par jour). Cocher « E-mail » sur une alerte l'envoie même si le résumé général est désactivé.
   - Aide sous la case : « Envoyé à votre adresse, en moins de 15 minutes. »
3. **« Dans l'app » toujours présent** : quand « E-mail » est cochée, « Dans l'app » est cochée et verrouillée, avec l'infobulle « Toujours affichée dans l'app ».
4. **Désinscription** : le lien « Ne plus recevoir ces e-mails » décoche aussi « E-mail » sur les alertes de la personne. Au prochain affichage, un toast le dit : « E-mail désactivé sur vos alertes ».
5. **Contenu** : le déclencheur, le nombre et la démo, comme dans le résumé. Jamais de donnée de visiteur.
5 bis. **Alerte créée par une autre personne** (un admin l'ouvre) : la case « E-mail » montre son état mais n'est pas modifiable (`aria-disabled`, reste atteignable au clavier). Aide : « Envoyé à la personne qui a créé l'alerte. Elle seule peut changer ce réglage. »
6. **Envoi non configuré** : la case reste grisée avec « Bientôt », avec le même contrôle que Paramètres › Notifications.

## Slack

7. **Adresse du webhook** :
   - Où : Paramètres › Intégrations, carte Slack. Une adresse par espace, modifiable par les propriétaires et les admins.
   - Champ : libellé « Adresse du webhook entrant », exemple `https://hooks.slack.com/services/…`. Contrôle : https et hôte hooks.slack.com.
   - Boutons « Envoyer un test » (secondaire) et « Enregistrer » (primaire).
   - État connecté : pastille « Connecté » et action « Retirer ».
   - Dans l'alerte : case « Slack » grisée avec le lien « Configurer » vers la carte tant que rien n'est saisi, comme pour « Webhook ».
   - Message (une ligne) : `TutoClick · {déclencheur} : {nombre} sur « {démo} » — Voir dans Analytics` (le dernier segment est le lien).
   - Message de test : `TutoClick · Test de connexion réussi pour l'espace « {espace} ».`
8. **Périmètre v1** : les alertes seulement.
   - La carte Slack des Intégrations promet « nouveaux leads et commentaires dans un canal ». Ces deux lignes restent visibles en gris avec « Bientôt », jamais masquées.
