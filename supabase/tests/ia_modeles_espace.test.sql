-- Tests pgTAP : L41 étape 5, modèles de l'assistant gardés par l'espace (retrait seulement).
-- Conditions : propriétaire seulement ; modèle non proposé par la Console refusé ; au moins un modèle ;
-- ordre de la Console ; les autres réglages IA de l'espace sont gardés ; écriture directe refusée.
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000041d1', 'proprio-ia5@example.com'),
  ('00000000-0000-0000-0000-0000000041d2', 'admin-ia5@example.com'),
  ('00000000-0000-0000-0000-0000000041d3', 'editeur-ia5@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000041d1');
create temp table ctx as select (public.create_workspace('Acme modèles')).id as ws;
grant all on ctx to authenticated, anon, service_role;
select public.set_ai_settings((select ws from ctx), true);
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000041d2', 'admin'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000041d3', 'editor');
-- Console : Sonnet et Opus proposés, Haiku non (valeurs de départ de l'étape 4)

-- ===== Droits =====
select pg_temp.login('00000000-0000-0000-0000-0000000041d2');
select throws_ok($$ select public.set_ai_models((select ws from ctx), array['claude-opus-5-5']) $$,
  '42501', 'FORBIDDEN', 'admin de l''espace : lecture seule');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000041d3');
select throws_ok($$ select public.set_ai_models((select ws from ctx), array['claude-opus-5-5']) $$,
  '42501', 'FORBIDDEN', 'éditeur : refusé');
reset role;

-- ===== Propriétaire =====
select pg_temp.login('00000000-0000-0000-0000-0000000041d1');
select is((select settings -> 'ai' -> 'models' from public.workspaces where id = (select ws from ctx)), null,
  'départ : pas de liste (tous les modèles proposés)');
select is((public.set_ai_models((select ws from ctx), array['claude-opus-5-5', 'claude-sonnet-5-5'])) -> 'models',
  '["claude-sonnet-5-5", "claude-opus-5-5"]'::jsonb, 'liste enregistrée dans l''ordre de la Console');
select is((public.set_ai_models((select ws from ctx), array['claude-opus-5-5'])) -> 'models',
  '["claude-opus-5-5"]'::jsonb, 'retrait de Sonnet');
select throws_ok($$ select public.set_ai_models((select ws from ctx), array['claude-opus-5-5', 'claude-haiku-5-5']) $$,
  'P0001', 'NOT_PROPOSED', 'ajout d''un modèle non proposé par la Console : refusé');
select throws_ok($$ select public.set_ai_models((select ws from ctx), array[]::text[]) $$,
  'P0001', 'LAST_MODEL', 'aucun modèle : refusé');
select is((select (settings -> 'ai' ->> 'enabled')::boolean from public.workspaces where id = (select ws from ctx)),
  true, 'les autres réglages IA sont gardés');
select throws_ok($$ update public.workspaces set settings = jsonb_set(settings, '{ai,models}', '["claude-haiku-5-5"]')
  where id = (select ws from ctx) $$, '42501', 'AI_SETTINGS_RPC_ONLY', 'écriture directe des réglages IA refusée');
select is((select settings -> 'ai' -> 'models' from public.workspaces where id = (select ws from ctx)),
  '["claude-opus-5-5"]'::jsonb, 'liste inchangée après les refus');
reset role;

select * from finish();
rollback;
