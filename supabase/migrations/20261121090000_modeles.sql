-- L26-04 / L26-05 : bibliothèque de modèles de formation.
--  * steps.to_capture : étape « À capturer » (structure et textes prêts, capture à faire). Remis à false dès
--    qu'une image est posée. Tant qu'il en reste, la publication est refusée (TO_CAPTURE:n).
--  * demo_templates : modèles livrés (workspace_id null, génériques) et modèles de l'espace. La structure
--    (chapitres, étapes, bulles, quiz, réglages) est un instantané jsonb : une démo créée depuis un modèle
--    ne dépend plus de lui. Sans les captures, aucune image ni donnée de la démo d'origine n'est copiée.
--  * RPC : save_demo_as_template (éditeur+), create_demo_from_template (éditeur+).

alter table public.steps add column if not exists to_capture boolean not null default false;

create or replace function public.steps_clear_to_capture() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.to_capture and new.image_path is not null then new.to_capture := false; end if;
  return new;
end $$;
drop trigger if exists steps_clear_to_capture on public.steps;
create trigger steps_clear_to_capture before insert or update of image_path, to_capture on public.steps
  for each row execute function public.steps_clear_to_capture();

-- Publication : refusée tant qu'une étape reste à capturer (sans redéfinir publish_demo)
create or replace function public.demo_versions_check_capture() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  select count(*) into n from public.steps where demo_id = new.demo_id and to_capture;
  if n > 0 then raise exception 'TO_CAPTURE:%', n using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists demo_versions_check_capture on public.demo_versions;
create trigger demo_versions_check_capture before insert on public.demo_versions
  for each row execute function public.demo_versions_check_capture();

create table if not exists public.demo_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  builtin_key text unique,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  category text not null check (category in ('logiciel', 'procedure', 'reglementaire', 'accueil')),
  icon text not null default 'layout-template' check (icon ~ '^[a-z0-9-]{1,40}$'),
  structure jsonb not null check (jsonb_typeof(structure) = 'object' and pg_column_size(structure) < 200000),
  with_captures boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((workspace_id is null) = (builtin_key is not null))
);
create index if not exists demo_templates_ws_idx on public.demo_templates (workspace_id, created_at desc);
drop trigger if exists set_updated_at on public.demo_templates;
create trigger set_updated_at before update on public.demo_templates
  for each row execute function public.set_updated_at();

alter table public.demo_templates enable row level security;
revoke all on public.demo_templates from anon;
revoke insert, update, delete on public.demo_templates from authenticated;
grant select, delete on public.demo_templates to authenticated;
grant update (name, description, category) on public.demo_templates to authenticated;
drop policy if exists demo_templates_select on public.demo_templates;
create policy demo_templates_select on public.demo_templates for select to authenticated
  using (workspace_id is null or public.has_role(workspace_id, 'viewer'));
drop policy if exists demo_templates_update on public.demo_templates;
create policy demo_templates_update on public.demo_templates for update to authenticated
  using (workspace_id is not null and public.has_role(workspace_id, 'editor'))
  with check (workspace_id is not null and public.has_role(workspace_id, 'editor'));
drop policy if exists demo_templates_delete on public.demo_templates;
create policy demo_templates_delete on public.demo_templates for delete to authenticated
  using (workspace_id is not null and public.has_role(workspace_id, 'editor'));

-- Instantané d'une démo. Sans les captures : étapes à capture vidées (« À capturer »), sans flou, page,
-- métadonnées ni vidéo/HTML ; hotspots gardés (textes et positions). Les liens « aller à » deviennent
-- des indices (ordre des étapes) pour être rebranchés à la création.
create or replace function public.save_demo_as_template(
  p_demo uuid, p_name text, p_description text, p_category text, p_with_captures boolean
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
revoke all on function public.save_demo_as_template(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.save_demo_as_template(uuid, text, text, text, boolean) to authenticated;

-- Création d'une démo brouillon depuis un modèle (livré ou de l'espace). Les étapes « quiz » de la
-- structure sont des repères d'aperçu : les questions viennent de structure.quiz.
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
      insert into public.steps (id, demo_id, workspace_id, position, chapter_id, kind, title, body, options, cta,
                                image_path, image_width, image_height, blurs, to_capture)
      values (v_step, v_demo, p_ws, v_pos, v_chap, v_kind, left(coalesce(s ->> 'title', ''), 200),
              left(coalesce(s ->> 'body', ''), 4000), v_opts,
              case when jsonb_typeof(s -> 'cta') = 'object' then s -> 'cta' end,
              v_img ->> 'path', (v_img ->> 'width')::int, (v_img ->> 'height')::int,
              coalesce(v_img -> 'blurs', '[]'::jsonb),
              v_kind = 'image' and v_img is null);
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

-- ===== Modèles livrés (génériques, sans nom de logiciel) =====
insert into public.demo_templates (builtin_key, name, description, category, icon, structure) values
('prise-en-main', 'Prise en main d’un logiciel',
 'Pour présenter un outil à ses futurs utilisateurs : connexion, navigation, première tâche, puis un quiz court.',
 'logiciel', 'monitor', $j${
  "settings": {"quiz": {"mode": "quiz", "threshold": 70, "attempts": 3, "feedback": "each", "shuffle": true, "required": false}},
  "chapters": [
   {"title": "Découvrir", "steps": [
     {"type": "bulle", "title": "Se connecter", "bubble": "Bonjour {{first_name}}, connectez-vous avec votre identifiant habituel."},
     {"type": "bulle", "title": "Repérer le menu", "bubble": "Le menu principal regroupe toutes les rubriques."},
     {"type": "bulle", "title": "Ouvrir le tableau de bord", "bubble": "Le tableau de bord résume votre activité."}]},
   {"title": "Première tâche", "steps": [
     {"type": "bulle", "title": "Créer un élément", "bubble": "Cliquez ici pour créer votre premier élément."},
     {"type": "saisie", "title": "Remplir le formulaire", "bubble": "Renseignez les champs obligatoires.", "typing": "Exemple de saisie"},
     {"type": "bulle", "title": "Enregistrer", "bubble": "Enregistrez : l’élément apparaît dans la liste."}]},
   {"title": "Vérifier", "steps": [
     {"type": "quiz", "title": "Quiz de 3 questions"},
     {"type": "popup", "title": "Récapitulatif", "body": "Vous savez vous connecter, naviguer et créer un élément."},
     {"type": "fin", "title": "Écran de fin", "body": "Bravo {{first_name}}, la prise en main est terminée."}]}],
  "quiz": [
   {"type": "single", "prompt": "Où trouver toutes les rubriques ?", "answers": [{"id": "a", "label": "Dans le menu principal", "correct": true}, {"id": "b", "label": "Dans le pied de page", "correct": false}]},
   {"type": "truefalse", "prompt": "Le tableau de bord résume votre activité.", "answers": [{"id": "t", "label": "Vrai", "correct": true}, {"id": "f", "label": "Faux", "correct": false}]},
   {"type": "single", "prompt": "Que faire après avoir rempli le formulaire ?", "answers": [{"id": "a", "label": "Enregistrer", "correct": true}, {"id": "b", "label": "Fermer l’onglet", "correct": false}]}],
  "features": ["quiz"]}$j$::jsonb),
('nouvelle-procedure', 'Nouvelle procédure',
 'Pour expliquer une procédure qui change : le contexte, puis chaque action dans l’ordre.',
 'procedure', 'file-text', $j${
  "chapters": [
   {"title": "Contexte", "steps": [
     {"type": "popup", "title": "Pourquoi cette procédure", "body": "À partir de maintenant, la demande se fait en ligne."},
     {"type": "bulle", "title": "Ouvrir le dossier", "bubble": "Ouvrez le dossier concerné."},
     {"type": "bulle", "title": "Repérer la rubrique", "bubble": "La nouvelle rubrique se trouve ici."}]},
   {"title": "Réaliser", "steps": [
     {"type": "saisie", "title": "Saisir les informations", "bubble": "Complétez les informations demandées.", "typing": "Exemple de saisie"},
     {"type": "bulle", "title": "Valider", "bubble": "Validez : la demande est transmise."},
     {"type": "fin", "title": "Écran de fin", "body": "La procédure est terminée. Merci {{first_name}} !"}]}],
  "features": []}$j$::jsonb),
('changement-version', 'Changement de version',
 'Pour montrer ce qui change d’une version à l’autre, avec un comparatif Avant / Après.',
 'logiciel', 'refresh-cw', $j${
  "chapters": [
   {"title": "Ce qui change", "steps": [
     {"type": "popup", "title": "Ce qui change", "body": "Trois changements à connaître dans cette version."},
     {"type": "bulle", "title": "Le menu a changé de place", "bubble": "Avant / Après : le menu est désormais à gauche."},
     {"type": "bulle", "title": "Un nouveau bouton", "bubble": "Ce bouton remplace l’ancienne commande."},
     {"type": "saisie", "title": "Une saisie simplifiée", "bubble": "Un seul champ suffit désormais.", "typing": "Exemple de saisie"},
     {"type": "fin", "title": "Écran de fin", "body": "Vous connaissez les nouveautés de cette version."}]}],
  "features": ["avant_apres"]}$j$::jsonb),
('quiz-note', 'Formation avec quiz noté',
 'Pour une formation réglementaire : trois parties, puis un quiz noté avec un seuil de réussite de 70 %.',
 'reglementaire', 'shield-check', $j${
  "settings": {"quiz": {"mode": "quiz", "threshold": 70, "attempts": 3, "feedback": "end", "shuffle": true, "required": true}},
  "chapters": [
   {"title": "Le cadre", "steps": [
     {"type": "popup", "title": "Objectifs", "body": "À la fin de cette formation, vous saurez appliquer la règle."},
     {"type": "bulle", "title": "Où trouver la règle", "bubble": "La règle est accessible depuis cette rubrique."},
     {"type": "bulle", "title": "Les points clés", "bubble": "Retenez ces trois points."}]},
   {"title": "En pratique", "steps": [
     {"type": "bulle", "title": "Ouvrir le dossier", "bubble": "Ouvrez le dossier à traiter."},
     {"type": "saisie", "title": "Renseigner le motif", "bubble": "Le motif est obligatoire.", "typing": "Exemple de motif"},
     {"type": "bulle", "title": "Vérifier avant d’envoyer", "bubble": "Relisez avant d’envoyer."},
     {"type": "bulle", "title": "Envoyer", "bubble": "Envoyez : une trace est conservée."}]},
   {"title": "Évaluation", "steps": [
     {"type": "quiz", "title": "Quiz noté de 5 questions"},
     {"type": "popup", "title": "Résultat", "body": "Le seuil de réussite est de 70 %."},
     {"type": "fin", "title": "Écran de fin", "body": "Formation terminée."}]}],
  "quiz": [
   {"type": "single", "prompt": "Où trouver la règle ?", "answers": [{"id": "a", "label": "Dans la rubrique dédiée", "correct": true}, {"id": "b", "label": "Nulle part", "correct": false}]},
   {"type": "truefalse", "prompt": "Le motif est facultatif.", "answers": [{"id": "t", "label": "Vrai", "correct": false}, {"id": "f", "label": "Faux", "correct": true}]},
   {"type": "single", "prompt": "Que faire avant d’envoyer ?", "answers": [{"id": "a", "label": "Relire", "correct": true}, {"id": "b", "label": "Supprimer le dossier", "correct": false}]},
   {"type": "truefalse", "prompt": "Une trace est conservée après l’envoi.", "answers": [{"id": "t", "label": "Vrai", "correct": true}, {"id": "f", "label": "Faux", "correct": false}]},
   {"type": "multiple", "prompt": "Quels sont les points à retenir ?", "answers": [{"id": "a", "label": "Le motif est obligatoire", "correct": true}, {"id": "b", "label": "Relire avant d’envoyer", "correct": true}, {"id": "c", "label": "Envoyer sans vérifier", "correct": false}]}],
  "features": ["seuil"]}$j$::jsonb),
('accueil-agent', 'Accueil d’un nouvel agent',
 'Pour accueillir une personne qui arrive : les outils, les contacts et les premiers jours, avec une checklist.',
 'accueil', 'users', $j${
  "settings": {"checklist": {"enabled": true, "title": "Vos premiers jours", "position": "right"}},
  "chapters": [
   {"title": "Bienvenue", "steps": [
     {"type": "popup", "title": "Bienvenue", "body": "Bienvenue {{first_name}} ! Voici l’essentiel pour bien démarrer."},
     {"type": "bulle", "title": "L’intranet", "bubble": "L’intranet regroupe les informations utiles."},
     {"type": "bulle", "title": "L’annuaire", "bubble": "Retrouvez vos collègues dans l’annuaire."}]},
   {"title": "Vos outils", "steps": [
     {"type": "bulle", "title": "La messagerie", "bubble": "Votre messagerie est ici."},
     {"type": "bulle", "title": "L’agenda", "bubble": "Consultez l’agenda de l’équipe."},
     {"type": "bulle", "title": "Les documents partagés", "bubble": "Les documents de l’équipe sont rangés ici."}]},
   {"title": "Vos démarches", "steps": [
     {"type": "bulle", "title": "Poser un congé", "bubble": "Les demandes de congé se font ici."},
     {"type": "saisie", "title": "Demander du matériel", "bubble": "Décrivez votre besoin.", "typing": "Exemple de demande"},
     {"type": "bulle", "title": "Contacter le support", "bubble": "Le support répond à vos questions."}]},
   {"title": "Pour finir", "steps": [
     {"type": "bulle", "title": "Les formations", "bubble": "D’autres formations vous attendent ici."},
     {"type": "popup", "title": "Vos contacts", "body": "Votre responsable et votre référent restent vos premiers contacts."},
     {"type": "fin", "title": "Écran de fin", "body": "Bon démarrage {{first_name}} !"}]}],
  "features": ["checklist"]}$j$::jsonb),
('demo-fonctionnalite', 'Démo d’une fonctionnalité',
 'Pour faire découvrir une fonctionnalité en quelques étapes, avec un bouton d’action à la fin.',
 'logiciel', 'target', $j${
  "chapters": [
   {"title": "La fonctionnalité", "steps": [
     {"type": "popup", "title": "En bref", "body": "Découvrez la fonctionnalité en moins d’une minute."},
     {"type": "bulle", "title": "Où la trouver", "bubble": "La fonctionnalité est accessible ici."},
     {"type": "bulle", "title": "L’utiliser", "bubble": "Un clic suffit."},
     {"type": "bulle", "title": "Le résultat", "bubble": "Le résultat s’affiche aussitôt."},
     {"type": "fin", "title": "À vous de jouer", "body": "Essayez dès maintenant.", "cta": {"label": "Essayer", "url": "https://app.example"}}]}],
  "features": ["cta"]}$j$::jsonb)
on conflict (builtin_key) do nothing;
