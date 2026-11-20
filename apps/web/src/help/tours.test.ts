import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseManifest } from '@flowdsiml/manifest';
import { ARTICLES } from './articles';
import { MODULE_TOUR, PAGE_TOUR } from './tours';

const HELP = resolve(__dirname, '../../public/help');
const index = JSON.parse(readFileSync(join(HELP, 'index.json'), 'utf8')) as {
  tours: Array<{ key: string; id: string; steps: number }>;
};

describe('visites guidées statiques (L26 §3.3-3.4)', () => {
  it('chaque visite de l’index est un manifeste valide pour le lecteur, avec ses captures', () => {
    expect(index.tours.length).toBeGreaterThan(0);
    for (const t of index.tours) {
      const raw = JSON.parse(readFileSync(join(HELP, t.id, 'manifest.json'), 'utf8')) as unknown;
      const m = parseManifest(raw);
      // Étapes du scénario, puis l'écran de fin commun
      expect(m.steps.length, t.key).toBe(t.steps + 1);
      for (const s of m.steps.filter((x) => x.image)) {
        expect(s.image!.url, t.key).toMatch(/^\d+\.webp$/);
        expect(existsSync(join(HELP, t.id, s.image!.url)), `${t.key} ${s.image!.url}`).toBe(true);
        expect(s.hotspots.length).toBe(1);
      }
      expect(JSON.stringify(raw)).not.toMatch(/localhost|https?:\/\/(?!app\.example)/);
    }
  });
  it('les clés de page et de module correspondent aux scénarios', () => {
    const keys = new Set(index.tours.map((t) => t.key));
    const all = [...Object.values(PAGE_TOUR), ...Object.values(MODULE_TOUR)];
    for (const k of keys) expect(all, k).toContain(k);
  });
});

describe('articles d’aide connus en base', () => {
  it('help_articles (migration) liste exactement les articles livrés', () => {
    // Toutes les migrations : les articles ajoutés après la liste initiale (L41) sont pris en compte
    const dir = resolve(__dirname, '../../../../supabase/migrations');
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    const blocks = [
      ...sql.matchAll(/insert into public\.help_articles \(slug\) values([\s\S]*?)on conflict/g),
    ].map((m) => m[1]!);
    const slugs = [
      ...new Set(blocks.flatMap((b) => [...b.matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]))),
    ].sort();
    expect(slugs).toEqual(ARTICLES.map((a) => a.slug).sort());
    expect(readdirSync(resolve(__dirname, '../aide')).length).toBe(ARTICLES.length);
  });
});
