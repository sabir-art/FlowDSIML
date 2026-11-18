import { SettingsTab } from './panels/SettingsTab';
import { FormPanel } from './panels/FormPanel';
import { FormPreview } from './FormPreview';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Crop,
  Droplet,
  GraduationCap,
  Image as ImageIcon,
  Keyboard,
  Palette,
  PenLine,
  Redo2,
  Share2,
  Target,
  Undo2,
  ZoomIn,
  Monitor,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Select } from '@flowdsiml/ui';
import { PLAN_DEFAULTS, type PlanCode } from '@flowdsiml/core';
import { errorMessage } from '../../lib/errors';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { useDemoEditor } from './useDemoEditor';
import { Canvas, type Tool } from './Canvas';
import { StepList } from './StepList';
import { CommentsPanel } from './comments/CommentsPanel';
import { useStepComments } from './comments/useStepComments';
import { useAuth } from '../../auth/AuthProvider';
import { StepPanel } from './panels/StepPanel';
import { HotspotPanel } from './panels/HotspotPanel';
import { BlurPanel } from './panels/BlurPanel';
import { ThemePanel } from './panels/ThemePanel';
import { buildDraftManifest } from './draftManifest';
import type { Selection } from './types';
import { PublishButton } from './PublishButton';
import { PreviewDialog } from './PreviewDialog';
import type { Manifest } from '@flowdsiml/manifest';
import '@flowdsiml/player-core/player-core.css';
import './editor.css';
import { Menu } from '../../components/Menu';
import { supabase } from '../../lib/supabase';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';

/** Vrai si la fenêtre est plus étroite que `px` (ED11 : l'éditeur exige un écran large). */
function useNarrow(px: number) {
  const query = `(max-width: ${px - 1}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}

type Tab = 'step' | 'design' | 'settings';
type Zoom = 'fit' | '50' | '100';

export function EditorPage() {
  const { t } = useTranslation();
  const { demoId = '' } = useParams();
  const { can, current: ws } = useWorkspace();
  const editor = useDemoEditor(demoId);
  const { user } = useAuth();
  const comments = useStepComments(demoId, ws?.id, user?.id);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<Selection>({ kind: 'step' });
  const [params] = useSearchParams();
  // ANA-09 : « Ajouter un formulaire » ouvre directement l'onglet Réglages
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'settings' ? 'settings' : 'step');
  const readOnly = !can('demo.edit');
  const narrow = useNarrow(1024);
  const [previewManifest, setPreviewManifest] = useState<Manifest | null>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const navigate = useNavigate();
  const versionId = editor.demo?.current_version_id;
  useEffect(() => {
    if (!versionId) return setPublishedAt(null);
    void supabase
      .from('demo_versions')
      .select('published_at')
      .eq('id', versionId)
      .maybeSingle()
      .then(({ data }) => setPublishedAt(data?.published_at ?? null));
  }, [versionId]);

  const step = editor.steps[Math.min(index, editor.steps.length - 1)];

  // Changement d'étape → sélection de l'étape.
  // (sauf le formulaire de lead, qui se sélectionne en même temps que l'étape qu'il précède)
  useEffect(
    () =>
      setSelection((s) =>
        s.kind === 'form' && editor.steps[index]?.gate_form_id === s.id ? s : { kind: 'step' },
      ),
    [index], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const selectedForm =
    selection.kind === 'form' ? editor.forms.find((f) => f.id === selection.id) : undefined;

  // Raccourcis clavier : flèches pour naviguer, Suppr pour le hotspot sélectionné.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.closest?.('[data-canvas-item], .cm, #fd-portal')) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight')
        setIndex((i) => Math.min(i + 1, editor.steps.length - 1));
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.kind === 'hotspot' && !readOnly) {
        void editor.deleteHotspot(selection.id);
        setSelection({ kind: 'step' });
      }
      if (e.key === 'Escape') {
        setTool('select');
        setSelection({ kind: 'step' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, selection, readOnly]);

  if (narrow) {
    // Écran étroit : l'éditeur reste indisponible, mais on lit et on répond aux commentaires (commentaires.md §5)
    if (editor.loading) return <Loading />;
    return (
      <main className="editor-narrow" id="main">
        {/* EDT-13 : avis centré, sans carte (maquette) */}
        <div className="editor-narrow__notice">
          <Monitor className="editor-narrow__icon" aria-hidden="true" />
          <h1>{t('editor.comments.mobileNoticeTitle')}</h1>
          <p className="fd-muted">{t('editor.comments.mobileNoticeBody')}</p>
          <div className="row editor-narrow__acts">
            <button
              type="button"
              className="fd-btn fd-btn--primary"
              disabled={!editor.steps.length}
              onClick={() => setPreviewManifest(buildDraftManifest(editor, ws?.name ?? ''))}
            >
              {t('editor.comments.viewDemo')}
            </button>
            <Link className="fd-btn" to={`/demos/${demoId}/share`}>
              {t('editor.share')}
            </Link>
          </div>
        </div>
        {step && (
          <CommentsPanel
            variant="mobile"
            stepId={step.id}
            stepIndex={Math.min(index, editor.steps.length - 1)}
            api={comments}
            header={
              <Select
                className="editor-narrow__steps"
                aria-label={t('editor.comments.step')}
                value={String(Math.min(index, editor.steps.length - 1))}
                onChange={(e) => setIndex(Number(e.target.value))}
              >
                {editor.steps.map((s, i) => (
                  <option key={s.id} value={i}>
                    {`${t('editor.comments.step')} ${i + 1} · ${s.title || t('editor.untitled')}`}
                    {comments.openByStep[s.id]
                      ? ` — ${t('editor.comments.openCount', { count: comments.openByStep[s.id] })}`
                      : ''}
                  </option>
                ))}
              </Select>
            }
          />
        )}
        <PreviewDialog manifest={previewManifest} onClose={() => setPreviewManifest(null)} />
      </main>
    );
  }
  if (editor.loading) return <Loading />;
  if (editor.notFound || !editor.demo)
    return (
      <div className="center">
        <Alert kind="error">{t('editor.notFound')}</Alert>
        <Link to="/">{t('common.back')}</Link>
      </div>
    );

  const plan = PLAN_DEFAULTS[(ws?.plan_code ?? 'free') as PlanCode] ?? PLAN_DEFAULTS.free;
  const hotspot =
    selection.kind === 'hotspot' ? editor.hotspots.find((h) => h.id === selection.id) : undefined;

  function preview() {
    setPreviewManifest(buildDraftManifest(editor, ws?.name ?? ''));
  }

  const safeIndex = Math.min(index, editor.steps.length - 1);
  // Modifications non publiées : démo modifiée après sa publication (ou jamais publiée)
  const unpublished =
    editor.demo.status !== 'published' ||
    (publishedAt !== null && Date.parse(editor.demo.updated_at) > Date.parse(publishedAt) + 2000);
  const toolBtn = (k: Tool, Icon: typeof Target, label: string) => (
    <button
      key={k}
      type="button"
      className="btn btn-ghost btn-icon"
      aria-pressed={tool === k}
      aria-label={label}
      title={label}
      onClick={() => setTool(tool === k ? 'select' : k)}
      disabled={readOnly || step?.kind !== 'image'}
    >
      <Icon aria-hidden="true" />
    </button>
  );

  return (
    <main className="mk ed" id="main">
      <h1 className="sr-only">
        {t('editor.pageTitle', { title: editor.demo.title || t('demos.untitled') })}
      </h1>
      <header className="ed-bar">
        <Link to="/" className="btn btn-ghost btn-sm btn-icon" aria-label={t('editor.backToDemos')}>
          <ArrowLeft aria-hidden="true" />
        </Link>
        <input
          className="ed-title"
          aria-label={t('editor.demoTitle')}
          maxLength={160}
          disabled={readOnly}
          value={editor.demo.title}
          onChange={(e) => editor.updateDemo({ title: e.target.value })}
        />
        {unpublished && (
          <span className="badge badge-warning">
            {editor.demo.status === 'published' ? t('editor.unpublishedChanges') : t('status.draft')}
          </span>
        )}
        <span className="save-state" role="status" aria-live="polite">
          {(editor.saveState === 'saved' || editor.saveState === 'idle') && (
            <CheckCircle2 aria-hidden="true" />
          )}
          {t(`editor.save_${editor.saveState === 'idle' ? 'saved' : editor.saveState}`)}
        </span>
        <span className="grow" />
        {/* Annuler / rétablir : pas encore disponibles */}
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={`${t('editor.undo')} · ${t('shell.soon')}`}
          title={t('shell.soon')}
          aria-disabled="true"
        >
          <Undo2 aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={`${t('editor.redo')} · ${t('shell.soon')}`}
          title={t('shell.soon')}
          aria-disabled="true"
        >
          <Redo2 aria-hidden="true" />
        </button>
        <div className="segmented" role="radiogroup" aria-label={t('editor.mode')}>
          {/* EDT-12 : le segmenté passe sur « Aperçu » pendant l'aperçu */}
          <button
            type="button"
            aria-checked={!previewManifest}
            role="radio"
            onClick={() => setPreviewManifest(null)}
          >
            {t('editor.modeEdit')}
          </button>
          <button
            type="button"
            aria-checked={!!previewManifest}
            role="radio"
            onClick={preview}
            disabled={!editor.steps.length}
          >
            {t('editor.preview')}
          </button>
        </div>
        <Menu
          label={t('editor.more')}
          items={[
            {
              label: t('editor.versions'),
              icon: <Clock />,
              disabled: true,
              end: <span className="fd-badge menu-soon">{t('shell.soon')}</span>,
              onSelect: () => undefined,
            },
            { label: t('editor.themeOfDemo'), icon: <Palette />, onSelect: () => setTab('design') },
            {
              label: t('editor.quiz.open') + (editor.questions.length ? ` (${editor.questions.length})` : ''),
              icon: <GraduationCap />,
              onSelect: () => navigate(`/demos/${demoId}/quiz`),
            },
            {
              label: t('editor.aiWriter'),
              icon: <PenLine />,
              disabled: true,
              end: <span className="fd-badge menu-soon">V2</span>,
              onSelect: () => undefined,
            },
            {
              label: t('editor.shortcuts'),
              icon: <Keyboard />,
              disabled: true,
              end: (
                <>
                  <kbd className="menu-kbd">?</kbd>
                  <span className="fd-badge menu-soon">{t('shell.soon')}</span>
                </>
              ),
              onSelect: () => undefined,
            },
            'separator',
            ...(can('demo.edit')
              ? [
                  {
                    label: t('editor.duplicateDemo'),
                    icon: <Copy />,
                    onSelect: () =>
                      void supabase.rpc('duplicate_demo', { p_demo: demoId }).then(({ data }) => {
                        const id =
                          typeof data === 'string' ? data : (data as unknown as { id?: string } | null)?.id;
                        navigate(id ? `/demos/${id}/edit` : '/');
                      }),
                  },
                ]
              : []),
          ]}
        />
        <Link className="btn btn-secondary btn-sm" to={`/demos/${demoId}/share`}>
          <Share2 aria-hidden="true" />
          {t('editor.share')}
        </Link>
        {can('demo.publish') && (
          <span className="tc-cta-grad ed-publish">
            <PublishButton
              editor={editor}
              republishLabel={t('publish.publish')}
              onReviewStep={(i) => {
                setIndex(i);
                setSelection({ kind: 'step' });
                setTab('step');
              }}
            />
          </span>
        )}
      </header>
      {editor.lastError != null && (
        <div className="ed-error">
          <div className="alert alert-danger" role="alert">
            {errorMessage(t, editor.lastError)}
          </div>
        </div>
      )}
      <div className="ed-body">
        <nav className="rail" aria-label={t('editor.steps')}>
          <StepList
            editor={editor}
            current={index}
            onSelect={(i) => {
              setIndex(i);
              setSelection({ kind: 'step' });
            }}
            readOnly={readOnly}
            openComments={comments.openByStep}
            selectedFormId={selectedForm?.id ?? null}
            onSelectForm={(i, id) => {
              setSelection({ kind: 'form', id });
              setIndex(i);
              setTab('step');
            }}
          />
        </nav>
        <section className="stage" aria-label={t('editor.canvas')} id="canvas">
          <div className="row stage-head">
            <span className="t-caption muted">
              {selectedForm
                ? `${t('editor.leadForm')} · ${t('editor.form.beforeStepShort', { n: safeIndex + 1 })}`
                : step
                  ? `${t('editor.stepN', { n: safeIndex + 1 })} · ${step.title || t('editor.untitled')}`
                  : ''}
            </span>
            <span className="grow" />
            <select
              className="select input-sm stage-zoom"
              aria-label={t('editor.zoom')}
              value={zoom}
              onChange={(e) => setZoom(e.target.value as Zoom)}
            >
              <option value="fit">{t('editor.zoomFit')}</option>
              <option value="50">50 %</option>
              <option value="100">100 %</option>
            </select>
          </div>
          <div className="stage-main">
            <div className="stage-inner">
              {step ? (
                <div className={`frame fd-player-scope frame--${zoom}`}>
                  <div className="browser" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    {step.page_url && (
                      <span className="url">{step.page_url.replace(/^https?:\/\//, '')}</span>
                    )}
                  </div>
                  <div className="shot">
                    <Canvas
                      editor={editor}
                      step={step}
                      tool={tool}
                      setTool={setTool}
                      selection={selection}
                      setSelection={setSelection}
                      readOnly={readOnly}
                      onEditForm={() =>
                        step.gate_form_id && setSelection({ kind: 'form', id: step.gate_form_id })
                      }
                      hideFormChip={!!selectedForm}
                    />
                    {selectedForm && <FormPreview form={selectedForm} editor={editor} />}
                  </div>
                </div>
              ) : (
                <div className="muted">{t('editor.empty')}</div>
              )}
              {tool !== 'select' && <p className="muted canvas-hint">{t(`editor.hint_${tool}`)}</p>}
            </div>
            <div className="floatbar" role="toolbar" aria-label={t('editor.tools')}>
              {toolBtn('hotspot', Target, t('editor.toolHotspot'))}
              {toolBtn('blur', Droplet, t('editor.toolBlur'))}
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label={t('editor.toolZoom')}
                title={t('editor.toolZoom')}
                disabled={readOnly || step?.kind !== 'image'}
                onClick={() => {
                  setSelection({ kind: 'step' });
                  setTab('step');
                }}
              >
                <ZoomIn aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-disabled="true"
                aria-label={`${t('editor.toolCrop')} · ${t('shell.soon')}`}
                title={t('shell.soon')}
              >
                <Crop aria-hidden="true" />
                <span className="fb-soon" aria-hidden="true">
                  {t('shell.soon')}
                </span>
              </button>
              <span className="sep" />
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-disabled="true"
                aria-label={`${t('editor.toolReplace')} · ${t('shell.soon')}`}
                title={t('shell.soon')}
              >
                <ImageIcon aria-hidden="true" />
                <span className="fb-soon" aria-hidden="true">
                  {t('shell.soon')}
                </span>
              </button>
            </div>
          </div>
          {/* Commentaires d'équipe (lot A6) : gardés sous le canevas, repliables */}
          <div className="stage-comments">
            <CommentsPanel stepId={step?.id ?? null} stepIndex={safeIndex} api={comments} />
          </div>
        </section>
        <aside className="panel" aria-label={t('editor.properties')}>
          <div className="tabs" role="tablist" aria-label={t('editor.properties')}>
            {(['step', 'design', 'settings'] as Tab[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                id={`ed-tab-${k}`}
                aria-selected={tab === k}
                tabIndex={tab === k ? 0 : -1}
                onClick={() => setTab(k)}
              >
                {t(`editor.tab_${k}`)}
              </button>
            ))}
          </div>
          <div className="panel-body" role="tabpanel" aria-labelledby={`ed-tab-${tab}`}>
            {tab === 'step' && selectedForm && (
              <FormPanel
                editor={editor}
                readOnly={readOnly}
                leadFormsAllowed={plan.leadForms}
                form={selectedForm}
                onBack={() => setSelection({ kind: 'step' })}
                onMove={(i) => {
                  setSelection({ kind: 'form', id: selectedForm.id });
                  setIndex(i);
                }}
              />
            )}
            {tab === 'step' && step && selection.kind === 'step' && (
              <StepPanel
                editor={editor}
                step={step}
                index={index}
                readOnly={readOnly}
                setSelection={setSelection}
              />
            )}
            {tab === 'step' && step && hotspot && (
              <HotspotPanel
                editor={editor}
                hotspot={hotspot}
                readOnly={readOnly}
                setSelection={setSelection}
              />
            )}
            {tab === 'step' && step && selection.kind === 'blur' && (
              <BlurPanel
                editor={editor}
                step={step}
                index={selection.index}
                readOnly={readOnly}
                setSelection={setSelection}
              />
            )}
            {tab === 'design' && <ThemePanel editor={editor} readOnly={readOnly} />}
            {tab === 'settings' && (
              <SettingsTab
                editor={editor}
                readOnly={readOnly}
                leadFormsAllowed={plan.leadForms}
                onOpenForm={(i, id) => {
                  setSelection({ kind: 'form', id });
                  setIndex(i);
                  setTab('step');
                }}
              />
            )}
          </div>
        </aside>
      </div>
      <PreviewDialog manifest={previewManifest} onClose={() => setPreviewManifest(null)} />
    </main>
  );
}
