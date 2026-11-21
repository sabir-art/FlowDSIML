import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ImagePlus, LayoutTemplate, Puzzle, WandSparkles, X } from 'lucide-react';
import type { ContentType } from '@flowdsiml/core';
import { CONTENT_TYPES } from '@flowdsiml/core';
import { aiBlock, useAiStatus } from '../../lib/ai';
import { useBlockText } from '../../components/ai/AiWrite';
import { Link } from 'react-router-dom';
import type { Tables } from '@flowdsiml/supabase-types';
import { IMAGE_ACCEPT } from './importImages';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { TypeBadge } from '../../components/TypeBadge';
import { EXTENSION_URL } from '../../lib/env';
import { useHtmlCapture } from '../../lib/htmlCapture';
import { HtmlCaptureNotice } from '../../components/HtmlCaptureNotice';

/**
 * DSH-06, L48-G §3 : « Nouvelle démo » en deux étapes.
 * 1. Type de contenu (Démo par captures, Démo HTML, Sandbox) : 3 cartes radio illustrées, sans points forts ; par défaut le
 *    dernier type choisi (user_metadata.content_type, que l'extension lit aussi pour préremplir html-review).
 * 2. Source, filtrée par type, en liste (icône, nom, phrase, chevron) : un clic ouvre la source.
 *    Extension (recommandé), images, modèle, IA ; démo vide (captures seulement) dans les actions.
 * Le dossier préremplit celui qui est filtré ; il s'applique à l'import, au modèle et à la démo vide.
 */
export function NewDemoDialog({
  open,
  folders,
  defaultFolder,
  onEmpty,
  onTemplate,
  onImport,
  onGenerate,
  onExtension,
  ws,
  onClose,
  initialType,
}: {
  open: boolean;
  folders: Tables<'folders'>[];
  defaultFolder: string | null;
  onEmpty: (folderId: string | null) => Promise<void> | void;
  /** L26-04 : « Partir d'un modèle ». */
  onTemplate: (folderId: string | null) => void;
  /** REV-06 : images choisies (au moins une). */
  onImport: (files: File[], folderId: string | null) => Promise<void> | void;
  /** L30-05 : « Générer avec l'IA ». */
  onGenerate: (folderId: string | null) => void;
  /** L48-G §3 : « Capturer avec l'extension » ouvre la fenêtre de l'extension (installation, lancement). */
  onExtension: () => void;
  ws: string;
  onClose: () => void;
  /** L48-G §4 : « Nouveau Sandbox » ouvre directement l'étape 2 avec ce type. */
  initialType?: ContentType;
}) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const extSoon = !EXTENSION_URL && !profile?.extension_seen_at;
  const ref = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const last = user?.user_metadata?.content_type as unknown;
  const remembered: ContentType = CONTENT_TYPES.includes(last as ContentType)
    ? (last as ContentType)
    : 'captures';
  // L49 P1 : captures HTML désactivées par un admin : Démo HTML et Sandbox visibles, désactivés, avec la raison
  const htmlCapture = useHtmlCapture(open ? ws : undefined);
  const htmlOff = htmlCapture.mode === 'disabled';
  const usable = (k: ContentType) => !htmlOff || k === 'captures';
  const firstType = (): ContentType => {
    const want = initialType ?? remembered;
    return usable(want) ? want : 'captures';
  };
  const [type, setType] = useState<ContentType>(initialType ?? remembered);
  const [step, setStep] = useState<1 | 2>(initialType ? 2 : 1);
  const [folder, setFolder] = useState<string>(defaultFolder ?? '');
  const [busy, setBusy] = useState(false);
  const { status: ai } = useAiStatus(open ? ws : undefined);
  const blockText = useBlockText();
  // Règle 4 : désactivée (espace, fonction, rôle) ; quota atteint : la carte reste active (message dans l'aperçu)
  const aiOff = aiBlock(ai, 'generate');
  const aiDisabled = aiOff === 'disabled' || aiOff === 'role';

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setFolder(defaultFolder ?? '');
      setType(firstType());
      setStep(initialType && usable(initialType) ? 2 : 1);
      d.showModal();
    } else if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- à l'ouverture seulement
  }, [open, defaultFolder]);

  /** Garde le type choisi (défaut suivant, préremplissage de l'extension) ; échec sans conséquence. */
  const next = () => {
    setStep(2);
    if (type !== last) void supabase.auth.updateUser({ data: { content_type: type } }).catch(() => undefined);
  };
  const onCardKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const list = CONTENT_TYPES.filter(usable);
    const i = list.indexOf(type);
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const n = list[(i + (fwd ? 1 : list.length - 1)) % list.length]!;
    setType(n);
    cards.current?.querySelector<HTMLInputElement>(`input[value="${n}"]`)?.focus();
  };

  return (
    <dialog ref={ref} className="dialog new-demo-dialog" onClose={onClose} aria-labelledby="nd-title nd-step">
      <div className="nd-head">
        <div className="nd-titles">
          <h2 id="nd-title">
            {step === 1 ? t('demos.newTitle') : t(`ctype.newTitle.${type}`)}
            {step === 2 && <TypeBadge type={type} />}
          </h2>
          <p id="nd-step" className="nd-step">
            {t('ctype.stepOf', { n: step, total: 2 })} · {step === 1 ? t('ctype.step1') : t('ctype.step2')}
          </p>
        </div>
        <button
          type="button"
          className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      {step === 1 ? (
        <>
          <fieldset className="nd-types">
            <legend className="nd-legend">{t('ctype.question')}</legend>
            <div ref={cards} className="nd-types__grid">
              {CONTENT_TYPES.map((k) => (
                <label
                  key={k}
                  className={`nd-type${type === k ? ' is-selected' : ''}${usable(k) ? '' : ' is-off'}`}
                >
                  <input
                    type="radio"
                    name="nd-type"
                    value={k}
                    checked={type === k}
                    disabled={!usable(k)}
                    aria-describedby={usable(k) ? undefined : `nd-off-${k}`}
                    onChange={() => setType(k)}
                    onKeyDown={onCardKey}
                  />
                  <TypeArt type={k} />
                  <span className="nd-type__txt">
                    <b>{t(`ctype.name.${k}`)}</b>
                    <span>{t(`ctype.line.${k}`)}</span>
                    {!usable(k) && (
                      <span className="nd-type__off" id={`nd-off-${k}`}>
                        {t('htmlCapture.blockedByAdmin')}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="dialog-actions nd-actions">
            <p className="nd-next">{t('ctype.nextHint')}</p>
            <span className="grow" />
            <button type="button" className="fd-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="fd-btn fd-btn--primary" onClick={next}>
              {t('common.continue')}
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="nd-sources" aria-label={t('ctype.step2')}>
            <li>
              {extSoon ? (
                // §18.4 : extension pas encore publiée : source visible, désactivée, « Bientôt »
                <div className="nd-src is-soon" aria-disabled="true">
                  <Puzzle aria-hidden="true" />
                  <span className="nd-src__txt">
                    <b>{t('demos.newExtension')}</b>
                    <span>{t('extension.soonBody')}</span>
                  </span>
                  <span className="nd-src__soon">{t('shell.soon')}</span>
                </div>
              ) : (
                <button type="button" className="nd-src" onClick={onExtension}>
                  <Puzzle aria-hidden="true" />
                  <span className="nd-src__txt">
                    <b>{t('demos.newExtension')}</b>
                    <span>
                      {type === 'captures' ? t('demos.newExtensionBody') : t(`ctype.extensionBody.${type}`)}
                    </span>
                  </span>
                  <ChevronRight className="nd-src__go" aria-hidden="true" />
                </button>
              )}
            </li>
            {type === 'captures' && (
              <li>
                <button
                  type="button"
                  className="nd-src"
                  disabled={busy}
                  onClick={() => picker.current?.click()}
                >
                  <ImagePlus aria-hidden="true" />
                  <span className="nd-src__txt">
                    <b>{t('demos.newImport')}</b>
                    <span>{t('demos.newImportBody')}</span>
                  </span>
                  <ChevronRight className="nd-src__go" aria-hidden="true" />
                </button>
                <input
                  ref={picker}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  hidden
                  aria-label={t('demos.newImport')}
                  onChange={async (e) => {
                    const files = [...(e.target.files ?? [])];
                    e.target.value = '';
                    if (!files.length) return;
                    setBusy(true);
                    try {
                      await onImport(files, folder || null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </li>
            )}
            <li>
              {type === 'captures' ? (
                <button type="button" className="nd-src" onClick={() => onTemplate(folder || null)}>
                  <LayoutTemplate aria-hidden="true" />
                  <span className="nd-src__txt">
                    <b>{t('templates.title')}</b>
                    <span>{t('templates.cardBody')}</span>
                  </span>
                  <ChevronRight className="nd-src__go" aria-hidden="true" />
                </button>
              ) : (
                // Aucun modèle HTML ni Sandbox pour l'instant : visible, désactivé, « Bientôt » en texte
                <div className="nd-src is-soon" aria-disabled="true">
                  <LayoutTemplate aria-hidden="true" />
                  <span className="nd-src__txt">
                    <b>{t('templates.title')}</b>
                    <span>{t(`ctype.noTemplate.${type}`)}</span>
                  </span>
                  <span className="nd-src__soon">{t('shell.soon')}</span>
                </div>
              )}
            </li>
            {type === 'captures' && (
              <li className="ai-disabled-wrap nd-ai">
                <button
                  type="button"
                  className="nd-src ai-entry"
                  aria-disabled={aiDisabled || undefined}
                  aria-describedby={aiDisabled ? 'nd-ai-tip' : undefined}
                  onClick={() => !aiDisabled && onGenerate(folder || null)}
                >
                  <WandSparkles aria-hidden="true" />
                  <span className="nd-src__txt">
                    <b>{t('ai.generate.card')}</b>
                    <span>{t('ai.generate.cardBody')}</span>
                  </span>
                  <ChevronRight className="nd-src__go" aria-hidden="true" />
                </button>
                {aiDisabled && (
                  <span id="nd-ai-tip" className="ai-tip" role="tooltip">
                    {blockText(aiOff, ai)}
                  </span>
                )}
                {aiDisabled && aiOff === 'disabled' && ai?.canManage && (
                  <Link className="t-caption" to="/settings/ai">
                    {t('ai.disabledAdmin')}
                  </Link>
                )}
              </li>
            )}
          </ul>
          {/* L49 §6 : mention d'autorisation pour les types HTML et Sandbox */}
          {type !== 'captures' && <HtmlCaptureNotice className="nd-notice" />}
          <label className="fd-field nd-folder">
            <span className="fd-label">{t('demos.colFolder')}</span>
            <select className="fd-input" value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">{t('demos.noFolder')}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="dialog-actions nd-actions">
            <button type="button" className="fd-btn" onClick={() => setStep(1)}>
              {t('common.back')}
            </button>
            {type === 'captures' && (
              <button
                type="button"
                className="fd-btn fd-btn--ghost nd-empty"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onEmpty(folder || null);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('demos.newEmpty')}
              </button>
            )}
            <span className="grow" />
            <button type="button" className="fd-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

/** Illustration schématique 16:9 (tokens, aucune capture réelle), décorative. */
function TypeArt({ type }: { type: ContentType }) {
  return (
    <svg className="nd-art" viewBox="0 0 160 90" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="158" height="88" rx="8" className="nd-art__bg" />
      {type === 'captures' && (
        <>
          <rect x="14" y="14" width="96" height="62" rx="4" className="nd-art__card" />
          <rect x="22" y="22" width="40" height="6" rx="3" className="nd-art__line" />
          <rect x="22" y="34" width="70" height="4" rx="2" className="nd-art__line" />
          <rect x="22" y="42" width="56" height="4" rx="2" className="nd-art__line" />
          <circle cx="86" cy="58" r="6" className="nd-art__dot" />
          <rect x="96" y="44" width="52" height="22" rx="5" className="nd-art__bubble" />
          <rect x="102" y="51" width="38" height="3" rx="1.5" className="nd-art__on" />
          <rect x="102" y="57" width="26" height="3" rx="1.5" className="nd-art__on" />
        </>
      )}
      {type === 'html' && (
        <>
          <rect x="14" y="14" width="132" height="62" rx="4" className="nd-art__card" />
          <rect x="14" y="14" width="132" height="10" rx="4" className="nd-art__line" />
          <path d="M30 42 l-8 8 l8 8 M50 42 l8 8 l-8 8" className="nd-art__stroke" />
          <rect x="70" y="40" width="60" height="5" rx="2.5" className="nd-art__line" />
          <rect x="70" y="50" width="44" height="5" rx="2.5" className="nd-art__dash" />
          <rect x="70" y="60" width="52" height="5" rx="2.5" className="nd-art__line" />
        </>
      )}
      {type === 'sandbox' && (
        <>
          <path d="M44 30 L80 52 M116 30 L80 52 M44 30 L116 30 M80 52 L80 66" className="nd-art__stroke" />
          <rect x="22" y="18" width="44" height="24" rx="4" className="nd-art__card" />
          <rect x="94" y="18" width="44" height="24" rx="4" className="nd-art__card" />
          <rect x="58" y="48" width="44" height="26" rx="4" className="nd-art__card nd-art__card--on" />
          <circle cx="80" cy="61" r="4" className="nd-art__dot" />
        </>
      )}
    </svg>
  );
}
