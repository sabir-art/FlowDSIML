/**
 * Faux Supabase pour les tests e2e de l'app web : intercepte les requêtes de supabase-js
 * (page.route) et répond depuis un état en mémoire. Couvre le sous-ensemble utilisé par l'app :
 * filtres eq/is/in/ilike, embed members → workspaces, insert/update/delete, quelques RPC, Storage.
 * Ce n'est PAS un substitut aux tests pgTAP (RLS) : il valide l'interface.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Hôtes fictifs (captures) : l'app et le lecteur sont lancés avec VITE_SUPABASE_URL=HOST et
// VITE_PLAYER_URL=PUBLIC_PLAYER ; PUBLIC_PLAYER est servi par le lecteur local (LOCAL_PLAYER).
const HOST = process.env.FAKE_SUPABASE_HOST || 'https://api.tutoclick.example';
const PUBLIC_PLAYER = process.env.PUBLIC_PLAYER_URL || 'https://demos.tutoclick.example';
const LOCAL_PLAYER = process.env.PLAYER_URL || 'http://localhost:5174';
const STORAGE_KEY = `sb-${new URL(HOST).hostname.split('.')[0]}-auth-token`;

function b64url(o) {
  return Buffer.from(JSON.stringify(o)).toString('base64url');
}
function fakeJwt(user) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.sig`;
}

/** L26-04 : modèles livrés, lus dans la migration (une seule source). */
/** L27 : styles livrés, lus dans la migration (identiques à presets.ts). */
function builtinStyles() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../../supabase/migrations/20261122090000_marque_regles.sql'),
    'utf8',
  );
  const out = {};
  for (const m of sql.matchAll(/\('([a-z]+)', \d+, '(\{.*?\})'\)/g))
    out[m[1]] = JSON.parse(m[2].replace(/''/g, "'"));
  return out;
}
let currentUserId = null;

function builtinTemplates() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../../supabase/migrations/20261121090000_modeles.sql'),
    'utf8',
  );
  const re =
    /\('([a-z-]+)', '((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'([a-z]+)', '([a-z-]+)', \$j\$([\s\S]*?)\$j\$::jsonb\)/g;
  const out = [];
  let m;
  let i = 0;
  while ((m = re.exec(sql))) {
    out.push({
      id: `tpl-${m[1]}`,
      workspace_id: null,
      builtin_key: m[1],
      name: m[2].replace(/''/g, "'"),
      description: m[3].replace(/''/g, "'"),
      category: m[4],
      icon: m[5],
      structure: JSON.parse(m[6]),
      with_captures: false,
      created_by: null,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      updated_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i++)).toISOString(),
    });
  }
  return out;
}

function seed() {
  const user = {
    id: 'u-alice',
    email: 'alice@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  };
  const ws = {
    id: 'ws-1',
    name: 'Acme',
    slug: 'acme',
    plan_code: 'pro',
    logo_path: null,
    brand_primary: null,
    brand_accent: null,
    settings: {},
    visit_measure: true,
    visit_gap_minutes: 30,
    created_by: user.id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const now = new Date().toISOString();
  const demo = {
    id: '0b5c1f0e-0000-4000-8000-000000000001',
    workspace_id: ws.id,
    folder_id: null,
    title: 'Démo CRM',
    status: 'draft',
    theme_id: null,
    settings: {},
    cover_path: null,
    current_version_id: null,
    created_by: user.id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const step = (id, position, extra) => ({
    id,
    demo_id: demo.id,
    workspace_id: ws.id,
    position,
    chapter_id: null,
    kind: 'image',
    image_path: `${ws.id}/${demo.id}/${id}.png`,
    image_width: 1100,
    image_height: 750,
    snapshot_path: null,
    title: `Écran ${position + 1}`,
    body: '',
    zoom: null,
    blurs: [],
    gate_form_id: null,
    cta: null,
    page_url: 'https://app.example.com/',
    page_title: 'App',
    element_meta: {},
    created_at: now,
    updated_at: now,
    ...extra,
  });
  return {
    user,
    tables: {
      profiles: [
        { id: user.id, full_name: 'Alice', avatar_url: null, locale: 'fr', created_at: now, updated_at: now },
      ],
      workspaces: [ws],
      members: [{ workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now }],
      invitations: [],
      demos: [
        demo,
        {
          ...demo,
          id: '0b5c1f0e-0000-4000-8000-000000000002',
          title: 'Onboarding',
          status: 'published',
          current_version_id: 'v-2',
        },
      ],
      steps: [
        step('s1', 0),
        step('s2', 1, { blurs: [{ x: 0.6, y: 0.1, w: 0.2, h: 0.06 }] }),
        step('s3', 2, { kind: 'text', image_path: null, title: 'Merci !', body: 'Réservez une **démo**' }),
      ],
      hotspots: [
        {
          id: 'h1',
          step_id: 's1',
          demo_id: demo.id,
          workspace_id: ws.id,
          // Calé sur le bouton « + Nouvelle opportunité » de la capture fictive (fixture.png)
          x: 0.243,
          y: 0.352,
          w: 0.208,
          h: 0.07,
          title: 'Créez une opportunité',
          body: 'Bienvenue {{company|chez vous}} : cliquez sur « + Nouvelle opportunité ».',
          placement: 'auto',
          action: { type: 'next' },
          cta: null,
          pulse: true,
          position: 0,
          created_at: now,
          updated_at: now,
        },
      ],
      chapters: [],
      forms: [],
      quiz_questions: [],
      demo_templates: builtinTemplates(),
      onboarding_prefs: [],
      learn_progress: [],
      variables: [
        {
          id: 'var-1',
          workspace_id: ws.id,
          key: 'company',
          label: 'Entreprise',
          default_value: 'votre entreprise',
        },
      ],
      folders: [],
      // L27 : ligne du style livré par défaut (« dsi »), comme la création d'un espace
      themes: [
        {
          id: 'th-default',
          workspace_id: ws.id,
          name: 'Par défaut',
          tokens: builtinStyles().dsi,
          is_default: true,
          builtin_key: 'dsi',
          created_by: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      share_links: [],
      demo_access: [],
      share_rules: [],
      folder_members: [],
      leads: [
        {
          id: 'l1',
          workspace_id: ws.id,
          demo_id: '0b5c1f0e-0000-4000-8000-000000000002',
          version_id: 'v-2',
          link_id: null,
          visitor_id: 'v1',
          email: 'prospect@globex.example',
          fields: { company: 'Globex' },
          consent: true,
          created_at: now,
        },
      ],
      demo_versions: [],
      plans: [
        {
          code: 'free',
          name: 'Free',
          sort: 0,
          limits: {
            published_demos: 3,
            members: 2,
            steps_per_demo: 30,
            remove_branding: false,
            lead_forms: false,
            analytics_retention_days: 30,
          },
        },
        {
          code: 'pro',
          name: 'Pro',
          sort: 1,
          limits: {
            published_demos: 25,
            members: 5,
            steps_per_demo: 100,
            remove_branding: true,
            lead_forms: true,
            analytics_retention_days: 365,
          },
        },
        {
          code: 'business',
          name: 'Business',
          sort: 2,
          limits: {
            published_demos: null,
            members: 25,
            steps_per_demo: null,
            remove_branding: true,
            lead_forms: true,
            analytics_retention_days: 730,
          },
        },
        {
          code: 'enterprise',
          name: 'Enterprise',
          sort: 3,
          limits: {
            share_rules: true,
            published_demos: null,
            members: null,
            steps_per_demo: null,
            remove_branding: true,
            lead_forms: true,
            analytics_retention_days: 1095,
          },
        },
      ],
    },
    calls: [],
    storage: {},
    events: [],
  };
}

function matches(row, key, op, val) {
  const v = row[key];
  switch (op) {
    case 'eq':
      return String(v) === val;
    case 'neq':
      return String(v) !== val;
    case 'is':
      return val === 'null' ? v === null || v === undefined : String(v) === val;
    case 'in':
      return val
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((s) => s.replace(/^"|"$/g, ''))
        .includes(String(v));
    case 'ilike':
      return new RegExp(
        '^' +
          val
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/%/g, '.*') +
          '$',
        'i',
      ).test(String(v ?? ''));
    default:
      return true;
  }
}

async function install(page, state = seed()) {
  const png = fs.readFileSync(path.join(__dirname, 'fixture.png'));
  const t = state.tables;
  currentUserId = state.user?.id ?? null;
  const json = (route, status, body, headers = {}) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', ...headers },
      body: JSON.stringify(body),
    });

  // state.signedOut : visiteur non connecté (écrans d'authentification), identifiants refusés
  if (!state.signedOut)
    await page.addInitScript(
      ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
      [
        STORAGE_KEY,
        {
          access_token: fakeJwt(state.user),
          refresh_token: 'r',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: state.user,
        },
      ],
    );

  // Adresse publique fictive du lecteur (codes d'intégration, liens, aperçus) servie par le lecteur local
  await page.route(`${PUBLIC_PLAYER}/**`, async (route) => {
    const u = new URL(route.request().url());
    try {
      const res = await route.fetch({ url: `${LOCAL_PLAYER}${u.pathname}${u.search}` });
      return route.fulfill({ response: res });
    } catch {
      return route.abort();
    }
  });

  await page.route(`${HOST}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const method = req.method();
    if (method === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      });
    const body =
      req.postData() && (req.headers()['content-type'] || '').includes('json')
        ? JSON.parse(req.postData())
        : null;
    state.calls.push({ method, path: p, query: url.search, body });

    // L11 : Edge Function open-demo (accès décidé côté serveur, manifeste servi par la fonction)
    if (p.startsWith('/functions/v1/open-demo')) {
      const req0 = JSON.parse(req.postData() || '{}');
      const id = req0.demoId;
      const f = state.storage[`published/${id}/latest.json`];
      const demo = state.tables.demos.find((d) => d.id === id);
      if (!f || !demo) return json(route, 200, { status: 'not_found' });
      const ws = state.tables.workspaces.find((w) => w.id === demo.workspace_id);
      const info = {
        title: demo.title,
        workspace: ws?.name ?? '',
        website: ws?.settings?.websiteUrl ?? null,
      };
      const acc = (state.tables.demo_access || []).find((a) => a.demo_id === id);
      if (acc?.expires_at && new Date(acc.expires_at) <= new Date())
        return json(route, 200, { ...info, status: 'expired', expiredAt: acc.expires_at });
      // Comme la fonction : toute ressource relative « assets/… » devient une URL signée
      const sign = (v) =>
        typeof v === 'string'
          ? /^assets\/[\w.-]+$/.test(v)
            ? `${HOST}/storage/v1/object/sign/published/${id}/${v}?token=t`
            : v
          : Array.isArray(v)
            ? v.map(sign)
            : v && typeof v === 'object'
              ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sign(x)]))
              : v;
      const ok = (extra = {}) =>
        json(route, 200, { ...info, ...extra, status: 'ok', manifest: sign(JSON.parse(f.data.toString())) });
      if (!acc || acc.mode === 'link') return ok();
      state.grants = state.grants || {};
      if (req0.grant && state.grants[req0.grant] === id) return ok();
      if (!req0.password) return json(route, 200, { ...info, status: 'password_required' });
      acc.failures = acc.failures || 0;
      if (acc.lockedUntil && acc.lockedUntil > Date.now())
        return json(route, 200, { ...info, status: 'locked', retryIn: 60 });
      if (req0.password === acc.password) {
        acc.failures = 0;
        const grant = `grant-${Object.keys(state.grants).length + 1}`;
        state.grants[grant] = id;
        return ok({ grant });
      }
      acc.failures++;
      if (acc.failures >= 5) {
        acc.failures = 0;
        acc.lockedUntil = Date.now() + 60_000;
        return json(route, 200, { ...info, status: 'locked', retryIn: 60 });
      }
      return json(route, 200, { ...info, status: 'password_wrong', remaining: 5 - acc.failures });
    }
    // L23 : envoi immédiat (test, rejeu) ; résultat réglable par state.dispatchResult
    if (p.startsWith('/functions/v1/webhooks-dispatch')) {
      const d = (t.webhook_deliveries || []).find(
        (x) => x.id === body?.delivery_id && x.status === 'pending',
      );
      if (!d) return json(route, 404, { error: 'not_found' });
      const r = { status: 200, duration_ms: 180, error: null, ...(state.dispatchResult || {}) };
      const ok = r.status >= 200 && r.status < 300;
      Object.assign(d, {
        status: ok ? 'success' : d.event_type === 'ping' ? 'failed' : 'pending',
        response_status: r.status,
        response_body: ok ? 'ok' : 'Not Found',
        duration_ms: r.duration_ms,
        error: r.error,
        finished_at: new Date().toISOString(),
      });
      return json(route, 200, { ...r, outcome: d.status });
    }
    // L18 : fonction media (dépôt multipart, suppression) ; type réel simulé d'après le nom du fichier
    if (p.startsWith('/functions/v1/media')) {
      const list = (t.media_files ||= []);
      if (method === 'DELETE') {
        const row = list.find((x) => x.id === body?.id);
        if (!row) return json(route, 404, { error: 'NOT_FOUND' });
        t.media_files = list.filter((x) => x !== row);
        (state.mediaDeleted ||= []).push(row.id);
        return json(route, 200, { deleted: row.id });
      }
      const raw = (req.postDataBuffer() || Buffer.alloc(0)).toString('latin1');
      const field = (n) => new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`).exec(raw)?.[1] ?? '';
      const fname = /filename="([^"]*)"/.exec(raw)?.[1] ?? field('name');
      const ext = (fname.split('.').pop() || '').toLowerCase();
      const mime = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        svg: 'image/svg+xml',
        woff2: 'font/woff2',
      }[ext];
      if (!mime) return json(route, 415, { error: 'BAD_TYPE' });
      if (state.mediaReject) return json(route, 422, { error: state.mediaReject });
      const ws = field('ws');
      const row = {
        id: crypto.randomUUID(),
        workspace_id: ws,
        kind: field('kind') || 'image',
        name: field('name') || fname,
        path: `${ws}/${crypto.randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`,
        mime,
        size_bytes: 120000,
        width: null,
        height: null,
        created_by: state.user.id,
        created_at: new Date().toISOString(),
      };
      // Contenu du fichier (Playwright ne transmet pas les octets d'un envoi multipart) : fourni par
      // le test dans state.mediaFiles[nom], pour une vignette fidèle dans la médiathèque
      const content = state.mediaFiles?.[fname];
      if (content) {
        state.storage[`media/${row.path}`] = { data: content, type: mime };
        row.size_bytes = content.length;
      }
      list.unshift(row);
      return json(route, 200, row);
    }
    if (p.startsWith('/functions/v1/track')) {
      const batch = JSON.parse(req.postData() || '{}');
      state.events.push(...(batch.events || []));
      return json(route, 200, { inserted: (batch.events || []).length });
    }
    if (state.signedOut && p.startsWith('/auth/v1/token'))
      return json(route, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    if (p.startsWith('/auth/v1/user')) {
      if (method === 'PUT' && body?.data)
        state.user.user_metadata = { ...state.user.user_metadata, ...body.data };
      return json(route, 200, state.user);
    }
    if (p.startsWith('/auth/v1/')) return json(route, 200, {});

    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.split('/').pop();
      const a = body || {};
      switch (fn) {
        case 'workspace_usage': {
          // Calculé depuis l'espace demandé (plan, démos, membres), comme la RPC réelle
          const w = t.workspaces.find((x) => x.id === a.p_workspace) || t.workspaces[0];
          const plan = t.plans.find((x) => x.code === w.plan_code) || t.plans[0];
          const live = t.demos.filter((d) => d.workspace_id === w.id && !d.deleted_at);
          return json(route, 200, {
            plan: plan.code,
            limits: plan.limits,
            published_demos: live.filter((d) => d.status === 'published').length,
            demos: live.length,
            members: t.members.filter((m) => m.workspace_id === w.id).length,
          });
        }
        case 'set_comment_resolved': {
          const c = (t.step_comments || []).find((x) => x.id === a.p_comment);
          if (c) Object.assign(c, { resolved_at: a.p_resolved ? new Date().toISOString() : null });
          return json(route, 200, null);
        }
        case 'list_members': {
          // Annuaire facultatif (maquette) : membres de t.members avec nom et email
          const dir = state.memberDirectory || {};
          const me = t.profiles?.[0]?.full_name || 'Alice';
          const others = (t.members || [])
            .filter((m) => m.user_id !== state.user.id && dir[m.user_id])
            .map((m) => ({ user_id: m.user_id, role: m.role, created_at: m.created_at, ...dir[m.user_id] }));
          return json(route, 200, [
            {
              user_id: state.user.id,
              email: state.user.email,
              full_name: me === 'Alice' ? 'Alice' : me,
              role: 'owner',
              created_at: '2026-01-01',
            },
            ...others,
            ...(state.extraMembers || []),
          ]);
        }
        case 'workspace_overview':
          return json(
            route,
            200,
            t.demos
              .filter((d) => !a.p_workspace || d.workspace_id === a.p_workspace)
              .map((d) => ({
                demo_id: d.id,
                views: d.status === 'published' ? 120 : 0,
                visitors: d.status === 'published' ? 90 : 0,
                completions: d.status === 'published' ? 40 : 0,
                leads: d.status === 'published' ? 1 : 0,
              })),
          );
        case 'demo_analytics':
          if (a.p_to && Date.parse(a.p_to) < Date.now() - 86400000)
            return json(route, 200, {
              views: 96,
              visitors: 80,
              completions: 30,
              ctaClicks: 14,
              leads: 0,
              steps: [],
              daily: [],
            });
          return json(route, 200, {
            views: 120,
            visitors: 90,
            completions: 40,
            ctaClicks: 12,
            leads: 1,
            steps: [
              { stepIndex: 0, visitors: 90 },
              { stepIndex: 1, visitors: 62 },
              { stepIndex: 2, visitors: 41 },
            ],
            daily: [
              { day: '2026-11-15', views: 30, visitors: 24 },
              { day: '2026-11-16', views: 50, visitors: 38 },
              { day: '2026-11-17', views: 40, visitors: 28 },
            ],
            sources: { direct: 62, embed: 34, link: 24 },
          });
        case 'workspace_analytics': {
          // Agrégats synthétiques déterministes (comme workspace_kpis) + série et sources
          const previous = a.p_to && Date.parse(a.p_to) < Date.now() - 86400000;
          const pub = t.demos.filter(
            (d) => d.status === 'published' && !d.deleted_at && (!a.p_demo || d.id === a.p_demo),
          ).length;
          const k = previous ? 0.85 : 1;
          const views = Math.round(267 * pub * k);
          const days = Math.max(
            1,
            Math.round((Date.parse(a.p_to || new Date().toISOString()) - Date.parse(a.p_from)) / 86400000),
          );
          const daily = Array.from({ length: days }, (_, i) => {
            const day = new Date(Date.parse(a.p_to || new Date().toISOString()) - (days - 1 - i) * 86400000)
              .toISOString()
              .slice(0, 10);
            const v = Math.round((views / days) * (0.7 + 0.6 * Math.abs(Math.sin(i / 3))));
            return { day, views: v, completions: Math.round(v * 0.62) };
          });
          state.lastSegment = a.p_segment ?? null;
          return json(route, 200, {
            segmentVisitors: a.p_segment ? (state.segmentVisitors ?? 120) : null,
            views,
            visitors: Math.round(views * 0.65),
            completions: Math.round(views * 0.65 * 0.64),
            ctaClicks: Math.round(views * 0.05),
            leads: Math.round(views * 0.0266),
            daily,
            sources: {
              embed: Math.round(views * 0.6),
              link: Math.round(views * 0.21),
              direct: Math.round(views * 0.19),
            },
          });
        }
        case 'workspace_leads': {
          const rows = t.leads
            .filter((l) => !a.p_demo || l.demo_id === a.p_demo)
            .map((l, i) => ({
              id: l.id,
              email: l.email,
              fields: l.fields,
              consent: l.consent,
              created_at: l.created_at,
              demo_id: l.demo_id,
              max_step: i % 2 ? 4 : 5,
              completed: i % 2 === 0,
              steps_total: 6,
            }));
          const off = a.p_offset || 0;
          return json(route, 200, { total: rows.length, rows: rows.slice(off, off + (a.p_limit || 50)) });
        }
        case 'workspace_sessions': {
          const rows = t.leads.slice(0, 30).map((l, i) => ({
            session_id: `s${i}`,
            demo_id: l.demo_id,
            source: ['link', 'embed', 'direct'][i % 3],
            started_at: new Date(Date.now() - (i + 1) * 3 * 3600000).toISOString(),
            duration_s: 48 + ((i * 37) % 160),
            max_step: i % 2 ? 3 : 5,
            completed: i % 2 === 0,
            steps_total: 6,
            has_lead: i % 3 !== 1,
            lead_email: i % 3 === 1 || state.role === 'viewer' ? null : l.email,
            lead_fields: i % 3 === 1 || state.role === 'viewer' ? null : l.fields,
          }));
          const off = a.p_offset || 0;
          state.lastSessionsSegment = a.p_segment ?? null;
          // L19 : segment de moins de 5 visiteurs : aucune ligne
          if (a.p_segment && state.segmentVisitors != null && state.segmentVisitors < 5)
            return json(route, 200, { total: 0, rows: [], tooSmall: true });
          return json(route, 200, { total: rows.length, rows: rows.slice(off, off + (a.p_limit || 25)) });
        }
        case 'quiz_stats':
          return json(
            route,
            200,
            state.quizStats ?? { attempts: 0, visitors: 0, passRate: 0, avgScore: 0, questions: [] },
          );
        case 'workspace_kpis': {
          const previous = a.p_to && Date.parse(a.p_to) < Date.now() - 86400000;
          const pub = t.demos.filter((d) => d.status === 'published' && !d.deleted_at).length;
          return json(route, 200, {
            views: (previous ? 96 : 120) * pub,
            visitors: (previous ? 80 : 90) * pub,
            completions: (previous ? 30 : 40) * pub,
            leads: (previous ? 0 : 1) * pub,
          });
        }
        case 'set_folder_access': {
          // L27-09 : dossier restreint à des membres choisis (administrateurs toujours inclus)
          const f = t.folders.find((x) => x.id === a.p_folder);
          if (!f) return json(route, 400, { code: '42501', message: 'FORBIDDEN' });
          f.restricted = !!a.p_restricted;
          t.folder_members = t.folder_members.filter((m) => m.folder_id !== f.id);
          if (f.restricted)
            for (const u of a.p_users || [])
              t.folder_members.push({ folder_id: f.id, user_id: u, workspace_id: f.workspace_id });
          state.folderAccessCalls = [...(state.folderAccessCalls || []), a];
          return json(route, 200, null);
        }
        case 'folder_hidden_count': {
          const f = t.folders.find((x) => x.id === a.p_folder);
          if (!f?.restricted) return json(route, 200, 0);
          const others = (t.members || []).filter((m) => m.role !== 'admin' && m.role !== 'owner');
          return json(
            route,
            200,
            others.filter(
              (m) => !t.folder_members.some((x) => x.folder_id === f.id && x.user_id === m.user_id),
            ).length,
          );
        }
        case 'share_rules_preview': {
          // L27-07 : démos publiées dont le mode est interdit ou sans expiration sous la limite
          const items = [];
          let locked = 0;
          for (const d of t.demos.filter(
            (x) => x.workspace_id === a.p_ws && x.status === 'published' && !x.deleted_at,
          )) {
            const acc = (t.demo_access || []).find((x) => x.demo_id === d.id);
            if (acc?.locked_by_rules) continue;
            const mode = acc?.mode || 'link';
            if (!a.p_modes.includes(mode)) {
              items.push({ title: d.title, kind: 'mode', mode });
              if (!a.p_modes.includes('link') && !(a.p_modes.includes('password') && acc?.password)) locked++;
            } else if (
              a.p_max_days &&
              (!acc?.expires_at || Date.parse(acc.expires_at) > Date.now() + a.p_max_days * 864e5)
            )
              items.push({ title: d.title, kind: 'expiry', mode });
          }
          return json(route, 200, { count: items.length, locked, items: items.slice(0, 5) });
        }
        case 'set_share_rules': {
          const ws = t.workspaces.find((w) => w.id === a.p_ws);
          if (ws?.plan_code !== 'enterprise')
            return json(route, 400, { code: 'P0001', message: 'PLAN_REQUIRED:share_rules' });
          state.shareRulesCalls = [...(state.shareRulesCalls || []), a];
          let fixed = 0;
          let lockedN = 0;
          if (a.p_fix)
            for (const d of t.demos.filter((x) => x.workspace_id === a.p_ws && x.status === 'published')) {
              if (!t.demo_access) t.demo_access = [];
              let acc = t.demo_access.find((x) => x.demo_id === d.id);
              const mode = acc?.mode || 'link';
              if (a.p_modes.includes(mode)) continue;
              if (!acc)
                t.demo_access.push(
                  (acc = { demo_id: d.id, workspace_id: a.p_ws, mode: 'link', ask_email: false }),
                );
              if (a.p_modes.includes('password') && acc.password) ((acc.mode = 'password'), fixed++);
              else ((acc.locked_by_rules = true), lockedN++);
            }
          t.share_rules = t.share_rules.filter((r) => r.workspace_id !== a.p_ws);
          t.share_rules.push({
            workspace_id: a.p_ws,
            modes: a.p_modes,
            max_link_days: a.p_max_days,
            publish_role: a.p_publish_role,
            exports_allowed: a.p_exports,
          });
          return json(route, 200, { fixed, locked: lockedN });
        }
        case 'set_default_style': {
          // L27-03 : style livré (ligne masquée) ou style de l'espace
          const rows = t.themes.filter((x) => x.workspace_id === a.p_ws);
          for (const r of rows) r.is_default = false;
          if (a.p_theme) {
            t.themes = t.themes.filter((x) => !(x.workspace_id === a.p_ws && x.builtin_key));
            const r = t.themes.find((x) => x.id === a.p_theme);
            if (r) r.is_default = true;
          } else {
            const tokens = builtinStyles()[a.p_builtin];
            if (!tokens) return json(route, 400, { code: 'P0001', message: 'NOT_FOUND' });
            let r = rows.find((x) => x.builtin_key);
            if (!r)
              t.themes.push(
                (r = { id: crypto.randomUUID(), workspace_id: a.p_ws, name: 'Par défaut', created_by: null }),
              );
            Object.assign(r, { builtin_key: a.p_builtin, tokens, is_default: true });
          }
          return json(route, 200, null);
        }
        case 'default_style_impact':
          return json(
            route,
            200,
            t.demos.filter((d) => d.workspace_id === a.p_ws && !d.deleted_at && !d.settings?.theme?.primary)
              .length,
          );
        case 'workspace_onboarding': {
          // L26-01 : étapes fixées par le test (state.onboarding), sinon déduites des données
          const ws = a.p_ws;
          const st = state.onboarding || {
            brand: false,
            extension: false,
            capture: t.steps.some((x) => x.workspace_id === ws && x.image_path),
            pii: false,
            publish: t.demos.some((d) => d.workspace_id === ws && d.status === 'published'),
            invite: t.members.filter((m) => m.workspace_id === ws).length >= 2,
            distribute: false,
          };
          const pref = t.onboarding_prefs.find((p) => p.workspace_id === ws);
          return json(route, 200, {
            steps: st,
            doneAt: state.onboardingDoneAt ?? null,
            hiddenAt: pref?.hidden_at ?? null,
          });
        }
        case 'help_feedback': {
          state.helpFeedback = [...(state.helpFeedback || []), a];
          return json(route, 200, null);
        }
        case 'create_demo_from_template': {
          const tpl = t.demo_templates.find(
            (x) => x.id === a.p_template && (x.workspace_id === null || x.workspace_id === a.p_ws),
          );
          if (!tpl) return json(route, 400, { message: 'TEMPLATE_NOT_FOUND', code: 'P0001' });
          const base = t.demos[0];
          const id = `demo-${crypto.randomUUID().slice(0, 6)}`;
          t.demos.push({
            ...base,
            id,
            workspace_id: a.p_ws,
            folder_id: a.p_folder ?? null,
            title: tpl.name,
            status: 'draft',
            current_version_id: null,
            settings: { ...(tpl.structure.settings || {}) },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          let pos = 0;
          const ids = [];
          (tpl.structure.chapters || []).forEach((c, ci) => {
            let chap = null;
            if (c.title) {
              chap = crypto.randomUUID();
              t.chapters.push({ id: chap, demo_id: id, workspace_id: a.p_ws, title: c.title, position: ci });
            }
            for (const st of c.steps || []) {
              if (st.type === 'quiz') continue;
              const sid = crypto.randomUUID();
              ids.push(sid);
              const text = ['popup', 'fin', 'texte'].includes(st.type);
              const options = { ...(st.options || {}) };
              if (st.type === 'popup') options.display = 'popup';
              if (st.type === 'saisie' && st.typing)
                options.animation = {
                  type: 'typing',
                  text: st.typing,
                  field: null,
                  fieldLabel: '',
                  speed: 'normal',
                };
              const img = tpl.workspace_id === a.p_ws && st.image ? st.image : null;
              t.steps.push({
                ...t.steps[0],
                id: sid,
                demo_id: id,
                workspace_id: a.p_ws,
                position: pos++,
                chapter_id: chap,
                kind: text ? 'text' : 'image',
                title: st.title || '',
                body: st.body || '',
                options,
                cta: st.cta || null,
                image_path: img ? img.path : null,
                image_width: img ? img.width : null,
                image_height: img ? img.height : null,
                blurs: img ? img.blurs || [] : [],
                page_url: null,
                page_title: null,
                element_meta: {},
                presenter_notes: '',
                to_capture: !text && !img,
              });
              if (!text) {
                const hs =
                  st.hotspots && st.hotspots.length
                    ? st.hotspots
                    : [{ x: 0.45, y: 0.45, w: 0.1, h: 0.06, title: st.bubble || '', body: '' }];
                hs.forEach((h, hi) =>
                  t.hotspots.push({
                    ...t.hotspots[0],
                    id: crypto.randomUUID(),
                    step_id: sid,
                    demo_id: id,
                    workspace_id: a.p_ws,
                    x: h.x,
                    y: h.y,
                    w: h.w,
                    h: h.h,
                    title: h.title || '',
                    body: h.body || '',
                    action: { type: 'next' },
                    position: hi,
                  }),
                );
              }
            }
          });
          (tpl.structure.quiz || []).forEach((q, qi) =>
            t.quiz_questions.push({
              id: crypto.randomUUID(),
              demo_id: id,
              workspace_id: a.p_ws,
              position: qi,
              type: q.type,
              prompt: q.prompt,
              answers: q.answers,
              explanation: q.explanation || '',
              step_id: null,
              points: q.points || 1,
            }),
          );
          state.lastTemplateDemo = id;
          return json(route, 200, id);
        }
        case 'save_demo_as_template': {
          const d = t.demos.find((x) => x.id === a.p_demo);
          const steps = t.steps.filter((x) => x.demo_id === d.id).sort((x, y) => x.position - y.position);
          const toJson = (x) => ({
            type:
              x.kind === 'text'
                ? x.options?.display === 'popup'
                  ? 'popup'
                  : 'texte'
                : x.options?.animation?.type === 'typing'
                  ? 'saisie'
                  : 'bulle',
            title: x.title,
            body: x.body,
            ...(a.p_with_captures && x.image_path
              ? {
                  image: { path: x.image_path, width: x.image_width, height: x.image_height, blurs: x.blurs },
                }
              : {}),
            hotspots: t.hotspots
              .filter((h) => h.step_id === x.id)
              .map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h, title: h.title, body: h.body })),
          });
          const chapters = t.chapters
            .filter((c) => c.demo_id === d.id)
            .sort((x, y) => x.position - y.position)
            .map((c) => ({ title: c.title, steps: steps.filter((x) => x.chapter_id === c.id).map(toJson) }));
          const loose = steps.filter((x) => !x.chapter_id).map(toJson);
          const row = {
            id: `tpl-${crypto.randomUUID().slice(0, 6)}`,
            workspace_id: d.workspace_id,
            builtin_key: null,
            name: a.p_name,
            description: a.p_description || '',
            category: a.p_category,
            icon: 'layout-template',
            structure: {
              settings: d.settings || {},
              chapters: [...(loose.length ? [{ title: '', steps: loose }] : []), ...chapters],
              quiz: t.quiz_questions.filter((q) => q.demo_id === d.id),
            },
            with_captures: !!a.p_with_captures,
            created_by: state.user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          t.demo_templates.push(row);
          state.lastTemplateArgs = a;
          return json(route, 200, row.id);
        }
        case 'duplicate_demo': {
          const src = t.demos.find((d) => d.id === a.p_demo);
          const id = `demo-${crypto.randomUUID().slice(0, 6)}`;
          t.demos.push({
            ...src,
            id,
            title: `${src.title} (copie)`,
            status: 'draft',
            current_version_id: null,
          });
          return json(route, 200, id);
        }
        case 'publish_demo': {
          const d = t.demos.find((x) => x.id === a.p_demo);
          const steps = t.steps.filter((s) => s.demo_id === d.id).sort((x, y) => x.position - y.position);
          if (!steps.length) return json(route, 400, { message: 'DEMO_EMPTY', code: 'P0001' });
          const toCapture = steps.filter((s) => s.to_capture && !s.image_path).length;
          if (toCapture) return json(route, 400, { message: `TO_CAPTURE:${toCapture}`, code: 'P0001' });
          const ws = t.workspaces?.find((w) => w.id === d.workspace_id);
          if (ws && ws.public_links_enabled === false)
            return json(route, 400, { message: 'PUBLIC_DISABLED', code: 'P0001' });
          if (!a.p_ack?.reviewed || !a.p_ack?.fictional)
            return json(route, 400, { message: 'GDPR_ACK_REQUIRED', code: 'P0001' });
          state.lastAck = a.p_ack;
          const baBad = steps.findIndex(
            (s) => s.kind === 'before_after' && (!s.image_path || !s.before_image_path),
          );
          if (baBad >= 0)
            return json(route, 400, { message: `BEFORE_AFTER_INCOMPLETE:${baBad + 1}`, code: 'P0001' });
          const versionId = crypto.randomUUID();
          const number = t.demo_versions.filter((v) => v.demo_id === d.id).length + 1;
          const manifest = {
            schemaVersion: 1,
            demoId: d.id,
            versionId,
            workspaceId: d.workspace_id,
            title: d.title,
            locale: 'fr',
            publishedAt: new Date().toISOString(),
            theme: { ...(d.settings.theme || {}) },
            variables: t.variables.map((v) => ({ key: v.key, label: v.label, default: v.default_value })),
            chapters: [],
            forms: t.forms
              .filter((f) => f.demo_id === d.id)
              .map((f) => ({
                id: f.id,
                title: f.title,
                description: f.description,
                submitLabel: f.submit_label,
                fields: f.fields,
                consentText: f.consent_text,
                skippable: f.skippable,
              })),
            allowedEmbedOrigins: d.settings.allowedEmbedOrigins || [],
            trackUrl: null,
            steps: steps.map((s) => ({
              id: s.id,
              chapterId: null,
              kind: s.kind,
              image: s.image_path
                ? { url: `assets/${s.id}.webp`, width: s.image_width, height: s.image_height }
                : null,
              snapshotUrl: null,
              // L17 : comme publish_demo (capture « Avant », sans les sources)
              beforeAfter:
                s.kind === 'before_after' && s.before_image_path
                  ? {
                      ...(({ sources, ...rest }) => rest)(s.options?.beforeAfter || {}),
                      before: {
                        url: `assets/${s.id}-b.webp`,
                        width: s.before_image_width,
                        height: s.before_image_height,
                      },
                      beforeBlurs: s.before_blurs || [],
                    }
                  : null,
              title: s.title,
              body: s.body,
              blurs: s.blurs,
              zoom: s.zoom,
              cta: s.cta,
              gateFormId: s.gate_form_id,
              hotspots: t.hotspots
                .filter((h) => h.step_id === s.id)
                .map((h) => ({
                  id: h.id,
                  x: h.x,
                  y: h.y,
                  w: h.w,
                  h: h.h,
                  title: h.title,
                  body: h.body,
                  placement: h.placement,
                  action: h.action,
                  cta: h.cta,
                  pulse: h.pulse,
                })),
            })),
          };
          t.demo_versions.push({
            id: versionId,
            demo_id: d.id,
            number,
            manifest,
            published_by: state.user.id,
            published_at: new Date().toISOString(),
            // F1 : confirmation RGPD (auteur, date) quand la publication est publique
            public_ack: a.p_ack ? { by: state.user.id, at: new Date().toISOString(), reviewed: true } : null,
          });
          return json(route, 200, {
            versionId,
            number,
            manifest,
            copies: [
              ...steps
                .filter((s) => s.image_path)
                .map((s) => ({ from: s.image_path, to: `${d.id}/assets/${s.id}.webp` })),
              ...steps
                .filter((s) => s.kind === 'before_after' && s.before_image_path)
                .map((s) => ({ from: s.before_image_path, to: `${d.id}/assets/${s.id}-b.webp` })),
            ],
          });
        }
        case 'finalize_publication': {
          const v = t.demo_versions.find((x) => x.id === a.p_version);
          const d = t.demos.find((x) => x.id === v.demo_id);
          d.status = 'published';
          d.current_version_id = v.id;
          return json(route, 200, null);
        }
        case 'unpublish_demo': {
          t.demos.find((x) => x.id === a.p_demo).status = 'draft';
          return json(route, 200, null);
        }
        case 'create_workspace': {
          // Nouvel espace vide (comme en vrai) : aucune démo, aucune vue
          const ws = { ...t.workspaces[0], id: crypto.randomUUID(), name: a.p_name, slug: null };
          t.workspaces.push(ws);
          t.members.push({
            workspace_id: ws.id,
            user_id: t.members[0].user_id,
            role: 'owner',
            created_at: '2026-01-01',
          });
          return json(route, 200, ws);
        }
        case 'track_events':
          state.events.push(...(a.p_batch?.events || []));
          return json(route, 200, (a.p_batch?.events || []).length);
        case 'submit_lead':
          t.leads.push({
            id: crypto.randomUUID(),
            email: a.p_email,
            fields: a.p_fields,
            demo_id: a.p_demo,
            consent: a.p_consent,
            created_at: new Date().toISOString(),
          });
          return json(route, 200, 'lead-id');
        case 'set_demo_password':
        case 'set_demo_access': {
          if (!t.demo_access) t.demo_access = [];
          let row = t.demo_access.find((x) => x.demo_id === a.p_demo);
          if (fn === 'set_demo_access' && a.p_mode === 'password' && !row?.password)
            return json(route, 400, { code: 'P0001', message: 'PASSWORD_REQUIRED' });
          if (fn === 'set_demo_password' && (a.p_password || '').length < 8)
            return json(route, 400, { code: 'P0001', message: 'PASSWORD_LENGTH' });
          const demo = t.demos.find((d) => d.id === a.p_demo);
          if (!row) {
            row = {
              demo_id: a.p_demo,
              workspace_id: demo?.workspace_id,
              mode: 'link',
              ask_email: false,
              expires_at: null,
            };
            t.demo_access.push(row);
          }
          if (fn === 'set_demo_password') {
            Object.assign(row, {
              mode: 'password',
              password: a.p_password,
              password_changed_at: new Date().toISOString(),
            });
            state.grants = {};
          } else
            Object.assign(row, {
              mode: a.p_mode,
              ask_email: !!a.p_ask_email,
              expires_at: a.p_expires_at ?? null,
            });
          row.updated_at = new Date().toISOString();
          return json(route, 200, null);
        }
        // L14 : centre de formation (réglages)
        case 'center_slug_available': {
          const taken =
            (state.takenSlugs || []).includes(a.p_slug) ||
            (t.training_centers || []).some((c) => c.slug === a.p_slug && c.workspace_id !== a.p_ws);
          return json(route, 200, /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(a.p_slug) && !taken);
        }
        case 'save_center_draft': {
          if ((state.takenSlugs || []).includes(a.p_slug))
            return json(route, 400, { code: 'P0001', message: 'SLUG_TAKEN' });
          const list = (t.training_centers ||= []);
          let c = list.find((x) => x.workspace_id === a.p_ws);
          if (!c) {
            c = {
              workspace_id: a.p_ws,
              published: null,
              published_at: null,
              access_mode: 'link',
              password_changed_at: null,
            };
            list.push(c);
          }
          Object.assign(c, { slug: a.p_slug, draft: a.p_draft, updated_at: new Date().toISOString() });
          return json(route, 200, null);
        }
        case 'publish_center': {
          const c = (t.training_centers || []).find((x) => x.workspace_id === a.p_ws);
          if (!c) return json(route, 400, { code: 'P0001', message: 'NO_VISIBLE_PATH' });
          c.published = JSON.parse(JSON.stringify(c.draft));
          c.published_at = new Date().toISOString();
          return json(route, 200, c.published_at);
        }
        case 'set_center_access': {
          const c = (t.training_centers || []).find((x) => x.workspace_id === a.p_ws);
          if (c) c.access_mode = a.p_mode;
          return json(route, 200, null);
        }
        case 'set_center_password': {
          const c = (t.training_centers || []).find((x) => x.workspace_id === a.p_ws);
          if (c) Object.assign(c, { access_mode: 'password', password_changed_at: new Date().toISOString() });
          (state.centerPasswords ||= []).push(a.p_password.length);
          return json(route, 200, null);
        }
        // L13 : suivi des apprenants. state.learners = réponse de learners_progress (paths, structures, learners)
        case 'learners_progress':
          return json(route, 200, state.learners || { paths: [], structures: [], learners: [] });
        case 'learner_detail':
          return json(
            route,
            200,
            (state.learnerDetail || {})[a.p_learner] || { events: [], attempts: [], reminders: [] },
          );
        case 'record_reminders': {
          const now = new Date().toISOString();
          const kept = (state.learners?.learners || []).filter(
            (l) =>
              a.p_learners.includes(l.id) &&
              l.email &&
              (!l.lastReminder || Date.now() - Date.parse(l.lastReminder) >= 72 * 3600e3),
          );
          for (const l of kept) l.lastReminder = now;
          return json(
            route,
            200,
            kept.map((l) => l.id),
          );
        }
        case 'grant_quiz_attempt': {
          const m = state.learners?.learners
            .find((l) => l.id === a.p_learner)
            ?.modules.find((x) => x.demoId === a.p_demo);
          if (m && m.max !== null) {
            m.max += 1;
            if (m.status === 'failed') m.status = 'in_progress';
          }
          return json(route, 200, 1);
        }
        case 'log_learners_export':
          (state.audit ||= []).push({ action: 'learners.export', rows: a.p_rows, columns: a.p_columns });
          return json(route, 200, null);
        case 'erase_learner': {
          const list = state.learners?.learners || [];
          const l = list.find((x) => x.id === a.p_learner);
          if (!l || String(a.p_confirm).trim().toLowerCase() !== (l.email || l.name).toLowerCase())
            return json(route, 400, { code: 'P0001', message: 'CONFIRMATION_MISMATCH' });
          state.learners.learners = list.filter((x) => x.id !== a.p_learner);
          (state.audit ||= []).push({ action: 'learner.erase' });
          return json(route, 200, null);
        }
        case 'mark_notifications_read': {
          // L22-05 : comme la RPC, seulement les notifications de l'utilisateur
          let n = 0;
          for (const x of t.notifications || [])
            if (x.user_id === state.user.id && !x.read_at && (!a.p_ids || a.p_ids.includes(x.id))) {
              x.read_at = new Date().toISOString();
              n++;
            }
          return json(route, 200, n);
        }
        // ===== L18 : médiathèque =====
        case 'media_used':
          return json(
            route,
            200,
            (state.mediaBaseUsed || 0) + (t.media_files || []).reduce((n, x) => n + (x.size_bytes || 0), 0),
          );
        case 'media_usage':
          return json(
            route,
            200,
            (t.media_files || []).map((m) => ({
              id: m.id,
              demos: t.demos.filter((d) => !d.deleted_at && JSON.stringify(d.settings || {}).includes(m.path))
                .length,
            })),
          );
        // ===== L18 : test A/B =====
        case 'ab_start': {
          const h = t.hotspots.find((x) => x.id === a.p_hotspot);
          const st = t.steps.find((x) => x.id === h.step_id);
          const list = (t.ab_tests ||= []);
          const run = list.find((x) => x.demo_id === st.demo_id && x.status === 'running');
          if (run) {
            const n =
              t.steps
                .filter((x) => x.demo_id === st.demo_id)
                .sort((x, y) => x.position - y.position)
                .findIndex((x) => x.id === run.step_id) + 1;
            return json(route, 400, { message: `AB_ALREADY_RUNNING:${n}`, code: 'P0001' });
          }
          const row = {
            id: crypto.randomUUID(),
            workspace_id: st.workspace_id,
            demo_id: st.demo_id,
            step_id: st.id,
            hotspot_id: h.id,
            status: 'running',
            split_b: 50,
            goal: 'completion',
            label_b: a.p_label || 'Variante B',
            variant_b: { title: h.title, body: h.body, cta: h.cta },
            history: [],
            kept: null,
            started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
            ended_at: null,
            created_by: state.user.id,
          };
          list.push(row);
          return json(route, 200, row.id);
        }
        case 'ab_update': {
          const x = (t.ab_tests || []).find((y) => y.id === a.p_test);
          if (a.p_b) {
            x.variant_b = { ...x.variant_b, ...a.p_b };
            x.history.push({ at: new Date().toISOString(), fields: Object.keys(a.p_b) });
          }
          if (a.p_split) x.split_b = a.p_split;
          if (a.p_goal) x.goal = a.p_goal;
          if (a.p_label) x.label_b = a.p_label;
          return json(route, 200, null);
        }
        case 'ab_end': {
          const x = (t.ab_tests || []).find((y) => y.id === a.p_test);
          if (a.p_keep === 'B') {
            const h = t.hotspots.find((y) => y.id === x.hotspot_id);
            Object.assign(h, {
              title: x.variant_b.title,
              body: x.variant_b.body,
              cta: x.variant_b.cta ?? null,
            });
          }
          Object.assign(x, {
            status: a.p_keep ? 'ended' : 'stopped',
            kept: a.p_keep || null,
            ended_at: new Date().toISOString(),
          });
          return json(route, 200, null);
        }
        // ===== L26-10 / 11 : télécommande du mode présentateur =====
        case 'present_remote_start': {
          state.remotes = state.remotes || [];
          state.remotes.forEach((r) => r.demo_id === a.p_demo && (r.ended = true));
          const r = {
            id: crypto.randomUUID(),
            demo_id: a.p_demo,
            code: state.remoteCode || String(crypto.randomInt(0, 1e8)).padStart(8, '0'),
            codeExpiresAt: new Date(Date.now() + 300000).toISOString(),
            channel: crypto.randomBytes(16).toString('hex'),
            token: null,
            failures: 0,
            ended: false,
          };
          state.remotes.push(r);
          return json(route, 200, {
            id: r.id,
            code: r.code,
            codeExpiresAt: r.codeExpiresAt,
            channel: r.channel,
          });
        }
        case 'present_remote_new_code': {
          const r = (state.remotes || []).find((x) => x.id === a.p_id);
          r.code = String(crypto.randomInt(0, 1e8)).padStart(8, '0');
          r.failures = 0;
          r.codeExpiresAt = new Date(Date.now() + 300000).toISOString();
          return json(route, 200, { code: r.code, codeExpiresAt: r.codeExpiresAt });
        }
        case 'present_remote_status': {
          const r = (state.remotes || []).find((x) => x.id === a.p_id);
          return json(
            route,
            200,
            r ? { paired: !!r.token, channel: r.channel, active: !r.ended, failures: r.failures } : null,
          );
        }
        case 'present_remote_end': {
          const r = (state.remotes || []).find((x) => x.id === a.p_id);
          if (r) r.ended = true;
          return json(route, 200, null);
        }
        case 'present_remote_pair':
        case 'present_remote_state': {
          const list = state.remotes || [];
          const r =
            fn === 'present_remote_state'
              ? list.find((x) => x.token && x.token === a.p_token)
              : list.find((x) => !x.ended && x.code && x.code === a.p_code && (!a.p_id || x.id === a.p_id));
          if (!r || r.ended) {
            const bad = a.p_id && list.find((x) => x.id === a.p_id);
            if (bad) bad.failures += 1;
            return json(route, 200, { status: fn === 'present_remote_state' ? 'ended' : 'invalid' });
          }
          if (fn === 'present_remote_pair') {
            r.code = null;
            r.token = crypto.randomBytes(32).toString('hex');
            r.channel = crypto.randomBytes(16).toString('hex');
          }
          const d = t.demos.find((x) => x.id === r.demo_id);
          const steps = t.steps
            .filter((s) => s.demo_id === r.demo_id)
            .sort((x, y) => x.position - y.position)
            .map((s) => ({ title: s.title, notes: s.presenter_notes || '' }));
          return json(route, 200, {
            status: 'ok',
            id: r.id,
            token: r.token,
            channel: r.channel,
            title: d.title,
            notes: d.presenter_notes || '',
            steps,
          });
        }
        // ===== L26-06 à 08 : visiteurs récurrents =====
        case 'workspace_returning': {
          const w = t.workspaces.find((x) => x.id === a.p_workspace) || t.workspaces[0];
          if (w.visit_measure === false)
            return json(route, 200, { enabled: false, gapMinutes: w.visit_gap_minutes ?? 30 });
          // Même population que workspace_analytics (visiteurs = 65 % des vues), part de récurrents
          // réglable (state.returningShare, 34 % par défaut) : chiffres cohérents avec la vue d'ensemble
          const pubs = t.demos.filter(
            (d) => d.status === 'published' && !d.deleted_at && (!a.p_demo || d.id === a.p_demo),
          );
          const total = Math.round(267 * pubs.length * 0.65);
          const share = state.returningShare ?? 0.34;
          const visitors = Math.round(total * share);
          return json(route, 200, {
            enabled: true,
            gapMinutes: w.visit_gap_minutes ?? 30,
            total,
            visitors,
            avgVisits: visitors ? 2.4 : null,
            topDemos: pubs.slice(0, 2).map((d, i) => {
              const v = Math.round(total / Math.max(pubs.length, 1));
              return {
                demoId: d.id,
                title: d.title,
                visitors: v,
                returning: Math.round(v * (share + 0.07 - i * 0.04)),
              };
            }),
          });
        }
        case 'session_visits': {
          const w = t.workspaces.find((x) => x.id === a.p_workspace) || t.workspaces[0];
          if (w.visit_measure === false) return json(route, 200, {});
          // Sessions fictives : une sur deux est une visite répétée (n° 2 à 4)
          return json(
            route,
            200,
            Object.fromEntries((a.p_sessions || []).map((s, i) => [s, i % 2 ? 2 + (i % 3) : 1])),
          );
        }
        case 'live_visits':
          return json(route, 200, state.liveVisits || {});
        // ===== L19 : analytics avancées =====
        case 'live_demo':
          return json(
            route,
            200,
            state.live || {
              kpis: { live: 0, views30: 0, ctaToday: 0, leadsToday: 0 },
              stepsTotal: 0,
              more: 0,
              visitors: [],
            },
          );
        case 'survey_results':
          return json(route, 200, (state.surveys || {})[a.p_demo] || []);
        case 'choice_results':
          return json(route, 200, (state.choices || {})[a.p_demo] || []);
        case 'survey_texts':
          return json(route, 200, state.surveyTexts || []);
        case 'segment_count': {
          // Effectif calculé (retour Lead UX) : population fictive de 1 000 visiteurs aux attributs
          // fixés, chaque condition est réellement évaluée. Les leads sont ceux de la table leads.
          state.segmentCalls = (state.segmentCalls || 0) + 1;
          const seg = a.p_segment || {};
          const def = seg.id ? (t.segments || []).find((x) => x.id === seg.id) : seg;
          const nLeads = (t.leads || []).length;
          const pop = Array.from({ length: 1000 }, (_, i) => ({
            source: ['direct', 'embed', 'link'][i % 3],
            device: i % 10 < 6 ? 'desktop' : i % 10 < 9 ? 'mobile' : 'tablet',
            browser: ['chrome', 'edge', 'firefox', 'safari'][i % 4],
            os: ['windows', 'macos', 'android', 'ios'][i % 4],
            lang: i % 7 === 0 ? 'en' : 'fr',
            country: i % 9 === 0 ? 'BE' : 'FR',
            steps: i % 6,
            completed: i % 3 === 0,
            cta: i % 8 === 0,
            lead: i < nLeads,
            referrer: i % 2 ? 'intranet.acme.example' : '',
            demo: null,
          }));
          const test = (v, c) => {
            const x = v[c.field];
            if (c.op === 'is') return x === c.value;
            if (c.op === 'is_not' || c.op === 'not') return x !== c.value;
            if (c.op === 'gte' || c.op === 'at_least') return Number(x) >= Number(c.value);
            if (c.op === 'lte' || c.op === 'at_most') return Number(x) <= Number(c.value);
            if (c.op === 'contains') return String(x ?? '').includes(String(c.value));
            if (c.op === 'not_contains') return !String(x ?? '').includes(String(c.value));
            return true;
          };
          const conds = def?.conditions || [];
          const visitors = pop.filter((v) =>
            !conds.length
              ? true
              : def?.match === 'any'
                ? conds.some((c) => test(v, c))
                : conds.every((c) => test(v, c)),
          ).length;
          return json(route, 200, { visitors, total: 1000 });
        }
        case 'ab_results': {
          const r = state.abResults || { A: { visitors: 0, reached: 0 }, B: { visitors: 0, reached: 0 } };
          const x = (t.ab_tests || []).find((y) => y.id === a.p_test);
          return json(route, 200, { goal: a.p_goal || x.goal, ...(r[a.p_goal || x.goal] || r) });
        }
        // ===== L17 : glossaire =====
        case 'glossary_usage':
          return json(
            route,
            200,
            (t.glossary_terms || [])
              .filter((g) => g.workspace_id === a.p_ws)
              .map((g) => ({ id: g.id, modules: (state.glossaryUsage || {})[g.term] ?? 0 })),
          );
        case 'glossary_set_underline': {
          const w = t.workspaces.find((x) => x.id === a.p_ws);
          w.settings = { ...(w.settings || {}), glossary: { underline: !!a.p_on } };
          return json(route, 200, null);
        }
        case 'glossary_import': {
          (state.glossaryImports ||= []).push(a);
          const list = (t.glossary_terms ||= []);
          const key = (x) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
          let added = 0;
          let updated = 0;
          for (const r of a.p_rows) {
            const cur = list.find((g) => g.workspace_id === a.p_ws && key(g.term) === key(r.term));
            if (cur) {
              Object.assign(cur, r, { updated_at: new Date().toISOString() });
              updated++;
            } else {
              list.push({
                id: crypto.randomUUID(),
                workspace_id: a.p_ws,
                created_by: state.user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...r,
              });
              added++;
            }
          }
          return json(route, 200, { added, updated, skipped: 0, errors: [] });
        }
        // ===== L16 : diffusions =====
        case 'record_diffusion': {
          (state.diffusionCalls ||= []).push(a);
          const demo = t.demos.find((x) => x.id === a.p_demo);
          const list = (t.diffusions ||= []);
          const now = new Date().toISOString();
          let row = list.find((x) => x.demo_id === a.p_demo && x.kind === a.p_kind && x.label === a.p_label);
          if (row) Object.assign(row, { settings: a.p_settings || {}, last_at: now, uses: row.uses + 1 });
          else {
            row = {
              id: crypto.randomUUID(),
              workspace_id: demo.workspace_id,
              demo_id: a.p_demo,
              kind: a.p_kind,
              label: a.p_label,
              settings: a.p_settings || {},
              created_by: state.user.id,
              first_at: now,
              last_at: now,
              uses: 1,
            };
            list.push(row);
          }
          row.version_id = demo.current_version_id;
          return json(route, 200, row.id);
        }
        case 'demo_embed_views':
          return json(route, 200, state.embedViews || []);
        // ===== L23 : webhooks =====
        case 'webhook_create': {
          const n = (t.webhooks || []).filter((w) => w.workspace_id === a.p_ws).length;
          if (n >= (state.webhookLimit ?? 3))
            return json(route, 400, { message: 'PLAN_LIMIT', code: 'P0001' });
          const secret = 'tcsec_EXEMPLE-fictif-' + crypto.randomBytes(12).toString('hex');
          const w = {
            id: crypto.randomUUID(),
            workspace_id: a.p_ws,
            url: a.p_url,
            name: a.p_name || '',
            events: a.p_events,
            state: 'active',
            failures: 0,
            secret_hint: secret.slice(-4),
            created_by: state.user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          (t.webhooks ||= []).push(w);
          return json(route, 200, { id: w.id, secret });
        }
        case 'webhook_rotate_secret': {
          const w = t.webhooks.find((x) => x.id === a.p_id);
          const secret = 'tcsec_EXEMPLE-fictif-' + crypto.randomBytes(12).toString('hex');
          w.secret_hint = secret.slice(-4);
          (state.audit ||= []).push({ action: 'webhook.secret_rotated' });
          return json(route, 200, secret);
        }
        case 'webhook_set_state': {
          const w = t.webhooks.find((x) => x.id === a.p_id);
          w.state = a.p_state;
          if (a.p_state === 'active') w.failures = 0;
          return json(route, 200, null);
        }
        case 'webhook_send_test':
        case 'webhook_replay': {
          const src =
            fn === 'webhook_replay' ? t.webhook_deliveries.find((x) => x.id === a.p_delivery) : null;
          const hook = t.webhooks.find((x) => x.id === (src ? src.webhook_id : a.p_id));
          const ev = src ? src.event_id : crypto.randomUUID();
          const d = {
            id: crypto.randomUUID(),
            workspace_id: hook.workspace_id,
            webhook_id: hook.id,
            event_id: ev,
            event_type: src ? src.event_type : 'ping',
            payload: src
              ? src.payload
              : { id: ev, type: 'ping', created_at: new Date().toISOString(), data: {} },
            status: 'pending',
            attempt: 1,
            next_attempt_at: new Date().toISOString(),
            response_status: null,
            response_body: null,
            duration_ms: null,
            error: null,
            replay_of: src ? src.id : null,
            created_at: new Date().toISOString(),
            finished_at: null,
          };
          (t.webhook_deliveries ||= []).push(d);
          return json(route, 200, d.id);
        }
        case 'resolve_share_link': {
          const l = t.share_links.find((x) => x.token === a.p_token && x.is_active);
          return json(route, 200, l ? { demoId: l.demo_id, linkId: l.id, variables: l.variables } : null);
        }
        default:
          return json(route, 200, null);
      }
    }

    if (p.startsWith('/rest/v1/')) {
      const table = p.split('/')[3];
      const rows = t[table] || (t[table] = []);
      const filters = [];
      let select = '*';
      let order = null;
      for (const [k, v] of url.searchParams) {
        if (k === 'select') select = v;
        else if (k === 'order') order = v;
        // or=(…) : non interprété (aucun filtre), suffisant pour les écrans testés
        else if (k !== 'limit' && k !== 'offset' && k !== 'columns' && k !== 'or') {
          const i = v.indexOf('.');
          filters.push([k, v.slice(0, i), v.slice(i + 1)]);
        }
      }
      const filtered = () => rows.filter((r) => filters.every(([k, op, val]) => matches(r, k, op, val)));
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      const embed = (r) => {
        if (table === 'members' && select.includes('workspaces'))
          return { ...r, workspaces: t.workspaces.find((w) => w.id === r.workspace_id) || null };
        if (select.includes('paths(') && r.path_id) {
          const x = (t.paths || []).find((y) => y.id === r.path_id);
          return { ...r, paths: x ? { title: x.title } : null };
        }
        if (select.includes('demos(') && r.demo_id) {
          const d = t.demos.find((x) => x.id === r.demo_id);
          return { ...r, demos: d ? { title: d.title } : null };
        }
        return r;
      };
      const respond = (list) => {
        if (single)
          return list.length === 1
            ? json(route, 200, list[0])
            : json(route, 406, { code: 'PGRST116', message: 'no rows', details: '', hint: null });
        return json(route, 200, list);
      };
      if (method === 'GET' || method === 'HEAD') {
        let list = filtered().map(embed);
        // count=exact (head:true) : nombre total dans Content-Range, comme PostgREST
        if ((req.headers()['prefer'] || '').includes('count=exact'))
          return json(route, 200, method === 'HEAD' ? null : list, {
            'content-range': `0-${Math.max(0, list.length - 1)}/${list.length}`,
            'access-control-expose-headers': 'Content-Range',
          });
        if (order) {
          const [col, dir] = order.split(',')[0].split('.');
          list = list
            .slice()
            .sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
        }
        return respond(list);
      }
      if (method === 'POST') {
        const items = (Array.isArray(body) ? body : [body]).map((r) => ({
          id: r.id ?? crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...defaults(table, r),
          ...r,
        }));
        // L25-13 : code de page tiré par la base (jamais celui du client)
        if (table === 'share_links')
          for (const it of items) {
            const abc = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
            it.page_code = it.page_enabled
              ? Array.from(crypto.randomBytes(12), (x) => abc[x % 62]).join('')
              : null;
          }
        // step_comments : contexte et auteur posés comme le trigger SQL
        if (table === 'step_comments')
          for (const it of items) {
            const st = t.steps.find((x) => x.id === it.step_id);
            Object.assign(it, {
              author_id: state.user.id,
              demo_id: st?.demo_id,
              workspace_id: st?.workspace_id,
              resolved_at: null,
              resolved_by: null,
            });
          }
        // L19 : nom de segment unique par workspace (casse ignorée)
        if (
          table === 'segments' &&
          items.some((it) =>
            rows.some(
              (r) =>
                r.workspace_id === it.workspace_id &&
                r.name.trim().toLowerCase() === it.name.trim().toLowerCase(),
            ),
          )
        )
          return json(route, 409, { code: '23505', message: 'duplicate key value', details: '', hint: null });
        // L17 : terme unique par workspace (casse et accents ignorés), comme l'index de la base
        if (table === 'glossary_terms') {
          const key = (x) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
          if (
            items.some((it) =>
              rows.some((r) => r.workspace_id === it.workspace_id && key(r.term) === key(it.term)),
            )
          )
            return json(route, 409, {
              code: '23505',
              message: 'duplicate key value',
              details: '',
              hint: null,
            });
        }
        // L26 : upsert sur la clé (personne, espace / module)
        if (table === 'onboarding_prefs' || table === 'learn_progress')
          for (const it of items) {
            it.user_id = it.user_id ?? state.user.id;
            const k = table === 'onboarding_prefs' ? 'workspace_id' : 'module';
            const i = rows.findIndex((r) => r.user_id === it.user_id && r[k] === it[k]);
            if (i >= 0) rows.splice(i, 1);
          }
        rows.push(...items);
        return respond(items);
      }
      if (method === 'PATCH') {
        const list = filtered();
        for (const r of list) Object.assign(r, body);
        return respond(list);
      }
      if (method === 'DELETE') {
        const list = filtered();
        t[table] = rows.filter((r) => !list.includes(r));
        return respond(list);
      }
    }

    if (p.startsWith('/storage/v1/object/list/')) {
      const bucket = p.split('/')[5];
      const prefix = (body.prefix || '').replace(/\/$/, '');
      const names = Object.keys(state.storage)
        .filter((k) => k.startsWith(`${bucket}/${prefix}/`))
        .map((k) => k.slice(bucket.length + prefix.length + 2))
        .filter((n) => !n.includes('/') && (!body.search || n.includes(body.search)));
      return json(
        route,
        200,
        names.map((name) => ({ name, id: name, metadata: {} })),
      );
    }
    if (p.startsWith('/storage/v1/object/public/')) {
      const key = decodeURIComponent(p.slice('/storage/v1/object/public/'.length));
      // L11 : bucket « published » privé, aucune lecture publique
      if (key.startsWith('published/'))
        return json(route, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      const f = state.storage[key];
      // L18 : fichiers de la médiathèque déposés par la fonction media (image fixture)
      if (!f && key.startsWith('media/') && (t.media_files || []).some((m) => key === `media/${m.path}`))
        return route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: png,
          headers: { 'access-control-allow-origin': '*' },
        });
      if (!f) return json(route, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      // Corps multipart non transmis par Playwright : image fixture à la place (logo de la marque…)
      const empty = !f.data?.length && /^image\//.test(f.type || '');
      return route.fulfill({
        status: 200,
        contentType: empty ? 'image/png' : f.type,
        body: empty ? png : f.data,
        headers: { 'access-control-allow-origin': '*' },
      });
    }
    if (p.startsWith('/storage/v1/object/') && method === 'DELETE') {
      for (const k of body.prefixes || []) delete state.storage[`${p.split('/')[4]}/${k}`];
      return json(route, 200, []);
    }
    if (p.startsWith('/storage/v1/object/sign/') && method === 'POST' && !body?.paths) {
      // Signature d'un seul fichier : /object/sign/<bucket>/<chemin>
      const rest = p.slice('/storage/v1/object/sign/'.length);
      return json(route, 200, { signedURL: `/object/sign/${rest}?token=t` });
    }
    if (p.startsWith('/storage/v1/object/sign/') && method === 'POST') {
      const paths = body.paths || [];
      const bucket = p.slice('/storage/v1/object/sign/'.length).split('/')[0] || 'captures';
      return json(
        route,
        200,
        paths.map((x) => ({ path: x, signedURL: `/object/sign/${bucket}/${x}?token=t`, error: null })),
      );
    }
    if (p.startsWith('/storage/v1/object/copy')) {
      (state.copies ||= []).push({ from: body.sourceKey, to: body.destinationKey });
      return json(route, 200, { Key: body.destinationKey });
    }
    if (p.startsWith('/storage/v1/object/') && (method === 'POST' || method === 'PUT')) {
      const key = decodeURIComponent(p.slice('/storage/v1/object/'.length));
      state.storage[key] = parseUpload(
        req.postDataBuffer() || Buffer.alloc(0),
        req.headers()['content-type'] || '',
      );
      return json(route, 200, { Key: key, Id: 'x' });
    }
    // L16 : fichier déposé dans le faux Storage (ex. manifeste publié vN.json), sinon image fixture
    const stored = /^\/storage\/v1\/object\/(?:sign\/|public\/)?(.+)$/.exec(p);
    // Corps binaire non transmis par Playwright (fichier image) : fixture servie à la place
    if (stored && state.storage[decodeURIComponent(stored[1])]?.data?.length) {
      const f = state.storage[decodeURIComponent(stored[1])];
      return route.fulfill({
        status: 200,
        contentType: f.type,
        body: f.data,
        headers: { 'access-control-allow-origin': '*' },
      });
    }
    // A8 : pages HTML (bucket html, URL signées) : contenu tenu dans state.htmlPages (chemin → HTML)
    if (/^\/storage\/v1\/object\/sign\/html\//.test(p)) {
      const key = decodeURIComponent(p.slice('/storage/v1/object/sign/html/'.length));
      const html = (state.htmlPages || {})[key];
      return route.fulfill({
        status: html ? 200 : 404,
        contentType: 'text/html',
        headers: { 'access-control-allow-origin': '*' },
        body: html || 'introuvable',
      });
    }
    // F7 : vidéos (bucket videos, URL signées) : WebM fictif, requêtes partielles comme le stockage
    if (
      /^\/storage\/v1\/object\/sign\/videos\//.test(p) ||
      /^\/storage\/v1\/object\/sign\/published\/.+\.webm$/.test(p)
    ) {
      const webm = require('fs').readFileSync(require('path').join(__dirname, 'fixture-video.webm'));
      const m = /bytes=(\d+)-(\d*)/.exec(req.headers()['range'] || '');
      const cors = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' };
      if (!m) return route.fulfill({ status: 200, contentType: 'video/webm', headers: cors, body: webm });
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : webm.length - 1;
      return route.fulfill({
        status: 206,
        contentType: 'video/webm',
        headers: { ...cors, 'content-range': `bytes ${a}-${b}/${webm.length}` },
        body: webm.subarray(a, b + 1),
      });
    }
    if (p.startsWith('/storage/v1/object/'))
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: png,
        headers: { 'access-control-allow-origin': '*' },
      });
    return json(route, 404, { message: 'not mocked ' + p });
  });
  return state;
}

/** storage-js envoie les Blob en multipart/form-data : on extrait la partie fichier. */
function parseUpload(buf, contentType) {
  const m = /boundary=(.+)$/.exec(contentType);
  if (!m) return { data: buf, type: contentType || 'application/octet-stream' };
  const boundary = Buffer.from(`--${m[1]}`);
  let start = 0;
  while ((start = buf.indexOf(boundary, start)) !== -1) {
    const headerEnd = buf.indexOf('\r\n\r\n', start);
    if (headerEnd === -1) break;
    const headers = buf.slice(start, headerEnd).toString();
    const next = buf.indexOf(boundary, headerEnd);
    const ct = /content-type:\s*([^\r\n]+)/i.exec(headers);
    if ((ct && /filename=|name=""/i.test(headers)) || (ct && !/cacheControl/.test(headers))) {
      return { data: buf.slice(headerEnd + 4, next - 2), type: ct[1].trim() };
    }
    start = next;
  }
  return { data: buf, type: contentType };
}

function defaults(table, r) {
  if (table === 'themes')
    return { is_default: false, builtin_key: null, created_by: currentUserId, tokens: {} };
  if (table === 'demos')
    return {
      status: 'draft',
      settings: {},
      folder_id: null,
      deleted_at: null,
      current_version_id: null,
      device: 'desktop',
      viewport: null,
      kind: 'guided',
      sandbox: null,
    };
  if (table === 'hotspots')
    return { body: '', placement: 'auto', action: { type: 'next' }, cta: null, pulse: true };
  if (table === 'steps')
    return {
      blurs: [],
      zoom: null,
      cta: null,
      chapter_id: null,
      gate_form_id: null,
      body: '',
      title: '',
      element_meta: {},
      options: {},
      before_image_path: null,
      before_image_width: null,
      before_image_height: null,
      before_blurs: [],
      video_path: null,
      video_duration_ms: null,
      video: {},
      html_path: null,
      html_ops: [],
      html_meta: {},
    };
  if (table === 'alerts')
    return {
      threshold: null,
      demo_id: null,
      path_id: null,
      segment_id: null,
      channels: ['app'],
      frequency: 'immediate',
      active: true,
      pending: 0,
      last_state: false,
      digest_at: null,
      last_fired_at: null,
      created_by: 'u-alice',
    };
  if (table === 'segments') return { match: 'all', created_by: 'u-alice' };
  if (table === 'demo_pages')
    return {
      workspace_id: 'ws-1',
      enabled: false,
      title: '',
      description: '',
      cta_label: null,
      cta_url: null,
      style: 'demo',
      related: false,
      indexable: false,
    };
  if (table === 'forms')
    return {
      title: 'Accédez à la démo',
      description: '',
      submit_label: 'Continuer',
      fields: [{ key: 'email', label: 'Email professionnel', type: 'email', required: true }],
      consent_text: '',
      skippable: false,
    };
  if (table === 'share_links')
    return {
      token: crypto.randomBytes(12).toString('hex'),
      name: '',
      variables: {},
      expires_at: null,
      is_active: true,
    };
  if (table === 'chapters') return { title: '' };
  return {};
}

module.exports = { install, seed, HOST, PUBLIC_PLAYER };
