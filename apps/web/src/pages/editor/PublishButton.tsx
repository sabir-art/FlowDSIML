import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import { publishDemo } from '../../lib/publish';
import { errorMessage } from '../../lib/errors';
import type { DemoEditor } from './useDemoEditor';

export function PublishButton({ editor }: { editor: DemoEditor }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<string | null>(null);
  const demo = editor.demo!;

  async function publish() {
    setProgress('…');
    try {
      await editor.flush();
      await publishDemo(demo.id, (d, total) => setProgress(`${Math.round((d / total) * 100)} %`));
      await editor.reload();
      navigate(`/demos/${demo.id}/share?published=1`);
    } catch (e) {
      alert(errorMessage(t, e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Button
      variant="primary"
      onClick={() => void publish()}
      disabled={progress !== null || !editor.steps.length}
    >
      {progress
        ? `${t('publish.publishing')} ${progress}`
        : demo.status === 'published'
          ? t('publish.republish')
          : t('publish.publish')}
    </Button>
  );
}
