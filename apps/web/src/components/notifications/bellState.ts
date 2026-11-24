/**
 * État d'ouverture du panneau des notifications, gardé hors des composants. La cloche est remontée
 * quand une page passe de son squelette à son contenu, et son code est chargé après le premier
 * affichage : un clic fait pendant ce temps ne doit pas être perdu (le panneau s'ouvre, et reste ouvert).
 */
export const bellState = { open: false };
