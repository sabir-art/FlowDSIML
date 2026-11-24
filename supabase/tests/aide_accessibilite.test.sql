-- Tests pgTAP : article d'aide « Accessibilité de TutoClick » (20261201150000_aide_accessibilite.sql).
-- La déclaration d'accessibilité renvoie vers cet article pour signaler un défaut : il doit être connu en
-- base pour recevoir un avis. Droits inchangés : un membre de l'espace seulement, réponses non lisibles.
begin;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000062a1', 'membre-a11y@example.com'),
  ('00000000-0000-0000-0000-0000000062a2', 'externe-a11y@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select is((select count(*)::int from public.help_articles where slug = 'accessibilite-tutoclick'), 1,
  'article « accessibilite-tutoclick » connu en base');

select pg_temp.login('00000000-0000-0000-0000-0000000062a1');
create temp table ctx as select (public.create_workspace('Aide accessibilité')).id as ws;
grant all on ctx to authenticated;
select lives_ok($$ select public.help_vote('accessibilite-tutoclick', false, 'settings', (select ws from ctx)) $$,
  'membre : réponse « Non » enregistrée sur l''article');
select throws_ok($$ select * from public.help_feedback_entries $$, '42501', null,
  'réponses toujours non lisibles par les utilisateurs');

-- Une personne extérieure à l'espace ne peut pas répondre pour lui
select pg_temp.login('00000000-0000-0000-0000-0000000062a2');
select throws_ok($$ select public.help_vote('accessibilite-tutoclick', false, 'settings', (select ws from ctx)) $$,
  null, null, 'personne extérieure à l''espace : refusée');

-- Une seule réponse par personne, par article et par espace (la contrainte d'origine tient)
reset role;
select is((select count(*)::int from public.help_feedback_entries
           where article = 'accessibilite-tutoclick' and workspace_id = (select ws from ctx)), 1,
  'une réponse enregistrée pour l''espace');
select pg_temp.login('00000000-0000-0000-0000-0000000062a1');
select lives_ok($$ select public.help_vote('accessibilite-tutoclick', true, 'settings', (select ws from ctx)) $$,
  'la même personne peut changer sa réponse, sans doublon');

select * from finish();
rollback;
