-- Tests pgTAP : EXT-02 §6.3, projecteur libre (réglage de la démo) dans le manifeste publié.
begin;
set search_path = public, extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000099a1', 'projecteur@example.com'),
  ('00000000-0000-0000-0000-0000000099a2', 'projecteur-lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
-- Publie, puis rend le manifeste enregistré (celui que l'app relit et met en ligne)
create function pg_temp.pub() returns jsonb language plpgsql as $$
declare
  v_id uuid;
  v_m jsonb;
begin
  v_id := (public.publish_demo('00000000-0000-0000-0000-0000000099d1', '{"reviewed": true, "fictional": true}') ->> 'versionId')::uuid;
  select v.manifest into v_m from public.demo_versions v where v.id = v_id;
  return jsonb_build_object('manifest', v_m);
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000099a1');
create temp table ctx as select (public.create_workspace('Projecteur')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 'Avec projecteur', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, kind, title, body) values
  ('00000000-0000-0000-0000-0000000099b1', '00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 0, 'text', 'Bienvenue', 'Texte');
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000099a2', 'viewer');

-- Sans réglage, ou désactivé : pas de clé dans le manifeste
select pg_temp.login('00000000-0000-0000-0000-0000000099a1');
select ok(not ((pg_temp.pub() -> 'manifest') ? 'spotlight'), 'sans réglage : pas de projecteur dans le manifeste');
update public.demos set settings = settings || '{"spotlight":{"enabled":false,"size":300,"dim":70}}'
 where id = '00000000-0000-0000-0000-0000000099d1';
select ok(not ((pg_temp.pub() -> 'manifest') ? 'spotlight'), 'désactivé : pas de projecteur dans le manifeste');

-- Activé : valeurs de la démo
update public.demos set settings = settings || '{"spotlight":{"enabled":true,"size":300,"dim":70,"fixedOnReducedMotion":false}}'
 where id = '00000000-0000-0000-0000-0000000099d1';
select is(pg_temp.pub() -> 'manifest' -> 'spotlight', '{"size":300,"dim":70,"fixedOnReducedMotion":false}'::jsonb,
  'activé : taille, assombrissement et préférence dans le manifeste');

-- Défauts et bornes
update public.demos set settings = settings || '{"spotlight":{"enabled":true}}'
 where id = '00000000-0000-0000-0000-0000000099d1';
select is(pg_temp.pub() -> 'manifest' -> 'spotlight', '{"size":220,"dim":55,"fixedOnReducedMotion":true}'::jsonb,
  'activé sans valeurs : 220 px, 55 %, halo fixe si moins d''animations');
update public.demos set settings = settings || '{"spotlight":{"enabled":true,"size":9000,"dim":1}}'
 where id = '00000000-0000-0000-0000-0000000099d1';
select is(pg_temp.pub() -> 'manifest' -> 'spotlight', '{"size":400,"dim":20,"fixedOnReducedMotion":true}'::jsonb,
  'hors bornes : ramené entre 120 et 400 px, 20 et 80 %');
update public.demos set settings = settings || '{"spotlight":{"enabled":true,"size":"grand","dim":null,"fixedOnReducedMotion":"oui"}}'
 where id = '00000000-0000-0000-0000-0000000099d1';
select is(pg_temp.pub() -> 'manifest' -> 'spotlight', '{"size":220,"dim":55,"fixedOnReducedMotion":true}'::jsonb,
  'valeurs inattendues : défauts, sans erreur');
update public.demos set settings = settings || '{"spotlight":"oui"}'
 where id = '00000000-0000-0000-0000-0000000099d1';
select ok(not ((pg_temp.pub() -> 'manifest') ? 'spotlight'), 'réglage mal formé : ignoré');

-- Lecteur de l'espace : ne peut pas changer le réglage (RLS)
select pg_temp.login('00000000-0000-0000-0000-0000000099a2');
update public.demos set settings = '{"spotlight":{"enabled":true}}' where id = '00000000-0000-0000-0000-0000000099d1';
reset role;
select is((select settings -> 'spotlight' from public.demos where id = '00000000-0000-0000-0000-0000000099d1'), '"oui"'::jsonb,
  'lecteur : le réglage de la démo n''est pas modifiable');

select * from finish();
rollback;
