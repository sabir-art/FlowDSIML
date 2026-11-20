-- Tests pgTAP : L28 171/172 (mes données). Export limité à l'utilisateur, suppression du compte : session
-- récente, e-mail, mot de passe s'il existe, blocage du seul propriétaire, espace solo supprimé,
-- commentaires gardés (« Ancien membre »), chemins orphelins limités aux espaces supprimés.
begin;
set search_path = public, extensions;
select plan(20);

insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-0000000171a1', 'camille@acme.example', extensions.crypt('Correct-Horse-9', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-0000000171a2', 'alice@acme.example', null),
  ('00000000-0000-0000-0000-0000000171a3', 'jules@acme.example', '');
-- age : secondes depuis la connexion (amr) ; le jeton (iat) est toujours frais, comme après un rafraîchissement.
-- age null : jeton sans amr (repli sur auth.users.last_sign_in_at)
create function pg_temp.login(uid uuid, age int default 10) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', case when age is null
    then json_build_object('sub', uid, 'iat', extract(epoch from now())::bigint)
    else json_build_object('sub', uid, 'iat', extract(epoch from now())::bigint,
      'amr', json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint - age)))
    end::text, true);
  execute 'set local role authenticated';
end $$;

-- Alice : propriétaire d'« Acme » (Camille éditrice) ; Camille : seule membre de « Brouillons »
select pg_temp.login('00000000-0000-0000-0000-0000000171a2');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000171d1', (select ws from ctx), 'Saisir un congé', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, title)
  values ('00000000-0000-0000-0000-0000000171e1', '00000000-0000-0000-0000-0000000171d1', (select ws from ctx), 0, 'Étape 1');
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000171a1', 'editor');
select pg_temp.login('00000000-0000-0000-0000-0000000171a1');
create temp table solo as select (public.create_workspace('Brouillons')).id as ws;
grant all on solo to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000171d2', (select ws from solo), 'Essai', auth.uid());
insert into public.step_comments (workspace_id, demo_id, step_id, body) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000171d1', '00000000-0000-0000-0000-0000000171e1', 'Remarque de Camille');

-- ===== Export =====
create temp table ex as select public.export_my_data() as d;
select is((select d -> 'profile' ->> 'email' from ex), 'camille@acme.example', 'export : profil de l’utilisateur');
select is((select jsonb_array_length(d -> 'workspaces') from ex), 2, 'export : espaces et rôles');
select is((select d -> 'comments' -> 0 ->> 'body' from ex), 'Remarque de Camille', 'export : commentaires écrits');
select ok((select not (d::text like '%alice@acme.example%') from ex), 'export : aucune donnée d’un autre membre');
reset role;

-- ===== Suppression : contrôles =====
select pg_temp.login('00000000-0000-0000-0000-0000000171a1', 600);
select throws_ok($$ select public.delete_my_account('camille@acme.example', 'Correct-Horse-9') $$,
  'P0001', 'REAUTH_REQUIRED', 'jeton rafraîchi (iat récent) avec amr ancien : nouvelle connexion exigée');
select is((select public.account_deletion_check() ->> 'recentAuth'), 'false', 'vérification : connexion ancienne signalée');
reset role;
update auth.users set last_sign_in_at = now() - interval '1 hour' where id = '00000000-0000-0000-0000-0000000171a1';
select pg_temp.login('00000000-0000-0000-0000-0000000171a1', null);
select throws_ok($$ select public.delete_my_account('camille@acme.example', 'Correct-Horse-9') $$,
  'P0001', 'REAUTH_REQUIRED', 'sans amr : dernière connexion ancienne (last_sign_in_at) refusée');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000171a1');
select throws_ok($$ select public.delete_my_account('autre@acme.example', 'Correct-Horse-9') $$,
  'P0001', 'EMAIL_MISMATCH', 'adresse e-mail différente : refusé');
select throws_ok($$ select public.delete_my_account('camille@acme.example', 'mauvais') $$,
  'P0001', 'PASSWORD_MISMATCH', 'mot de passe faux : refusé');
select throws_ok($$ select public.delete_my_account('camille@acme.example') $$,
  'P0001', 'PASSWORD_MISMATCH', 'mot de passe absent alors que le compte en a un : refusé');
select is((select public.account_deletion_check() -> 'solo' -> 0 ->> 'name'), 'Brouillons',
  'vérification : espace solo annoncé');
reset role;

-- Alice : seule propriétaire d'un espace avec d'autres membres : bloquée
select pg_temp.login('00000000-0000-0000-0000-0000000171a2');
select is((select public.account_deletion_check() -> 'blocking' -> 0 ->> 'name'), 'Acme', 'vérification : espace bloquant');
select throws_ok($$ select public.delete_my_account('alice@acme.example') $$,
  'P0001', 'ACCOUNT_SOLE_OWNER:Acme', 'seul propriétaire : transférer d’abord');
reset role;

-- ===== Suppression de Camille (orphelin hors de ses espaces ignoré) =====
select pg_temp.login('00000000-0000-0000-0000-0000000171a1');
select lives_ok($$ select public.delete_my_account(' Camille@Acme.example ', 'Correct-Horse-9', jsonb_build_array(
    jsonb_build_object('bucket', 'captures', 'path', (select ws from solo)::text || '/x/y.webp'),
    jsonb_build_object('bucket', 'published', 'path', '00000000-0000-0000-0000-0000000171d2/latest.json'),
    jsonb_build_object('bucket', 'captures', 'path', (select ws from ctx)::text || '/autre.webp'))) $$,
  'compte supprimé (e-mail sans tenir compte de la casse)');
reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000171a1'), 0, 'compte supprimé');
select is((select count(*)::int from public.workspaces where id = (select ws from solo)), 0, 'espace solo supprimé avec le compte');
select ok((select count(*) = 1 and bool_and(author_id is null) from public.step_comments
            where body = 'Remarque de Camille'), 'commentaire gardé, auteur effacé (« Ancien membre »)');
select is((select count(*)::int from public.storage_orphans), 2,
  'orphelins inscrits : seulement ceux des espaces supprimés');

-- Compte sans mot de passe (lien magique) : l'adresse suffit, avec une connexion récente (repli last_sign_in_at)
update auth.users set last_sign_in_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-0000000171a3';
select pg_temp.login('00000000-0000-0000-0000-0000000171a3', null);
select is((select public.account_deletion_check() ->> 'recentAuth'), 'true', 'vérification : connexion récente');
select lives_ok($$ select public.delete_my_account('jules@acme.example') $$, 'compte sans mot de passe : supprimé');
reset role;

select * from finish();
rollback;
