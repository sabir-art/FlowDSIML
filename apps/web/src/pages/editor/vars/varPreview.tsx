/**
 * L46 §7 : aperçu des variables dans le canevas de l'éditeur. Les pastilles sont remplacées par les
 * exemples du catalogue (« Bienvenue Camille ! ») ou par les valeurs de repli (visiteur inconnu) ;
 * les valeurs insérées sont légèrement surlignées (éditeur seulement, jamais dans le lecteur).
 */
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { applyVariables, escapeHtml, richTextToHtml } from '@flowdsiml/core';
import type { Tables } from '@flowdsiml/supabase-types';
import { previewValues, type CatalogItem } from '../../../lib/varCatalog';

export type PreviewMode = 'examples' | 'fallbacks';
let mode: PreviewMode = 'examples';
const subs = new Set<() => void>();
const setMode = (m: PreviewMode) => {
  mode = m;
  subs.forEach((f) => f());
};
export const usePreviewMode = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => mode,
  );

const OPEN = '';
const CLOSE = '';

/** Fonctions d'aperçu pour le canevas (selon le mode choisi au-dessus du canevas). */
export function varPreview(
  catalog: CatalogItem[],
  rows: Array<Pick<Tables<'variables'>, 'key' | 'default_value'> & { value?: string | null }>,
  m: PreviewMode,
) {
  const values = previewValues(catalog, m);
  const defaults = Object.fromEntries(
    rows.map((v) => [v.key, (m === 'fallbacks' && v.value) || v.default_value]),
  );
  const marked = (s: string) => s.replaceAll(OPEN, '<mark class="var-val">').replaceAll(CLOSE, '</mark>');
  return {
    /** Texte simple (titre, bouton) : valeurs sans surlignage. */
    text: (s: string) => applyVariables(s, values, m === 'fallbacks' ? defaults : {}),
    /** Texte riche (HTML) avec les valeurs surlignées. */
    html: (s: string) =>
      marked(richTextToHtml(applyVariables(s, values, m === 'fallbacks' ? defaults : {}, [OPEN, CLOSE]))),
    /** Texte simple échappé, valeurs surlignées. */
    plainHtml: (s: string) =>
      marked(escapeHtml(applyVariables(s, values, m === 'fallbacks' ? defaults : {}, [OPEN, CLOSE]))),
  };
}

/** Commutateur « Aperçu avec : Exemples | Valeurs de repli », seulement si l'étape a une variable. */
export function PreviewSwitch({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const m = usePreviewMode();
  if (!visible) return null;
  return (
    <div className="var-prev-switch">
      <span className="t-caption muted" id="var-prev-l">
        {t('variables.previewWith')}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby="var-prev-l">
        {(['examples', 'fallbacks'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={m === k} onClick={() => setMode(k)}>
            {t(k === 'examples' ? 'variables.previewExamples' : 'variables.previewFallbacks')}
          </button>
        ))}
      </div>
    </div>
  );
}
