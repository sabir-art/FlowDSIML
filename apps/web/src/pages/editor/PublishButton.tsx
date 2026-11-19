import { AlertTriangle, Loader2, Rocket } from 'lucide-react';
import { useMemo, useState } from 'react';
import { branchIssues } from './branch';
import { asAction, asStepOptions, beforeAfterComplete } from './types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trans } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import { useConfirm } from '../../components/ConfirmDialog';
import { usePlan } from '../../lib/plan';
import { publishDemo } from '../../lib/publish';
import { errorMessage } from '../../lib/errors';
import type { DemoEditor } from './useDemoEditor';
import { GdprDialog, type GdprAck } from './GdprDialog';
import { firstInvalid } from './quizValidation';
import { asAnswers, asSettings } from './types';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

export function PublishButton({
  editor,
  onReviewStep,
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
  const navigate = useNavigate();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const demo = editor.demo!;
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
      editor.questions.map((q) => ({ prompt: q.prompt, answers: asAnswers(q.answers) })),
      mode,
    );
    if (bad) {
      setError(t('errors.quizInvalid', { n: bad }));
      return;
    }
    // L17 : une étape Avant / Après doit avoir ses deux captures
    const incomplete = editor.steps.findIndex((s) => !beforeAfterComplete(s));
    if (incomplete >= 0) {
      setError(t('editor.ba.incomplete', { n: incomplete + 1 }));
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
      {error && (
        <span role="alert" className="publish-error">
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
      <Button
        variant="primary"
        icon={progress ? <Loader2 className="spin" /> : <Rocket />}
        onClick={() => void publish()}
        disabled={progress !== null || !editor.steps.length}
      >
        {progress
          ? `${t('publish.publishing')} ${progress}`
          : demo.status === 'published'
            ? (republishLabel ?? t('publish.republish'))
            : t('publish.publish')}
      </Button>
    </>
  );
}
