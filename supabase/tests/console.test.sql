-- Tests pgTAP : L41 retours sur l'aide et Console propriétaire.
-- Conditions : RLS stricte, platform_admins sans grant, journal en insertion seule, aucune identité de
-- répondant, un admin d'espace ne voit RIEN de la console, list_product_news = publiées seulement.
begin;
set search_path = public, extensions;
select plan(48);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'proprio@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'lecture@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'client-admin@example.com'),
  ('00000000-0000-0000-0000-0000000000c4', 'membre@example.com'),
  ('00000000-0000-0000-0000-0000000000c5', 'nouveau@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

-- Espace client « Acme » : c3 propriétaire de l'espace, c4 membre
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000000c4', 'editor');
-- Premier admin de la plateforme : créé en SQL (exploitation), puis un compte en lecture seule
insert into public.platform_admins (user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin'),
  ('00000000-0000-0000-0000-0000000000c2', 'read_only');

-- ===== Côté client =====
select pg_temp.login('00000000-0000-0000-0000-0000000000c4');
create temp table v as select public.help_vote('membres-roles', false, 'members', (select ws from ctx)) as id;
select ok((select id from v) is not null, 'vote « Non » enregistré');
select throws_ok($$ select public.help_comment((select id from v), 'Écrivez-moi à test@example.com') $$,
  'P0001', 'PERSONAL_DATA', 'e-mail refusé côté serveur');
select throws_ok($$ select public.help_comment((select id from v), 'Rappelez le 06 12 34 56 78') $$,
  'P0001', 'PERSONAL_DATA', 'numéro de 9 chiffres ou plus refusé');
select throws_ok($$ select public.help_comment((select id from v), repeat('a', 501)) $$,
  'P0001', 'COMMENT_LENGTH', '501 caractères refusés');
select lives_ok($$ select public.help_comment((select id from v), repeat('a', 500)) $$, '500 caractères acceptés');
select is((public.my_help_vote('membres-roles', (select ws from ctx)) ->> 'helpful')::boolean, false,
  'réponse enregistrée retrouvée');
select throws_ok($$ select public.help_vote('membres-roles', true, 'members', gen_random_uuid()) $$,
  '42501', null, 'vote dans un espace dont on n''est pas membre : refusé');
-- Changer sa réponse : le commentaire reste lié à l'ancienne réponse
select lives_ok($$ select public.help_vote('membres-roles', true, 'members', (select ws from ctx)) $$, 'changer sa réponse');
reset role;
select is((select count(*)::int from public.help_feedback_entries where article = 'membres-roles' and is_current), 1,
  'une seule réponse en vigueur');
select is((select count(*)::int from public.help_feedback_entries where article = 'membres-roles' and comment is not null), 1,
  'le commentaire reste lié à l''ancienne réponse');

-- Accès direct aux tables : refusé à tout compte connecté
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select * from public.help_feedback_entries $$, '42501', null, 'admin d''espace : table des retours illisible');
select throws_ok($$ select * from public.platform_admins $$, '42501', null, 'admin d''espace : platform_admins illisible');
select throws_ok($$ insert into public.platform_admins (user_id, role) values (auth.uid(), 'admin') $$,
  '42501', null, 'admin d''espace : impossible de s''ajouter propriétaire');
select throws_ok($$ select * from public.console_audit $$, '42501', null, 'admin d''espace : journal illisible');
select throws_ok($$ select * from public.product_news $$, '42501', null, 'admin d''espace : annonces illisibles en direct');

-- Un admin d'espace ne voit RIEN de la console
select is(public.console_me(), null, 'admin d''espace : console_me nul');
select is(public.is_platform_owner(), false, 'admin d''espace : pas propriétaire de la plateforme');
select throws_ok($$ select public.console_overview(90) $$, '42501', null, 'admin d''espace : vue d''ensemble refusée');
select throws_ok($$ select public.console_comments(90, null, null) $$, '42501', null, 'admin d''espace : commentaires refusés');
select throws_ok($$ select public.console_articles(90, null) $$, '42501', null, 'admin d''espace : articles refusés');
select throws_ok($$ select public.console_items() $$, '42501', null, 'admin d''espace : backlog refusé');
select throws_ok($$ select public.console_team() $$, '42501', null, 'admin d''espace : équipe refusée');
select throws_ok($$ select public.console_audit_list(10) $$, '42501', null, 'admin d''espace : journal refusé');
select throws_ok($$ select public.console_add_owner('client-admin@example.com', 'admin') $$, '42501', null,
  'admin d''espace : recherche de compte par e-mail refusée');
select throws_ok($$ select public.console_log_event('console.open', '') $$, '42501', null,
  'admin d''espace : aucune écriture au journal');

-- ===== Console : admin de la plateforme =====
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
create temp table cm as select public.console_comments(90, null, null) as j;
select is(jsonb_array_length((select j from cm)), 1, 'console : commentaire visible');
select ok(position('0000000000c4' in (select j from cm)::text) = 0 and position('membre@example.com' in (select j from cm)::text) = 0,
  'console : aucune identité de répondant');
select is((select j from cm) -> 0 ->> 'workspace', 'Acme', 'console : seul le nom de l''espace est visible');
create temp table it as select public.console_create_item('Expliquer les rôles', 'high', 'membres-roles', null,
  array[((select j from cm) -> 0 ->> 'id')::uuid]) as id;
select is((public.console_items() -> 0 ->> 'feedback')::int, 1, 'élément créé avec son retour rattaché');
select throws_ok($$ select public.console_update_item((select id from it), '{"status":"rejected"}') $$,
  'P0001', 'REJECT_REASON', 'Rejeté sans motif : refusé');
select throws_ok($$ select public.console_update_item((select id from it), '{"githubUrl":"https://example.com/x"}') $$,
  '23514', null, 'ticket GitHub invalide : refusé');
select lives_ok($$ select public.console_update_item((select id from it),
  '{"status":"done","githubUrl":"https://github.com/acme/app/issues/431"}') $$, 'passage à Fait avec un ticket valide');
-- Annonces : brouillon, publiée, retirée ; le client ne voit que les publiées
select public.console_save_news(null, 'Brouillon', 'Pas encore', null, null, false);
create temp table nw as select public.console_save_news(null, 'Rôles expliqués', 'Nouvel article.', 'membres-roles',
  (select id from it), true) as id;
select is(public.console_add_owner('inconnu@example.com', 'admin'), 'introuvable', 'compte inconnu : « introuvable »');
select throws_ok($$ select public.console_set_owner_role(auth.uid(), 'read_only') $$, '42501', null,
  'changer son propre rôle : impossible');
select lives_ok($$ select public.console_set_owner_role('00000000-0000-0000-0000-0000000000c2', 'read_only') $$,
  'changer le rôle d''un autre propriétaire');

-- Garde-fous de l'équipe (arbitrage du chef)
reset role;
select is((select count(*)::int from auth.users), 5, 'add_owner ne crée jamais de compte');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.console_remove_owner(auth.uid()) $$, '42501', 'OWN_ROLE', 'se retirer soi-même : refusé');
select lives_ok($$ select public.console_add_owner('nouveau@example.com', 'read_only') $$, 'ajout d''un compte existant');
reset role;
select is((select role from public.platform_admins where user_id = '00000000-0000-0000-0000-0000000000c5'), 'read_only',
  'compte existant ajouté avec son rôle');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
-- Plafond : 20 opérations d'équipe par heure (recherches « introuvable » comprises)
-- 3 opérations déjà faites (recherche, rôle, ajout) : 17 de plus atteignent le plafond
select public.console_add_owner('inconnu' || g || '@example.com', 'read_only') from generate_series(1, 17) g;
select throws_ok($$ select public.console_add_owner('encore@example.com', 'read_only') $$, '54000', 'RATE_LIMIT',
  'au-delà de 20 opérations d''équipe par heure : refusé');
reset role;
-- Exploitation en SQL (aucun compte connecté)
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
select throws_ok($$ delete from public.platform_admins where user_id = '00000000-0000-0000-0000-0000000000c1' $$,
  '23514', 'LAST_ADMIN', 'retirer le dernier admin : refusé');

select pg_temp.login('00000000-0000-0000-0000-0000000000c4');
create temp table ln as select public.list_product_news() as j;
select is(jsonb_array_length((select j from ln)), 1, 'client : seules les annonces publiées');
select is(public.news_unseen_count(), 1, 'client : une nouveauté non vue');
select public.news_mark_seen();
select is(public.news_unseen_count(), 0, 'client : point effacé après ouverture de la page');

-- Lecture seule : lit, n'écrit pas
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
select ok(jsonb_array_length(public.console_items()) = 1, 'lecture seule : backlog lisible');
select throws_ok($$ select public.console_create_item('X', 'low', null, null, '{}') $$, '42501', null,
  'lecture seule : écriture refusée');

-- Journal : alimenté, ni modifiable ni effaçable
reset role;
select ok((select count(*) from public.console_audit where action in ('item.create', 'feedback.link', 'item.status.done',
  'item.ticket', 'news.publish', 'news.draft', 'owner.role')) >= 7, 'journal : chaque action du parcours tracée');
select throws_ok($$ delete from public.console_audit $$, '42501', 'AUDIT_READ_ONLY', 'journal : suppression refusée');

select * from finish();
rollback;
