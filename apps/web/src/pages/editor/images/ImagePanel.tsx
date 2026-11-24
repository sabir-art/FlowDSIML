import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { Checkbox, Slider, Switch } from '@flowdsiml/ui';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FolderOpen,
  ImagePlus,
  ImageUp,
  Info,
  Layers,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Menu } from '../../../components/Menu';
import { MediaLibrary } from '../../../components/media/MediaLibrary';
import { RectFields } from '../panels/RectFields';
import type { DemoEditor } from '../useDemoEditor';
import type { Selection, StepRow } from '../types';
import {
  LAYER_OPACITY,
  isFull,
  asLayers,
  fitRect,
  fractionRatio,
  layerName,
  layerOpacity,
  needsAlt,
  reorder,
  type ImageLayer,
} from './layers';
import { LAYER_ACCEPT, useLayerEdit, useLayerImport } from './useLayerActions';

/** Groupe de boutons radio : les flèches changent le choix et déplacent le focus (COMP-01). */
function radioKey(e: KeyboardEvent<HTMLElement>, count: number, i: number, pick: (n: number) => void) {
  const d =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? -1
        : 0;
  if (!d) return;
  e.preventDefault();
  e.stopPropagation();
  const n = (i + d + count) % count;
  pick(n);
  const group = e.currentTarget.parentElement;
  requestAnimationFrame(() => (group?.children[n] as HTMLElement | undefined)?.focus());
}

/**
 * Retours client du 24/11 §1 : panneau Image. La capture de l'étape (remplacer par un fichier, par un
 * fichier de la médiathèque, ou recadrer), puis les images ajoutées par-dessus (liste du dessus vers le
 * dessous) et les réglages de l'image choisie.
 */
export function ImagePanel({
  editor,
  step,
  wsId,
  readOnly,
  selection,
  setSelection,
  onImportCapture,
  onCaptureFile,
  onCrop,
  importRef,
  children,
}: {
  editor: DemoEditor;
  step: StepRow;
  wsId: string;
  readOnly: boolean;
  selection: Selection;
  setSelection: (s: Selection) => void;
  /** Ouvre le sélecteur de fichier qui remplace la capture. */
  onImportCapture: () => void;
  /** Remplace la capture par ce fichier (choisi dans la médiathèque). */
  onCaptureFile: (file: File) => void;
  onCrop: () => void;
  /** Import d'une image ajoutée, appelé par le dépôt d'un fichier sur le canevas. */
  importRef: MutableRefObject<((file: File) => void) | null>;
  /** Réglages de la capture propres à l'étape (onglet du navigateur). */
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const layers = asLayers(step.options);
  const sel = selection.kind === 'image' ? layers.find((l) => l.id === selection.id) : undefined;
  const picker = useRef<HTMLInputElement>(null);
  const [library, setLibrary] = useState<'capture' | 'layer' | null>(null);
  const act = useLayerEdit(editor, step, setSelection);
  const imp = useLayerImport(editor, step, wsId, setSelection);
  // Dépôt d'un fichier sur la capture (outil ouvert) : même import que le menu
  const importFile = imp.importFile;
  useEffect(() => {
    importRef.current = (f) => void importFile(f);
    return () => {
      importRef.current = null;
    };
  });
  const full = isFull(layers);
  const frameRatio = act.frameRatio;
  const captureUrl = step.image_path ? editor.imageUrls[step.image_path] : undefined;
  const fileName =
    (step.element_meta as { fileName?: string } | null)?.fileName?.trim() || t('editor.image.captureName');
  // Milliers groupés avec l'espace fine de la langue (« 1 100 »)
  const nf = new Intl.NumberFormat(i18n.language);
  const name = (l: ImageLayer) => layerName(l, t('editor.image.untitled'));

  const addItems = [
    { label: t('editor.image.import'), icon: <Upload />, onSelect: () => picker.current?.click() },
    { label: t('editor.image.fromMedia'), icon: <FolderOpen />, onSelect: () => setLibrary('layer') },
  ];

  return (
    <div className="imgp">
      <section className="sec imgp-sec" aria-labelledby="imgp-cap">
        <div className="sec-title" id="imgp-cap">
          {t('editor.image.capture')}
        </div>
        <div className="imgp-cap">
          <span className="imgp-cap__thumb">
            {captureUrl && <img src={captureUrl} alt="" draggable={false} />}
          </span>
          <div className="imgp-cap__text">
            <b title={fileName}>{fileName}</b>
            {step.image_width && step.image_height ? (
              <span className="muted">
                {`${nf.format(step.image_width)}\u00a0×\u00a0${nf.format(step.image_height)}`}
              </span>
            ) : null}
          </div>
          {!readOnly && (
            <Menu
              label={t('editor.image.replace')}
              trigger={{ icon: <ImageUp />, text: t('editor.image.replace') }}
              items={[
                { label: t('editor.image.import'), icon: <Upload />, onSelect: onImportCapture },
                {
                  label: t('editor.image.fromMedia'),
                  icon: <FolderOpen />,
                  onSelect: () => setLibrary('capture'),
                },
                { label: t('editor.image.crop'), icon: <Crop />, onSelect: onCrop },
              ]}
            />
          )}
        </div>
        {children}
      </section>

      <section className="sec imgp-sec" aria-labelledby="imgp-list">
        <div className="sec-title">
          <span id="imgp-list">
            {layers.length ? t('editor.image.addedN', { n: layers.length }) : t('editor.image.added')}
          </span>
          {!readOnly &&
            layers.length > 0 &&
            (full ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-disabled="true"
                aria-describedby="imgp-full"
              >
                <Plus aria-hidden="true" />
                {t('editor.image.add')}
              </button>
            ) : (
              <Menu
                label={t('editor.image.add')}
                trigger={{ icon: <Plus />, text: t('editor.image.add') }}
                items={addItems}
              />
            ))}
        </div>
        {layers.length === 0 ? (
          <div className="imgp-empty">
            <ImagePlus aria-hidden="true" />
            <p>{t('editor.image.empty')}</p>
            {!readOnly && (
              <Menu
                label={t('editor.image.addImage')}
                align="start"
                trigger={{ icon: <Plus />, text: t('editor.image.addImage') }}
                items={addItems}
              />
            )}
          </div>
        ) : (
          <ul className="imgp-list" data-gap-exempt="">
            {layers
              .slice()
              .reverse()
              .map((l) => {
                const i = layers.indexOf(l);
                const on = sel?.id === l.id;
                return (
                  <li key={l.id} className={`imgp-row${on ? ' is-on' : ''}${l.hidden ? ' is-off' : ''}`}>
                    <button
                      type="button"
                      className="imgp-row__main"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => setSelection({ kind: 'image', id: l.id })}
                    >
                      <span className="imgp-row__thumb">
                        {editor.imageUrls[l.path] && (
                          <img src={editor.imageUrls[l.path]} alt="" draggable={false} />
                        )}
                      </span>
                      <span className="imgp-row__name">{name(l)}</span>
                    </button>
                    <button
                      type="button"
                      className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                      aria-pressed={!!l.hidden}
                      aria-label={t('editor.image.hide', { name: name(l) })}
                      title={l.hidden ? t('editor.image.showTip') : t('editor.image.hideTip')}
                      disabled={readOnly}
                      onClick={() => act.patch(l, { hidden: l.hidden ? undefined : true })}
                    >
                      {l.hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                    {!readOnly && (
                      <Menu
                        label={t('editor.image.actionsFor', { name: name(l) })}
                        items={[
                          {
                            label: t('editor.image.up'),
                            icon: <ArrowUp />,
                            disabled: i === layers.length - 1,
                            onSelect: () => act.setLayers(reorder(layers, l.id, 1)),
                          },
                          {
                            label: t('editor.image.down'),
                            icon: <ArrowDown />,
                            disabled: i === 0,
                            onSelect: () => act.setLayers(reorder(layers, l.id, -1)),
                          },
                          {
                            label: t('editor.image.duplicate'),
                            icon: <Copy />,
                            disabled: full,
                            hint: full ? t('editor.image.full') : undefined,
                            onSelect: () => act.duplicate(l),
                          },
                          'separator' as const,
                          {
                            label: t('common.delete'),
                            icon: <Trash2 />,
                            danger: true,
                            onSelect: () => act.remove(l),
                          },
                        ]}
                      />
                    )}
                  </li>
                );
              })}
          </ul>
        )}
        {full && (
          <p className="help" id="imgp-full">
            {t('editor.image.full')}
          </p>
        )}
        {imp.busy && (
          <p className="help" role="status">
            {t('editor.image.adding')}
          </p>
        )}
      </section>

      {sel && (
        <section className="sec imgp-sec imgp-set" aria-labelledby="imgp-sel">
          <div className="sec-title">
            <span id="imgp-sel" className="imgp-set__name">
              {name(sel)}
            </span>
            {!readOnly && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                aria-label={t('editor.image.deleteImage')}
                title={t('editor.image.deleteImage')}
                onClick={() => act.remove(sel)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            )}
          </div>
          {/\.svg$/i.test(sel.name ?? '') && <p className="help imgp-svg">{t('editor.image.svgHelp')}</p>}
          <RectFields
            id="imgp-rect"
            rect={sel}
            disabled={readOnly}
            onChange={(r) =>
              act.patch(
                sel,
                fitRect(sel, r, sel.keep !== false ? fractionRatio(sel.ratio ?? 1, frameRatio) : null),
              )
            }
          />
          <Switch
            label={t('editor.image.keep')}
            checked={sel.keep !== false}
            disabled={readOnly}
            onChange={(e) => act.patch(sel, { keep: e.target.checked ? undefined : false })}
          />
          <div className="imgp-field">
            <span className="label" id="imgp-op">
              {t('editor.image.opacity')}{' '}
              <span className="muted">· {t('editor.image.percent', { n: layerOpacity(sel) })}</span>
            </span>
            <Slider
              min={LAYER_OPACITY.min}
              max={LAYER_OPACITY.max}
              step={LAYER_OPACITY.step}
              value={layerOpacity(sel)}
              disabled={readOnly}
              aria-labelledby="imgp-op"
              valueText={t('editor.image.percent', { n: layerOpacity(sel) })}
              onChange={(v) => act.patch(sel, { opacity: v === 100 ? undefined : v })}
            />
          </div>
          <div className="imgp-field">
            <span className="label" id="imgp-corners">
              {t('editor.image.corners')}
            </span>
            <div className="fd-segmented imgp-seg" role="radiogroup" aria-labelledby="imgp-corners">
              {([false, true] as const).map((rounded, i) => (
                <button
                  key={String(rounded)}
                  type="button"
                  role="radio"
                  aria-checked={!!sel.rounded === rounded}
                  tabIndex={!!sel.rounded === rounded ? 0 : -1}
                  disabled={readOnly}
                  onClick={() => act.patch(sel, { rounded: rounded || undefined })}
                  onKeyDown={(e) =>
                    radioKey(e, 2, i, (n) => act.patch(sel, { rounded: n === 1 || undefined }))
                  }
                >
                  {t(rounded ? 'editor.image.rounded' : 'editor.image.square')}
                </button>
              ))}
            </div>
          </div>
          <Switch
            label={t('editor.image.shadow')}
            checked={!!sel.shadow}
            disabled={readOnly}
            onChange={(e) => act.patch(sel, { shadow: e.target.checked || undefined })}
          />
          <div className="imgp-field">
            {!sel.decorative && (
              <div className="field">
                <label htmlFor="imgp-alt">{t('editor.image.alt')}</label>
                <textarea
                  id="imgp-alt"
                  className="input"
                  rows={2}
                  maxLength={300}
                  required
                  aria-required="true"
                  aria-describedby={needsAlt(sel) ? 'imgp-alt-help' : undefined}
                  disabled={readOnly}
                  value={sel.alt ?? ''}
                  onChange={(e) => act.patch(sel, { alt: e.target.value || undefined })}
                />
                {needsAlt(sel) && (
                  <span className="help" id="imgp-alt-help">
                    {t('editor.image.altHelp')}
                  </span>
                )}
              </div>
            )}
            <Checkbox
              label={t('editor.image.decorative')}
              checked={!!sel.decorative}
              disabled={readOnly}
              onChange={(e) => act.patch(sel, { decorative: e.target.checked || undefined })}
            />
          </div>
          <div className="blur-all">
            <Switch
              label={
                <>
                  <Layers aria-hidden="true" />
                  {t('editor.image.allSteps')}
                </>
              }
              checked={act.grouped(sel)}
              disabled={readOnly}
              onChange={(e) => act.setScope(sel, e.target.checked)}
            />
          </div>
          <p className="imgp-info">
            <Info aria-hidden="true" />
            <span>{t('editor.image.help')}</span>
          </p>
        </section>
      )}

      <input
        ref={picker}
        id="imgp-file"
        type="file"
        accept={LAYER_ACCEPT}
        /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié à son menu */
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void imp.importFile(f);
        }}
      />
      {library && (
        <MediaLibrary
          wsId={wsId}
          kind="image"
          destination={
            library === 'capture'
              ? t('editor.image.destCapture', { title: step.title || t('editor.untitled') })
              : t('editor.image.destLayer', { title: step.title || t('editor.untitled') })
          }
          onClose={() => setLibrary(null)}
          onPick={(f) => {
            const target = library;
            setLibrary(null);
            if (target === 'layer') void imp.addFromMedia(f);
            else void imp.mediaAsFile(f).then((file) => file && onCaptureFile(file));
          }}
        />
      )}
    </div>
  );
}
