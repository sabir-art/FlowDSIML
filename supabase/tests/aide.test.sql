-- Tests pgTAP : L26-02 / L26-03 aide, reprise L41 (vote par article et par personne).
begin;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000050a1', 'lectrice-aide@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000050a1');
create temp table ctx as select (public.create_workspace('Aide')).id as ws;
grant all on ctx to authenticated;
select lives_ok($$ select public.help_vote('exporter-scorm', true, 'distribute', (select ws from ctx)) $$, 'réponse « Oui » enregistrée');
select throws_ok($$ select public.help_vote('../secret', true, '', (select ws from ctx)) $$, 'P0001', 'ARTICLE_INVALID', 'clé d’article contrôlée');
select throws_ok($$ select public.help_vote('article-invente', true, '', (select ws from ctx)) $$, 'P0001', 'ARTICLE_INVALID', 'articles connus seulement');
select throws_ok($$ select * from public.help_feedback $$, '42501', null, 'ancien compteur non lisible par les utilisateurs');
select throws_ok($$ select * from public.help_feedback_entries $$, '42501', null, 'réponses non lisibles par les utilisateurs');
reset role;
select ok(not exists (select 1 from pg_proc where proname = 'help_feedback' and pronamespace = 'public'::regnamespace),
  'ancienne RPC du compteur retirée (remplacée par help_vote)');

select * from finish();
rollback;
