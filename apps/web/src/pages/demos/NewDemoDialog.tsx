import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ChevronRight,
  FilePlus2,
  ImagePlus,
  LayoutTemplate,
  Plus,
  Puzzle,
  WandSparkles,
} from 'lucide-react';
import type { ContentType } from '@flowdsiml/core';
import { CONTENT_TYPES } from '@flowdsiml/core';
import { aiBlock, useAiStatus } from '../../lib/ai';
import { useBlockText } from '../../components/ai/AiWrite';
import { Link } from 'react-router-dom';
import type { Tables } from '@flowdsiml/supabase-types';
import { IMAGE_ACCEPT, orderImages } from './importImages';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { TYPE_ICON } from '../../components/TypeBadge';
import { EXTENSION_URL } from '../../lib/env';
import { useHtmlCapture } from '../../lib/htmlCapture';
import { HtmlCaptureNotice } from '../../components/HtmlCaptureNotice';
import { Modal, Select } from '@flowdsiml/ui';
import { useConfirm } from '../../components/ConfirmDialog';
import { VideoImportZone, type VideoImportHandle } from './VideoImportZone';
import { FileDropzone } from '../../components/FileDropzone';

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
  onVideo,
  ws,
  onClose,
  initialType,
  initialFiles,
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
  /** EXT-02 §4.1 bis : vidéo importée, démo créée. */
  onVideo: (demoId: string) => void;
  ws: string;
  onClose: () => void;
  /** L48-G §4 : « Nouveau Sandbox » ouvre directement l'étape 2 avec ce type. */
  initialType?: ContentType;
  /** MEDIA-01 §18.3 : images déposées sur la liste des Démos ; la fenêtre s'ouvre déjà remplie. */
  initialFiles?: File[];
}) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const extSoon = !EXTENSION_URL && !profile?.extension_seen_at;
  const cards = useRef<HTMLDivElement>(null);
  const last = user?.user_metadata?.content_type as unknown;
  const remembered: ContentType = CONTENT_TYPES.includes(last as ContentType)
    ? (last as ContentType)
    : 'captures';
  // L49 P1 : captures HTML désactivées par un admin : Démo HTML et Sandbox visibles, désactivés, avec la raison
  const htmlCapture = useHtmlCapture(ws);
  const htmlOff = htmlCapture.mode === 'disabled';
  // La vidéo n'est pas une capture HTML : le réglage ne la concerne pas
  const usable = (k: ContentType) => !htmlOff || k === 'captures' || k === 'video';
  const firstType = (): ContentType => {
    const want = initialType ?? remembered;
    return usable(want) ? want : 'captures';
  };
  const [type, setType] = useState<ContentType>(initialType ?? remembered);
  const [step, setStep] = useState<1 | 2>(initialType ? 2 : 1);
  const [folder, setFolder] = useState<string>(defaultFolder ?? '');
  const [busy, setBusy] = useState(false);
  // Images choisies ou déposées : la démo n'est créée qu'avec « Créer la démo »
  const [images, setImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const pickImages = (list: File[]) => {
    const kept = orderImages(list);
    setImageError(kept.length ? null : t('demos.newImportBadType'));
    if (kept.length) setImages(kept);
  };
  const createFromImages = async () => {
    setBusy(true);
    try {
      await onImport(images, folder || null);
    } finally {
      setBusy(false);
    }
  };
  // Import vidéo en cours : quitter la fenêtre ou l'étape demande confirmation
  const [sending, setSending] = useState(false);
  const video = useRef<VideoImportHandle>(null);
  const [confirmDialog, ask] = useConfirm();
  const leave = async (then: () => void) => {
    if (sending) {
      const ok = await ask({
        title: t('videoImport.stopTitle'),
        body: t('videoImport.stopBody'),
        confirmLabel: t('videoImport.stopConfirm'),
        secondary: { label: t('videoImport.stopCancel'), onSelect: () => undefined },
        danger: true,
      });
      if (!ok) return;
      video.current?.stop();
    }
    then();
  };
  const { status: ai } = useAiStatus(open ? ws : undefined);
  const blockText = useBlockText();
  // Règle 4 : désactivée (espace, fonction, rôle) ; quota atteint : la carte reste active (message dans l'aperçu)
  const aiOff = aiBlock(ai, 'generate');
  const aiDisabled = aiOff === 'disabled' || aiOff === 'role' || aiOff === 'unavailable';
  /** Assistance IA coupée et réglable par ce membre : « Ouvrir le réglage » à droite de la ligne. */
  const aiLink = aiDisabled && aiOff === 'disabled' && !!ai?.canManage;

  useEffect(() => {
    if (!open) return;
    setFolder(defaultFolder ?? '');
    const dropped = orderImages(initialFiles ?? []);
    setImages(dropped);
    setImageError(null);
    // Images déposées sur la page : type « Démo par captures », étape 2 déjà remplie
    setType(dropped.length ? 'captures' : firstType());
    setStep(dropped.length || (initialType && usable(initialType)) ? 2 : 1);
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

  const createEmpty = async () => {
    setBusy(true);
    try {
      await onEmpty(folder || null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        onDismiss={sending ? () => void leave(onClose) : undefined}
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
              <button type="button" className="fd-btn nd-back" onClick={() => void leave(() => setStep(1))}>
                <ArrowLeft aria-hidden="true" />
                {t('common.back')}
              </button>
              <button type="button" className="fd-btn" onClick={() => void leave(onClose)}>
                {t('common.cancel')}
              </button>
              {type === 'captures' && images.length > 0 && (
                <button
                  type="button"
                  className="fd-btn fd-btn--primary"
                  disabled={busy}
                  onClick={() => void createFromImages()}
                >
                  {t('demos.newImportCreate')}
                </button>
              )}
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
        ) : type === 'video' ? (
          <>
            <ul className="nd-sources" aria-label={t('ctype.step2')}>
              <li>
                {extSoon ? (
                  <div className="nd-src is-soon" aria-disabled="true">
                    <span className="nd-src__tile" aria-hidden="true">
                      <Puzzle />
                    </span>
                    <span className="nd-src__txt">
                      <b>{t('videoImport.extensionTitle')}</b>
                      <span>{t('extension.soonBody')}</span>
                    </span>
                    <span className="nd-src__soon">{t('shell.soon')}</span>
                  </div>
                ) : (
                  <button type="button" className="nd-src" onClick={() => void leave(onExtension)}>
                    <span className="nd-src__tile" aria-hidden="true">
                      <Puzzle />
                    </span>
                    <span className="nd-src__txt">
                      <b>{t('videoImport.extensionTitle')}</b>
                      <span>{t('videoImport.extensionBody')}</span>
                    </span>
                    <ChevronRight className="nd-src__go" aria-hidden="true" />
                  </button>
                )}
              </li>
            </ul>
            <p className="nd-or">
              <span>{t('videoImport.or')}</span>
            </p>
            <VideoImportZone
              ws={ws}
              userId={user?.id ?? ''}
              folderId={folder || null}
              onBusy={setSending}
              onStopRequest={() => void leave(() => undefined)}
              onCreated={onVideo}
              handle={video}
            />
            <label className="fd-field nd-folder">
              <span className="fd-label">{t('demos.colFolder')}</span>
              <Select value={folder} disabled={sending} onChange={(e) => setFolder(e.target.value)}>
                <option value="">{t('demos.noFolder')}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </label>
          </>
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
                // MEDIA-01 §18.3 : zone large dans la carte de choix ; plusieurs images, compteur après dépôt
                <li className="nd-zone">
                  <FileDropzone
                    label={t('demos.newImport')}
                    inputId="newdemodialog-file"
                    accept={IMAGE_ACCEPT}
                    multiple
                    icon={<ImagePlus />}
                    title={t('demos.newImport')}
                    hint={t('demos.newImportBody')}
                    pickLabel={t('demos.newImportPick')}
                    file={
                      images.length
                        ? {
                            name: t('demos.newImportCount', { count: images.length }),
                            meta: images.map((f) => f.name).join(', '),
                          }
                        : null
                    }
                    busy={busy && images.length > 0}
                    busyLabel={t('demos.newImportSending')}
                    error={imageError}
                    onFiles={pickImages}
                    onRemove={() => setImages([])}
                    removeLabel={t('demos.newImportRemove')}
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
              {type === 'captures' && !images.length && (
                // Retours client du 24/11 §7 : dernière ligne des sources, comme les autres choix
                <li>
                  <button
                    type="button"
                    className="nd-src nd-empty"
                    disabled={busy}
                    onClick={() => void createEmpty()}
                  >
                    <span className="nd-src__tile" aria-hidden="true">
                      <FilePlus2 />
                    </span>
                    <span className="nd-src__txt">
                      <b>{t('demos.newEmpty')}</b>
                      <span>{t('demos.newEmptyBody')}</span>
                    </span>
                    <ChevronRight className="nd-src__go" aria-hidden="true" />
                  </button>
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
      {confirmDialog}
    </>
  );
}
