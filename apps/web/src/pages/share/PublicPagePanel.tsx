import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Info } from 'lucide-react';
import type { Tables, TablesUpdate } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { publicPageUrl } from '../../lib/embed';
import { useToast } from '../../components/Toast';
import { CopyButton } from './codeBlock';

type Page = Tables<'demo_pages'>;
type Style = 'demo' | 'light' | 'dark';
const HTTPS = /^https:\/\/[^\s/?#]+\S*$/;

/** Formulaire de la page publique (lu depuis demo_pages ; défauts de la base). */
interface Form {
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  style: Style;
  related: boolean;
  indexable: boolean;
}
const fromRow = (r: Page | null): Form => ({
  title: r?.title ?? '',
  description: r?.description ?? '',
  ctaLabel: r?.cta_label ?? '',
  ctaUrl: r?.cta_url ?? '',
  style: (r?.style as Style) ?? 'demo',
  related: r?.related ?? false,
  indexable: r?.indexable ?? false,
});

/** Erreurs du bouton d'action (les deux champs ensemble, lien https). */
export function ctaErrors(f: Pick<Form, 'ctaLabel' | 'ctaUrl'>): { label?: string; url?: string } {
  const l = f.ctaLabel.trim();
  const u = f.ctaUrl.trim();
  if (!l && !u) return {};
  return {
    ...(!l ? { label: 'ctaLabelRequired' } : {}),
    ...(!u ? { url: 'ctaUrlRequired' } : !HTTPS.test(u) ? { url: 'ctaUrlHttps' } : {}),
  };
}

/**
 * L19b-01 / 02 : onglet « Page publique » de Partager. Page désactivée par défaut ; titre (70),
 * description (200), bouton d'action (40, lien https), style, autres démos, indexation (désactivée
 * par défaut, jamais pour une démo protégée).
 */
export function PublicPagePanel({
  demoId,
  demoTitle,
  published,
  protectedAccess,
  editable,
}: {
  demoId: string;
  demoTitle: string;
  published: boolean;
  protectedAccess: boolean;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [row, setRow] = useState<Page | null | undefined>(undefined);
  const [form, setForm] = useState<Form>(fromRow(null));
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const url = publicPageUrl(demoId);

  useEffect(() => {
    void supabase
      .from('demo_pages')
      .select('*')
      .eq('demo_id', demoId)
      .maybeSingle()
      .then(({ data }) => {
        setRow((data as Page | null) ?? null);
        setForm(fromRow((data as Page | null) ?? null));
      });
  }, [demoId]);

  if (row === undefined) return null;
  const enabled = row?.enabled ?? false;
  const errs = ctaErrors(form);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function write(patch: TablesUpdate<'demo_pages'>) {
    const body = { demo_id: demoId, ...patch };
    const { data, error } = row
      ? await supabase.from('demo_pages').update(patch).eq('demo_id', demoId).select().single()
      : await supabase.from('demo_pages').insert(body).select().single();
    if (error) {
      toast(t('share.page.error'));
      return false;
    }
    setRow(data as Page);
    return true;
  }

  async function save() {
    setTried(true);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const ok = await write({
      title: form.title.trim(),
      description: form.description.trim(),
      cta_label: form.ctaLabel.trim() || null,
      cta_url: form.ctaUrl.trim() || null,
      style: form.style,
      related: form.related,
      indexable: form.indexable,
    });
    setSaving(false);
    if (ok) toast(t('share.page.saved'));
  }

  return (
    <div className="sh-page">
      {!published && (
        <div className="alert alert-info sh-alert" role="status">
          <Info aria-hidden="true" />
          <span>{t('share.page.notPublished')}</span>
        </div>
      )}
      <div className="setting sh-first">
        <div>
          <b id={`${id}-on`}>{t('share.page.toggle')}</b>
          <p className="t-caption muted">{t('share.page.toggleHelp')}</p>
        </div>
        <span className="switch">
          <input
            type="checkbox"
            role="switch"
            aria-labelledby={`${id}-on`}
            checked={enabled}
            disabled={!editable}
            onChange={(e) => {
              const on = e.target.checked;
              // Affichage immédiat ; rétabli si l'écriture échoue
              const before = row;
              setRow((r) => ({ ...(r ?? ({} as Page)), enabled: on }));
              void write({ enabled: on }).then((ok) =>
                ok ? toast(on ? t('share.page.enabled') : t('share.page.disabled')) : setRow(before),
              );
            }}
          />
          <span />
        </span>
      </div>
      {!enabled ? (
        <div className="alert alert-info sh-alert" role="status">
          <Info aria-hidden="true" />
          <span>{t('share.page.offInfo')}</span>
        </div>
      ) : (
        <form
          className="col sh-page-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={!editable} className="sh-page-fs">
            <div className="field">
              <label htmlFor={`${id}-url`}>{t('share.page.address')}</label>
              <div className="input-group">
                <input id={`${id}-url`} className="input t-mono" readOnly value={url} />
                <CopyButton value={url} />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${id}-t`}>{t('share.page.title')}</label>
              <input
                id={`${id}-t`}
                className="input"
                maxLength={70}
                placeholder={demoTitle}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
              <span className="help">{t('share.page.titleHelp')}</span>
            </div>
            <div className="field">
              <label htmlFor={`${id}-d`}>{t('share.page.description')}</label>
              <textarea
                id={`${id}-d`}
                className="input"
                rows={3}
                maxLength={200}
                aria-describedby={`${id}-dc`}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
              <span className="help" id={`${id}-dc`}>
                {t('share.page.count', { n: form.description.length, max: 200 })}
              </span>
            </div>
            <div className="sh-page-2col">
              <div className="field">
                <label htmlFor={`${id}-cl`}>{t('share.page.ctaLabel')}</label>
                <input
                  id={`${id}-cl`}
                  className="input"
                  maxLength={40}
                  value={form.ctaLabel}
                  aria-invalid={(tried && !!errs.label) || undefined}
                  aria-describedby={tried && errs.label ? `${id}-cle` : undefined}
                  onChange={(e) => set('ctaLabel', e.target.value)}
                />
                {tried && errs.label && (
                  <span className="help is-error" id={`${id}-cle`}>
                    {t(`share.page.${errs.label}`)}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor={`${id}-cu`}>{t('share.page.ctaUrl')}</label>
                <input
                  id={`${id}-cu`}
                  className="input t-mono"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  maxLength={500}
                  value={form.ctaUrl}
                  aria-invalid={(tried && !!errs.url) || undefined}
                  aria-describedby={tried && errs.url ? `${id}-cue` : `${id}-cuh`}
                  onChange={(e) => set('ctaUrl', e.target.value)}
                />
                {tried && errs.url ? (
                  <span className="help is-error" id={`${id}-cue`}>
                    {t(`share.page.${errs.url}`)}
                  </span>
                ) : (
                  <span className="help" id={`${id}-cuh`}>
                    {t('share.page.ctaHelp')}
                  </span>
                )}
              </div>
            </div>
            <div className="field">
              <span className="t-label" id={`${id}-st`}>
                {t('share.page.style')}
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby={`${id}-st`}>
                {(['demo', 'light', 'dark'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={form.style === s}
                    onClick={() => set('style', s)}
                  >
                    {t(`share.page.style_${s}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <div>
                <b id={`${id}-rl`}>{t('share.page.related')}</b>
                <p className="t-caption muted">{t('share.page.relatedHelp')}</p>
              </div>
              <span className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-labelledby={`${id}-rl`}
                  checked={form.related}
                  onChange={(e) => set('related', e.target.checked)}
                />
                <span />
              </span>
            </div>
            <div className="setting">
              <div>
                <b id={`${id}-ix`}>{t('share.page.indexable')}</b>
                <p className="t-caption muted">
                  {protectedAccess ? t('share.page.indexableProtected') : t('share.page.indexableHelp')}
                </p>
              </div>
              <span className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-labelledby={`${id}-ix`}
                  checked={form.indexable && !protectedAccess}
                  disabled={protectedAccess}
                  onChange={(e) => set('indexable', e.target.checked)}
                />
                <span />
              </span>
            </div>
            {/* L19b-01 : badge « Bientôt » standard */}
            <p className="help">
              {t('share.page.ogSoonText')} <span className="badge">{t('shell.soon')}</span>
            </p>
          </fieldset>
          <div className="row sh-page-actions">
            <a className="btn btn-secondary" href={url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              {t('share.page.open')}
            </a>
            <span className="help">{t('share.page.newTab')}</span>
            {editable && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {t('common.save')}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
