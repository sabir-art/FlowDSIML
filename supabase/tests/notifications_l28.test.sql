-- Tests pgTAP : L28 122 (notifications de commentaires). Mention toujours envoyée, démo coupée, dossier
-- restreint (aucune fuite), commentaire supprimé gardé, démos coupées privées.
begin;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000122a1', 'olga-notif@example.com'),
  ('00000000-0000-0000-0000-0000000122a2', 'eddie-notif@example.com'),
  ('00000000-0000-0000-0000-0000000122a3', 'vera-notif@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.n(uid uuid, k text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = uid and kind = k;
$$;

-- Olga (propriétaire, créatrice de la démo), Eddie éditeur, Vera lectrice
select pg_temp.login('00000000-0000-0000-0000-0000000122a1');
create temp table ctx as select (public.create_workspace('Notifications')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000122d1', (select ws from ctx), 'Saisir un congé', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, title) values
  ('00000000-0000-0000-0000-0000000122e1', '00000000-0000-0000-0000-0000000122d1', (select ws from ctx), 0, 'Étape 1');
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000122a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000122a3', 'viewer');
create temp table c as select null::uuid as id;
grant all on c to authenticated;

-- Mention toujours envoyée, même désactivée dans les préférences
insert into public.notification_settings (user_id, prefs)
  values ('00000000-0000-0000-0000-0000000122a3', '{"mention": false, "comment": false}');
select pg_temp.login('00000000-0000-0000-0000-0000000122a2');
insert into public.step_comments (workspace_id, demo_id, step_id, body) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000122d1', '00000000-0000-0000-0000-0000000122e1',
   'Voir avec @[Vera](00000000-0000-0000-0000-0000000122a3)');
reset role;
select is(pg_temp.n('00000000-0000-0000-0000-0000000122a3', 'mention'), 1, 'mention envoyée malgré la préférence');
select is(pg_temp.n('00000000-0000-0000-0000-0000000122a1', 'comment'), 1, 'créatrice : « Commentaire »');
select is(pg_temp.n('00000000-0000-0000-0000-0000000122a2', 'mention') + pg_temp.n('00000000-0000-0000-0000-0000000122a2', 'comment'),
  0, 'jamais pour ses propres actions');

-- Démo coupée par Olga : plus de « Commentaire », mais les mentions arrivent
select pg_temp.login('00000000-0000-0000-0000-0000000122a1');
insert into public.notification_mutes (demo_id, workspace_id)
  values ('00000000-0000-0000-0000-0000000122d1', (select ws from ctx));
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000122a3');
select is((select count(*)::int from public.notification_mutes), 0, 'démos coupées : privées (Vera ne voit pas celles d’Olga)');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000122a2');
insert into public.step_comments (workspace_id, demo_id, step_id, body) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000122d1', '00000000-0000-0000-0000-0000000122e1', 'Deuxième remarque');
insert into public.step_comments (workspace_id, demo_id, step_id, body) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000122d1', '00000000-0000-0000-0000-0000000122e1',
   'Merci @[Olga](00000000-0000-0000-0000-0000000122a1)');
reset role;
select is(pg_temp.n('00000000-0000-0000-0000-0000000122a1', 'comment'), 1, 'démo coupée : pas de nouveau « Commentaire »');
select is(pg_temp.n('00000000-0000-0000-0000-0000000122a1', 'mention'), 1, 'démo coupée : la mention arrive quand même');

-- Dossier restreint : Vera (non autorisée) n'est jamais notifiée
insert into public.folders (id, workspace_id, name, restricted)
  values ('00000000-0000-0000-0000-0000000122f1', (select ws from ctx), 'RH', true);
update public.demos set folder_id = '00000000-0000-0000-0000-0000000122f1' where id = '00000000-0000-0000-0000-0000000122d1';
select pg_temp.login('00000000-0000-0000-0000-0000000122a2');
insert into public.step_comments (workspace_id, demo_id, step_id, body) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000122d1', '00000000-0000-0000-0000-0000000122e1',
   'Encore @[Vera](00000000-0000-0000-0000-0000000122a3)');
reset role;
select is(pg_temp.n('00000000-0000-0000-0000-0000000122a3', 'mention'), 1,
  'dossier restreint : aucune notification pour un membre qui ne voit pas la démo');
insert into public.folder_members (folder_id, user_id, workspace_id)
  values ('00000000-0000-0000-0000-0000000122f1', '00000000-0000-0000-0000-0000000122a3', (select ws from ctx));
select pg_temp.login('00000000-0000-0000-0000-0000000122a2');
insert into public.step_comments (workspace_id, demo_id, step_id, body) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000122d1', '00000000-0000-0000-0000-0000000122e1',
   'Et @[Vera](00000000-0000-0000-0000-0000000122a3)');
reset role;
select is(pg_temp.n('00000000-0000-0000-0000-0000000122a3', 'mention'), 2, 'membre choisi du dossier : notifiée');

-- Réouverture : personne n'est notifié ; résolution : l'auteur l'est
insert into public.folder_members (folder_id, user_id, workspace_id)
  values ('00000000-0000-0000-0000-0000000122f1', '00000000-0000-0000-0000-0000000122a2', (select ws from ctx));
update c set id = (select id from public.step_comments where body = 'Deuxième remarque');
select pg_temp.login('00000000-0000-0000-0000-0000000122a1');
select public.set_comment_resolved((select id from c), true);
select public.set_comment_resolved((select id from c), false);
reset role;
select is(pg_temp.n('00000000-0000-0000-0000-0000000122a2', 'resolved'), 1, 'résolu : l’auteur est notifié une fois');
select is((select count(*)::int from public.notifications where comment_id = (select id from c)), 1,
  'réouverture : aucune notification');

-- Commentaire supprimé : la notification reste, sans référence au texte
delete from public.step_comments where id = (select id from c);
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000122a2' and kind = 'resolved' and comment_id is null), 1,
  'commentaire supprimé : notification gardée, sans commentaire');
select throws_ok($$ insert into public.notifications (workspace_id, user_id, kind, demo_id)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000122a2', 'mention', '00000000-0000-0000-0000-0000000122d1') $$,
  '23514', null, 'notification de commentaire : démo et étape obligatoires');

select * from finish();
rollback;
