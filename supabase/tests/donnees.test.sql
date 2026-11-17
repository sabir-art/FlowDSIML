-- Tests pgTAP : F1 données sensibles (liens publics par workspace, confirmation RGPD journalisée).
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'editeur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
create temp table ctx as select (public.create_workspace('Données')).id as ws;
grant all on ctx to authenticated;
select is((select public_links_enabled from public.workspaces where id = (select ws from ctx)), false,
  'nouveau workspace : liens publics désactivés par défaut');

insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-00000000de01', (select ws from ctx), 'Module', auth.uid());
insert into public.steps (demo_id, workspace_id, position, kind, title, image_path, image_width, image_height, blurs, element_meta) values
  ('00000000-0000-0000-0000-00000000de01', (select ws from ctx), 0, 'image', 'A', 'x/a.webp', 1280, 800,
   '[{"x":0.1,"y":0.1,"w":0.1,"h":0.1}]',
   '{"pii":[{"type":"phone","rect":{"x":0,"y":0,"w":0.1,"h":0.1},"blurred":true},{"type":"name","rect":{"x":0,"y":0.2,"w":0.1,"h":0.1},"blurred":true}]}'),
  ('00000000-0000-0000-0000-00000000de01', (select ws from ctx), 1, 'image', 'B', 'x/b.webp', 1280, 800, '[]',
   '{"pii":[{"type":"address","rect":{"x":0,"y":0,"w":0.1,"h":0.1},"blurred":false}]}');

select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-00000000de01', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'PUBLIC_DISABLED', 'publication refusée quand les liens publics sont désactivés');
select throws_ok($$ insert into public.share_links (demo_id, workspace_id) values ('00000000-0000-0000-0000-00000000de01', (select ws from ctx)) $$,
  'P0001', 'PUBLIC_DISABLED', 'lien personnalisé refusé quand les liens publics sont désactivés');

-- Un éditeur ne peut pas activer les liens publics (admin+ uniquement)
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000000e2', 'editor');
select pg_temp.login('00000000-0000-0000-0000-0000000000e2');
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select is((select public_links_enabled from public.workspaces where id = (select ws from ctx)), false,
  'un éditeur ne peut pas activer les liens publics');
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);
select is((select public_links_enabled from public.workspaces where id = (select ws from ctx)), true,
  'un admin active les liens publics');

select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-00000000de01') $$,
  'P0001', 'GDPR_ACK_REQUIRED', 'confirmation RGPD exigée');
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-00000000de01', '{"reviewed": true}') $$,
  'P0001', 'GDPR_ACK_REQUIRED', 'les deux cases sont obligatoires');

create temp table pub as select public.publish_demo('00000000-0000-0000-0000-00000000de01', '{"reviewed": true, "fictional": true}') as r;
create temp table ack as select public_ack as a from public.demo_versions where id = (select (r ->> 'versionId')::uuid from pub);
select is((select (a ->> 'blurred')::int from ack), 3, 'bilan : zones floutées (calque + incrustées)');
select is((select a -> 'pendingSteps' from ack), '[2]'::jsonb, 'bilan : étape avec détection non floutée');
select is((select (a ->> 'by')::uuid from ack), '00000000-0000-0000-0000-0000000000e1'::uuid, 'confirmation journalisée avec son auteur');

select * from finish();
rollback;
