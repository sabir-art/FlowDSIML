-- Tests pgTAP : e-mails P2, résumé des notifications (opt-in, rythme d'une heure, lues exclues, budget,
-- désinscription sans connexion à usage unique).
begin;
set search_path = public, extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000310a1', 'olga-dg@acme.example'),
  ('00000000-0000-0000-0000-0000000310a2', 'camille-dg@acme.example'),
  ('00000000-0000-0000-0000-0000000310a3', 'vera-dg@acme.example');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000310a2', 'Camille Exemple')
  on conflict (id) do update set full_name = excluded.full_name;
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000310a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000310d1', (select ws from ctx), 'Créer un rendez-vous', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, title) values
  ('00000000-0000-0000-0000-0000000310e1', '00000000-0000-0000-0000-0000000310d1', (select ws from ctx), 2, 'Étape 3');
-- Option désactivée par défaut, activée par la personne elle-même
insert into public.notification_settings (user_id) values (auth.uid());
select is((select email from public.notification_settings where user_id = auth.uid()), false, 'option e-mail désactivée par défaut');
update public.notification_settings set email = true where user_id = auth.uid();
select is((select email from public.notification_settings where user_id = auth.uid()), true, 'la personne active son option');
select throws_ok($$ select public.digest_claim(10) $$, '42501', null, 'réservation : service_role seulement');
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000310a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000310a3', 'viewer');
insert into public.notification_settings (user_id, email) values ('00000000-0000-0000-0000-0000000310a3', false);

create function pg_temp.notif(uid uuid, min int, read boolean default false) returns void language sql as $$
  insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, actor_id, created_at, read_at)
  values ((select ws from ctx), uid, 'comment', '00000000-0000-0000-0000-0000000310d1',
          '00000000-0000-0000-0000-0000000310e1', '00000000-0000-0000-0000-0000000310a2',
          now() - make_interval(mins => min), case when read then now() end);
$$;
-- Recette 5 et 6 : trois non lues et une lue pour Olga ; Vera (option désactivée) a aussi une notification
select pg_temp.notif('00000000-0000-0000-0000-0000000310a1', 3);
select pg_temp.notif('00000000-0000-0000-0000-0000000310a1', 2);
select pg_temp.notif('00000000-0000-0000-0000-0000000310a1', 1);
select pg_temp.notif('00000000-0000-0000-0000-0000000310a1', 4, true);
select pg_temp.notif('00000000-0000-0000-0000-0000000310a3', 1);

create temp table c1 as select public.digest_claim(50) as r;
select is(jsonb_array_length((select r from c1)), 1, 'un seul résumé : Olga (option de Vera désactivée)');
select is((select r -> 0 ->> 'email' from c1), 'olga-dg@acme.example', 'adresse de la personne');
select is((select (r -> 0 ->> 'total')::int from c1), 3, 'trois lignes : la notification lue est exclue');
select is((select ((r -> 0 -> 'lines' -> 0) - 'at') - 'data' from c1),
  '{"kind": "comment", "actor": "Camille Exemple", "demo": "Créer un rendez-vous", "step": 3}'::jsonb,
  'ligne : auteur, démo et étape, sans texte de commentaire');
select is((select sent from private.email_budget where day = private.email_day()), 1, 'résumé compté dans le budget du jour');
select is((select count(*)::int from public.notifications where emailed_at is not null), 3, 'notifications marquées envoyées');

-- 20 min plus tard, une 4e notification : elle attend le résumé suivant (60 min au moins)
select pg_temp.notif('00000000-0000-0000-0000-0000000310a1', 0);
select is(jsonb_array_length(public.digest_claim(50)), 0, 'moins de 60 min : pas de second résumé');
update private.email_digest_state set last_at = now() - interval '61 minutes';
create temp table c2 as select public.digest_claim(50) as r;
select is((select (r -> 0 ->> 'total')::int from c2), 1, 'après 60 min : seule la nouvelle notification');

-- Échec de l'envoi : tout est rendu
select public.digest_undo((select (r -> 0 ->> 'user')::uuid from c2),
  array(select jsonb_array_elements_text(r -> 0 -> 'ids')::uuid from c2), (select (r -> 0 ->> 'previous')::timestamptz from c2));
select is((select sent from private.email_budget where day = private.email_day()), 1, 'échec : budget rendu');
select is((select count(*)::int from public.notifications where emailed_at is null and read_at is null
            and user_id = '00000000-0000-0000-0000-0000000310a1'), 1, 'échec : la notification repartira');

-- Recette 8 : budget du jour atteint, le résumé attend
update private.email_budget set sent = 150 where day = private.email_day();
select is(jsonb_array_length(public.digest_claim(50)), 0, 'budget atteint : aucun résumé');
select is((select count(*)::int from public.notifications where emailed_at is null and read_at is null
            and user_id = '00000000-0000-0000-0000-0000000310a1'), 1, 'budget atteint : rien n''est perdu');

-- Recette 7 : désinscription sans connexion, jeton à usage unique
select is(public.email_unsubscribe((select r -> 0 ->> 'token' from c1)), true, 'désinscription : jeton valable');
select is((select email from public.notification_settings where user_id = '00000000-0000-0000-0000-0000000310a1'), false,
  'option désactivée sans connexion');
update public.notification_settings set email = true where user_id = '00000000-0000-0000-0000-0000000310a1';
select public.email_unsubscribe((select r -> 0 ->> 'token' from c1));
select is((select email from public.notification_settings where user_id = '00000000-0000-0000-0000-0000000310a1'), true,
  'jeton déjà utilisé : plus aucun effet');
select is(public.email_unsubscribe(repeat('0', 48)), false, 'jeton inconnu : refusé');

select * from finish();
rollback;
