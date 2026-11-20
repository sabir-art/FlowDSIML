-- Tests pgTAP : L27 123 (règles de partage : plan Enterprise, modes, durée, publication, exports,
-- liens non conformes et mise en conformité, démo bloquée).
begin;
set search_path = public, extensions;
select plan(35);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000070a1', 'admin-regles@example.com'),
  ('00000000-0000-0000-0000-0000000070a2', 'editrice-regles@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000070a1');
create temp table ctx as select (public.create_workspace('Règles')).id as ws;
grant all on ctx to authenticated, service_role;
reset role;
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000070a2', 'editor');
-- Trois démos publiées : sans mot de passe, avec mot de passe (en lien public), et un lien personnalisé
insert into public.demos (id, workspace_id, title, status) values
  ('00000000-0000-0000-0000-0000000070d1', (select ws from ctx), 'Sans mot de passe', 'published'),
  ('00000000-0000-0000-0000-0000000070d2', (select ws from ctx), 'Avec mot de passe', 'published'),
  ('00000000-0000-0000-0000-0000000070d3', (select ws from ctx), 'Brouillon', 'draft');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest) values
  ('00000000-0000-0000-0000-0000000070e1', '00000000-0000-0000-0000-0000000070d1', (select ws from ctx), 1, '{}'),
  ('00000000-0000-0000-0000-0000000070e2', '00000000-0000-0000-0000-0000000070d2', (select ws from ctx), 1, '{}');
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000070e1' where id = '00000000-0000-0000-0000-0000000070d1';
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000070e2' where id = '00000000-0000-0000-0000-0000000070d2';
insert into public.steps (demo_id, workspace_id, position, image_path)
  values ('00000000-0000-0000-0000-0000000070d3', (select ws from ctx), 0, 'x/capture.webp');
insert into public.share_links (id, demo_id, workspace_id, name)
  values ('00000000-0000-0000-0000-0000000070f1', '00000000-0000-0000-0000-0000000070d2', (select ws from ctx), 'Lien Camille');

select pg_temp.login('00000000-0000-0000-0000-0000000070a1');
select public.set_demo_password('00000000-0000-0000-0000-0000000070d2', 'motdepasse-fictif');
select public.set_demo_access('00000000-0000-0000-0000-0000000070d2', 'link', false, null);

-- Valeurs par défaut, plan
select is((select count(*)::int from public.share_rules), 0, 'aucune règle enregistrée');
select throws_ok($$ select public.share_rules_of((select ws from ctx)) $$, '42501', null, 'share_rules_of : interne');
reset role;
select is((select publish_role from public.share_rules_of((select ws from ctx))), 'editor', 'défaut : éditeurs publient');
select pg_temp.login('00000000-0000-0000-0000-0000000070a1');
-- L48-A : plus aucune fonction réservée à une offre
select lives_ok($$ select public.set_share_rules((select ws from ctx), array['password'], null, 'editor', true) $$,
  'règles de partage permises pour toutes les offres (L48-A)');
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);

-- Droits et contrôles
select pg_temp.login('00000000-0000-0000-0000-0000000070a2');
select throws_ok($$ select public.set_share_rules((select ws from ctx), array['password'], null, 'editor', true) $$,
  '42501', null, 'éditeur : pas de modification des règles');
select is((select count(*)::int from public.share_rules where workspace_id = (select ws from ctx)), 1, 'éditeur : lecture des règles');
select throws_ok($$ select public.share_rules_preview((select ws from ctx), array['password'], null) $$,
  '42501', null, 'éditeur : pas d’aperçu des liens');
select pg_temp.login('00000000-0000-0000-0000-0000000070a1');
select throws_ok($$ select public.set_share_rules((select ws from ctx), array[]::text[], null, 'editor', true) $$,
  'P0001', 'RULE_MODES_EMPTY', 'au moins un mode');
select throws_ok($$ select public.set_share_rules((select ws from ctx), array['sso'], null, 'editor', true) $$,
  'P0001', 'NOT_AVAILABLE', 'mode inconnu refusé (L39 : invitation et domaine autorisables)');

-- L27-07 : liens non conformes (lien public interdit, durée de 30 jours)
select is((public.share_rules_preview((select ws from ctx), array['password'], null) ->> 'count')::int, 2,
  'lien public interdit : 2 démos publiées en lien public');
select is((public.share_rules_preview((select ws from ctx), array['password'], null) ->> 'locked')::int, 1,
  '1 démo sera bloquée (aucun mot de passe)');
select is((public.share_rules_preview((select ws from ctx), array['link', 'password'], 30) ->> 'count')::int, 3,
  'durée de 30 jours : 2 démos sans expiration et 1 lien personnalisé');
select ok(not (public.share_rules_preview((select ws from ctx), array['password'], null) -> 'items')::text ~ 'Brouillon',
  'brouillon non compté');

-- « Garder les liens existants » : rien ne change
select is((public.set_share_rules((select ws from ctx), array['password'], null, 'editor', true, false) ->> 'fixed')::int, 0,
  'garder : aucun lien modifié');
select is((select coalesce(mode, 'link') from public.demo_access where demo_id = '00000000-0000-0000-0000-0000000070d2'), 'link',
  'garder : le lien public existant reste');
select throws_ok($$ select public.set_demo_access('00000000-0000-0000-0000-0000000070d2', 'link', true, null) $$,
  'P0001', 'RULE_MODE', 'nouveau réglage en lien public refusé');
-- Revenir aux règles d'origine pour tester la mise en conformité
select public.set_share_rules((select ws from ctx), array['link', 'password'], null, 'editor', true);

-- « Les mettre en conformité maintenant »
select is(public.set_share_rules((select ws from ctx), array['password'], 30, 'editor', true, true),
  '{"fixed": 2, "locked": 1}'::jsonb, 'conformité : 1 démo en mot de passe, 1 lien raccourci, 1 démo bloquée');
select is((select mode from public.demo_access where demo_id = '00000000-0000-0000-0000-0000000070d2'), 'password',
  'démo avec mot de passe : mot de passe obligatoire');
select ok((select locked_by_rules from public.demo_access where demo_id = '00000000-0000-0000-0000-0000000070d1'),
  'démo sans mot de passe : bloquée (« Accès à régler »)');
select ok((select expires_at <= now() + interval '30 days 1 minute' from public.share_links
  where id = '00000000-0000-0000-0000-0000000070f1'), 'lien personnalisé : expiration ramenée à 30 jours');
reset role;
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000070d1') ->> 'status', 'not_found', 'démo bloquée : inaccessible');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000070a2');
select public.set_demo_password('00000000-0000-0000-0000-0000000070d1', 'autre-fictif-123');
select ok(not (select locked_by_rules from public.demo_access where demo_id = '00000000-0000-0000-0000-0000000070d1'),
  'mot de passe défini : démo débloquée');

-- Durée maximale : nouveaux liens limités
select public.set_demo_access('00000000-0000-0000-0000-0000000070d1', 'password', false, null);
select ok((select expires_at between now() + interval '29 days' and now() + interval '31 days' from public.demo_access
  where demo_id = '00000000-0000-0000-0000-0000000070d1'), '« Jamais » ramené à la limite');
select throws_like($$ select public.set_demo_access('00000000-0000-0000-0000-0000000070d1', 'password', false, now() + interval '60 days') $$,
  'RULE_EXPIRY:30', 'au-delà de la limite : refusé');
select lives_ok($$ select public.set_demo_access('00000000-0000-0000-0000-0000000070d1', 'password', false, now() + interval '10 days') $$,
  'expiration dans la limite acceptée');
select is((select mode from public.demo_access where demo_id = '00000000-0000-0000-0000-0000000070d1'), 'password',
  'correctif : réglage d’une démo protégée (mode mot de passe) accepté');
insert into public.share_links (demo_id, workspace_id, name)
  values ('00000000-0000-0000-0000-0000000070d1', (select ws from ctx), 'Nouveau lien');
select ok((select expires_at between now() + interval '29 days' and now() + interval '31 days' from public.share_links where name = 'Nouveau lien'),
  'nouveau lien personnalisé : expiration posée à la limite');
select throws_like($$ update public.share_links set expires_at = now() + interval '90 days' where name = 'Nouveau lien' $$,
  'RULE_EXPIRY:30', 'lien prolongé au-delà de la limite : refusé');

-- Publication et diffusion réservées aux administrateurs, exports interdits
select pg_temp.login('00000000-0000-0000-0000-0000000070a1');
select public.set_share_rules((select ws from ctx), array['password'], 30, 'admin', false);
select pg_temp.login('00000000-0000-0000-0000-0000000070a2');
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000070d3', '{"reviewed": true, "fictional": true}') $$,
  '42501', null, 'éditeur : publication refusée');
select throws_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000070d2', 'intranet', 'Intranet Acme') $$,
  '42501', null, 'éditeur : diffusion refusée');
select throws_ok($$ insert into public.demo_pages (demo_id, workspace_id, enabled) values ('00000000-0000-0000-0000-0000000070d2', (select ws from ctx), true) $$,
  '42501', null, 'éditeur : page publique refusée');
select pg_temp.login('00000000-0000-0000-0000-0000000070a1');
select throws_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000070d2', 'scorm', 'LMS Acme') $$,
  'P0001', 'RULE_EXPORTS', 'exports interdits : paquet SCORM refusé');
select lives_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000070d2', 'intranet', 'Intranet Acme') $$,
  'admin : intégration intranet acceptée');
select lives_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000070d3', '{"reviewed": true, "fictional": true}') $$, 'admin : publication acceptée');
select is((select modes from public.share_rules where workspace_id = (select ws from ctx)), array['password'],
  'règles enregistrées');

select * from finish();
rollback;
