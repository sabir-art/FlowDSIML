import { defineConfig } from 'wxt';
import { APP_NAME } from '../../packages/core/src/brand';

export default defineConfig({
  manifest: {
    name: `${APP_NAME} — Capture`,
    description: 'Enregistre un parcours web pour créer une démo interactive.',
    permissions: ['activeTab', 'storage', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
    action: { default_title: APP_NAME },
  },
});
