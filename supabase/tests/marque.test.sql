-- Tests pgTAP : L27 120 (marque de l'espace, styles des démos, droits par rôle).
begin;
set search_path = public, extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000060a1', 'proprietaire-marque@example.com'),
  ('00000000-0000-0000-0000-0000000060a2', 'editrice-marque@example.com'),
  ('00000000-0000-0000-0000-0000000060a3', 'editeur2-marque@example.com'),
  ('00000000-0000-0000-0000-0000000060a4', 'lecteur-marque@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000060a1');
create temp table ctx as select (public.create_workspace('Marque')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000060a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000060a3', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000060a4', 'viewer');

select is((select count(*)::int from public.builtin_styles), 6, '6 styles livrés');
select is((select builtin_key from public.themes where workspace_id = (select ws from ctx) and is_default), 'dsi',
  'nouvel espace : style livré « dsi » par défaut');
select is((select tokens ->> 'primary' from public.themes where workspace_id = (select ws from ctx) and is_default),
  '#A3195B', 'valeurs du style par défaut (lues par publish_demo)');
select hasnt_table('public', 'help_tours', 'help_tours supprimée');

-- Marque : admin seulement
select pg_temp.login('00000000-0000-0000-0000-0000000060a2');
update public.workspaces set brand_primary = '#123456' where id = (select ws from ctx);
select is((select brand_primary from public.workspaces where id = (select ws from ctx)), null, 'éditeur : couleurs non modifiables');
select pg_temp.login('00000000-0000-0000-0000-0000000060a1');
update public.workspaces set brand_primary = '#1D4ED8', brand_accent = '#0F766E' where id = (select ws from ctx);
select is((select brand_primary from public.workspaces where id = (select ws from ctx)), '#1D4ED8', 'admin : couleurs enregistrées');
select throws_ok($$ update public.workspaces set brand_accent = 'rouge' where id = (select ws from ctx) $$,
  '23514', null, 'couleur : hexadécimal seulement');

-- Création : éditeur, auteur = soi
select pg_temp.login('00000000-0000-0000-0000-0000000060a2');
insert into public.themes (workspace_id, name, tokens) values ((select ws from ctx), 'Acme bleu', '{"primary":"#1D4ED8"}');
select is((select created_by from public.themes where name = 'Acme bleu'), '00000000-0000-0000-0000-0000000060a2'::uuid,
  'éditeur : style créé, auteur enregistré');
select throws_ok($$ insert into public.themes (workspace_id, name, tokens) values ((select ws from ctx), 'ACME BLEU', '{}') $$,
  'P0001', 'STYLE_NAME_TAKEN', 'nom déjà pris (casse ignorée)');
select throws_ok($$ insert into public.themes (workspace_id, name, tokens) values ((select ws from ctx), repeat('x', 41), '{}') $$,
  'P0001', 'STYLE_NAME_INVALID', 'nom : 40 caractères au plus');
select throws_ok($$ insert into public.themes (workspace_id, name, tokens, created_by)
  values ((select ws from ctx), 'Usurpé', '{}', '00000000-0000-0000-0000-0000000060a3') $$,
  '42501', null, 'éditeur : pas de style au nom d’un autre');
select throws_ok($$ insert into public.themes (workspace_id, name, tokens, is_default) values ((select ws from ctx), 'Défaut', '{}', true) $$,
  '42501', null, 'éditeur : pas de choix du défaut par insertion');
update public.themes set name = 'Acme bleu nuit' where name = 'Acme bleu';
select is((select count(*)::int from public.themes where name = 'Acme bleu nuit'), 1, 'éditeur : renomme son style');

-- Un autre éditeur : lecture et duplication seulement
select pg_temp.login('00000000-0000-0000-0000-0000000060a3');
update public.themes set name = 'Pris' where name = 'Acme bleu nuit';
select is((select count(*)::int from public.themes where name = 'Acme bleu nuit'), 1, 'éditeur : ne modifie pas le style d’un autre');
delete from public.themes where name = 'Acme bleu nuit';
select is((select count(*)::int from public.themes where name = 'Acme bleu nuit'), 1, 'éditeur : ne supprime pas');
select throws_ok($$ select public.set_default_style((select ws from ctx), 'blue') $$, '42501', null, 'éditeur : pas de choix du défaut');
select pg_temp.login('00000000-0000-0000-0000-0000000060a4');
select throws_ok($$ insert into public.themes (workspace_id, name, tokens) values ((select ws from ctx), 'Lecteur', '{}') $$,
  '42501', null, 'lecteur : pas de création');

-- Admin : tout, sauf supprimer le défaut
select pg_temp.login('00000000-0000-0000-0000-0000000060a1');
update public.themes set tokens = '{"primary":"#0F766E"}' where name = 'Acme bleu nuit';
select is((select tokens ->> 'primary' from public.themes where name = 'Acme bleu nuit'), '#0F766E', 'admin : modifie tous les styles');
select public.set_default_style((select ws from ctx), null, (select id from public.themes where name = 'Acme bleu nuit'));
select is((select name from public.themes where workspace_id = (select ws from ctx) and is_default), 'Acme bleu nuit',
  'admin : style de l’espace par défaut');
select is((select count(*)::int from public.themes where workspace_id = (select ws from ctx) and builtin_key is not null), 0,
  'ligne du style livré retirée');
delete from public.themes where name = 'Acme bleu nuit';
select is((select count(*)::int from public.themes where name = 'Acme bleu nuit'), 1, 'style par défaut : jamais supprimé');
select public.set_default_style((select ws from ctx), 'night');
select is((select builtin_key from public.themes where workspace_id = (select ws from ctx) and is_default), 'night',
  'admin : style livré par défaut');
delete from public.themes where name = 'Acme bleu nuit';
select is((select count(*)::int from public.themes where name = 'Acme bleu nuit'), 0, 'admin : supprime un autre style');

-- Démos concernées par le défaut : celles sans style choisi
insert into public.demos (workspace_id, title, settings) values
  ((select ws from ctx), 'Sans style', '{}'),
  ((select ws from ctx), 'Avec style', '{"theme":{"primary":"#217BAC"}}');
select is(public.default_style_impact((select ws from ctx)), 1, '1 démo concernée');
select throws_ok($$ select public.set_default_style((select ws from ctx), 'inconnu') $$, 'P0001', 'NOT_FOUND', 'style livré inconnu');

select * from finish();
rollback;
