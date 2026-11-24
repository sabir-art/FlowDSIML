-- Tests pgTAP : notification « Nouveau lead » (20261201170000_notification_lead.sql).
-- Données fictives, aucun envoi.
begin;
set search_path = public, extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000330a1', 'olga-ld@acme.example'),
  ('00000000-0000-0000-0000-0000000330a2', 'camille-ld@acme.example'),
  ('00000000-0000-0000-0000-0000000330a3', 'vera-ld@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000330a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000330a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000330a3', 'viewer');
-- Démo d1 créée par Camille (editor), d2 par Vera (viewer), d3 sans auteur
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000330d1', (select ws from ctx), 'Créer un rendez-vous', '00000000-0000-0000-0000-0000000330a2'),
  ('00000000-0000-0000-0000-0000000330d2', (select ws from ctx), 'Suivre un dossier', '00000000-0000-0000-0000-0000000330a3'),
  ('00000000-0000-0000-0000-0000000330d3', (select ws from ctx), 'Sans auteur', null);
create function pg_temp.lead(p_demo uuid, p_email text) returns void language sql as $$
  insert into public.leads (workspace_id, demo_id, email, fields)
  values ((select ws from ctx), p_demo, p_email, '{"nom": "Visiteur Fictif"}');
$$;
create function pg_temp.notifs(p_user uuid) returns bigint language sql as $$
  select count(*) from public.notifications where kind = 'lead' and user_id = p_user;
$$;

-- ===== La personne qui a créé la démo est prévenue, sans donnée du visiteur =====
select pg_temp.lead('00000000-0000-0000-0000-0000000330d1', 'visiteur-1@exemple.example');
select is(pg_temp.notifs('00000000-0000-0000-0000-0000000330a2'), 1::bigint, 'créatrice de la démo prévenue');
select is(pg_temp.notifs('00000000-0000-0000-0000-0000000330a1'), 0::bigint, 'les autres membres ne sont pas prévenus');
select is((select n.demo_id from public.notifications n where n.kind = 'lead'),
  '00000000-0000-0000-0000-0000000330d1'::uuid, 'la notification porte la démo');
select ok((select n.step_id is null and n.comment_id is null and n.alert_id is null and n.actor_id is null
             from public.notifications n where n.kind = 'lead'), 'ni étape, ni commentaire, ni alerte, ni auteur');
select ok((select to_jsonb(n)::text !~ 'visiteur|exemple|Fictif' and n.data = '{}'::jsonb
             from public.notifications n where n.kind = 'lead'),
  'aucune donnée du visiteur dans la notification (ni adresse, ni réponses)');

-- ===== Une seule notification non lue par démo =====
select pg_temp.lead('00000000-0000-0000-0000-0000000330d1', 'visiteur-2@exemple.example');
select pg_temp.lead('00000000-0000-0000-0000-0000000330d1', 'visiteur-3@exemple.example');
select is(pg_temp.notifs('00000000-0000-0000-0000-0000000330a2'), 1::bigint,
  'plusieurs leads : une seule notification non lue pour la démo');
update public.notifications set read_at = now() where kind = 'lead';
select pg_temp.lead('00000000-0000-0000-0000-0000000330d1', 'visiteur-4@exemple.example');
select is(pg_temp.notifs('00000000-0000-0000-0000-0000000330a2'), 2::bigint,
  'après lecture, un nouveau lead prévient de nouveau');

-- ===== Qui n'est pas prévenu =====
select pg_temp.lead('00000000-0000-0000-0000-0000000330d2', 'visiteur-5@exemple.example');
select is(pg_temp.notifs('00000000-0000-0000-0000-0000000330a3'), 0::bigint,
  'rôle viewer : ne lit pas les leads, n''est pas prévenu');
select lives_ok($$ select pg_temp.lead('00000000-0000-0000-0000-0000000330d3', 'visiteur-6@exemple.example') $$,
  'démo sans auteur : le lead est enregistré, sans notification');
select is((select count(*) from public.leads where demo_id = '00000000-0000-0000-0000-0000000330d3'), 1::bigint,
  'démo sans auteur : lead présent');

delete from public.notifications where kind = 'lead';
insert into public.notification_settings (user_id, prefs) values ('00000000-0000-0000-0000-0000000330a2', '{"lead": false}');
select pg_temp.lead('00000000-0000-0000-0000-0000000330d1', 'visiteur-7@exemple.example');
select is(pg_temp.notifs('00000000-0000-0000-0000-0000000330a2'), 0::bigint, 'événement coupé dans l''app : rien');
update public.notification_settings set prefs = '{}' where user_id = '00000000-0000-0000-0000-0000000330a2';
insert into public.notification_mutes (user_id, demo_id, workspace_id)
  values ('00000000-0000-0000-0000-0000000330a2', '00000000-0000-0000-0000-0000000330d1', (select ws from ctx));
select pg_temp.lead('00000000-0000-0000-0000-0000000330d1', 'visiteur-8@exemple.example');
select is(pg_temp.notifs('00000000-0000-0000-0000-0000000330a2'), 0::bigint, 'démo coupée : rien');
delete from public.notification_mutes;
delete from public.members where user_id = '00000000-0000-0000-0000-0000000330a2';
select pg_temp.lead('00000000-0000-0000-0000-0000000330d1', 'visiteur-9@exemple.example');
select is(pg_temp.notifs('00000000-0000-0000-0000-0000000330a2'), 0::bigint, 'créatrice sortie de l''espace : rien');
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000330a2', 'editor');

-- ===== Réglages et résumé par e-mail =====
select lives_ok($$ update public.notification_settings set prefs = '{"lead": true}', email_prefs = '{"lead": false}'
                    where user_id = '00000000-0000-0000-0000-0000000330a2' $$,
  'la clé « lead » est acceptée dans les deux réglages');
select pg_temp.lead('00000000-0000-0000-0000-0000000330d1', 'visiteur-10@exemple.example');
update public.notification_settings set email = true where user_id = '00000000-0000-0000-0000-0000000330a2';
select is((select count(*) from private.digest_due('00000000-0000-0000-0000-0000000330a2')), 0::bigint,
  'e-mail coupé pour l''événement : pas dans le résumé');
update public.notification_settings set email_prefs = '{"lead": true}' where user_id = '00000000-0000-0000-0000-0000000330a2';
select is((select count(*) from private.digest_due('00000000-0000-0000-0000-0000000330a2') where kind = 'lead'), 1::bigint,
  'e-mail demandé : le nouveau lead entre dans le résumé');

-- ===== RLS : la notification n'est lue que par sa destinataire =====
select pg_temp.login('00000000-0000-0000-0000-0000000330a1');
select is((select count(*) from public.notifications where kind = 'lead'), 0::bigint,
  'une autre personne de l''espace ne lit pas la notification');

select * from finish();
rollback;
