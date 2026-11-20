import { AlertTriangle, Loader2, Rocket } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { branchIssues } from './branch';
import { firstMissingRule } from './rules';
import { publishedColumns, useDataset } from './data/datasetStore';
import { asAction, asStepOptions, beforeAfterComplete } from './types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canPublishWith, useShareRules } from '../../lib/shareRules';
import { Trans } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import { useConfirm } from '../../components/ConfirmDialog';
import { usePlan } from '../../lib/plan';
import { publishDemo } from '../../lib/publish';
import { errorMessage } from '../../lib/errors';
import type { DemoEditor } from './useDemoEditor';
import { GdprDialog, type GdprAck } from './GdprDialog';
import { publishTodo } from './publishTodo';
import { firstInvalid } from './quizValidation';
import { asAnswers, asSettings } from './types';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

export function PublishButton({
  editor,
  onReviewStep,
  onRename,
  republishLabel,
  onPublished,
}: {
  editor: DemoEditor;
  /** L16 : publication depuis « Diffuser » : rester dans la modale au lieu d'ouvrir Partager. */
  onPublished?: (version: number) => void;
  /** Libellé quand la démo est déjà publiée (page Partager : « Publier les modifications »). */
  republishLabel?: string;
  /** « Revoir l'étape n » depuis l'avertissement RGPD. */
  onReviewStep?: (index: number) => void;
  /** L38 : « Renommer » depuis « À compléter » (titre par défaut) : ferme la modale, focus sur le titre. */
  onRename?: () => void;
}) {
  const { t } = useTranslation();
  // L22-09 : avertissements de branchement rappelés dans la modale de publication (non bloquants)
  const branchWarnings = useMemo(() => {
    const issues = branchIssues(
      editor.steps.map((s) => ({
        id: s.id,
        chapterId: s.chapter_id,
        options: asStepOptions(s.options),
        hotspotActions: editor.hotspots.filter((h) => h.step_id === s.id).map((h) => asAction(h.action)),
      })),
      new Set(editor.chapters.map((c) => c.id)),
    );
    return [
      ...issues.unreachable.map((i) => t('editor.advanced.choice.unreachable', { n: i + 1 })),
      ...issues.dead.map((i) => t('editor.branch.publishDead', { n: i + 1 })),
      ...issues.loops.map((i) => t('editor.branch.publishLoop', { n: i + 1 })),
    ];
  }, [editor.steps, editor.hotspots, editor.chapters, t]);
  // L38-5 : contenu à compléter, rappelé dans la modale (non bloquant)
  const todo = useMemo(
    () =>
      publishTodo({
        title: editor.demo?.title ?? '',
        defaultTitle: t('demos.untitled'),
        steps: editor.steps,
        hotspots: editor.hotspots,
        quizOpened: !!asSettings(editor.demo?.settings).quiz,
        questions: editor.questions.length,
      }),
    [editor.demo?.title, editor.demo?.settings, editor.steps, editor.hotspots, editor.questions.length, t],
  );
  const navigate = useNavigate();
  // L25-09 : le bilan RGPD compte le jeu de données publié
  const { dataset } = useDataset(editor.demo?.id);
  const [progress, setProgress] = useState<string | null>(null);
  // REV-09 : le message bloquant s'affiche en infobulle sous le bouton, avec « Aller à l'étape n »
  const [error, setErrorState] = useState<{ text: string; step?: number } | null>(null);
  const setError = (text: string | null, step?: number) => setErrorState(text ? { text, step } : null);
  // Le message d'une tentative précédente disparaît dès que les étapes changent (corrigées)
  useEffect(() => setErrorState(null), [editor.steps]);
  const demo = editor.demo!;
  const { current } = useWorkspace();
  const restricted = !canPublishWith(useShareRules(demo.workspace_id), current?.role);
  const plan = usePlan();
  const [dialog, ask] = useConfirm();
  const [gdprOpen, setGdprOpen] = useState(false);
  const { current: ws } = useWorkspace();

  async function publish() {
    // Plan sans formulaires de lead : prévenir que le formulaire sera retiré de la version publiée
    const gated = plan.leadForms ? -1 : editor.steps.findIndex((s) => s.gate_form_id);
    if (gated >= 0) {
      const form = editor.forms.find((f) => f.id === editor.steps[gated]!.gate_form_id);
      const yes = await ask({
        title: t('planForms.confirmTitle'),
        body: (
          <p>
            <Trans
              i18nKey="planForms.confirmBody"
              values={{ name: form?.title ?? '', n: gated + 1 }}
              components={{ strong: <strong /> }}
            />
          </p>
        ),
        confirmLabel: t('planForms.confirmLabel'),
        secondary: { label: t('planForms.seePlans'), onSelect: () => navigate('/settings/plans') },
      });
      if (!yes) return;
    }
    // F2 : publication bloquée tant qu'une question du quiz est incomplète
    const mode = asSettings(demo.settings).quiz?.mode === 'survey' ? 'survey' : 'quiz';
    const bad = firstInvalid(
      editor.questions.map((q) => ({ prompt: q.prompt, answers: asAnswers(q.answers), type: q.type })),
      mode,
    );
    if (bad) {
      setError(t('errors.quizInvalid', { n: bad }));
      return;
    }
    // L17 : une étape Avant / Après doit avoir ses deux captures
    const incomplete = editor.steps.findIndex((s) => !beforeAfterComplete(s));
    if (incomplete >= 0) {
      setError(t('editor.ba.incomplete', { n: incomplete + 1 }), incomplete);
      return;
    }
    // L26-04 : étapes « À capturer » d'un modèle
    const toCapture = editor.steps.filter((s) => s.to_capture && !s.image_path).length;
    if (toCapture > 0) {
      setError(
        t('templates.toCaptureLeft', { count: toCapture }),
        editor.steps.findIndex((s) => s.to_capture && !s.image_path),
      );
      return;
    }
    // L28 035 : une voix off doit avoir sa transcription (sous-titres)
    const noTranscript = editor.steps.findIndex((s) => s.voice_path && !s.voice_transcript?.trim());
    if (noTranscript >= 0) {
      setError(t('editor.voice.publishMissing', { n: noTranscript + 1 }), noTranscript);
      return;
    }
    // F7 : une étape vidéo doit avoir son fichier
    const noVideo = editor.steps.findIndex(
      (s) => s.kind === 'video' && (!s.video_path || !s.video_duration_ms),
    );
    if (noVideo >= 0) {
      setError(t('errors.videoMissing', { n: noVideo + 1 }), noVideo);
      return;
    }
    // A8 : une étape HTML doit avoir sa page
    const noHtml = editor.steps.findIndex((s) => s.kind === 'html' && !s.html_path);
    if (noHtml >= 0) {
      setError(t('errors.htmlMissing', { n: noHtml + 1 }), noHtml);
      return;
    }
    // L25-10 : une règle de suite sans destination bloque la publication
    const noDest = firstMissingRule(editor.steps.map((s) => asStepOptions(s.options)));
    if (noDest >= 0) {
      setError(t('editor.rules.publishMissing', { n: noDest + 1 }), noDest);
      return;
    }
    // F1 : avertissement RGPD à chaque publication publique (toute publication l'est jusqu'à F3)
    setGdprOpen(true);
  }

  async function doPublish(ack: GdprAck) {
    setGdprOpen(false);
    setProgress('…');
    setError(null);
    try {
      await editor.flush();
      const res = await publishDemo(demo.id, ack, (d, total) =>
        setProgress(`${Math.round((d / total) * 100)} %`),
      );
      await editor.reload();
      if (onPublished) onPublished(res.number);
      else navigate(`/demos/${demo.id}/share?published=1`);
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      {dialog}
      <GdprDialog
        open={gdprOpen}
        steps={editor.steps}
        branchWarnings={branchWarnings}
        todo={todo}
        onQuiz={() => {
          setGdprOpen(false);
          navigate(`/demos/${demo.id}/quiz`);
        }}
        onRename={
          onRename &&
          (() => {
            setGdprOpen(false);
            onRename();
          })
        }
        dataset={dataset ? { rows: dataset.rows.length, columns: publishedColumns(dataset).length } : null}
        publicEnabled={ws?.public_links_enabled !== false}
        onConfirm={(ack) => void doPublish(ack)}
        onReview={(i) => {
          setGdprOpen(false);
          onReviewStep?.(i);
        }}
        onSettings={() => navigate('/settings/workspace')}
        onRestrict={() => navigate(`/demos/${demo.id}/share?tab=access`)}
        onClose={() => setGdprOpen(false)}
      />
      {/* L27-08 : publication réservée aux administrateurs par les règles de l'espace */}
      {restricted && (
        <span id="publish-restricted" className="sr-only">
          {t('rules.errPublish')}
        </span>
      )}
      <span className="publish-wrap">
        <Button
          variant="primary"
          icon={progress ? <Loader2 className="spin" /> : <Rocket />}
          onClick={() => !restricted && void publish()}
          disabled={progress !== null || !editor.steps.length}
          aria-disabled={restricted || undefined}
          aria-describedby={restricted ? 'publish-restricted' : undefined}
          title={restricted ? t('rules.errPublish') : undefined}
        >
          {progress
            ? `${t('publish.publishing')} ${progress}`
            : demo.status === 'published'
              ? (republishLabel ?? t('publish.republish'))
              : t('publish.publish')}
        </Button>
        {error && (
          <span role="alert" className="publish-error">
            <AlertTriangle size={16} aria-hidden="true" />
            <span className="publish-error__text">{error.text}</span>
            {error.step !== undefined && error.step >= 0 && onReviewStep && (
              <button
                type="button"
                className="mk-link-inline publish-error__go"
                onClick={() => {
                  const i = error.step!;
                  setErrorState(null);
                  onReviewStep(i);
                }}
              >
                {t('publish.goStep', { n: error.step + 1 })}
              </button>
            )}
          </span>
        )}
      </span>
    </>
  );
}
