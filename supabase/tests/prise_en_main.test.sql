-- Tests pgTAP : L26-01 (prise en main de l'espace) et « Apprendre TutoClick ».
begin;
set search_path = public, extensions;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000060a1', 'admin-pem@example.com'),
  ('00000000-0000-0000-0000-0000000060a2', 'lecteur-pem@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000060a1');
create temp table ctx as select (public.create_workspace('Prise en main')).id as ws;
grant all on ctx to authenticated;
create function pg_temp.step(k text) returns boolean language sql as $$
  select (public.workspace_onboarding((select ws from ctx)) -> 'steps' ->> k)::boolean
$$;
select is((select count(*)::int from jsonb_each(public.workspace_onboarding((select ws from ctx)) -> 'steps') e
  where e.value = 'true'::jsonb), 0, 'espace neuf : 0 étape sur 7');

-- Extension, capture vérifiée, publication
select public.extension_seen();
select ok(pg_temp.step('extension'), 'extension vue');
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000060d1', (select ws from ctx), 'Démo', auth.uid());
insert into public.steps (demo_id, workspace_id, position, kind, image_path, element_meta)
  values ('00000000-0000-0000-0000-0000000060d1', (select ws from ctx), 0, 'image',
          (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000060d1/s.webp', '{"pii": []}');
select ok(pg_temp.step('capture'), 'capture');
select ok(pg_temp.step('pii'), 'capture vérifiée');
select ok(not pg_temp.step('publish'), 'pas encore publiée');
update public.workspaces set logo_path = (select ws from ctx)::text || '/logo.png' where id = (select ws from ctx);
select ok(pg_temp.step('brand'), 'logo : espace personnalisé');
select ok(not pg_temp.step('distribute'), 'pas encore diffusée');
reset role;
insert into public.diffusions (workspace_id, demo_id, kind, label)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000060d1', 'intranet', 'Intranet');
select pg_temp.login('00000000-0000-0000-0000-0000000060a1');
select ok(pg_temp.step('distribute'), 'intégration intranet : diffusée');

-- Lecteur : pas de prise en main
reset role;
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000060a2', 'viewer');
select pg_temp.login('00000000-0000-0000-0000-0000000060a2');
select throws_ok($$ select public.workspace_onboarding((select ws from ctx)) $$, '42501', null, 'lecteur : rien');
select pg_temp.login('00000000-0000-0000-0000-0000000060a1');
select ok(pg_temp.step('invite'), '2 membres');

-- Masquer pour la personne
insert into public.onboarding_prefs (workspace_id, hidden_at) values ((select ws from ctx), now());
select isnt(public.workspace_onboarding((select ws from ctx)) ->> 'hiddenAt', null, 'masquée pour la personne');
select pg_temp.login('00000000-0000-0000-0000-0000000060a2');
select is((select count(*)::int from public.onboarding_prefs), 0, 'préférences des autres invisibles');

-- Apprendre TutoClick
select lives_ok($$ insert into public.learn_progress (module) values ('capturer') $$, 'module terminé');
select throws_ok($$ insert into public.learn_progress (module) values ('pirater') $$, '23514', null, 'modules contrôlés');
select pg_temp.login('00000000-0000-0000-0000-0000000060a1');
select is((select count(*)::int from public.learn_progress), 0, 'progression personnelle');

select * from finish();
rollback;
