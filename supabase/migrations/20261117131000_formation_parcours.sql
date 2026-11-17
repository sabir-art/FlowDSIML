-- FlowDSIML — Formation F1 : parcours guidés (modes Walkthrough / Spotlight, étape pop-up,
-- menu de choix / branching, checklist, lecture automatique). Idempotent, additif.
--  * steps.options    : affichage (« screen » | « popup »), variante (« info » | « instruction »),
--                       fond de pop-up (« blur » | « color », bgColor), showIcon, buttonLabel,
--                       choix de parcours [{label, action}] (max 6) ; action = goto (stepId) | chapter
--                       (chapterId) | end | url
--  * hotspots.style   : « beacon » (visite guidée, pastille + bulle) | « spotlight » (zone éclairée)
--  * demos.settings   : mode (« walkthrough » | « spotlight », pour toute la démo), checklist
--                       {enabled, title, position}, autoplay {enabled, delayMs}
-- publish_demo et duplicate_demo sont recréées à l'identique de 130700 / 130200, avec ces champs en plus.

alter table public.steps add column if not exists options jsonb not null default '{}'::jsonb;
alter table public.hotspots add column if not exists style text not null default 'beacon';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'steps_options_object') then
    alter table public.steps add constraint steps_options_object check (
      jsonb_typeof(options) = 'object'
      and (not options ? 'choices' or (jsonb_typeof(options -> 'choices') = 'array' and jsonb_array_length(options -> 'choices') <= 6))
      and coalesce(options ->> 'display', 'screen') in ('screen', 'popup')
      and coalesce(options ->> 'variant', 'info') in ('info', 'instruction')
      and coalesce(options ->> 'background', 'blur') in ('blur', 'color'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hotspots_style_check') then
    alter table public.hotspots add constraint hotspots_style_check check (style in ('beacon', 'spotlight'));
  end if;
end $$;

create or replace function public.publish_demo(p_demo uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.demos;
  ws public.workspaces;
  lim jsonb;
  n_published bigint;
  v_number int;
  v_id uuid := gen_random_uuid();
  v_theme jsonb;
  v_steps jsonb;
  v_copies jsonb;
  v_forms jsonb;
  v_manifest jsonb;
  lead_forms boolean;
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null then raise exception 'DEMO_NOT_FOUND'; end if;
  if not public.has_role(d.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into ws from public.workspaces where id = d.workspace_id;
  select limits into lim from public.plans where code = ws.plan_code;

  if d.status <> 'published' then
    select count(*) into n_published from public.demos
      where workspace_id = d.workspace_id and status = 'published' and deleted_at is null;
    if public.limit_reached(d.workspace_id, 'published_demos', n_published) then
      raise exception 'PLAN_LIMIT:published_demos' using errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from public.steps where demo_id = p_demo) then
    raise exception 'DEMO_EMPTY';
  end if;

  lead_forms := coalesce((lim ->> 'lead_forms')::boolean, false);

  select coalesce(max(number), 0) + 1 into v_number from public.demo_versions where demo_id = p_demo;

  -- Thème : thème choisi (ou défaut du workspace) + surcharges de la démo
  select coalesce(t.tokens, '{}'::jsonb) into v_theme from public.themes t
    where t.id = coalesce(d.theme_id, (select id from public.themes where workspace_id = d.workspace_id and is_default limit 1));
  v_theme := coalesce(v_theme, '{}'::jsonb) || coalesce(d.settings -> 'theme', '{}'::jsonb);
  v_theme := v_theme || jsonb_build_object(
    'showBranding', not coalesce((lim ->> 'remove_branding')::boolean, false) or coalesce((v_theme ->> 'showBranding')::boolean, true)
  );

  with s as (
    select st.*, row_number() over (order by st.position, st.created_at) - 1 as idx,
      case when st.image_path is not null
        then 'assets/' || st.id || '-' || md5(st.image_path) || '.webp' end as pub_path
    from public.steps st where st.demo_id = p_demo
  )
  select
    jsonb_agg(jsonb_build_object(
      'id', s.id::text,
      'chapterId', s.chapter_id::text,
      'kind', s.kind,
      'image', case when s.pub_path is not null then jsonb_build_object(
        'url', s.pub_path, 'width', coalesce(s.image_width, 1280), 'height', coalesce(s.image_height, 800)) end,
      'snapshotUrl', null,
      'title', s.title,
      'body', s.body,
      'blurs', s.blurs,
      'zoom', s.zoom,
      'cta', s.cta,
      'options', s.options,
      'gateFormId', case when lead_forms then s.gate_form_id::text end,
      'hotspots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', h.id::text, 'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h,
          'title', h.title, 'body', h.body, 'placement', h.placement,
          'action', h.action, 'cta', h.cta, 'pulse', h.pulse,
          -- mode Spotlight réglé pour toute la démo : il s'impose à chaque hotspot
          'style', case when d.settings ->> 'mode' = 'spotlight' then 'spotlight' else h.style end
        ) order by h.position, h.created_at)
        from public.hotspots h where h.step_id = s.id), '[]'::jsonb)
    ) order by s.idx),
    coalesce(jsonb_agg(jsonb_build_object('from', s.image_path, 'to', p_demo::text || '/' || s.pub_path))
      filter (where s.pub_path is not null), '[]'::jsonb)
  into v_steps, v_copies
  from s;

  if lead_forms then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id::text, 'title', f.title, 'description', f.description, 'submitLabel', f.submit_label,
      'fields', f.fields, 'consentText', f.consent_text, 'skippable', f.skippable)), '[]'::jsonb)
    into v_forms from public.forms f where f.demo_id = p_demo;
  else
    v_forms := '[]'::jsonb;
  end if;

  v_manifest := jsonb_build_object(
    'schemaVersion', 1,
    'demoId', p_demo::text,
    'versionId', v_id::text,
    'workspaceId', d.workspace_id::text,
    'title', d.title,
    'locale', coalesce(d.settings ->> 'locale', 'fr'),
    'publishedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'theme', v_theme,
    'variables', coalesce((select jsonb_agg(jsonb_build_object('key', v.key, 'label', v.label, 'default', v.default_value))
                           from public.variables v where v.workspace_id = d.workspace_id), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('id', c.id::text, 'title', c.title) order by c.position)
                          from public.chapters c where c.demo_id = p_demo), '[]'::jsonb),
    'steps', v_steps,
    'forms', v_forms,
    'allowedEmbedOrigins', coalesce(d.settings -> 'allowedEmbedOrigins', '[]'::jsonb),
    -- P6 : bouton d'action du client affiché en permanence dans le player (ex. « Réserver une démo »)
    'cta', case when jsonb_typeof(d.settings -> 'cta') = 'object' and d.settings -> 'cta' ? 'url' then d.settings -> 'cta' end,
    -- P13 : lien « Confidentialité » du workspace sous les formulaires de lead (https uniquement)
    'privacyUrl', case when (ws.settings ->> 'privacyUrl') ~ '^https://[^\s]+$' then ws.settings ->> 'privacyUrl' end,
    -- F1 : checklist de progression et lecture automatique (réglages de la démo)
    'checklist', case when jsonb_typeof(d.settings -> 'checklist') = 'object'
                       and coalesce((d.settings -> 'checklist' ->> 'enabled')::boolean, false)
                  then jsonb_build_object(
                    'title', left(coalesce(d.settings -> 'checklist' ->> 'title', ''), 80),
                    'position', case when d.settings -> 'checklist' ->> 'position' in ('left', 'right', 'collapsed')
                                     then d.settings -> 'checklist' ->> 'position' else 'right' end)
                  end,
    'autoplay', case when jsonb_typeof(d.settings -> 'autoplay') = 'object'
                      and coalesce((d.settings -> 'autoplay' ->> 'enabled')::boolean, false)
                 then jsonb_build_object('enabled', true,
                        'delayMs', least(greatest(coalesce((d.settings -> 'autoplay' ->> 'delayMs')::int, 4000), 1500), 30000))
                 end,
    'trackUrl', null
  );

  insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by)
  values (v_id, p_demo, d.workspace_id, v_number, v_manifest, (select auth.uid()));

  return jsonb_build_object('versionId', v_id, 'number', v_number, 'manifest', v_manifest, 'copies', v_copies);
end $$;

revoke all on function public.publish_demo(uuid) from public, anon;
grant execute on function public.publish_demo(uuid) to authenticated;

create or replace function public.duplicate_demo(p_demo uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.demos;
  v_new uuid := gen_random_uuid();
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null or not public.has_role(d.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;

  insert into public.demos (id, workspace_id, folder_id, title, theme_id, settings, cover_path, created_by)
  values (v_new, d.workspace_id, d.folder_id, left(d.title || ' (copie)', 160), d.theme_id, d.settings, d.cover_path, (select auth.uid()));

  drop table if exists pg_temp._map;
  create temp table _map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _map select id, gen_random_uuid() from public.chapters where demo_id = p_demo;
  insert into public.chapters (id, demo_id, workspace_id, title, position)
    select m.new_id, v_new, d.workspace_id, c.title, c.position from public.chapters c join _map m on m.old_id = c.id;

  insert into _map select id, gen_random_uuid() from public.forms where demo_id = p_demo;
  insert into public.forms (id, workspace_id, demo_id, title, description, submit_label, fields, consent_text, skippable)
    select m.new_id, f.workspace_id, v_new, f.title, f.description, f.submit_label, f.fields, f.consent_text, f.skippable
    from public.forms f join _map m on m.old_id = f.id;

  insert into _map select id, gen_random_uuid() from public.steps where demo_id = p_demo;
  insert into public.steps (id, demo_id, workspace_id, position, chapter_id, kind, image_path, image_width, image_height,
                            snapshot_path, title, body, zoom, blurs, gate_form_id, cta, page_url, page_title, element_meta, options)
    select m.new_id, v_new, d.workspace_id, s.position, mc.new_id, s.kind, s.image_path, s.image_width, s.image_height,
           s.snapshot_path, s.title, s.body, s.zoom, s.blurs, mf.new_id, s.cta, s.page_url, s.page_title, s.element_meta,
           -- les choix de parcours (F1) pointent vers les nouvelles étapes et les nouveaux chapitres
           case when jsonb_typeof(s.options -> 'choices') = 'array' then jsonb_set(s.options, '{choices}', coalesce((
             select jsonb_agg(case
               when c -> 'action' ->> 'type' = 'goto' then jsonb_set(c, '{action,stepId}', to_jsonb(coalesce(
                 (select g.new_id::text from _map g where g.old_id::text = c -> 'action' ->> 'stepId'), c -> 'action' ->> 'stepId')))
               when c -> 'action' ->> 'type' = 'chapter' then jsonb_set(c, '{action,chapterId}', to_jsonb(coalesce(
                 (select g.new_id::text from _map g where g.old_id::text = c -> 'action' ->> 'chapterId'), c -> 'action' ->> 'chapterId')))
               else c end order by ord)
             from jsonb_array_elements(s.options -> 'choices') with ordinality as x(c, ord)), '[]'::jsonb))
           else s.options end
    from public.steps s join _map m on m.old_id = s.id
    left join _map mc on mc.old_id = s.chapter_id
    left join _map mf on mf.old_id = s.gate_form_id;

  insert into public.hotspots (step_id, demo_id, workspace_id, x, y, w, h, title, body, placement, action, cta, pulse, position, style)
    select m.new_id, v_new, d.workspace_id, h.x, h.y, h.w, h.h, h.title, h.body, h.placement,
           -- les cibles "goto" pointent vers les nouvelles étapes
           case when h.action ->> 'type' = 'goto'
             then jsonb_build_object('type', 'goto', 'stepId', coalesce((select g.new_id::text from _map g where g.old_id::text = h.action ->> 'stepId'), h.action ->> 'stepId'))
             else h.action end,
           h.cta, h.pulse, h.position, h.style
    from public.hotspots h join _map m on m.old_id = h.step_id;

  return v_new;
end $$;
