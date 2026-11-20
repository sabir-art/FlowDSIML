-- Tests pgTAP : L29, notification « webhook en pause » aux propriétaires et admins.
begin;
set search_path = public, extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000290a1', 'olga-wh@acme.example'),
  ('00000000-0000-0000-0000-0000000290a2', 'adam-wh@acme.example'),
  ('00000000-0000-0000-0000-0000000290a3', 'eddie-wh@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000290a1');
create temp table ctx as select (public.create_workspace('Webhooks')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000290a2', 'admin'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000290a3', 'editor');
insert into public.webhooks (id, workspace_id, url, name, events)
  values ('00000000-0000-0000-0000-0000000290b1', (select ws from ctx), 'https://crm.acme.example/hook/secret?k=1', 'CRM', '{lead.created}');

update public.webhooks set state = 'paused_auto', failures = 6 where id = '00000000-0000-0000-0000-0000000290b1';
select is((select count(*)::int from public.notifications where kind = 'webhook_paused'), 2,
  'pause automatique : propriétaire et admin notifiés');
select is((select count(*)::int from public.notifications where kind = 'webhook_paused'
            and user_id = '00000000-0000-0000-0000-0000000290a3'), 0, 'éditeur : pas notifié');
select is((select data ->> 'host' from public.notifications where kind = 'webhook_paused' limit 1), 'crm.acme.example',
  'hôte seul, jamais le chemin ni les paramètres');
update public.webhooks set failures = 7 where id = '00000000-0000-0000-0000-0000000290b1';
update public.webhooks set state = 'paused_auto' where id = '00000000-0000-0000-0000-0000000290b1';
select is((select count(*)::int from public.notifications where kind = 'webhook_paused'), 2, 'pas de doublon si déjà en pause');
select throws_ok($$ insert into public.notifications (workspace_id, user_id, kind, demo_id)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000290a1', 'webhook_paused', gen_random_uuid()) $$,
  '23514', null, 'webhook en pause : sans démo');

select * from finish();
rollback;
