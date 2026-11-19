import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { APP_NAME } from '@flowdsiml/core';
import fr from './locales/fr.json';

const saved = (() => {
  try {
    return localStorage.getItem('fd.locale');
  } catch {
    return null;
  }
})();

// L27 : l'anglais est chargé à la demande (le français, langue par défaut et de repli, reste inclus)
let enLoaded: Promise<void> | null = null;
function loadEn(): Promise<void> {
  enLoaded ??= import('./locales/en.json').then((m) => {
    i18n.addResourceBundle('en', 'translation', m.default, true, true);
  });
  return enLoaded;
}

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr } },
  lng: 'fr',
  fallbackLng: 'fr',
  // {{app}} : nom du produit (constante unique, packages/core/src/brand.ts)
  interpolation: { escapeValue: false, defaultVariables: { app: APP_NAME } },
});

if (saved === 'en') void loadEn().then(() => i18n.changeLanguage('en'));

export async function setLocale(lng: 'fr' | 'en') {
  if (lng === 'en') await loadEn();
  await i18n.changeLanguage(lng);
  try {
    localStorage.setItem('fd.locale', lng);
  } catch {
    /* stockage indisponible */
  }
  document.documentElement.lang = lng;
}

export default i18n;
