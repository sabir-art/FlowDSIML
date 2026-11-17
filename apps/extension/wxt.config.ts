import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'FlowDSIML — Capture',
    description: 'Enregistre un parcours web pour créer une démo interactive.',
    permissions: ['activeTab', 'storage', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'FlowDSIML' },
  },
});
