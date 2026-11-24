import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Monitor } from 'lucide-react';
import { Select } from '@flowdsiml/ui';
import type { Manifest } from '@flowdsiml/manifest';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useAuth } from '../../auth/AuthProvider';
import { useDemoEditor, type DemoEditor } from './useDemoEditor';
import { CommentsPanel } from './comments/CommentsPanel';
import { useStepComments } from './comments/useStepComments';
import { PreviewDialog } from './PreviewDialog';
import './editor.css';
import { ShareDialog, useShareWindow } from '../share/ShareDialog';

/**
 * Écran étroit : l'éditeur reste indisponible, mais on lit et on répond aux commentaires (commentaires.md §5).
 * L33 : l'avis s'affiche sans attendre les données ; le manifeste d'aperçu est construit à la demande.
 */
export function EditorNarrowView({
  editor,
  comments,
  index,
  setIndex,
  onShare,
}: {
  editor: DemoEditor;
  comments: ReturnType<typeof useStepComments>;
  index: number;
  setIndex: (i: number) => void;
  /** §1 : ouvre la fenêtre Partager. */
  onShare: () => void;
}) {
  const { t } = useTranslation();
  const { current: ws } = useWorkspace();
  const [params] = useSearchParams();
  const focusComment = params.get('comment');
  const [previewManifest, setPreviewManifest] = useState<Manifest | null>(null);
  const safeIndex = Math.min(index, editor.steps.length - 1);
  const step = editor.steps[safeIndex];
  const preview = () =>
    void import('./draftManifest').then((m) =>
      setPreviewManifest(m.buildDraftManifest(editor, ws?.name ?? '')),
    );
  return (
    <main className="editor-narrow" id="main" aria-busy={editor.loading ? 'true' : 'false'}>
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
            onClick={preview}
          >
            {t('editor.comments.viewDemo')}
          </button>
          <button type="button" className="fd-btn" data-share-open="" onClick={onShare}>
            {t('editor.share')}
          </button>
        </div>
      </div>
      {step && (
        <CommentsPanel
          variant="mobile"
          focusComment={focusComment}
          stepId={step.id}
          stepIndex={safeIndex}
          api={comments}
          header={
            <Select
              className="editor-narrow__steps"
              aria-label={t('editor.comments.step')}
              value={String(safeIndex)}
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

/** Page chargée à la place de l'éditeur sur écran étroit (sans le code ni les textes de l'éditeur complet). */
export function EditorNarrowPage() {
  const { demoId = '' } = useParams();
  const { current: ws } = useWorkspace();
  const { user } = useAuth();
  const editor = useDemoEditor(demoId);
  const share = useShareWindow();
  const comments = useStepComments(demoId, ws?.id, user?.id);
  const [params] = useSearchParams();
  const focusStep = params.get('step');
  const [index, setIndex] = useState(0);
  const [applied, setApplied] = useState(false);
  // L22-05 : lien d'une notification (?step=…&comment=…) → étape choisie une fois chargée
  useEffect(() => {
    if (applied || !focusStep || !editor.steps.length) return;
    const i = editor.steps.findIndex((st) => st.id === focusStep);
    if (i >= 0) setIndex(i);
    setApplied(true);
  }, [applied, focusStep, editor.steps]);
  return (
    <>
      <EditorNarrowView
        editor={editor}
        comments={comments}
        index={index}
        setIndex={setIndex}
        onShare={share.open}
      />
      {share.view && (
        <ShareDialog
          demoId={demoId}
          view={share.view}
          onView={share.setView}
          onClose={share.close}
          justPublished={share.justPublished}
        />
      )}
    </>
  );
}
