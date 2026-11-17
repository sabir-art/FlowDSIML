import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';

const saved = (() => {
  try {
    return localStorage.getItem('fd.locale');
  } catch {
    return null;
  }
})();

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: saved === 'en' || saved === 'fr' ? saved : 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export function setLocale(lng: 'fr' | 'en') {
  void i18n.changeLanguage(lng);
  try {
    localStorage.setItem('fd.locale', lng);
  } catch {
    /* stockage indisponible */
  }
  document.documentElement.lang = lng;
}

export default i18n;
