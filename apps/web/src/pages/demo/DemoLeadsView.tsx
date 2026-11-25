import { LeadsTable } from '../analytics/LeadsTable';
import { useDemoView } from './DemoViewShell';

/** §9 : leads de la démo (tableau, recherche, export), dans la démo. */
export function DemoLeadsView() {
  const { demo } = useDemoView();
  // Une seule carte : la recherche au-dessus, le tableau ou l'état vide dessous
  return <LeadsTable demoId={demo.id} />;
}
