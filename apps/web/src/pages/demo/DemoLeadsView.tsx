import { Card } from '@flowdsiml/ui';
import { LeadsTable } from '../analytics/LeadsTable';
import { useDemoView } from './DemoViewShell';

/** §9 : leads de la démo (tableau, recherche, export), dans la démo. */
export function DemoLeadsView() {
  const { demo } = useDemoView();
  return (
    <Card>
      <LeadsTable demoId={demo.id} />
    </Card>
  );
}
