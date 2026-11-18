# Spec L11 : partage sécurisé (mot de passe, invitation, domaine e-mail, lien expirant)

> Ce lot active les accès restreints aujourd'hui marqués « Bientôt » ou « V2 » dans l'onglet Accès (PRT-04) et l'écran mot de passe du lecteur (PLY-05). Il complète aussi l'écran « lien expiré » (PLY-06).
>
> **Maquettes** (clair et sombre) :
> - `docs/ux/maquettes/reference/partage-securise.html` : onglet Accès de la page Partager, dans la structure validée de `reference/partage.html`. États : `?etat=mdp|invitation|modale|domaine|expiration`.
> - `docs/ux/maquettes/refonte/l11-acces-visiteur.html` : écrans vus par le visiteur, dans le cadre du lecteur validé (refonte, PLY-01). États : `?view=mdp|mdp-err|mdp-bloque|invitation|envoye|domaine|expire|lien-perime`.
>
> La spec A1 (`a1-partage.md` §3 et §6) reste la source pour le détail des comportements. Ce document fixe ce qui change par rapport à elle pour coller à la structure validée.

## 1. États (codes de l'outil de suivi)

| Code | État | Maquette |
|---|---|---|
| L11-01 | Accès : mot de passe | `partage-securise.html?etat=mdp` |
| L11-02 | Accès : sur invitation, liste des personnes | `?etat=invitation` |
| L11-03 | Modale « Inviter des personnes » | `?etat=modale` |
| L11-04 | Accès : par domaine e-mail (avec erreur de saisie) | `?etat=domaine` |
| L11-05 | Accès : date d'expiration active | `?etat=expiration` |
| L11-06 | Visiteur : mot de passe | `l11-acces-visiteur.html?view=mdp` |
| L11-07 | Visiteur : mot de passe incorrect | `?view=mdp-err` |
| L11-08 | Visiteur : trop d'essais | `?view=mdp-bloque` |
| L11-09 | Visiteur : accès sur invitation | `?view=invitation` |
| L11-10 | Visiteur : lien d'accès envoyé | `?view=envoye` |
| L11-11 | Visiteur : domaine refusé | `?view=domaine` |
| L11-12 | Visiteur : lien de la démo expiré (complète PLY-06) | `?view=expire` |
| L11-13 | Visiteur : lien d'accès personnel expiré | `?view=lien-perime` |

## 2. Onglet Accès (page Partager)

La structure reprend l'onglet validé (PRT-04) : rangées de réglages, puis « Formulaire avant la démo ». Seule la partie haute change :

- **« Qui peut voir la démo ? »** remplace les interrupteurs « Mot de passe » et « Domaines e-mail autorisés ». Ces modes s'excluent l'un l'autre, d'où un groupe de **cartes radio** (`fieldset` + `legend`), dans l'ordre suivant :
  1. Toute personne avec le lien (globe) ;
  2. Avec un mot de passe (clé) ;
  3. Sur invitation (enveloppe) ;
  4. Par domaine e-mail (immeuble).

  La carte choisie prend une bordure prune et le fond `primary-soft`, avec sa pastille d'icône en blanc. Sa configuration s'ouvre juste dessous, en retrait de 30 px, dans un bloc `surface-sunken` avec un liseré prune de 3 px à gauche.
- **Mot de passe** :
  - champ masqué avec bouton « Afficher » (`aria-pressed`) et bouton « Générer » (toast « Nouveau mot de passe généré ») ;
  - aide : « 8 caractères minimum. Le changer oblige les visiteurs à saisir le nouveau. » ;
  - interrupteur « Demander aussi l'e-mail du visiteur ».
- **Sur invitation** :
  - compteur « n personnes invitées » et bouton primaire « Inviter des personnes » ;
  - tableau Adresse / Statut / Dernière visite / Actions. Statuts : « Invité » (neutre), « A ouvert la démo » (succès), « Lien d'accès expiré » (avertissement) ;
  - menu « … » : Renvoyer l'invitation, Copier un lien d'accès, puis, après un séparateur, « Retirer l'accès » en danger ;
  - aide sous le tableau sur le lien personnel de 30 minutes.
- **Modale « Inviter des personnes »** : même gabarit que l'invitation de membres (PRM-04).
  - Champ « Adresses e-mail » (virgule ou retour à la ligne, 50 au plus) et champ « Message (facultatif) ».
  - Interrupteur « Envoyer l'invitation par e-mail » : désactivé, les adresses sont seulement autorisées.
  - Bouton primaire avec icône d'envoi, au libellé compté (« Inviter 2 personnes »).
- **Par domaine e-mail** :
  - champ à pastilles (`@domaine` en mono, bouton de retrait par pastille), avec ajout par Entrée ;
  - erreur « Saisissez un domaine complet, par exemple mission-locale.example. » ;
  - les messageries grand public sont refusées, et l'aide le dit.
- **Date d'expiration** :
  - reste un interrupteur ;
  - une fois actif, il affiche une date et une heure (heure de Paris) et trois raccourcis : Dans 7 jours, Dans 30 jours, Fin du mois ;
  - aide : on peut prolonger ou retirer l'expiration, et le lien redevient actif aussitôt ;
  - lien « Voir l'écran affiché ».
- **Alerte d'information** en bas : les règles valent pour le lien, l'intégration et les liens personnalisés, et prennent effet sans republier.
- **Colonne de droite** : nouvelle carte « Accès à la démo » en tête. Elle montre :
  - le mode choisi et son détail ;
  - l'expiration, si elle est active ;
  - un bouton « Voir l'écran d'accès », qui ouvre l'aperçu visiteur du mode choisi.

## 3. Écrans du visiteur (lecteur)

Le cadre est celui du lecteur validé : en-tête (pastille et nom du workspace, titre, sans Chapitres ni CTA tant que l'accès n'est pas ouvert), capture vide voilée, carte centrée `.pl-modal` et « Créé avec TutoClick ». Sur mobile, la carte devient une feuille du bas (comme PLY-07). Le thème sombre suit `prefers-color-scheme`.

- La carte est centrée et contient une pastille d'icône (prune ; orange pour « trop d'essais » et « lien périmé » ; verte pour « lien envoyé »), un titre, un texte, le champ, puis un bouton primaire pleine largeur.
- **Mot de passe** :
  - après une erreur, le message apparaît sous le champ (`role="alert"`, `aria-invalid`) avec le nombre d'essais restants ;
  - après 5 essais, il faut patienter 1 minute : le champ est désactivé et le bouton porte un compte à rebours.
- **Invitation et domaine** : la réponse est toujours « Vérifiez votre boîte mail », que l'adresse soit autorisée ou non. On ne révèle pas qui est sur la liste.
  - Seule exception : l'erreur de domaine, connue côté navigateur.
  - « Renvoyer le lien » est désactivé 60 s.
  - « Changer d'adresse » revient au formulaire.
- **Lien expiré** : il complète PLY-06 dès que la date et le workspace sont fournis au lecteur.
  - Texte : « Le lien a expiré le {{date}}. Contactez {{workspace}} pour en recevoir un nouveau. »
  - Bouton secondaire « Visiter {{site}} » si le workspace a un site renseigné.
- **Lien d'accès personnel expiré** : « Recevoir un nouveau lien » renvoie au formulaire, avec l'adresse pré-remplie.

## 4. Règles

- Données de démo fictives uniquement (`*.example`).
- Pas d'emoji : icônes Lucide (Key, Mail, Building2, Clock, CircleCheck, Send, RefreshCw, UserX, Eye).
- Tant qu'un mode n'est pas branché côté serveur, sa carte reste visible avec un badge « Bientôt » et ne se sélectionne pas : on ne la supprime pas.
- Accessibilité :
  - cartes radio au clavier (flèches), `legend` lue ;
  - erreurs liées par `aria-describedby` ;
  - statuts en `role="status"` ;
  - compte à rebours annoncé une seule fois, pas chaque seconde.
- Contraste : boutons primaires prune ou framboise selon la référence (`reference/assets/reference.css`) ; le texte blanc reste à 4,5:1 ou plus.
