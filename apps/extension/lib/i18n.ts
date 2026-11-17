/** Chaînes de l'extension (formulations de docs/ux/i18n, clés extension.*). FR par défaut. */
const fr = {
  subtitle: 'Capture',
  email: 'Email',
  password: 'Mot de passe',
  signIn: 'Se connecter',
  noAccount: 'Pas de compte ?',
  signUp: 'Créer un compte',
  workspace: 'Workspace',
  demoTitle: 'Titre de la démo',
  demoTitlePlaceholder: 'Ex. : Créer un projet',
  start: 'Démarrer la capture',
  hint: "Chaque clic dans l'onglet courant crée une étape (capture d'écran + hotspot). Les mots de passe et champs de carte sont floutés automatiquement.",
  signOut: 'Se déconnecter',
  recording: 'Capture en cours',
  paused: 'Capture en pause',
  pause: 'Pause',
  resume: 'Reprendre',
  finish: 'Terminer',
  cancel: 'Annuler la capture',
  confirmCancel: 'Annuler la capture ? Les étapes déjà capturées seront supprimées.',
  stepsCaptured_one: '{{count}} étape capturée',
  stepsCaptured_other: '{{count}} étapes capturées',
  notLoggedIn: 'Connectez-vous à FlowDSIML pour capturer.',
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
  hint: 'Each click in the current tab creates a step (screenshot + hotspot). Passwords and card fields are blurred automatically.',
  signOut: 'Sign out',
  recording: 'Capturing',
  paused: 'Capture paused',
  pause: 'Pause',
  resume: 'Resume',
  finish: 'Finish',
  cancel: 'Cancel capture',
  confirmCancel: 'Cancel the capture? Steps already captured will be deleted.',
  stepsCaptured_one: '{{count}} step captured',
  stepsCaptured_other: '{{count}} steps captured',
  notLoggedIn: 'Sign in to FlowDSIML to capture.',
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
