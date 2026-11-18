-- Tests pgTAP : L22 collaboration (notes du présentateur, notifications, présence Realtime).
begin;
set search_path = public, extensions;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'olga-collab@example.com'),
  ('00000000-0000-0000-0000-0000000004a2', 'eddie-collab@example.com'),
  ('00000000-0000-0000-0000-0000000004a3', 'vera-collab@example.com'),
  ('00000000-0000-0000-0000-0000000004a4', 'xavier-collab@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Olga (owner, créatrice de la démo), Eddie éditeur, Vera lectrice, Xavier hors workspace
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
create temp table ctx as select (public.create_workspace('Collaboration')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000004d1', (select ws from ctx), 'Démo animée', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, title, presenter_notes) values
  ('00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-0000000004d1', (select ws from ctx), 0, 'Étape 1',
   'Note secrète : rappeler la consigne interne');
select pg_temp.logout();
update public.workspaces set plan_code = 'pro', public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000004a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000004a3', 'viewer');

-- ===== Notes du présentateur =====
select throws_ok($$ update public.steps set presenter_notes = repeat('x', 1001) where id = '00000000-0000-0000-0000-0000000004e1' $$,
  '23514', null, 'notes limitées à 1 000 caractères');
select pg_temp.login('00000000-0000-0000-0000-0000000004a2');
select ok(position('Note secrète' in public.publish_demo('00000000-0000-0000-0000-0000000004d1',
  '{"reviewed": true, "fictional": true}')::text) = 0, 'les notes du présentateur ne sont jamais publiées');
select is((select presenter_notes from public.steps where id = '00000000-0000-0000-0000-0000000004e1'),
  'Note secrète : rappeler la consigne interne', 'un éditeur lit les notes dans l''app');

-- ===== Notifications =====
-- Eddie commente : Olga (créatrice) est notifiée ; Eddie ne se notifie pas lui-même
insert into public.step_comments (id, step_id, body)
  values ('00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-0000000004e1', 'Texte privé du commentaire');
select pg_temp.logout();
select is((select array_agg(user_id::text || ':' || kind order by user_id) from public.notifications),
  array['00000000-0000-0000-0000-0000000004a1:comment'], 'nouveau commentaire : la créatrice de la démo est notifiée, pas l''auteur');
select ok((select row_to_json(n)::text !~ 'Texte privé' from public.notifications n limit 1),
  'la notification ne porte que des références, jamais le texte du commentaire');
-- Vera répond : Eddie (fil) en « reply », Olga (créatrice) en « comment » ; Vera exclue
select pg_temp.login('00000000-0000-0000-0000-0000000004a3');
insert into public.step_comments (id, step_id, body)
  values ('00000000-0000-0000-0000-0000000004c2', '00000000-0000-0000-0000-0000000004e1', 'Réponse');
select pg_temp.logout();
select is((select array_agg(user_id::text || ':' || kind order by user_id) from public.notifications
           where comment_id = '00000000-0000-0000-0000-0000000004c2'),
  array['00000000-0000-0000-0000-0000000004a1:comment', '00000000-0000-0000-0000-0000000004a2:reply'],
  'réponse : l''auteur du fil est notifié (reply), la créatrice une seule fois (comment), pas l''auteur');
-- Olga résout le commentaire d'Eddie : Eddie notifié « resolved »
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
select public.set_comment_resolved('00000000-0000-0000-0000-0000000004c1', true);
select pg_temp.logout();
select is((select count(*)::int from public.notifications
           where user_id = '00000000-0000-0000-0000-0000000004a2' and kind = 'resolved'), 1,
  'résolution : l''auteur du commentaire est notifié');
-- Mentions : Eddie mentionne Vera (membre) et Xavier (hors workspace) ; Olga a coupé « comment »
update public.profiles set notification_prefs = '{"comment": false}' where id = '00000000-0000-0000-0000-0000000004a1';
select pg_temp.login('00000000-0000-0000-0000-0000000004a2');
insert into public.step_comments (id, step_id, body) values ('00000000-0000-0000-0000-0000000004c3', '00000000-0000-0000-0000-0000000004e1',
  'Tu peux relire @[Vera Exemple](00000000-0000-0000-0000-0000000004a3) et @[Xavier](00000000-0000-0000-0000-0000000004a4) ?');
select pg_temp.logout();
select is((select kind from public.notifications where comment_id = '00000000-0000-0000-0000-0000000004c3'
           and user_id = '00000000-0000-0000-0000-0000000004a3'), 'mention',
  'mention : la personne mentionnée est notifiée en « mention » (prioritaire sur la réponse)');
select is((select count(*)::int from public.notifications where comment_id = '00000000-0000-0000-0000-0000000004c3'
           and user_id = '00000000-0000-0000-0000-0000000004a4'), 0, 'mention d''une personne hors du workspace ignorée');
select is((select count(*)::int from public.notifications where comment_id = '00000000-0000-0000-0000-0000000004c3'
           and user_id = '00000000-0000-0000-0000-0000000004a1'), 0, 'préférence : un type désactivé n''est plus notifié');
select throws_ok($$ update public.profiles set notification_prefs = '{"email": true}' where id = '00000000-0000-0000-0000-0000000004a1' $$,
  '23514', null, 'préférences : seuls les types connus, en booléen');
update public.profiles set notification_prefs = '{}' where id = '00000000-0000-0000-0000-0000000004a1';

-- Un non-membre n'est jamais notifié, même s'il a créé la démo
update public.demos set created_by = '00000000-0000-0000-0000-0000000004a4' where id = '00000000-0000-0000-0000-0000000004d1';
select pg_temp.login('00000000-0000-0000-0000-0000000004a2');
insert into public.step_comments (step_id, body) values ('00000000-0000-0000-0000-0000000004e1', 'Encore un');
select pg_temp.logout();
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000004a4'), 0,
  'un non-membre n''est jamais notifié');

-- RLS : chacun ne lit que les siennes
select pg_temp.login('00000000-0000-0000-0000-0000000004a3');
select is((select count(*)::int from public.notifications where user_id <> auth.uid()), 0, 'un membre ne lit que ses notifications');
select throws_ok($$ insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, comment_id)
  values ((select ws from ctx), auth.uid(), 'comment', '00000000-0000-0000-0000-0000000004d1',
          '00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-0000000004c1') $$,
  '42501', null, 'aucune création de notification côté client');
select pg_temp.login('00000000-0000-0000-0000-0000000004a1');
select is(public.mark_notifications_read(null), (select count(*)::int from public.notifications where read_at is null),
  'mark_notifications_read marque ses propres notifications');
select pg_temp.logout();
select ok((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000004a2' and read_at is null) > 0,
  'les notifications des autres ne sont pas touchées');
-- Perte d'accès : les notifications restantes deviennent invisibles
delete from public.members where workspace_id = (select ws from ctx) and user_id = '00000000-0000-0000-0000-0000000004a2';
select pg_temp.login('00000000-0000-0000-0000-0000000004a2');
select is((select count(*)::int from public.notifications), 0, 'ancien membre : ses notifications ne sont plus lisibles');
select pg_temp.logout();
-- Suppression du commentaire : notifications supprimées en cascade
delete from public.step_comments where id = '00000000-0000-0000-0000-0000000004c1';
select is((select count(*)::int from public.notifications where comment_id = '00000000-0000-0000-0000-0000000004c1'), 0,
  'commentaire supprimé : notifications supprimées');

-- ===== Présence (Realtime Authorization) =====
select pg_temp.login('00000000-0000-0000-0000-0000000004a3');
select set_config('realtime.topic', 'demo:00000000-0000-0000-0000-0000000004d1', true);
select lives_ok($$ insert into realtime.messages (topic, extension, payload)
  values ('demo:00000000-0000-0000-0000-0000000004d1', 'presence', '{"name":"Vera"}') $$, 'présence : un membre rejoint le canal de la démo');
select pg_temp.login('00000000-0000-0000-0000-0000000004a4');
select throws_ok($$ insert into realtime.messages (topic, extension, payload)
  values ('demo:00000000-0000-0000-0000-0000000004d1', 'presence', '{}') $$, '42501', null, 'présence : un non-membre est refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000004a3');
select set_config('realtime.topic', 'demo:----------------------------------- or 1=1', true);
select ok(public.presence_topic_allowed('demo:------------------------------------') is false
      and public.presence_topic_allowed('demo:x'' or 1=1') is false
      and public.presence_topic_allowed(null) is false,
  'sujet mal formé : refusé sans erreur SQL');
select pg_temp.logout();

select * from finish();
rollback;
