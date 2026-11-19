-- Tests pgTAP : L26-02 / L26-03 (compteur anonyme des articles).
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
select lives_ok($$ select public.help_feedback('exporter-scorm', true) $$, 'réponse « Oui » enregistrée');
select public.help_feedback('exporter-scorm', true);
select public.help_feedback('exporter-scorm', false);
select throws_ok($$ select public.help_feedback('../secret', true) $$, 'P0001', 'ARTICLE_INVALID', 'clé d’article contrôlée');
select throws_ok($$ select public.help_feedback('article-invente', true) $$, 'P0001', 'ARTICLE_INVALID', 'articles connus seulement');
select throws_ok($$ select * from public.help_feedback $$, '42501', null, 'compteurs non lisibles par les utilisateurs');
reset role;
select is((select yes from public.help_feedback where article = 'exporter-scorm'), 2, 'compteur Oui');
select is((select no from public.help_feedback where article = 'exporter-scorm'), 1, 'compteur Non (anonyme)');

select * from finish();
rollback;
