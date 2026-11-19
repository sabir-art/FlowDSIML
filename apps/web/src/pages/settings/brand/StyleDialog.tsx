import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert, X } from 'lucide-react';
import { FONTS, SHAPES, type StyleTokens } from '../../editor/styles/presets';
import { checkStyle, type StyleCheck } from '../../editor/styles/styleCheck';
import { ratioText } from '../../../lib/contrast';
import { STYLE_NAME_MAX, isHex, nameTaken } from './brand';

type ColorKey = 'primary' | 'hotspot' | 'surface' | 'text' | 'background';

/**
 * L27-02 : modale « Modifier le style » (création, duplication, modification). Les champs sont ceux de
 * l'onglet Design ; l'aperçu (fictif, aria-hidden) suit en direct. Sous un seuil de contraste,
 * l'enregistrement reste possible : l'alerte propose une couleur.
 */
export function StyleDialog({
  mode,
  initialName,
  initial,
  taken,
  onClose,
  onSave,
}: {
  mode: 'new' | 'duplicate' | 'edit';
  /** Nom d'origine (titre « Dupliquer » / « Modifier ») */
  initialName: string;
  initial: { name: string; tokens: StyleTokens };
  taken: string[];
  onClose: () => void;
  onSave: (name: string, tokens: StyleTokens) => Promise<void>;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initial.name);
  const [tokens, setTokens] = useState<StyleTokens>(initial.tokens);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const set = (p: Partial<StyleTokens>) => setTokens((x) => ({ ...x, ...p }));
  const checks = checkStyle(tokens);
  const checkFor = (k: ColorKey) => checks.find((c) => c.field === k);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setErr(t('editor.styles.nameEmpty'));
    if (nameTaken(n, taken)) return setErr(t('editor.styles.nameTaken'));
    setBusy(true);
    try {
      await onSave(n, tokens);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  const contrast = (c: StyleCheck) => {
    const text = t('brand.ratio', {
      what: t(`brand.check_${c.key}`),
      ratio: ratioText(c.ratio),
      verdict: c.ok ? t('brand.ok') : t('brand.notOk'),
    });
    return c.ok ? (
      <span className="help">{text}</span>
    ) : (
      <div className="alert alert-warning th-warn" role="status">
        <TriangleAlert aria-hidden="true" />
        <span className="t-caption">
          {text}.
          {c.fix && (
            <>
              {' '}
              {t('brand.proposed', { color: c.fix })}{' '}
              <button type="button" className="mk-link" onClick={() => set({ [c.field]: c.fix })}>
                {t('brand.useColor')}
              </button>
            </>
          )}
        </span>
      </div>
    );
  };

  const color = (key: ColorKey, label: string) => {
    const c = checkFor(key);
    return (
      <div className="field">
        <label htmlFor={`sd-${key}`}>{label}</label>
        <div className="color-row">
          <input
            className="swatch"
            type="color"
            aria-label={t('brand.picker', { label })}
            value={tokens[key]}
            onChange={(e) => set({ [key]: e.target.value.toUpperCase() })}
          />
          <input
            id={`sd-${key}`}
            className="input input-sm t-mono"
            maxLength={7}
            defaultValue={tokens[key].toUpperCase()}
            key={tokens[key]}
            onBlur={(e) => {
              const v = e.target.value.trim().toUpperCase();
              if (isHex(v)) set({ [key]: v });
              else e.target.value = tokens[key].toUpperCase();
            }}
          />
        </div>
        {c && contrast(c)}
      </div>
    );
  };

  const vars = {
    '--st-bg': tokens.background,
    '--st-tip': tokens.surface,
    '--st-text': tokens.text,
    '--st-primary': tokens.primary,
    '--st-on': tokens.onPrimary,
    '--st-hot': tokens.hotspot,
    '--st-r': `${tokens.radius}px`,
    '--st-br': `${Math.min(tokens.buttonRadius, 99)}px`,
    '--st-font': tokens.fontFamily,
  } as CSSProperties;
  const title =
    mode === 'new'
      ? t('brand.dlgNew')
      : t(mode === 'edit' ? 'brand.dlgEdit' : 'brand.dlgDuplicate', { name: initialName });

  return (
    <dialog ref={ref} className="mk br-dialog" aria-labelledby="br-sd-t" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="modal-head">
          <h2 id="br-sd-t">{title}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={() => ref.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body br-sd">
          <div className="br-sd-fields">
            <div className="field">
              <label htmlFor="br-sd-name">{t('brand.styleName')}</label>
              <input
                id="br-sd-name"
                className="input"
                required
                maxLength={STYLE_NAME_MAX}
                value={name}
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? 'br-sd-name-err' : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  setErr(null);
                }}
              />
              {err && (
                <p id="br-sd-name-err" className="field-error" role="alert">
                  {err}
                </p>
              )}
            </div>
            {color('primary', t('brand.primary'))}
            {color('surface', t('brand.bubbleBg'))}
            {color('text', t('brand.bubbleText'))}
            {color('hotspot', t('brand.hotspot'))}
            {color('background', t('brand.background'))}
            <fieldset className="field br-fieldset">
              <legend>{t('brand.radius')}</legend>
              <div className="segmented" role="radiogroup" aria-label={t('brand.radius')}>
                {SHAPES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={tokens.radius === s.radius}
                    onClick={() => set({ radius: s.radius })}
                  >
                    {t(`editor.design.shape_${s.key}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="br-sd-font">{t('brand.font')}</label>
              <select
                id="br-sd-font"
                className="select input-sm"
                value={FONTS.includes(tokens.fontFamily) ? tokens.fontFamily : FONTS[0]}
                onChange={(e) => set({ fontFamily: e.target.value })}
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f.split(',')[0]!.replace(/'/g, '')}
                  </option>
                ))}
              </select>
            </div>
            {mode === 'edit' && <p className="t-caption muted">{t('brand.editHelp')}</p>}
          </div>
          <div className="br-sd-preview" style={vars} aria-hidden="true">
            <div className="br-sd-screen">
              <span className="br-sd-line" />
              <span className="br-sd-line br-sd-line--short" />
              <span className="br-sd-target">
                <span className="sty-dot br-sd-dot" />
              </span>
              <span className="br-sd-bubble">
                <b>{t('brand.previewTitle')}</b>
                <span>{t('brand.previewBody')}</span>
                <span className="sty-cta br-sd-cta">{t('editor.styles.sampleNext')}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
