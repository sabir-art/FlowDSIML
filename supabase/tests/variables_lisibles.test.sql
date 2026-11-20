-- Tests pgTAP : L46 (variables lisibles : description, exemple, valeur fixe, libellé repris de la clé,
-- valeur publiée dans le manifeste). Données fictives.
begin;
set search_path = public, extensions;
select plan(7);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a461', 'auteur-variables@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000a461');
create temp table ctx as select (public.create_workspace('Variables')).id as ws;
grant all on ctx to authenticated;
reset role;
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-00000000a461');

select has_column('public', 'variables', 'description', 'colonne description');
select has_column('public', 'variables', 'example', 'colonne exemple');
select has_column('public', 'variables', 'value', 'colonne valeur fixe');

insert into public.variables (workspace_id, key, label, description, example, value, default_value) values
  ((select ws from ctx), 'logiciel', 'Nom du logiciel', 'Le logiciel métier présenté.', 'GestPro', 'GestPro', 'le logiciel'),
  ((select ws from ctx), 'antenne', 'Antenne', '', 'Antenne Nord', null, 'votre antenne');
select throws_ok($$ insert into public.variables (workspace_id, key, description)
  values ((select ws from ctx), 'trop_long', repeat('x', 81)) $$, '23514', null, 'description de 80 caractères au plus');

insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-00000000a4d1', (select ws from ctx), 'Démo variables', auth.uid());
insert into public.steps (demo_id, workspace_id, position, kind, title)
  values ('00000000-0000-0000-0000-00000000a4d1', (select ws from ctx), 0, 'text', 'Bienvenue {{logiciel}}');
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-00000000a4d1', '{"reviewed": true, "fictional": true}') as r;
grant all on pub to authenticated;
select is((select v ->> 'default' from pub, jsonb_array_elements(r -> 'manifest' -> 'variables') v where v ->> 'key' = 'logiciel'),
  'GestPro', 'valeur fixe de l''espace publiée');
select is((select v ->> 'default' from pub, jsonb_array_elements(r -> 'manifest' -> 'variables') v where v ->> 'key' = 'antenne'),
  'votre antenne', 'sans valeur fixe : le repli');
select is((select v ->> 'label' from pub, jsonb_array_elements(r -> 'manifest' -> 'variables') v where v ->> 'key' = 'logiciel'),
  'Nom du logiciel', 'libellé publié');

select * from finish();
rollback;
