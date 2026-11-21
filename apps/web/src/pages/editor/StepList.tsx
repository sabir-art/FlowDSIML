import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { branchOf } from './branch';
import { condRules, missingDest } from './rules';
import type { ChoiceAction } from '@flowdsiml/manifest';
import { stepTab, tabChanged } from './capture/tabs';
import { asCrop, cropImageStyle, outOfFrame } from '@flowdsiml/player-core';
import { asVideo } from './video/videoModel';
import type { PresencePayload } from './presence/presence';
import { RailWho } from './presence/PresenceUI';
import {
  TriangleAlert,
  PanelsTopLeft,
  ArrowDown,
  AudioLines,
  ArrowUp,
  ClipboardList,
  Code,
  Droplet,
  Camera,
  Flag,
  CornerDownRight,
  GitBranch,
  GraduationCap,
  GripVertical,
  ImageOff,
  ImagePlus,
  Layers,
  MessageCircle,
  MessageSquare,
  MousePointerClick,
  Play,
  Plus,
  Target,
  Type,
  ZoomIn,
} from 'lucide-react';
import { Menu, type MenuItem } from '../../components/Menu';
import { asSettings, asStepOptions, type StepRow } from './types';
import { Fragment, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/Toast';
import type { DemoEditor } from './useDemoEditor';
import { Status } from '@flowdsiml/ui';

export function StepList({
  editor,
  current,
  onSelect,
  readOnly,
  openComments = {},
  findHits,
  selectedFormId = null,
  onSelectForm,
  presence = {},
  presenceNames = {},
}: {
  editor: DemoEditor;
  current: number;
  onSelect: (i: number) => void;
  /** EDT-08 : formulaire sélectionné dans le rail. */
  selectedFormId?: string | null;
  onSelectForm?: (stepIndex: number, formId: string) => void;
  readOnly: boolean;
  /** Nombre de commentaires ouverts par étape (badge du rail). */
  openComments?: Record<string, number>;
  /** L12-04 : nombre de résultats de recherche par index d'étape (pastille orange). */
  findHits?: Record<number, number>;
  /** L22-08 : personnes présentes par étape (avatars sur la vignette). */
  presence?: Record<string, PresencePayload[]>;
  presenceNames?: Record<string, string>;
}) {
  const toast = useToast();
  const { t } = useTranslation();
  /** L25-10 : destination d'une règle de suite dans le rail. */
  const railDest = (a: ChoiceAction, from: number) => {
    if (missingDest(a)) return '?';
    if (a.type === 'next') return String(from + 2);
    if (a.type === 'goto') return String(editor.steps.findIndex((x) => x.id === a.stepId) + 1 || '?');
    if (a.type === 'chapter') return editor.chapters.find((c) => c.id === a.chapterId)?.title || '?';
    return a.type === 'end' ? t('editor.rules.railEnd') : t('editor.rules.railUrl');
  };
  const { current: ws } = useWorkspace();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const chapterTitle = (id: string | null) => editor.chapters.find((c) => c.id === id)?.title;

  const addItems: Array<MenuItem | 'separator'> = [
    // EDT-03 : ordre et libellés de la maquette
    {
      label: t('editor.add.capture'),
      icon: <MousePointerClick />,
      disabled: true,
      end: <Status size="sm">{t('shell.soon')}</Status>,
      onSelect: () => {},
    },
    { label: t('editor.add.image'), icon: <ImagePlus />, onSelect: () => file.current?.click() },
    {
      label: t('editor.addTextStep'),
      icon: <Type />,
      onSelect: () =>
        void editor.addTextStep(current, t('editor.newTextStep')).then(() => onSelect(current + 1)),
    },
    {
      label: t('editor.add.popup'),
      icon: <MessageCircle />,
      onSelect: () =>
        void editor
          .addTextStep(current, t('editor.advanced.stepTypes.popup'), { display: 'popup' })
          .then(() => onSelect(current + 1)),
    },
    {
      label: t('editor.advanced.stepTypes.choice'),
      icon: <GitBranch />,
      onSelect: () =>
        void editor
          .addTextStep(current, t('editor.advanced.choice.question'), {
            display: 'popup',
            choices: [1, 2].map((n) => ({
              label: t('editor.advanced.choice.option', { n }),
              action: { type: 'end' as const },
            })),
          })
          .then(() => onSelect(current + 1)),
    },
    // L17-02 : étape Avant / Après (captures choisies ensuite dans le panneau)
    {
      label: t('editor.add.beforeAfter'),
      icon: <Layers />,
      onSelect: () =>
        void editor.addBeforeAfterStep(current, t('editor.ba.newTitle')).then(() => onSelect(current + 1)),
    },
    'separator',
    // EDT-08 : le formulaire de lead se place avant l'étape courante (un seul formulaire par démo)
    {
      label: t('editor.add.form'),
      icon: <ClipboardList />,
      onSelect: () =>
        void (async () => {
          const target = editor.steps[current];
          if (!target) return;
          const form = editor.forms[0] ?? (await editor.createForm(ws?.name ?? ''));
          if (!form) return;
          await placeForm(form.id, current);
          onSelectForm?.(current, form.id);
        })(),
    },
  ];

  // EDT-04 : au clavier, le focus suit les flèches ; Espace « saisit » l'étape, les flèches la
  // déplacent, Espace la pose, Échap la repose.
  const [grabbed, setGrabbed] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const focusStep = (i: number) =>
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLButtonElement>(`[data-step-index="${i}"]`)?.focus(),
    );
  function onRailKey(e: React.KeyboardEvent, i: number) {
    const n = editor.steps.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const to = Math.min(n - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
      if (to === i) return;
      if (grabbed !== null && !readOnly) {
        void editor.moveStep(i, to).then(() => {
          setGrabbed(to);
          onSelect(to);
          focusStep(to);
          setAnnounce(t('editor.stepMove.moved', { n: to + 1, total: n }));
        });
      } else {
        onSelect(to);
        focusStep(to);
      }
    } else if (e.key === ' ' && !readOnly) {
      e.preventDefault();
      e.stopPropagation();
      if (grabbed === null) {
        setGrabbed(i);
        setAnnounce(t('editor.stepMove.grabbed', { n: i + 1 }));
      } else {
        setGrabbed(null);
        setAnnounce(t('editor.stepMove.dropped', { n: i + 1 }));
      }
    } else if (e.key === 'Escape' && grabbed !== null) {
      e.preventDefault();
      e.stopPropagation();
      setGrabbed(null);
      setAnnounce(t('editor.stepMove.dropped', { n: i + 1 }));
    }
  }

  /** Déplacer le formulaire dans le rail = changer l'étape qu'il précède. */
  async function placeForm(formId: string, to: number) {
    const target = editor.steps[to];
    if (!target) return;
    for (const s of editor.steps)
      if (s.gate_form_id === formId && s.id !== target.id) editor.updateStep(s.id, { gate_form_id: null });
    if (target.gate_form_id !== formId) editor.updateStep(target.id, { gate_form_id: formId });
  }

  return (
    <>
      <div className="rail-head">
        <b className="t-label">
          {t('editor.steps')} <span className="subtle">· {editor.steps.length}</span>
        </b>
        {!readOnly && <Menu label={t('editor.addStep')} align="start" icon={<Plus />} items={addItems} />}
      </div>
      <span className="sr-only" aria-live="assertive">
        {announce}
      </span>
      <ol className="rail-list" aria-label={t('editor.railLabel')} ref={listRef}>
        {editor.steps.map((s, i) => {
          // F7 : vignette d'une étape vidéo = image de sa première pause, sinon icône de lecture
          const firstFrame = s.kind === 'video' ? Object.values(asVideo(s.video).frames)[0] : undefined;
          const thumbPath = s.image_path ?? firstFrame;
          const url = thumbPath ? editor.imageUrls[thumbPath] : undefined;
          const chapter = chapterTitle(s.chapter_id);
          const showChapter = chapter && chapterTitle(editor.steps[i - 1]?.chapter_id ?? null) !== chapter;
          const form = s.gate_form_id ? editor.forms.find((f) => f.id === s.gate_form_id) : undefined;
          const formSelected = !!form && selectedFormId === form.id;
          return (
            <Fragment key={s.id}>
              {form && (
                <li key={`f-${form.id}`} className="rail-li rail-li--form">
                  <button
                    type="button"
                    className="step step--form"
                    aria-current={formSelected ? 'step' : undefined}
                    onClick={() => onSelectForm?.(i, form.id)}
                  >
                    <span className="n" aria-hidden="true" />
                    <span className="th th--form" aria-hidden="true">
                      <ClipboardList />
                    </span>
                    <span className="meta">
                      <b>{form.title || t('editor.leadForm')}</b>
                      <span className="icons">{t('editor.form.beforeStep', { n: i + 1 })}</span>
                    </span>
                  </button>
                  {!readOnly && (
                    <span className="rail-move">
                      <button
                        type="button"
                        aria-label={t('editor.form.moveUp')}
                        disabled={i === 0}
                        onClick={() =>
                          void placeForm(form.id, i - 1).then(() => onSelectForm?.(i - 1, form.id))
                        }
                      >
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('editor.form.moveDown')}
                        disabled={i === editor.steps.length - 1}
                        onClick={() =>
                          void placeForm(form.id, i + 1).then(() => onSelectForm?.(i + 1, form.id))
                        }
                      >
                        <ArrowDown aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </li>
              )}
              <li
                draggable={!readOnly}
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(i);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null && dragFrom !== i) {
                    void editor.moveStep(dragFrom, i);
                    onSelect(i);
                  }
                  setDragFrom(null);
                  setOver(null);
                }}
                className="rail-li"
              >
                {showChapter && <div className="rail-chapter">{chapter}</div>}
                {over === i && dragFrom !== null && dragFrom !== i && (
                  <div className="insert" aria-hidden="true" />
                )}
                <button
                  type="button"
                  className={`step${grabbed === i ? ' is-grabbed' : ''}`}
                  aria-current={i === current && !selectedFormId ? 'step' : undefined}
                  data-step-index={i}
                  onClick={() => onSelect(i)}
                  onKeyDown={(e) => onRailKey(e, i)}
                >
                  {!readOnly && (
                    <span className="grip" aria-hidden="true">
                      <GripVertical />
                    </span>
                  )}
                  <span className="n">{i + 1}</span>
                  <span className="th">
                    {url ? (
                      <>
                        {/* L25-02 : vignette recadrée comme la capture */}
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={cropImageStyle(asCrop((s.options as { crop?: unknown } | null)?.crop))}
                        />
                        {(() => {
                          // EDT-04 : point du premier hotspot sur la vignette
                          const h = editor.hotspots.find((x) => x.step_id === s.id);
                          return h ? (
                            <span
                              className="th-dot"
                              style={{ left: `${(h.x + h.w / 2) * 100}%`, top: `${(h.y + h.h / 2) * 100}%` }}
                            />
                          ) : null;
                        })()}
                      </>
                    ) : s.kind === 'video' ? (
                      <Play aria-hidden="true" className="th-missing" />
                    ) : s.kind === 'html' ? (
                      <Code aria-hidden="true" className="th-missing" />
                    ) : s.kind === 'text' ? (
                      <span className="th-card fd-player-scope">{s.title || t('editor.untitled')}</span>
                    ) : s.to_capture ? (
                      <span className="th-tocapture">
                        <Camera aria-hidden="true" />
                        {t('editor.toCapture.badge')}
                      </span>
                    ) : (
                      <ImageOff aria-hidden="true" className="th-missing" />
                    )}
                    <RailWho people={presence[s.id] ?? []} names={presenceNames} />
                    {!!findHits?.[i] && (
                      <span className="rail-hits">
                        <span aria-hidden="true">{findHits[i]}</span>
                        <span className="sr-only">{t('editor.find.railHits', { count: findHits[i] })}</span>
                      </span>
                    )}
                  </span>
                  <span className="meta">
                    <b>{s.title || t('editor.untitled')}</b>
                    {/* L25-06 : l'étape change d'onglet */}
                    {tabChanged(editor.steps, i) && (
                      <span className="rail-tab">
                        <PanelsTopLeft aria-hidden="true" />
                        {t('editor.capture.railTab', { n: stepTab(s)!.n })}
                      </span>
                    )}
                    <span className="icons">
                      <StepBadges
                        step={s}
                        hotspots={editor.hotspots.filter((h) => h.step_id === s.id).length}
                        isLast={i === editor.steps.length - 1}
                        outside={editor.hotspots.some((h) => h.step_id === s.id && outOfFrame(h))}
                        railDest={(a) => railDest(a, i)}
                      />
                      {(openComments[s.id] ?? 0) > 0 && (
                        <span className="rail-comments">
                          <MessageSquare aria-hidden="true" />
                          <span aria-hidden="true">
                            {openComments[s.id]! > 99 ? '99+' : openComments[s.id]}
                          </span>
                          <span className="sr-only">
                            {t('editor.comments.railBadge', { count: openComments[s.id] })}
                          </span>
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                {!readOnly && (
                  <span className="rail-move">
                    <button
                      type="button"
                      aria-label={t('editor.moveUp')}
                      disabled={i === 0}
                      onClick={() => void editor.moveStep(i, i - 1).then(() => onSelect(i - 1))}
                    >
                      <ArrowUp aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('editor.moveDown')}
                      disabled={i === editor.steps.length - 1}
                      onClick={() => void editor.moveStep(i, i + 1).then(() => onSelect(i + 1))}
                    >
                      <ArrowDown aria-hidden="true" />
                    </button>
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
      {/* REV-08 : le quiz (après la dernière étape) est visible dans le rail et s'ouvre en un clic */}
      {/* L38-6 : toujours présent pour un éditeur : « Ajouter un quiz », ou questions et seuil */}
      {editor.demo && (editor.questions.length > 0 || !readOnly) && (
        <Link
          className={`rail-quiz${editor.questions.length ? '' : ' rail-quiz--add'}`}
          to={`/demos/${editor.demo.id}/quiz`}
        >
          {editor.questions.length ? <GraduationCap aria-hidden="true" /> : <Plus aria-hidden="true" />}
          <span>
            {!editor.questions.length
              ? t('editor.railQuizAdd')
              : asSettings(editor.demo.settings).quiz?.mode === 'survey'
                ? t('editor.railQuiz', { count: editor.questions.length })
                : t('editor.railQuizThreshold', {
                    count: editor.questions.length,
                    pct: `${asSettings(editor.demo.settings).quiz?.threshold ?? 70}\u202f%`,
                  })}
          </span>
        </Link>
      )}
      {!readOnly && (
        <div className="rail-foot">
          <Menu
            label={t('editor.addStep')}
            align="start"
            trigger={{ icon: <Plus />, text: t('editor.addStep'), block: true }}
            items={addItems}
          />
          <input
            ref={file}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // REV-07 : avertissement à l'import (aucune détection automatique)
              if (f)
                void editor.addImageStep(current, f).then((r) => {
                  onSelect(current + 1);
                  if (r) toast(t('editor.importWarn'), undefined, { tone: 'warning' });
                });
              e.target.value = '';
            }}
          />
        </div>
      )}
    </>
  );
}

/** Icônes d'état d'une étape dans le rail (ED10). */
function StepBadges({
  step,
  hotspots,
  isLast,
  outside = false,
  railDest,
}: {
  step: StepRow;
  hotspots: number;
  isLast: boolean;
  /** L25-10 : destination d'une règle de suite, en clair (« 7 », « Les bases », « Fin »). */
  railDest: (a: ChoiceAction) => string;
  /** L25-02 : un hotspot sort du cadre après un recadrage (alerte, publication non bloquée). */
  outside?: boolean;
}) {
  const { t } = useTranslation();
  const blurs = Array.isArray(step.blurs) ? step.blurs.length : 0;
  const opts = asStepOptions(step.options);
  const items = [
    outside && { icon: <TriangleAlert className="rail-warn" />, label: t('editor.crop.outside') },
    opts.choices.length > 0 && {
      icon: <GitBranch />,
      // L22-09 : « n règles » (règles de suite du menu de choix)
      label: t('editor.branch.railRules', { count: branchOf(opts).rules.length }),
    },
    // L25-10 : flèche secondaire vers chaque destination des règles de suite
    !opts.choices.length &&
      condRules(opts).length > 0 && {
        icon: <CornerDownRight />,
        label: t('editor.rules.rail', {
          dests: condRules(opts)
            .map((r) => railDest(r.goto))
            .join(', '),
        }),
      },
    !opts.choices.length &&
      step.kind === 'text' &&
      opts.display === 'popup' && { icon: <MessageCircle />, label: t('editor.advanced.stepTypes.popup') },
    // EDT-04 : icône de type pour l'étape de texte ou de fin
    !opts.choices.length &&
      step.kind === 'text' &&
      opts.display !== 'popup' &&
      (isLast
        ? { icon: <Flag />, label: t('editor.end.title') }
        : { icon: <Type />, label: t('editor.end.textTitle') }),
    step.kind === 'before_after' && { icon: <Layers />, label: t('editor.add.beforeAfter') },
    step.kind === 'video' && { icon: <Play />, label: t('editor.video.kind') },
    step.kind === 'html' && { icon: <Code />, label: t('editor.html.kind') },
    // L28-02 : étape avec voix off
    // L30-10 : voix de synthèse appliquée, repère « IA »
    step.voice_path &&
      ((step.options as { aiVoice?: boolean } | null)?.aiVoice
        ? { icon: <AudioLines />, label: t('editor.voice.railIconAi'), ai: true }
        : { icon: <AudioLines />, label: t('editor.voice.railIcon') }),
    hotspots > 0 && { icon: <Target />, label: t('editor.badgeHotspots', { count: hotspots }) },
    step.gate_form_id && { icon: <ClipboardList />, label: t('editor.badgeForm') },
    step.cta && { icon: <MousePointerClick />, label: t('editor.badgeCta') },
    step.zoom && { icon: <ZoomIn />, label: t('editor.badgeZoom') },
    blurs > 0 && { icon: <Droplet />, label: t('editor.badgeBlurs', { count: blurs }) },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; ai?: boolean }>;
  if (!items.length) return null;
  return (
    <>
      {items.map((b) => (
        <span
          key={b.label}
          title={b.label}
          aria-label={b.label}
          role="img"
          className={b.ai ? 'rail-ai' : undefined}
        >
          {b.icon}
          {b.ai && <span aria-hidden="true">{t('ai.badge')}</span>}
        </span>
      ))}
    </>
  );
}
