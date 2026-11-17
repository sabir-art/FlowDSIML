import { useTranslation } from 'react-i18next';
import { Alert, Card } from '@flowdsiml/ui';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { LeadsTable } from './LeadsTable';

export function LeadsPage() {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t('leads.title')}</h1>
      </div>
      {can('leads.view') ? (
        <Card>
          <LeadsTable />
          <p className="fd-muted" style={{ fontSize: 12 }}>
            {t('leads.gdpr')}
          </p>
        </Card>
      ) : (
        <Alert kind="error">{t('errors.forbidden')}</Alert>
      )}
    </div>
  );
}
