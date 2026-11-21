import { defineConfig } from 'wxt';
import { APP_NAME } from '../../packages/core/src/brand';

export default defineConfig({
  hooks: {
    // EXT-STORE : WXT recopie les « matches » des scripts injectés à la demande (registration: 'runtime')
    // dans host_permissions. Ils passent par scripting.executeScript, couvert par activeTab ou par l'accès
    // facultatif aux sites : aucun accès obligatoire aux sites dans le manifeste publié.
    // Les e2e (WXT_E2E=1) gardent l'accès : Playwright ne peut pas répondre à la fenêtre d'autorisation.
    'build:manifestGenerated': (_wxt, manifest) => {
      if (process.env.WXT_E2E !== '1') delete manifest.host_permissions;
    },
  },
  manifest: {
    // EXT-STORE (docs/ux/store/README.md §2) : nom sans signe, résumé de 132 caractères au plus
    name: `${APP_NAME} Capture`,
    description:
      'Créez une démo interactive en parcourant votre logiciel : chaque clic devient une étape, avec sa bulle d’explication.',
    // EXT-STORE : permissions minimales. L'accès aux sites est facultatif, demandé au clic sur « Démarrer »
    // avec une explication (lib/permissions.ts). `debugger` ne peut pas être facultative dans Chrome :
    // option B (décision du chef) = absente de la version de la boutique ; WXT_DEBUGGER=1 rétablit l'option A.
    permissions: [
      'activeTab',
      'storage',
      'scripting',
      'tabs',
      'tabCapture',
      'offscreen',
      ...(process.env.WXT_DEBUGGER === '1' ? (['debugger'] as const) : []),
    ],
    // F7 : raccourcis pendant l'enregistrement vidéo
    commands: {
      'rec-pause': { suggested_key: { default: 'Alt+Shift+P' }, description: 'Pause ou reprise' },
      'rec-mark': { suggested_key: { default: 'Alt+Shift+M' }, description: 'Marquer une étape' },
      'rec-stop': { suggested_key: { default: 'Alt+Shift+S' }, description: 'Terminer l’enregistrement' },
    },
    // Sans accès aux sites, activeTab couvre la page ouverte au démarrage. Avec, la barre est réinjectée
    // après un changement de page et dans les onglets suivis, et captureVisibleTab reste possible.
    optional_host_permissions: ['<all_urls>'],
    action: { default_title: APP_NAME },
  },
});
