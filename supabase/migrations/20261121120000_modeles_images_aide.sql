-- Correctifs 155 / 154 (demandés par le chef) :
--  * create_demo_from_template : plus aucun chemin d'image partagé. Les étapes d'un modèle « avec captures »
--    restent « À capturer » avec options.templateImage ; l'app copie chaque fichier dans le dossier de la
--    nouvelle démo, puis pose l'image et retire la clé (même espace uniquement).
--  * save_demo_as_template : bilan RGPD (p_ack) obligatoire avec les captures ; template_set_images range
--    les images d'un modèle dans son propre dossier (<espace>/templates/<modèle>/).
--  * help_feedback : seulement les articles connus (help_articles).

create or replace function public.create_demo_from_template(p_template uuid, p_ws uuid, p_folder uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tpl public.demo_templates;
  v_demo uuid := gen_random_uuid();
  v_chap uuid;
  v_step uuid;
  v_pos int := 0;
  v_cpos int := 0;
  c jsonb;
  s jsonb;
  h jsonb;
  v_hpos int;
  v_img jsonb;
  v_kind public.step_kind;
  v_opts jsonb;
  v_ids uuid[] := '{}';
begin
  if not public.has_role(p_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into tpl from public.demo_templates where id = p_template and (workspace_id is null or workspace_id = p_ws);
  if tpl.id is null then raise exception 'TEMPLATE_NOT_FOUND'; end if;
  if p_folder is not null and not exists (select 1 from public.folders where id = p_folder and workspace_id = p_ws) then
    p_folder := null;
  end if;

  insert into public.demos (id, workspace_id, folder_id, title, theme_id, settings, created_by)
  values (v_demo, p_ws, p_folder, tpl.name,
          case when tpl.workspace_id = p_ws then (select t.id from public.themes t
                 where t.id::text = tpl.structure ->> 'themeId' and t.workspace_id = p_ws) end,
          coalesce(tpl.structure -> 'settings', '{}'::jsonb), (select auth.uid()));

  for c in select value from jsonb_array_elements(coalesce(tpl.structure -> 'chapters', '[]'::jsonb)) loop
    v_chap := null;
    if coalesce(c ->> 'title', '') <> '' then
      v_chap := gen_random_uuid();
      insert into public.chapters (id, demo_id, workspace_id, title, position)
      values (v_chap, v_demo, p_ws, left(c ->> 'title', 120), v_cpos);
      v_cpos := v_cpos + 1;
    end if;
    for s in select value from jsonb_array_elements(coalesce(c -> 'steps', '[]'::jsonb)) loop
      if s ->> 'type' = 'quiz' then continue; end if;
      v_step := gen_random_uuid();
      v_ids := v_ids || v_step;
      v_kind := case when s ->> 'type' in ('popup', 'fin', 'texte') then 'text' else 'image' end;
      v_opts := case when jsonb_typeof(s -> 'options') = 'object' then s -> 'options' else '{}'::jsonb end;
      if s ->> 'type' = 'popup' then v_opts := v_opts || '{"display":"popup"}'; end if;
      if s ->> 'type' = 'saisie' and s ? 'typing' then
        v_opts := v_opts || jsonb_build_object('animation', jsonb_build_object(
          'type', 'typing', 'text', left(s ->> 'typing', 200), 'field', null, 'fieldLabel', '', 'speed', 'normal'));
      end if;
      -- Image d'exemple : seulement depuis un modèle de ce même espace
      v_img := case when tpl.workspace_id = p_ws and jsonb_typeof(s -> 'image') = 'object' then s -> 'image' end;
      -- L'image d'exemple n'est jamais partagée : l'étape reste « À capturer » avec le chemin source dans
      -- options.templateImage, jusqu'à ce que l'app ait copié le fichier dans le dossier de la nouvelle démo
      insert into public.steps (id, demo_id, workspace_id, position, chapter_id, kind, title, body, options, cta,
                                image_width, image_height, blurs, to_capture)
      values (v_step, v_demo, p_ws, v_pos, v_chap, v_kind, left(coalesce(s ->> 'title', ''), 200),
              left(coalesce(s ->> 'body', ''), 4000), v_opts,
              case when jsonb_typeof(s -> 'cta') = 'object' then s -> 'cta' end,
              (v_img ->> 'width')::int, (v_img ->> 'height')::int,
              coalesce(v_img -> 'blurs', '[]'::jsonb),
              v_kind = 'image');
      if v_img is not null and public.path_uuid(v_img ->> 'path', 1) = p_ws then
        update public.steps set options = options || jsonb_build_object('templateImage', v_img ->> 'path')
          where id = v_step;
      end if;
      v_pos := v_pos + 1;
      if v_kind = 'image' then
        v_hpos := 0;
        if jsonb_typeof(s -> 'hotspots') = 'array' and jsonb_array_length(s -> 'hotspots') > 0 then
          for h in select value from jsonb_array_elements(s -> 'hotspots') loop
            insert into public.hotspots (step_id, demo_id, workspace_id, x, y, w, h, title, body, placement, action, cta, pulse, style, position)
            values (v_step, v_demo, p_ws,
                    least(greatest(coalesce((h ->> 'x')::real, 0.45), 0), 1), least(greatest(coalesce((h ->> 'y')::real, 0.45), 0), 1),
                    least(greatest(coalesce((h ->> 'w')::real, 0.1), 0), 1), least(greatest(coalesce((h ->> 'h')::real, 0.06), 0), 1),
                    left(coalesce(h ->> 'title', ''), 200), left(coalesce(h ->> 'body', ''), 4000),
                    case when h ->> 'placement' in ('auto', 'top', 'bottom', 'left', 'right') then h ->> 'placement' else 'auto' end,
                    case when jsonb_typeof(h -> 'action') = 'object' then h -> 'action' else '{"type":"next"}'::jsonb end,
                    case when jsonb_typeof(h -> 'cta') = 'object' then h -> 'cta' end,
                    coalesce((h ->> 'pulse')::boolean, true), coalesce(h ->> 'style', 'beacon'), v_hpos);
            v_hpos := v_hpos + 1;
          end loop;
        else
          insert into public.hotspots (step_id, demo_id, workspace_id, x, y, w, h, title, body)
          values (v_step, v_demo, p_ws, 0.45, 0.45, 0.1, 0.06, left(coalesce(s ->> 'bubble', ''), 200), '');
        end if;
      end if;
    end loop;
  end loop;

  -- « Aller à l'étape n » : rebranché sur les nouvelles étapes (sinon « suivante »)
  update public.hotspots set action = case
      when (action ->> 'stepIndex') ~ '^\d+$' and (action ->> 'stepIndex')::int < coalesce(array_length(v_ids, 1), 0)
        then jsonb_build_object('type', 'goto', 'stepId', v_ids[(action ->> 'stepIndex')::int + 1]::text)
      else '{"type":"next"}'::jsonb end
    where demo_id = v_demo and action ->> 'type' = 'goto';

  insert into public.quiz_questions (demo_id, workspace_id, position, type, prompt, answers, explanation, points)
    select v_demo, p_ws, (q.ord - 1)::int, q.v ->> 'type', left(coalesce(q.v ->> 'prompt', ''), 200),
           coalesce(q.v -> 'answers', '[]'::jsonb), left(coalesce(q.v ->> 'explanation', ''), 1000),
           least(greatest(coalesce((q.v ->> 'points')::int, 1), 1), 100)
    from jsonb_array_elements(coalesce(tpl.structure -> 'quiz', '[]'::jsonb)) with ordinality as q(v, ord)
    where q.v ->> 'type' in ('single', 'multiple', 'truefalse');

  return v_demo;
end $$;
revoke all on function public.create_demo_from_template(uuid, uuid, uuid) from public, anon;
grant execute on function public.create_demo_from_template(uuid, uuid, uuid) to authenticated;

drop function if exists public.save_demo_as_template(uuid, text, text, text, boolean);
create or replace function public.save_demo_as_template(
  p_demo uuid, p_name text, p_description text, p_category text, p_with_captures boolean, p_ack boolean default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.demos;
  v_id uuid;
  v_struct jsonb;
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null or not public.has_role(d.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'NAME_INVALID'; end if;
  -- Bilan RGPD : un modèle avec captures exige la même confirmation qu'une publication
  if coalesce(p_with_captures, false) and not coalesce(p_ack, false) then
    raise exception 'GDPR_ACK_REQUIRED' using errcode = 'P0001';
  end if;

  with st as (
    select s.*, (row_number() over (order by s.position, s.created_at) - 1)::int as idx
    from public.steps s where s.demo_id = p_demo
  ), steps_json as (
    select st.chapter_id, st.idx, jsonb_strip_nulls(jsonb_build_object(
      'type', case when st.kind = 'text' and st.options ->> 'display' = 'popup' then 'popup'
                   when st.kind = 'text' then 'texte'
                   when st.options -> 'animation' ->> 'type' = 'typing' then 'saisie'
                   else 'bulle' end,
      'title', st.title,
      'body', st.body,
      'cta', st.cta,
      'options', case when p_with_captures then st.options - 'choices' - 'rules' - 'rulesElse' - 'branch' - 'beforeAfter'
                      else st.options - 'choices' - 'rules' - 'rulesElse' - 'branch' - 'beforeAfter' - 'tab' - 'tabCaptured'
                           - 'crop' - 'fullPage' end,
      'image', case when p_with_captures and st.image_path is not null then jsonb_build_object(
                 'path', st.image_path, 'width', st.image_width, 'height', st.image_height, 'blurs', st.blurs) end,
      'capture', case when st.kind = 'text' then null else true end,
      'hotspots', (select coalesce(jsonb_agg(jsonb_build_object(
                     'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h, 'title', h.title, 'body', h.body,
                     'placement', h.placement, 'pulse', h.pulse, 'style', h.style, 'cta', h.cta,
                     'action', case when h.action ->> 'type' = 'goto' then jsonb_build_object('type', 'goto',
                                 'stepIndex', (select t.idx from st t where t.id::text = h.action ->> 'stepId'))
                               else h.action end) order by h.position), '[]'::jsonb)
                   from public.hotspots h where h.step_id = st.id)
    )) as j
    from st
  ), chapters_json as (
    select c.position, jsonb_build_object('title', c.title, 'steps',
      coalesce((select jsonb_agg(sj.j order by sj.idx) from steps_json sj where sj.chapter_id = c.id), '[]'::jsonb)) as j
    from public.chapters c where c.demo_id = p_demo
  )
  select jsonb_build_object(
    'settings', coalesce(d.settings, '{}'::jsonb) - 'variables' - 'allowedEmbedOrigins',
    'themeId', d.theme_id,
    'chapters',
      case when exists (select 1 from steps_json where chapter_id is null)
        then jsonb_build_array(jsonb_build_object('title', '', 'steps',
               (select jsonb_agg(sj.j order by sj.idx) from steps_json sj where sj.chapter_id is null)))
        else '[]'::jsonb end
      || coalesce((select jsonb_agg(cj.j order by cj.position) from chapters_json cj), '[]'::jsonb),
    'quiz', coalesce((select jsonb_agg(jsonb_build_object('type', q.type, 'prompt', q.prompt, 'answers', q.answers,
                        'explanation', q.explanation, 'points', q.points) order by q.position)
                      from public.quiz_questions q where q.demo_id = p_demo), '[]'::jsonb)
  ) into v_struct;

  insert into public.demo_templates (workspace_id, name, description, category, icon, structure, with_captures, created_by)
  values (d.workspace_id, btrim(p_name), left(coalesce(p_description, ''), 200), p_category, 'layout-template',
          v_struct, coalesce(p_with_captures, false), (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.save_demo_as_template(uuid, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.save_demo_as_template(uuid, text, text, text, boolean, boolean) to authenticated;

-- Images d'un modèle : copiées par l'app dans <espace>/templates/<modèle>/, puis rattachées ici
create or replace function public.template_set_images(p_template uuid, p_map jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  tpl public.demo_templates;
  k text;
begin
  select * into tpl from public.demo_templates where id = p_template;
  if tpl.id is null or tpl.workspace_id is null or not public.has_role(tpl.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if jsonb_typeof(p_map) <> 'object' then raise exception 'MAP_INVALID'; end if;
  for k in select jsonb_object_keys(p_map) loop
    if public.path_uuid(k, 1) <> tpl.workspace_id
       or (p_map ->> k) !~ ('^' || tpl.workspace_id::text || '/templates/' || tpl.id::text || '/[A-Za-z0-9_.-]+$') then
      raise exception 'MAP_INVALID';
    end if;
  end loop;
  update public.demo_templates t set structure = jsonb_set(t.structure, '{chapters}', coalesce((
    select jsonb_agg(jsonb_set(c, '{steps}', coalesce((
      select jsonb_agg(case when p_map ? (st -> 'image' ->> 'path')
                            then jsonb_set(st, '{image,path}', p_map -> (st -> 'image' ->> 'path')) else st end
                       order by so)
      from jsonb_array_elements(c -> 'steps') with ordinality as x(st, so)), '[]'::jsonb)) order by co)
    from jsonb_array_elements(t.structure -> 'chapters') with ordinality as y(c, co)), '[]'::jsonb))
  where t.id = tpl.id;
end $$;
revoke all on function public.template_set_images(uuid, jsonb) from public, anon;
grant execute on function public.template_set_images(uuid, jsonb) to authenticated;

-- ===== Aide : compteur limité aux articles livrés =====
create table if not exists public.help_articles (slug text primary key check (slug ~ '^[a-z0-9-]{1,60}$'));
alter table public.help_articles enable row level security;
revoke all on public.help_articles from anon, authenticated;
insert into public.help_articles (slug) values
  ('accessibilite-demos'), ('animations-etape'), ('centre-formation'), ('creer-demo-extension'),
  ('diffuser-intranet'), ('exporter-scorm'), ('flouter-donnees'), ('lire-statistiques'), ('membres-roles'),
  ('mettre-a-jour-scorm'), ('modifier-etape'), ('page-publique'), ('parametres-espace'), ('partager-lien'),
  ('partir-modele'), ('ranger-demos'), ('reglages-demo'), ('style-demo'), ('suivre-apprenants'),
  ('visiteurs-recurrents')
on conflict do nothing;

create or replace function public.help_feedback(p_article text, p_helpful boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_helpful is null or not exists (select 1 from public.help_articles where slug = p_article) then
    raise exception 'ARTICLE_INVALID';
  end if;
  insert into public.help_feedback as f (article, yes, no)
  values (p_article, case when p_helpful then 1 else 0 end, case when p_helpful then 0 else 1 end)
  on conflict (article) do update
    set yes = f.yes + excluded.yes, no = f.no + excluded.no, updated_at = now();
end $$;
