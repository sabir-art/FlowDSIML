import { ArrowLeft, Eye, EyeOff, MousePointer2, Share2, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from '@flowdsiml/ui';
import { PLAN_DEFAULTS, type PlanCode } from '@flowdsiml/core';
import { errorMessage } from '../../lib/errors';
import { PLAYER_URL } from '../../lib/env';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { useDemoEditor } from './useDemoEditor';
import { Canvas, type Tool } from './Canvas';
import { StepList } from './StepList';
import { StepPanel } from './panels/StepPanel';
import { HotspotPanel } from './panels/HotspotPanel';
import { BlurPanel } from './panels/BlurPanel';
import { ThemePanel } from './panels/ThemePanel';
import { VariablesPanel } from './panels/VariablesPanel';
import { FormPanel } from './panels/FormPanel';
import { ChaptersPanel } from './panels/ChaptersPanel';
import { buildDraftManifest } from './draftManifest';
import type { Selection } from './types';
import { PublishButton } from './PublishButton';
import '@flowdsiml/player-core/player-core.css';
import './editor.css';

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

export function EditorPage() {
  const { t } = useTranslation();
  const { demoId = '' } = useParams();
  const { can, current: ws } = useWorkspace();
  const editor = useDemoEditor(demoId);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<Selection>({ kind: 'step' });
  const [tab, setTab] = useState<Tab>('step');
  const readOnly = !can('demo.edit');
  const narrow = useNarrow(1024);

  const step = editor.steps[Math.min(index, editor.steps.length - 1)];

  // Changement d'étape → sélection de l'étape.
  useEffect(() => setSelection({ kind: 'step' }), [index]);

  // Raccourcis clavier : flèches pour naviguer, Suppr pour le hotspot sélectionné.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.closest?.('[data-canvas-item]')) return;
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

  if (narrow)
    return (
      <main className="center" id="main" style={{ padding: 24, textAlign: 'center' }}>
        <div className="stack" style={{ maxWidth: 420 }}>
          <h1>{t('editor.narrowTitle')}</h1>
          <p className="fd-muted">{t('editor.narrowBody')}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="fd-btn" to="/">
              {t('common.back')}
            </Link>
            <Link className="fd-btn" to={`/demos/${demoId}/share`}>
              {t('editor.share')}
            </Link>
          </div>
        </div>
      </main>
    );
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
    const manifest = buildDraftManifest(editor);
    const win = window.open(`${PLAYER_URL}/#/preview`, '_blank');
    if (!win) return;
    const origin = new URL(PLAYER_URL).origin;
    const onMsg = (e: MessageEvent) => {
      if (
        e.source === win &&
        e.origin === origin &&
        (e.data as { type?: string })?.type === 'fd:preview-ready'
      ) {
        win.postMessage({ type: 'fd:preview', manifest }, origin);
      }
    };
    window.addEventListener('message', onMsg);
    setTimeout(() => window.removeEventListener('message', onMsg), 60_000);
  }

  return (
    <main className="editor" id="main">
      <header className="editor-bar">
        <Link to="/" className="fd-btn fd-btn--ghost fd-btn--icon" aria-label={t('common.back')}>
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <input
          className="fd-input editor-title"
          aria-label={t('editor.demoTitle')}
          maxLength={160}
          disabled={readOnly}
          value={editor.demo.title}
          onChange={(e) => editor.updateDemo({ title: e.target.value })}
        />
        <span className={`save-state save-${editor.saveState}`} role="status">
          {editor.saveState !== 'idle' && t(`editor.save_${editor.saveState}`)}
        </span>
        <span className="fd-badge">{t(`status.${editor.demo.status}`)}</span>
        <div className="row" style={{ marginLeft: 'auto' }}>
          {!readOnly && step?.kind === 'image' && (
            <div className="segmented" role="toolbar" aria-label={t('editor.tools')}>
              {(['select', 'hotspot', 'blur'] as Tool[]).map((k) => (
                <button key={k} type="button" aria-pressed={tool === k} onClick={() => setTool(k)}>
                  {k === 'select' ? (
                    <MousePointer2 size={15} aria-hidden="true" />
                  ) : k === 'hotspot' ? (
                    <Target size={15} aria-hidden="true" />
                  ) : (
                    <EyeOff size={15} aria-hidden="true" />
                  )}
                  {t(
                    k === 'select'
                      ? 'editor.toolSelect'
                      : k === 'hotspot'
                        ? 'editor.toolHotspot'
                        : 'editor.toolBlur',
                  )}
                </button>
              ))}
            </div>
          )}
          <Button icon={<Eye />} onClick={preview} disabled={!editor.steps.length}>
            {t('editor.preview')}
          </Button>
          <Link className="fd-btn" to={`/demos/${demoId}/share`}>
            <Share2 size={16} aria-hidden="true" />
            {t('editor.share')}
          </Link>
          {can('demo.publish') && <PublishButton editor={editor} />}
        </div>
      </header>
      {editor.lastError != null && (
        <div style={{ padding: '0 16px' }}>
          <Alert kind="error">{errorMessage(t, editor.lastError)}</Alert>
        </div>
      )}
      <div className="editor-body">
        <aside className="editor-left">
          <StepList editor={editor} current={index} onSelect={setIndex} readOnly={readOnly} />
        </aside>
        <section className="editor-center">
          {step ? (
            <Canvas
              editor={editor}
              step={step}
              tool={tool}
              setTool={setTool}
              selection={selection}
              setSelection={setSelection}
              readOnly={readOnly}
            />
          ) : (
            <div className="center fd-muted">{t('editor.empty')}</div>
          )}
          {tool !== 'select' && <p className="fd-muted canvas-hint">{t(`editor.hint_${tool}`)}</p>}
        </section>
        <aside className="editor-right">
          <div className="tabs" role="tablist">
            {(['step', 'design', 'settings'] as Tab[]).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {t(`editor.tab_${k}`)}
              </button>
            ))}
          </div>
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
            <HotspotPanel editor={editor} hotspot={hotspot} readOnly={readOnly} setSelection={setSelection} />
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
            <div className="stack panel-sections">
              <FormPanel editor={editor} readOnly={readOnly} leadFormsAllowed={plan.leadForms} />
              <VariablesPanel editor={editor} readOnly={readOnly} />
              <ChaptersPanel editor={editor} readOnly={readOnly} />
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
