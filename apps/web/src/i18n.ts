import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { APP_NAME } from '@flowdsiml/core';
// L33 : socle des textes (connexion, coquille, tableau de bord) ; le reste est chargé avec les autres pages
import fr from 'virtual:locale-fr-core';

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

let restLoaded: Promise<void> | null = null;
/** Suite des textes français (vite.locales.ts). Attendue par les pages et boîtes chargées à la demande. */
export function loadRestLocale(): Promise<void> {
  restLoaded ??= import('virtual:locale-fr-rest').then((m) => {
    i18n.addResourceBundle('fr', 'translation', m.default, true, false);
  });
  return restLoaded;
}

/** Importe un morceau de code en attendant aussi la suite des textes. */
export function withRestLocale<T>(load: () => Promise<T>): Promise<T> {
  return Promise.all([load(), loadRestLocale()]).then(([m]) => m);
}

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr } },
  lng: 'fr',
  fallbackLng: 'fr',
  // {{app}} : nom du produit (constante unique, packages/core/src/brand.ts)
  interpolation: { escapeValue: false, defaultVariables: { app: APP_NAME } },
  // L33 : en dev, une clé absente du socle mais présente dans la suite (affichée trop tôt) lève une erreur,
  // détectée par les tests e2e (« aucune erreur JS ») : le découpage de vite.locales.ts l'a manquée.
  ...(import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? {
        saveMissing: true,
        missingKeyHandler: (_lngs: readonly string[], _ns: string, key: string) => {
          void loadRestLocale().then(() => {
            if (i18n.exists(key))
              setTimeout(() => {
                throw new Error(`L33 : texte « ${key} » affiché avant la suite des textes (vite.locales.ts)`);
              });
          });
        },
      }
    : {}),
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
