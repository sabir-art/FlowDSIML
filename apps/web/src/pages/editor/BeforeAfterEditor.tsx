import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, ListOrdered, TriangleAlert, X } from 'lucide-react';
import { Button } from '@flowdsiml/ui';
import { Menu } from '../../components/Menu';
import { useToast } from '../../components/Toast';
import { FileDropzone } from '../../components/FileDropzone';
import { DropBlock } from '../../components/DropBlock';
import type { DemoEditor } from './useDemoEditor';
import {
  BA_LABEL_MAX,
  BA_NOTE_MAX,
  asBeforeAfter,
  asMasks,
  maskCss,
  type BeforeAfterConfig,
  type MaskRect,
  type StepRow,
} from './types';

/** Taille maximale d'une image importée pour un Avant / Après (spec §3). */
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function Masks({ list, ratio }: { list: MaskRect[]; ratio: number }) {
  return (
    <>
      {list.map((b, i) => (
        <span
          key={i}
          className={`canvas-blur${b.style === 'solid' ? ' canvas-blur--solid' : b.style === 'pixels' ? ' canvas-blur--pixels' : ''}`}
          style={{
            left: `${b.x * 100}%`,
            top: `${b.y * 100}%`,
            width: `${b.w * 100}%`,
            height: `${b.h * 100}%`,
            ...maskCss(b, ratio),
            ...(b.style === 'solid' ? { background: b.color } : {}),
          }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

/**
 * L17-02 : canevas d'une étape Avant / Après (aperçu côte à côte, étiquettes au-dessus, note en bas).
 * Pas d'outil hotspot, flou ni zoom sur ce type d'étape.
 */
export function BeforeAfterCanvas({
  editor,
  step,
  onSelect,
  readOnly = false,
}: {
  editor: DemoEditor;
  step: StepRow;
  onSelect: () => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const ba = asBeforeAfter(step.options);
  const lb = ba.labels.before || t('editor.ba.before');
  const la = ba.labels.after || t('editor.ba.after');
  // MEDIA-01 §18.3 : envoi d'une image depuis le canevas (zone vide, ou dépôt sur la capture en place)
  const [sending, setSending] = useState<'before' | 'after' | null>(null);
  const [errors, setErrors] = useState<{ before?: string; after?: string }>({});
  const [picking, setPicking] = useState<'before' | 'after' | null>(null);
  const hasSteps = editor.steps.some((s) => s.kind === 'image' && s.image_path);
  const send = async (side: 'before' | 'after', f: File | undefined) => {
    if (!f || readOnly) return;
    const fail = (msg: string) => setErrors((e) => ({ ...e, [side]: msg }));
    if (!TYPES.includes(f.type)) return fail(t('editor.ba.badType'));
    if (f.size > MAX_BYTES) return fail(t('editor.ba.tooBig'));
    setErrors((e) => ({ ...e, [side]: undefined }));
    setSending(side);
    try {
      await editor.setBeforeAfterImage(step.id, side, { file: f });
    } finally {
      setSending(null);
    }
  };
  /** Cadre d'un côté (fonction, pas composant : pas de remontage à chaque rendu) : une capture en place
   *  accepte un dépôt pour être remplacée (voile). */
  const pic = (side: 'before' | 'after', filled: boolean, children: ReactNode) =>
    filled && !readOnly ? (
      <DropBlock
        className={`ba-pic${side === 'before' ? ' is-old' : ''}`}
        disabled={sending !== null}
        onFile={(f) => void send(side, f)}
      >
        {children}
      </DropBlock>
    ) : (
      <div className={`ba-pic${side === 'before' ? ' is-old' : ''}`}>{children}</div>
    );
  const col = (side: 'before' | 'after') => {
    const path = side === 'before' ? step.before_image_path : step.image_path;
    const url = path ? editor.imageUrls[path] : undefined;
    const w = (side === 'before' ? step.before_image_width : step.image_width) ?? 16;
    const h = (side === 'before' ? step.before_image_height : step.image_height) ?? 10;
    const masks = asMasks(side === 'before' ? step.before_blurs : step.blurs);
    return (
      <div className="ba-col">
        <span className={`ba-pill ba-pill--${side}`}>{side === 'before' ? lb : la}</span>
        {pic(
          side,
          !!url,
          url ? (
            <div className="ba-shot" style={{ '--ratio': String(w / h) } as CSSProperties}>
              <img src={url} alt="" />
              <Masks list={masks} ratio={w / h} />
            </div>
          ) : readOnly ? (
            <span className="ba-missing">
              <ImagePlus aria-hidden="true" />
              {t(side === 'before' ? 'editor.ba.missingBefore' : 'editor.ba.missingAfter')}
            </span>
          ) : (
            // MEDIA-01 §18.3 : zone large, titrée « Avant » ou « Après », avec ses états
            <FileDropzone
              className="ba-zone"
              label={t(side === 'before' ? 'editor.ba.captureBefore' : 'editor.ba.captureAfter')}
              title={t('editor.ba.zoneTitle')}
              inputId={`ba-zone-${side}`}
              accept={TYPES.join(',')}
              icon={<ImagePlus />}
              hint={t('editor.ba.zoneHint')}
              pickLabel={t('dropzone.import')}
              busy={sending === side}
              busyLabel={t('editor.ba.zoneSending')}
              error={errors[side]}
              onFiles={(files) => void send(side, files[0])}
              extra={
                // Cas le plus courant : reprendre une étape de la démo et ses flous (même choix que le panneau)
                <Button
                  icon={<ListOrdered />}
                  disabled={sending !== null || !hasSteps}
                  onClick={() => setPicking(side)}
                >
                  {t('editor.ba.zoneFromStep')}
                </Button>
              }
            />
          ),
        )}
      </div>
    );
  };
  return (
    <div className="ba-canvas" onPointerDown={onSelect}>
      <div className="ba-cols">
        {col('before')}
        {col('after')}
      </div>
      {(ba.notes.before || ba.notes.after) && (
        <div className="ba-note">
          {ba.notes.before && (
            <span>
              <b>{lb}&#8239;:</b> {ba.notes.before}
            </span>
          )}
          {ba.notes.after && (
            <span>
              <b>{la}&#8239;:</b> {ba.notes.after}
            </span>
          )}
        </div>
      )}
      {picking && (
        <StepPicker
          editor={editor}
          current={step.id}
          onClose={() => setPicking(null)}
          onPick={(id) => {
            const side = picking;
            setPicking(null);
            void editor.setBeforeAfterImage(step.id, side, { stepId: id });
          }}
          title={t(picking === 'before' ? 'editor.ba.captureBefore' : 'editor.ba.captureAfter')}
        />
      )}
    </div>
  );
}

/** L17-02 : réglages d'une étape Avant / Après dans le panneau Étape. */
export function BeforeAfterFields({
  editor,
  step,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const ba = asBeforeAfter(step.options);
  const [picking, setPicking] = useState<'before' | 'after' | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const fileSide = useRef<'before' | 'after'>('before');
  const set = (patch: Partial<BeforeAfterConfig>) =>
    editor.updateStep(step.id, {
      options: {
        ...((step.options ?? {}) as Record<string, unknown>),
        beforeAfter: { ...ba, ...patch },
      } as StepRow['options'],
    });

  const sourceLabel = (side: 'before' | 'after') => {
    const src = ba.sources[side];
    const path = side === 'before' ? step.before_image_path : step.image_path;
    if (!path) return { title: t('editor.ba.none'), sub: t('editor.ba.noneHelp') };
    if (src?.kind === 'upload') return { title: t('editor.ba.uploaded'), sub: src.name };
    if (src?.kind === 'step') {
      const n = editor.steps.findIndex((s) => s.id === src.stepId);
      return {
        title: n >= 0 ? t('editor.stepN', { n: n + 1 }) : t('editor.ba.stepGone'),
        sub: t('editor.ba.copied'),
      };
    }
    return { title: t('editor.ba.uploaded'), sub: '' };
  };

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!TYPES.includes(f.type)) return toast(t('editor.ba.badType'));
    if (f.size > MAX_BYTES) return toast(t('editor.ba.tooBig'));
    await editor.setBeforeAfterImage(step.id, fileSide.current, { file: f });
  }

  const slot = (side: 'before' | 'after') => {
    const path = side === 'before' ? step.before_image_path : step.image_path;
    const url = path ? editor.imageUrls[path] : undefined;
    const label = sourceLabel(side);
    const name = side === 'before' ? t('editor.ba.captureBefore') : t('editor.ba.captureAfter');
    return (
      <div className="field">
        <span className="label" id={`ba-${side}-l`}>
          {name}
        </span>
        <div className={`ba-slot${path ? '' : ' is-empty'}`} aria-labelledby={`ba-${side}-l`} role="group">
          <span className={`ba-thumb${side === 'before' ? ' is-old' : ''}`}>
            {url ? <img src={url} alt="" /> : <ImagePlus aria-hidden="true" />}
          </span>
          <span className="ba-slot-text">
            <b>{label.title}</b>
            {/* Capture vide : une seule ligne, l'aide est portée par la zone du canevas */}
            {path && label.sub && <small>{label.sub}</small>}
          </span>
          {!readOnly && (
            <Menu
              label={t('editor.ba.changeFor', { name })}
              trigger={{ text: path ? t('editor.ba.change') : t('editor.ba.choose') }}
              items={[
                {
                  label: t('editor.ba.fromStep'),
                  icon: <ListOrdered />,
                  disabled: !editor.steps.some((s) => s.kind === 'image' && s.image_path),
                  onSelect: () => setPicking(side),
                },
                {
                  label: t('editor.ba.fromFile'),
                  icon: <ImagePlus />,
                  onSelect: () => {
                    fileSide.current = side;
                    file.current?.click();
                  },
                },
              ]}
            />
          )}
        </div>
        {/* L17-02 : une image importée n'est pas vérifiée automatiquement */}
        {ba.sources[side]?.kind === 'upload' && (
          <p className="ba-warn" role="note">
            <TriangleAlert aria-hidden="true" />
            {t('editor.importUnverified')}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="sec">
        <div className="sec-title">{t('editor.ba.title')}</div>
        <p className="help ba-intro">{t('editor.ba.intro')}</p>
        {slot('before')}
        {slot('after')}
        <input
          ref={file}
          type="file"
          accept={TYPES.join(',')}
          /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié à son bouton */
          id="beforeaftereditor-file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <div className="sec">
        <div className="sec-title" id="ba-layout-l">
          {t('editor.ba.layout')}
        </div>
        <div className="segmented ba-seg" role="radiogroup" aria-labelledby="ba-layout-l">
          {(['side', 'slider', 'toggle'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={ba.layout === k}
              disabled={readOnly}
              onClick={() => set({ layout: k })}
            >
              {t(`editor.ba.layout_${k}`)}
            </button>
          ))}
        </div>
        <p className="help">{t('editor.ba.layoutHelp')}</p>
      </div>
      <div className="sec">
        <div className="sec-title">{t('editor.ba.labels')}</div>
        <div className="ba-two">
          {(['before', 'after'] as const).map((k) => (
            <div className="field" key={k}>
              <label htmlFor={`ba-l-${k}`}>{t(`editor.ba.labelField_${k}`)}</label>
              <input
                id={`ba-l-${k}`}
                className="input input-sm"
                maxLength={BA_LABEL_MAX}
                disabled={readOnly}
                placeholder={t(`editor.ba.${k}`)}
                value={ba.labels[k]}
                onChange={(e) => set({ labels: { ...ba.labels, [k]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="sec">
        <div className="sec-title">{t('editor.ba.notes')}</div>
        {(['before', 'after'] as const).map((k) => (
          <div className="field" key={k}>
            <label htmlFor={`ba-n-${k}`}>{ba.labels[k] || t(`editor.ba.${k}`)}</label>
            <input
              id={`ba-n-${k}`}
              className="input input-sm"
              maxLength={BA_NOTE_MAX}
              disabled={readOnly}
              aria-describedby="ba-n-help"
              value={ba.notes[k]}
              onChange={(e) => set({ notes: { ...ba.notes, [k]: e.target.value } })}
            />
          </div>
        ))}
        <p className="help" id="ba-n-help">
          {t('editor.ba.notesHelp')}
        </p>
      </div>
      {picking && (
        <StepPicker
          editor={editor}
          current={step.id}
          onClose={() => setPicking(null)}
          onPick={(id) => {
            const side = picking;
            setPicking(null);
            void editor.setBeforeAfterImage(step.id, side, { stepId: id });
          }}
          title={picking === 'before' ? t('editor.ba.captureBefore') : t('editor.ba.captureAfter')}
        />
      )}
    </>
  );
}

/** Choix d'une étape (capture) de la démo : la capture et ses flous sont copiés. */
function StepPicker({
  editor,
  current,
  title,
  onPick,
  onClose,
}: {
  editor: DemoEditor;
  current: string;
  title: string;
  onPick: (stepId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const list = editor.steps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.id !== current && s.kind === 'image' && s.image_path);
  return (
    <dialog ref={ref} className="mk ba-picker" aria-labelledby="ba-pick-t" onClose={onClose}>
      <div className="modal-head">
        <h2 id="ba-pick-t">{t('editor.ba.pickTitle', { name: title })}</h2>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={t('common.close')}
          onClick={() => ref.current?.close()}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="modal-body">
        <p className="help">{t('editor.ba.pickHelp')}</p>
        <ul className="ba-pick-list">
          {list.map(({ s, i }) => (
            <li key={s.id}>
              <button type="button" onClick={() => onPick(s.id)}>
                <span className="ba-thumb">
                  {editor.imageUrls[s.image_path!] && <img src={editor.imageUrls[s.image_path!]} alt="" />}
                </span>
                <span>
                  <b>{t('editor.stepN', { n: i + 1 })}</b>
                  <small>{s.title || t('editor.untitled')}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
