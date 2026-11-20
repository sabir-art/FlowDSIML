/**
 * L46 : catalogue des variables présenté à l'auteur (jamais de clé technique à l'écran). Variables
 * prédéfinies (traductions variables.builtin.*) puis variables de l'espace (table variables).
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PREDEFINED_VARIABLES, type VariableGroup } from '@flowdsiml/core';
import type { Tables } from '@flowdsiml/supabase-types';

export interface CatalogItem {
  key: string;
  group: VariableGroup;
  label: string;
  description: string;
  example: string;
  /** Repli proposé à l'insertion (vide : le mot disparaît). */
  fallback: string;
  computed: boolean;
  emailOnly: boolean;
}

export const GROUP_ORDER: VariableGroup[] = ['visitor', 'company', 'demo', 'date', 'workspace'];

/** « nom_logiciel » → « Nom logiciel » (variable de l'espace sans libellé). */
export const labelFromKey = (key: string) => {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Clé créée à partir d'un libellé : « Nom du logiciel » → « nom_du_logiciel ». */
export function keyFromLabel(label: string): string {
  const k = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '');
  return (k || 'variable').slice(0, 40);
}

export function useVarCatalog(
  rows: Array<
    Pick<Tables<'variables'>, 'key' | 'label' | 'default_value'> &
      Partial<Pick<Tables<'variables'>, 'description' | 'example'>>
  >,
): CatalogItem[] {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    const builtin: CatalogItem[] = PREDEFINED_VARIABLES.map((p) => ({
      key: p.key,
      group: p.group,
      label: t(`variables.builtin.${p.key}.label`),
      description: t(`variables.builtin.${p.key}.description`),
      example: t(`variables.builtin.${p.key}.example`),
      fallback: t(`variables.builtin.${p.key}.fallback`),
      computed: !!p.computed,
      emailOnly: !!p.emailOnly,
    }));
    const own = rows
      .filter((r) => !builtin.some((b) => b.key === r.key))
      .map<CatalogItem>((r) => ({
        key: r.key,
        group: 'workspace',
        label: r.label.trim() || labelFromKey(r.key),
        description: r.description ?? '',
        example: r.example?.trim() || r.default_value || r.label || labelFromKey(r.key),
        fallback: r.default_value ?? '',
        computed: false,
        emailOnly: false,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    return [...builtin, ...own];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, i18n.language]);
}

/** Valeurs d'aperçu : exemples du catalogue, ou valeurs de repli (« ce que voit un visiteur inconnu »). */
export function previewValues(
  catalog: CatalogItem[],
  mode: 'examples' | 'fallbacks',
): Record<string, string> {
  return Object.fromEntries(
    catalog.filter((c) => mode === 'examples' || c.computed).map((c) => [c.key, c.example]),
  );
}
