-- Tests pgTAP : L41 étape 3, modèle par fonction et fonctions coupées (docs/tech/ia-fournisseurs.md §5).
-- Conditions : tables fermées aux clients ; écritures par le rôle de service au nom d'un admin de la
-- plateforme seulement ; journal ai.model_changed ; ai_status rend « unavailable » sans nom de fournisseur.
begin;
set search_path = public, extensions;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000041b1', 'proprio-ia3@example.com'),
  ('00000000-0000-0000-0000-0000000041b2', 'lecture-ia3@example.com'),
  ('00000000-0000-0000-0000-0000000041b3', 'client-ia3@example.com');
insert into public.platform_admins (user_id, role) values
  ('00000000-0000-0000-0000-0000000041b1', 'admin'),
  ('00000000-0000-0000-0000-0000000041b2', 'read_only');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

-- ===== Droits =====
select ok(not has_table_privilege('authenticated', 'public.ai_function_models', 'select'), 'client : ai_function_models illisible');
select ok(not has_table_privilege('authenticated', 'public.ai_cut', 'select'), 'client : ai_cut illisible');
select ok(not has_function_privilege('authenticated', 'public.ai_set_function_model(text, text, uuid, text, text, text)', 'execute'), 'client : ai_set_function_model refusée');
select ok(not has_function_privilege('authenticated', 'public.ai_set_cut(text[])', 'execute'), 'client : ai_set_cut refusée');
select ok(has_function_privilege('service_role', 'public.ai_set_function_model(text, text, uuid, text, text, text)', 'execute'), 'rôle de service : ai_set_function_model permise');

-- ===== Modèle par fonction =====
select is((public.ai_set_function_model('translate', 'claude-opus-5-5', '00000000-0000-0000-0000-0000000041b1'))->>'old',
  null, 'premier choix : pas d''ancien modèle');
select is((select model from public.ai_function_models where fn = 'translate'), 'claude-opus-5-5', 'choix enregistré');
select is((public.ai_set_function_model('translate', null, '00000000-0000-0000-0000-0000000041b1'))->>'old',
  'claude-opus-5-5', 'retour au défaut : l''ancien modèle est rendu (pour « Annuler »)');
select is((select count(*)::int from public.ai_function_models where fn = 'translate'), 0, 'retour au défaut : ligne retirée');
-- L41 étape 6 : objet, ancienne et nouvelle valeur ; sans libellés, les identifiants
select is((select object_label || ' | ' || old_value || ' | ' || new_value from public.console_audit
            where action = 'ai.model_changed' order by id desc limit 1),
  'translate | claude-opus-5-5 | défaut', 'journal : ancien et nouveau modèle');
select public.ai_set_function_model('translate', 'claude-opus-5-5', '00000000-0000-0000-0000-0000000041b1',
  'Traduction', 'Claude Sonnet (défaut)', 'Claude Opus');
select is((select object_label || ' | ' || old_value || ' | ' || new_value from public.console_audit
            where action = 'ai.model_changed' order by id desc limit 1),
  'Traduction | Claude Sonnet (défaut) | Claude Opus', 'journal : libellés lisibles fournis par l''Edge Function');
select throws_ok($$ select public.ai_set_function_model('write', 'claude-haiku-5-5', '00000000-0000-0000-0000-0000000041b2') $$,
  '42501', null, 'Lecture seule : changement refusé');
select throws_ok($$ select public.ai_set_function_model('autre', 'claude-haiku-5-5', '00000000-0000-0000-0000-0000000041b1') $$,
  'P0001', 'BAD_FUNCTION', 'fonction inconnue refusée');

-- ===== Fonctions coupées, vues par un espace =====
select public.ai_set_cut(array['translate', 'captions']);
select pg_temp.login('00000000-0000-0000-0000-0000000041b3');
create temp table ctx as select (public.create_workspace('Acme IA')).id as ws;
select is((public.ai_status((select ws from ctx)))->'unavailable', '["captions", "translate"]'::jsonb,
  'ai_status : fonctions coupées, sans nom de fournisseur');
reset role;
select public.ai_set_cut(array[]::text[]);
select pg_temp.login('00000000-0000-0000-0000-0000000041b3');
select is((public.ai_status((select ws from ctx)))->'unavailable', '[]'::jsonb, 'clé revenue : plus rien de coupé');
reset role;

select * from finish();
rollback;
