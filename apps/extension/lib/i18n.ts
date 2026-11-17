/** Chaînes de l'extension (formulations de docs/ux/i18n, clés extension.*). FR par défaut. */
import { APP_NAME } from '@flowdsiml/core';

const fr = {
  subtitle: 'Capture',
  email: 'Email',
  password: 'Mot de passe',
  signIn: 'Se connecter',
  noAccount: 'Pas de compte ?',
  signUp: 'Créer un compte',
  workspace: 'Workspace',
  demoTitle: 'Titre de la démo',
  demoTitlePlaceholder: 'Ex. : Créer un projet',
  start: 'Démarrer la capture',
  hint: "Chaque clic dans l'onglet courant crée une étape (capture d'écran + hotspot). Rien n'est envoyé avant la fin : vous vérifiez alors les données personnelles détectées, floutées dans l'image avant l'envoi.",
  signOut: 'Se déconnecter',
  recording: 'Capture en cours',
  paused: 'Capture en pause',
  pause: 'Pause',
  resume: 'Reprendre',
  finish: 'Terminer',
  cancel: 'Annuler la capture',
  confirmCancel: 'Annuler la capture ? Les captures seront effacées de ce navigateur.',
  stepsCaptured_one: '{{count}} étape capturée',
  stepsCaptured_other: '{{count}} étapes capturées',
  notLoggedIn: `Connectez-vous à ${APP_NAME} pour capturer.`,
  protectedPage: 'Cette page ne peut pas être capturée (page système du navigateur).',
  badCredentials: 'Email ou mot de passe incorrect.',
  noWorkspace: "Aucun workspace où vous êtes éditeur. Créez-en un dans l'application.",
};
const en: typeof fr = {
  subtitle: 'Capture',
  email: 'Email',
  password: 'Password',
  signIn: 'Sign in',
  noAccount: 'No account?',
  signUp: 'Create an account',
  workspace: 'Workspace',
  demoTitle: 'Demo title',
  demoTitlePlaceholder: 'E.g. Create a project',
  start: 'Start capture',
  hint: 'Each click in the current tab creates a step (screenshot + hotspot). Nothing is sent until you finish: you then review the detected personal data, blurred in the image before sending.',
  signOut: 'Sign out',
  recording: 'Capturing',
  paused: 'Capture paused',
  pause: 'Pause',
  resume: 'Resume',
  finish: 'Finish',
  cancel: 'Cancel capture',
  confirmCancel: 'Cancel the capture? Captures will be erased from this browser.',
  stepsCaptured_one: '{{count}} step captured',
  stepsCaptured_other: '{{count}} steps captured',
  notLoggedIn: `Sign in to ${APP_NAME} to capture.`,
  protectedPage: 'This page cannot be captured (browser system page).',
  badCredentials: 'Wrong email or password.',
  noWorkspace: 'No workspace where you are an editor. Create one in the app.',
};

export type Strings = typeof fr;
export const strings: Strings = (globalThis.navigator?.language ?? 'fr').toLowerCase().startsWith('en')
  ? en
  : fr;
export const lang = strings === en ? 'en' : 'fr';

export function stepsCaptured(n: number): string {
  return (n === 1 ? strings.stepsCaptured_one : strings.stepsCaptured_other).replace('{{count}}', String(n));
}
