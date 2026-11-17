/**
 * Faux Supabase pour les tests e2e de l'app web : intercepte les requêtes de supabase-js
 * (page.route) et répond depuis un état en mémoire. Couvre le sous-ensemble utilisé par l'app :
 * filtres eq/is/in/ilike, embed members → workspaces, insert/update/delete, quelques RPC, Storage.
 * Ce n'est PAS un substitut aux tests pgTAP (RLS) : il valide l'interface.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = 'https://ffzlhlxfratcbitkuvli.supabase.co';
const STORAGE_KEY = 'sb-ffzlhlxfratcbitkuvli-auth-token';

function b64url(o) {
  return Buffer.from(JSON.stringify(o)).toString('base64url');
}
function fakeJwt(user) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.sig`;
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
    settings: {},
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
          x: 0.34,
          y: 0.6,
          w: 0.32,
          h: 0.07,
          title: 'Cliquez sur « Se connecter »',
          body: 'Bienvenue {{company|chez vous}}',
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
      themes: [],
      share_links: [],
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
        case 'list_members':
          return json(route, 200, [
            ...(state.extraMembers || []),
            {
              user_id: state.user.id,
              email: state.user.email,
              full_name: 'Alice',
              role: 'owner',
              created_at: '2026-01-01',
            },
          ]);
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
          return json(route, 200, {
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
            lead_email: i % 3 === 1 ? null : l.email,
            lead_fields: i % 3 === 1 ? null : l.fields,
          }));
          const off = a.p_offset || 0;
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
          const ws = t.workspaces?.find((w) => w.id === d.workspace_id);
          if (ws && ws.public_links_enabled === false)
            return json(route, 400, { message: 'PUBLIC_DISABLED', code: 'P0001' });
          if (!a.p_ack?.reviewed || !a.p_ack?.fictional)
            return json(route, 400, { message: 'GDPR_ACK_REQUIRED', code: 'P0001' });
          state.lastAck = a.p_ack;
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
            published_at: new Date().toISOString(),
          });
          return json(route, 200, {
            versionId,
            number,
            manifest,
            copies: steps
              .filter((s) => s.image_path)
              .map((s) => ({ from: s.image_path, to: `${d.id}/assets/${s.id}.webp` })),
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
        else if (k !== 'limit' && k !== 'offset' && k !== 'columns') {
          const i = v.indexOf('.');
          filters.push([k, v.slice(0, i), v.slice(i + 1)]);
        }
      }
      const filtered = () => rows.filter((r) => filters.every(([k, op, val]) => matches(r, k, op, val)));
      const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      const embed = (r) => {
        if (table === 'members' && select.includes('workspaces'))
          return { ...r, workspaces: t.workspaces.find((w) => w.id === r.workspace_id) || null };
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
      const f = state.storage[key];
      if (!f) return json(route, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      return route.fulfill({
        status: 200,
        contentType: f.type,
        body: f.data,
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
      return json(
        route,
        200,
        paths.map((x) => ({ path: x, signedURL: `/object/sign/captures/${x}?token=t`, error: null })),
      );
    }
    if (p.startsWith('/storage/v1/object/copy')) return json(route, 200, { Key: body.destinationKey });
    if (p.startsWith('/storage/v1/object/') && (method === 'POST' || method === 'PUT')) {
      const key = decodeURIComponent(p.slice('/storage/v1/object/'.length));
      state.storage[key] = parseUpload(
        req.postDataBuffer() || Buffer.alloc(0),
        req.headers()['content-type'] || '',
      );
      return json(route, 200, { Key: key, Id: 'x' });
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
  if (table === 'demos')
    return { status: 'draft', settings: {}, folder_id: null, deleted_at: null, current_version_id: null };
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

module.exports = { install, seed, HOST };
