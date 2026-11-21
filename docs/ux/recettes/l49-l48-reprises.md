# Grille de revue : L49 (P1 à P4) et reprises L48

> Préparée le 21 novembre, pour valider dès que les lots arrivent sur `dev-mvp`. Méthode : `composants.md` §18.5.
> - Captures réelles en clair et en sombre, à 1440 px, et à 390 px quand l'écran existe sur mobile.
> - Styles calculés mesurés dans le navigateur.
> - `boutons-natifs.e2e.cjs` relancé à chaque lot.
> - Données fictives uniquement : espace Acme, `*.example`.
>
> Chaque ligne se coche **oui ou non**, avec la mesure relevée. Un « non » renvoie l'écart précis au dev.

## 1. L49, sécurité des captures HTML (`specs/l49-securite-html.md`)

### P1, réglage et refus
| # | Contrôle | Mesure attendue |
|---|---|---|
| 1 | Paramètres › Sécurité : la ligne « Captures HTML » est la première section | libellé et aide à gauche (40 %), 3 radios simples à droite, pas de cartes |
| 2 | Lecteur ou éditeur : mêmes valeurs en lecture seule | « Modifiable par un admin » en 13 px `text-muted`, pas de badge « Admins » |
| 3 | Mode « Seulement sur ces domaines » : `https://app.example.com/x` est refusé avec le message `htmlCapture.domainInvalid` ; `*.example.org` est accepté ; 51e domaine refusé | messages du §9 mot pour mot |
| 4 | Domaines en pastilles grises, « Retirer app.example.com » comme nom accessible | `aria-label` exact |
| 5 | Mention d'autorisation en texte gris de 13 px, avec l'icône `info` de 16 px, sans encadré ni fond | `background-color` transparent, `border-width` 0 |
| 6 | Pied : « Appliqué par l'app, l'extension et le serveur. », puis « Enregistrer » désactivé tant que rien ne change | `disabled` au chargement |
| 7 | Mode « Désactivées » : à l'étape 1 de « Nouvelle démo », Démo HTML et Sandbox sont visibles, désactivés, avec « Désactivé par un admin (Sécurité > Captures HTML) » | `aria-disabled="true"`, raison lisible sans survol |
| 8 | Mode « Désactivées » : dans le plan du Sandbox, « Capturer cette page » affiche la raison de l'admin, pas « Bientôt » | texte exact |
| 9 | Mention présente à l'étape 2 de « Nouvelle démo » (types HTML et Sandbox), sous la liste des sources | texte du §6 |
| 10 | Journal : une entrée `settings.html_capture` par changement, avec l'ancienne et la nouvelle valeur | ligne visible dans `audit_log` (faux backend) |
| 11 | Serveur : 403 `HTML_CAPTURE_DISABLED` et 403 `HTML_CAPTURE_DOMAIN` (tests Deno du dev) | tests verts |

### P2, rapport
| # | Contrôle | Mesure attendue |
|---|---|---|
| 12 | Éditeur, outil Étape d'une page HTML : la section « Sécurité de la page » tient en une ligne (statut, puis « Détail ») | une seule ligne à 360 px de panneau |
| 13 | Statut écrit avec un point de 8 px : `success` (Page sûre), `warning` (Éléments retirés), `text-muted` (Vérification partielle) | pas de badge ni de fond coloré |
| 14 | « Détail » déplie le tableau des compteurs : chiffres alignés à droite, `tabular-nums`, accord en nombre (`_one`, `_other`) | « 1 script retiré », « 2 scripts retirés » |
| 15 | La ligne `other` n'apparaît que si elle n'est pas à 0 ; la ligne `dangerousLinks` apparaît toujours, même à 0 | |
| 16 | Rien n'est ajouté sur la vignette de la colonne des étapes | aucun nouveau badge |
| 17 | Liste de contrôle avant publication : « {n} pages analysées : {x} sûres, {y} avec éléments retirés », non bloquante | Publier reste actif |
| 18 | Compte rendu en une phrase : « 3 pages nettoyées : 18 éléments actifs retirés, 1 lien dangereux bloqué » | texte `htmlSecurity.summary` |
| 19 | `role="group"` « Analyse de sécurité », compteurs en liste, icônes `aria-hidden` | axe sans violation grave |

### P3, liens externes
| # | Contrôle | Mesure attendue |
|---|---|---|
| 20 | Liste « Liens externes · {n} » : texte du lien, adresse en chasse fixe, interrupteur « Autoriser le lien {texte} » | nom accessible exact |
| 21 | Un lien `http:` reste désactivé, avec « Adresse non sécurisée » écrit à la place de l'interrupteur | pas d'interrupteur grisé |
| 22 | Lecteur : un lien autorisé ouvre « Vous quittez la démo », avec le domaine réel en gras (et non le texte du lien) | test avec un texte de lien trompeur : le texte dit `docs.example.com` et l'adresse mène à `autre.example` |
| 23 | Focus par défaut sur « Rester dans la démo » ; Échap ferme ; « Ouvrir » ouvre un nouvel onglet avec `noopener,noreferrer` | |
| 24 | Un lien non autorisé ne fait rien ; un formulaire capturé ne s'envoie jamais | test de `submit` |
| 25 | Dialogue : 16 px au moins entre les blocs (§18.2), aucun bouton natif | mesure et `boutons-natifs` |

### P4, Safe Browsing (cas nominal, clé configurée en production)
| # | Contrôle | Mesure attendue |
|---|---|---|
| 26 | Adresse de test officielle de Safe Browsing : « Bloqué, site signalé » en texte `danger` de 13 px 600 avec l'icône `shield-alert`, à la place de l'interrupteur | pas de badge, pas de fond |
| 27 | Le rapport compte 1 lien dangereux ; le statut passe à « Éléments retirés » | |
| 28 | API simulée en panne (429 ou 5xx) : « Vérification Google indisponible », avec la date de la dernière tentative ; statut « Vérification partielle » | |
| 29 | Autoriser un nouveau lien pendant la panne : refusé avec « Vérification Google indisponible, réessayez plus tard » | |
| 30 | Lien autorisé puis signalé à la publication : autorisation retirée, alerte « Le lien {texte} mène à un site signalé : il a été bloqué. » | |
| 31 | Aucune adresse complète dans les journaux du serveur | relevé du dev |

### Extension (L49)
| # | Contrôle | Mesure attendue |
|---|---|---|
| 32 | Hors liste de domaines : « Capture HTML » visible et désactivée, avec la raison écrite ; la capture d'écran reste proposée | capture du popup, version boutique |
| 33 | Mention au lancement d'une capture HTML, avant la première page | |
| 34 | Écran de vérification HTML : rapport cumulé en tête, statut par page (point et texte), détail en dépliant | chiffres identiques à ceux du serveur sur la page de `lib.test.ts` |

## 2. Reprises L48 encore ouvertes (tracker)

| Écran | Écart à revérifier | Mesure attendue |
|---|---|---|
| **L48-04**, Démos vide | B1 : les 3 tuiles de départ sont retirées | aucune tuile |
| | B2 : pas de « Nouvelle démo » dans l'en-tête quand la liste est vide | une seule action principale à l'écran |
| | B3 : « Voir un exemple » en lien désactivé, avec « Bientôt » en texte | `aria-disabled="true"` |
| **L48-05**, Sandbox | La colonne Dossiers dit « Tous les Sandbox » et « Mes Sandbox » | texte exact |
| | Sandbox vide : une seule action principale (en-tête ou centre, pas les deux) | |
| | Compteur « n liens sans page » en `danger` sur les cartes | avec une page qui a des liens morts |
| | Le type apparaît dans le filtre Démo d'Analytics, dans Parcours et dans la recherche | |
| **L48C-01**, accueil | C1 : « Importer des captures à la place » et « Continuer sans l'extension » en liens `primary` (corrigé par §18, à revoir sur l'écran) | aucun bouton natif |
| | C3 : avec l'extension détectée, « Ajouter à Chrome » est masqué | |
| | C4 : pas d'anneau de focus sur le titre au changement d'étape, à la souris | `:focus-visible` seulement |
| | C6 : la puce de l'aperçu n'affiche pas le nom deux fois | |
| | Extension sans URL : étape 4 en « Bientôt disponible » (§18.4) | |
| **L48D-01**, Analytics | D1 : « Ajouter un filtre » sur la ligne des filtres, après Source | même `top` que Source à 1440 px |
| | D2 : widgets alignés en haut, sans vide sous « Nouveaux et récurrents » | `align-items: start` |
| | D3 : tendance des Leads lisible (« +1 vs 6 sur les 30 j précédents ») | texte exact |
| | D4 : nom du dossier en 13 px `text-muted` sous chaque démo de l'onglet Démos | avec une démo rangée dans un dossier |
| **L48F-01**, Intégrations | F1 : titres de groupe en 12 px 600 `text-muted` | `font-size` 12 px |
| | F2 : 16 px entre la phrase et le segmenté, et entre la carte et la ligne de demande | mesure |
| | F5 : à 390 px, Aide et Notifications ne prennent pas une ligne à elles seules | capture à 390 px |
| **L48-02**, Dossiers | « Nouveau dossier » dans la police de l'app (corrigé par §18) | aucun bouton natif |

## 3. Après chaque revue
- Mettre le tracker à jour (statut, captures en clair et en sombre, écart précis), puis le `log` et la fiche de l'équipe UX.
- Envoyer la liste des « non » au dev, en un seul message, avec les mesures relevées.
- Envoyer une ligne au chef.
