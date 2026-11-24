import { describe, expect, it } from 'vitest';
import {
  ARTICLES,
  PAGE_ARTICLES,
  articleBySlug,
  highlight,
  pageFor,
  searchArticles,
  termsOf,
  visibleArticles,
} from './articles';

describe('articles d’aide (L26-03)', () => {
  it('L41 : l’article de la console est réservé aux comptes qui ont un rôle dans la console', () => {
    expect(articleBySlug('console-proprietaire')?.audience).toBe('console');
    expect(visibleArticles(false).some((a) => a.audience === 'console')).toBe(false);
    expect(visibleArticles(true).some((a) => a.slug === 'console-proprietaire')).toBe(true);
    expect(searchArticles('console proprietaire', visibleArticles(false))).toEqual([]);
  });
  it('chaque page a 2 à 4 articles existants', () => {
    for (const [page, slugs] of Object.entries(PAGE_ARTICLES)) {
      expect(slugs.length, page).toBeGreaterThanOrEqual(2);
      expect(slugs.length, page).toBeLessThanOrEqual(4);
      for (const s of slugs) expect(articleBySlug(s), `${page} → ${s}`).not.toBeNull();
    }
  });
  it('contenu minimal : un article par page principale, données personnelles, accessibilité', () => {
    for (const s of [
      'flouter-donnees',
      'accessibilite-demos',
      // Déclaration d'accessibilité : le retour d'information passe par cet article
      'accessibilite-tutoclick',
      'exporter-scorm',
      'suivre-apprenants',
    ])
      expect(articleBySlug(s)).not.toBeNull();
    for (const a of ARTICLES) {
      expect(a.title.length).toBeGreaterThan(3);
      expect(a.section).not.toBe('');
      expect(a.body).not.toMatch(/https?:\/\//); // aucune adresse externe
    }
  });
  it('recherche insensible aux accents et à la casse, titre d’abord', () => {
    const r = searchArticles('SCORM', ARTICLES);
    expect(r[0]!.slug).toMatch(/scorm/);
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(searchArticles('donnees personnelles', ARTICLES).map((a) => a.slug)).toContain('flouter-donnees');
    expect(searchArticles('xyzzy', ARTICLES)).toEqual([]);
    expect(searchArticles(' ', ARTICLES)).toEqual([]);
  });
  it('surligne les termes trouvés en gardant les accents', () => {
    const seg = highlight('Données personnelles', termsOf('donnees'));
    expect(seg[0]).toEqual({ text: 'Données', hit: true });
    expect(seg.map((s) => s.text).join('')).toBe('Données personnelles');
  });
  it('page d’aide d’une route', () => {
    expect(pageFor('/')).toBe('demos');
    expect(pageFor('/demos/x/edit', 'design')).toBe('editor-design');
    expect(pageFor('/demos/x/edit', null)).toBe('editor-step');
    expect(pageFor('/demos/x/distribute')).toBe('distribute');
    expect(pageFor('/settings/members')).toBe('settings');
    expect(pageFor('/onboarding')).toBeNull();
  });
});
