import { useState, type CSSProperties, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Palette, TriangleAlert } from 'lucide-react';
import { Button, Modal, Select } from '@flowdsiml/ui';
import { FONTS, SHAPES, type StyleTokens } from '../../editor/styles/presets';
import { checkStyle, type StyleCheck } from '../../editor/styles/styleCheck';
import { ratioText } from '../../../lib/contrast';
import { STYLE_NAME_MAX, isHex, nameTaken } from './brand';
import '../../editor/styles/styles.css';

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
  const [name, setName] = useState(initial.name);
  const [tokens, setTokens] = useState<StyleTokens>(initial.tokens);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      <span className="stg-help">{text}</span>
    ) : (
      <>
        <span className="stg-help br-warn" role="status">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            {text}.{c.fix && <> {t('brand.proposed', { color: c.fix })}</>}
          </span>
        </span>
        {c.fix && (
          <Button className="br-sd-use" onClick={() => set({ [c.field]: c.fix })}>
            {t('brand.useColor')}
          </Button>
        )}
      </>
    );
  };

  const color = (key: ColorKey, label: string) => {
    const c = checkFor(key);
    return (
      <div className="fd-modal__field">
        <label htmlFor={`sd-${key}`}>{label}</label>
        <div className="br-colr">
          <span className="br-swatch" style={{ background: tokens[key] }} aria-hidden="true" />
          <input
            id={`sd-${key}`}
            className="fd-input"
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
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
    <Modal
      open
      onClose={onClose}
      size="xl"
      icon={<Palette />}
      title={title}
      closeLabel={t('common.close')}
      className="br-dialog"
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="br-sd-form" disabled={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="br-sd-form" className="br-sd" onSubmit={submit} noValidate>
        <div className="br-sd-fields">
          <div className="fd-modal__field">
            <label htmlFor="br-sd-name">{t('brand.styleName')}</label>
            <input
              id="br-sd-name"
              className="fd-input"
              required
              autoComplete="off"
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
              <p id="br-sd-name-err" className="stg-error" role="alert">
                <CircleAlert size={16} aria-hidden="true" />
                {err}
              </p>
            )}
          </div>
          {color('primary', t('brand.primary'))}
          {color('surface', t('brand.bubbleBg'))}
          {color('text', t('brand.bubbleText'))}
          {color('hotspot', t('brand.hotspot'))}
          {color('background', t('brand.background'))}
          <div className="fd-modal__field">
            <span className="fd-modal__label" id="br-sd-radius">
              {t('brand.radius')}
            </span>
            <div className="segmented stg-seg" role="radiogroup" aria-labelledby="br-sd-radius">
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
          </div>
          <div className="fd-modal__field">
            <label htmlFor="br-sd-font">{t('brand.font')}</label>
            <Select
              id="br-sd-font"
              value={FONTS.includes(tokens.fontFamily) ? tokens.fontFamily : FONTS[0]}
              onChange={(e) => set({ fontFamily: e.target.value })}
              options={FONTS.map((f) => ({ value: f, label: f.split(',')[0]!.replace(/'/g, '') }))}
            />
          </div>
          {mode === 'edit' && <p className="stg-help br-sd-note">{t('brand.editHelp')}</p>}
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
      </form>
    </Modal>
  );
}
