import { describe, expect, it } from 'vitest';
import { allTabs, showTabs, stepTab, tabChanged, tabsAt } from './tabs';

const s = (n?: number, title = '') => ({ options: n ? { tab: { n, title } } : {} });
const steps = [s(1, 'Rapports'), s(1, 'Rapports'), s(2, 'Aide'), s(1, 'Rapports · Acme'), s()];

describe('L25-06 : onglets de la capture', () => {
  it('lit l’onglet d’une étape', () => {
    expect(stepTab(steps[2])).toEqual({ n: 2, title: 'Aide' });
    expect(stepTab(steps[4])).toBeNull();
    expect(stepTab({ options: { tab: { n: 0 } } })).toBeNull();
  });
  it('onglets de la démo', () => expect(allTabs(steps).map((t) => t.n)).toEqual([1, 2]));
  it('l’onglet d’origine reste proposé après un rattachement', () => {
    const moved = { options: { tab: { n: 1, title: 'Rapports' }, tabCaptured: { n: 2, title: 'Aide' } } };
    expect(allTabs([s(1, 'Rapports'), moved]).map((t) => t.n)).toEqual([1, 2]);
  });
  it('onglets visibles jusqu’à l’étape, avec le dernier titre', () => {
    expect(tabsAt(steps, 0)).toEqual({ tabs: [{ n: 1, title: 'Rapports' }], active: 1 });
    expect(tabsAt(steps, 2).tabs.map((t) => t.n)).toEqual([1, 2]);
    expect(tabsAt(steps, 3)).toEqual({
      tabs: [
        { n: 1, title: 'Rapports · Acme' },
        { n: 2, title: 'Aide' },
      ],
      active: 1,
    });
    expect(tabsAt(steps, 4).tabs).toEqual([]);
  });
  it('changement d’onglet', () => {
    expect([0, 1, 2, 3, 4].map((i) => tabChanged(steps, i))).toEqual([false, false, true, true, false]);
  });
  it('onglets affichés par défaut', () => {
    expect(showTabs(steps[0])).toBe(true);
    expect(showTabs({ options: { showTabs: false } })).toBe(false);
  });
});
