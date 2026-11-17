import { AlertTriangle, Loader2, Rocket } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trans } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import { useConfirm } from '../../components/ConfirmDialog';
import { usePlan } from '../../lib/plan';
import { publishDemo } from '../../lib/publish';
import { errorMessage } from '../../lib/errors';
import type { DemoEditor } from './useDemoEditor';

export function PublishButton({ editor }: { editor: DemoEditor }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const demo = editor.demo!;
  const plan = usePlan();
  const [dialog, ask] = useConfirm();

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
    setProgress('…');
    setError(null);
    try {
      await editor.flush();
      await publishDemo(demo.id, (d, total) => setProgress(`${Math.round((d / total) * 100)} %`));
      await editor.reload();
      navigate(`/demos/${demo.id}/share?published=1`);
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      {dialog}
      {error && (
        <span role="alert" className="publish-error">
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
      <Button
        variant="accent"
        icon={progress ? <Loader2 className="spin" /> : <Rocket />}
        onClick={() => void publish()}
        disabled={progress !== null || !editor.steps.length}
      >
        {progress
          ? `${t('publish.publishing')} ${progress}`
          : demo.status === 'published'
            ? t('publish.republish')
            : t('publish.publish')}
      </Button>
    </>
  );
}
