import { defineConfig } from 'wxt';
import { APP_NAME } from '../../packages/core/src/brand';

export default defineConfig({
  manifest: {
    name: `${APP_NAME} — Capture`,
    description: 'Enregistre un parcours web pour créer une démo interactive.',
    permissions: ['activeTab', 'storage', 'scripting', 'tabs', 'tabCapture', 'offscreen', 'debugger'],
    // F7 : raccourcis pendant l'enregistrement vidéo
    commands: {
      'rec-pause': { suggested_key: { default: 'Alt+Shift+P' }, description: 'Pause ou reprise' },
      'rec-mark': { suggested_key: { default: 'Alt+Shift+M' }, description: 'Marquer une étape' },
      'rec-stop': { suggested_key: { default: 'Alt+Shift+S' }, description: 'Terminer l’enregistrement' },
    },
    host_permissions: ['<all_urls>'],
    action: { default_title: APP_NAME },
  },
});
