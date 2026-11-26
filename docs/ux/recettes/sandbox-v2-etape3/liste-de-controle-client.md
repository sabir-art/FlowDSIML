# Sandbox vivant : liste de contrôle à faire vous-même (extension 0.3.4)

À faire sur votre compte, dans un espace où vous êtes propriétaire ou administrateur. Durée : environ 15 minutes.

Prenez un site que vous avez le droit de reproduire, de préférence une page de démonstration ou de test, **sans données réelles de vos usagers**. Si un écran ne correspond pas à ce qui est attendu, notez le numéro du point et faites une capture d'écran.

1. **Autorisation.** Dans Paramètres › Sécurité, « Autoriser le Sandbox vivant » est activé.
   *Attendu* : après « Enregistrer », le message « Réglage du Sandbox vivant enregistré » s'affiche.

2. **Capture.**
   - Ouvrez le site.
   - Ouvrez l'extension et choisissez **Sandbox**.
   - Parcourez 2 ou 3 pages en utilisant les menus, un onglet, un filtre ou un formulaire.
   - Terminez la capture.

   *Attendu* : l'écran « Vérifier avant l'envoi » s'ouvre. Il compte vos pages, liste les scripts (« Rejoué » pour ceux du site, « Bloqué » pour ceux d'autres sites) et indique les réponses du site.

3. **Scripts gardés ou bloqués.** Dans cet écran, cliquez « Garder » sur un script d'un autre site (par exemple une bulle de discussion), puis envoyez.
   *Attendu* : la ligne passe à « Rejoué » et le bouton devient « Bloquer ». L'envoi se termine, puis l'éditeur s'ouvre.

4. **Réglage vivant dans l'éditeur.** Ouvrez Plan › Réglages du sandbox.
   *Attendu* : « Sandbox vivant » est activé. Dans l'aperçu, les menus, onglets et formulaires réagissent comme sur le site.

5. **Publication.** Publiez la démo, puis ouvrez son lien public dans une fenêtre de navigation privée, sans être connecté.
   *Attendu* : la démo s'ouvre dans le lecteur.

6. **Parcours dans le lecteur public.** Refaites ce que vous avez fait pendant la capture : menu, onglet, filtre, envoi du formulaire.
   *Attendu* :
   - la page réagit comme le vrai site ;
   - un formulaire envoyé reçoit une réponse de succès, mais **rien n'arrive sur votre vrai site** : vérifiez qu'aucune demande n'y a été créée ;
   - l'élément du script gardé au point 3 est affiché, ceux des scripts bloqués ne le sont pas.

7. **Désactivation.** Revenez dans Paramètres › Sécurité, désactivez « Autoriser le Sandbox vivant » et enregistrez. Rouvrez la démo dans l'éditeur.
   *Attendu* : le réglage « Sandbox vivant » de la démo est grisé, avec sa raison. Réactivez ensuite le réglage si vous voulez garder ce fonctionnement.

**Limites connues, ce n'est pas un défaut :**
- une page, un onglet ou un résultat de filtre que vous n'avez pas ouvert pendant la capture n'est pas disponible dans la démo (prévu dans une prochaine étape) ;
- l'écran « Vérifier avant l'envoi » peut encore parler de « copie fixe » : son texte pour le mode vivant arrive dans une prochaine version.
