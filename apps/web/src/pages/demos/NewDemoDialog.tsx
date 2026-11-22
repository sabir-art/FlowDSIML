import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight, ImagePlus, LayoutTemplate, Plus, Puzzle, WandSparkles } from 'lucide-react';
import type { ContentType } from '@flowdsiml/core';
import { CONTENT_TYPES } from '@flowdsiml/core';
import { aiBlock, useAiStatus } from '../../lib/ai';
import { useBlockText } from '../../components/ai/AiWrite';
import { Link } from 'react-router-dom';
import type { Tables } from '@flowdsiml/supabase-types';
import { IMAGE_ACCEPT } from './importImages';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { TYPE_ICON } from '../../components/TypeBadge';
import { EXTENSION_URL } from '../../lib/env';
import { useHtmlCapture } from '../../lib/htmlCapture';
import { HtmlCaptureNotice } from '../../components/HtmlCaptureNotice';
import { Modal, Select } from '@flowdsiml/ui';

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
  const picker = useRef<HTMLInputElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const last = user?.user_metadata?.content_type as unknown;
  const remembered: ContentType = CONTENT_TYPES.includes(last as ContentType)
    ? (last as ContentType)
    : 'captures';
  // L49 P1 : captures HTML désactivées par un admin : Démo HTML et Sandbox visibles, désactivés, avec la raison
  const htmlCapture = useHtmlCapture(ws);
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
  /** Assistance IA coupée et réglable par ce membre : « Ouvrir le réglage » à droite de la ligne. */
  const aiLink = aiDisabled && aiOff === 'disabled' && !!ai?.canManage;

  useEffect(() => {
    if (!open) return;
    setFolder(defaultFolder ?? '');
    setType(firstType());
    setStep(initialType && usable(initialType) ? 2 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- à l'ouverture seulement
  }, [open, defaultFolder]);

  // Réglage lu après l'ouverture : un type devenu indisponible repasse sur « Démo par captures »
  useEffect(() => {
    if (usable(type)) return;
    setType('captures');
    setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- usable dépend seulement de htmlOff
  }, [htmlOff, type]);

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

  const emptyBtn = type === 'captures' && (
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
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      className="new-demo-dialog"
      icon={<Plus />}
      title={step === 1 ? t('demos.newTitle') : t(`ctype.newTitle.${type}`)}
      subtitle={
        <>
          {t('ctype.stepOf', { n: step, total: 2 })} · {step === 1 ? t('ctype.step1') : t('ctype.step2')}
        </>
      }
      closeLabel={t('common.close')}
      footerLead={step === 1 ? t('ctype.nextHint') : undefined}
      footer={
        step === 1 ? (
          <>
            <button type="button" className="fd-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="fd-btn fd-btn--primary" onClick={next}>
              {t('common.continue')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="fd-btn nd-back" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden="true" />
              {t('common.back')}
            </button>
            {emptyBtn}
            <button type="button" className="fd-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </>
        )
      }
    >
      {step === 1 ? (
        <fieldset className="nd-types">
          <legend className="nd-legend">{t('ctype.question')}</legend>
          {/* MODAL-01 : un choix par ligne (tuile, nom, phrase, bouton radio) ; l'écart est porté par la grille */}
          <div ref={cards} className="nd-types__grid" data-gap-exempt="">
            {CONTENT_TYPES.map((k) => {
              const Icon = TYPE_ICON[k];
              return (
                <label
                  key={k}
                  className={`nd-type${type === k ? ' is-selected' : ''}${usable(k) ? '' : ' is-off'}`}
                >
                  <span className="nd-type__tile" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="nd-type__txt">
                    <b>{t(`ctype.name.${k}`)}</b>
                    <span>{t(`ctype.line.${k}`)}</span>
                    {!usable(k) && (
                      <span className="nd-type__off" id={`nd-off-${k}`}>
                        {t('htmlCapture.blockedByAdmin')}
                      </span>
                    )}
                  </span>
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
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <>
          <ul className="nd-sources" aria-label={t('ctype.step2')}>
            <li>
              {extSoon ? (
                // §18.4 : extension pas encore publiée : source visible, désactivée, « Bientôt »
                <div className="nd-src is-soon" aria-disabled="true">
                  <span className="nd-src__tile" aria-hidden="true">
                    <Puzzle />
                  </span>
                  <span className="nd-src__txt">
                    <b>{t('demos.newExtension')}</b>
                    <span>{t('extension.soonBody')}</span>
                  </span>
                  <span className="nd-src__soon">{t('shell.soon')}</span>
                </div>
              ) : (
                <button type="button" className="nd-src" onClick={onExtension}>
                  <span className="nd-src__tile" aria-hidden="true">
                    <Puzzle />
                  </span>
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
                  aria-controls="newdemodialog-file"
                  onClick={() => picker.current?.click()}
                >
                  <span className="nd-src__tile" aria-hidden="true">
                    <ImagePlus />
                  </span>
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
                  /* COMP-01 §5 : le champ reste dans la page, masqué à l'œil et relié à son bouton */
                  id="newdemodialog-file"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
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
                  <span className="nd-src__tile" aria-hidden="true">
                    <LayoutTemplate />
                  </span>
                  <span className="nd-src__txt">
                    <b>{t('templates.title')}</b>
                    <span>{t('templates.cardBody')}</span>
                  </span>
                  <ChevronRight className="nd-src__go" aria-hidden="true" />
                </button>
              ) : (
                // Aucun modèle HTML ni Sandbox pour l'instant : visible, désactivé, « Bientôt » en texte
                <div className="nd-src is-soon" aria-disabled="true">
                  <span className="nd-src__tile" aria-hidden="true">
                    <LayoutTemplate />
                  </span>
                  <span className="nd-src__txt">
                    <b>{t('templates.title')}</b>
                    <span>{t(`ctype.noTemplate.${type}`)}</span>
                  </span>
                  <span className="nd-src__soon">{t('shell.soon')}</span>
                </div>
              )}
            </li>
            {type === 'captures' && (
              <li className="nd-ai">
                <button
                  type="button"
                  className="nd-src ai-entry"
                  aria-disabled={aiDisabled || undefined}
                  aria-describedby={aiDisabled ? 'nd-ai-why' : undefined}
                  onClick={() => !aiDisabled && onGenerate(folder || null)}
                >
                  <span className="nd-src__tile" aria-hidden="true">
                    <WandSparkles />
                  </span>
                  <span className="nd-src__txt">
                    <b>{t('ai.generate.card')}</b>
                    <span>{t('ai.generate.cardBody')}</span>
                    {/* Recette UX (E1) : la raison est écrite sous l'aide, pas dans une infobulle ; avec
                        « Ouvrir le réglage » à droite, elle reste lue mais n'est pas affichée */}
                    {aiDisabled && (
                      <span className={aiLink ? 'sr-only' : 'nd-src__why'} id="nd-ai-why">
                        {blockText(aiOff, ai)}
                      </span>
                    )}
                  </span>
                  {/* Ligne désactivée : pas de chevron, comme les lignes « Bientôt » */}
                  {!aiDisabled && <ChevronRight className="nd-src__go" aria-hidden="true" />}
                </button>
                {aiLink && (
                  <Link className="fd-btn fd-btn--ghost fd-btn--sm nd-ai__link" to="/settings/ai">
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
            <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">{t('demos.noFolder')}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </label>
        </>
      )}
    </Modal>
  );
}
