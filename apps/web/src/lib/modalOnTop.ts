/**
 * Une fenêtre modale (`<dialog>` ouverte par showModal) est au-dessus de la page. Les tiroirs et panneaux
 * qui écoutent le clavier sur le document lui laissent alors Échap et Tab : sinon ils captent la touche
 * et la fenêtre ne reçoit jamais sa demande de fermeture.
 */
export const modalOnTop = (): boolean => !!document.querySelector('dialog:modal');
