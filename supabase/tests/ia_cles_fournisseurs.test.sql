-- Tests pgTAP : L41 étape 2, clés des fournisseurs IA (docs/tech/ia-fournisseurs.md §4 et §9).
-- Conditions : la table d'état n'est lisible par aucun client ; les fonctions de clé sont réservées au rôle
-- de service ; une clé enregistrée va dans le coffre seulement, jamais dans l'état ni dans le journal ;
-- un compte Lecture seule ne peut rien écrire. Données fictives ; coffre simulé dans la transaction.
begin;
set search_path = public, extensions;
select plan(22);

-- Coffre simulé (la base de test n'a pas Vault) : mêmes noms que Supabase Vault
create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text);
create or replace view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create or replace function vault.create_secret(p_secret text, p_name text) returns uuid language sql as
  $$ insert into vault.secrets (name, secret) values (p_name, p_secret) returning id $$;
create or replace function vault.update_secret(p_id uuid, p_secret text) returns void language sql as
  $$ update vault.secrets set secret = p_secret where id = p_id $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000041a1', 'proprio-ia@example.com'),
  ('00000000-0000-0000-0000-0000000041a2', 'lecture-ia@example.com'),
  ('00000000-0000-0000-0000-0000000041a3', 'client-ia@example.com');
insert into public.platform_admins (user_id, role) values
  ('00000000-0000-0000-0000-0000000041a1', 'admin'),
  ('00000000-0000-0000-0000-0000000041a2', 'read_only');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

-- ===== Droits =====
select ok(not has_table_privilege('authenticated', 'public.ai_providers', 'select'), 'client : ai_providers illisible');
select ok(not has_table_privilege('anon', 'public.ai_providers', 'select'), 'anonyme : ai_providers illisible');
select ok(not has_function_privilege('authenticated', 'public.ai_key_read(text)', 'execute'), 'client : ai_key_read refusée');
select ok(not has_function_privilege('authenticated', 'public.ai_key_save(text, text, uuid, integer)', 'execute'), 'client : ai_key_save refusée');
select ok(not has_function_privilege('authenticated', 'public.ai_key_tested(text, boolean, text, integer, uuid)', 'execute'), 'client : ai_key_tested refusée');
select ok(not has_function_privilege('anon', 'public.ai_key_read(text)', 'execute'), 'anonyme : ai_key_read refusée');
select ok(has_function_privilege('service_role', 'public.ai_key_save(text, text, uuid, integer)', 'execute'), 'rôle de service : ai_key_save permise');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_providers'::regclass), 'RLS active sur ai_providers');

-- Même un propriétaire de la plateforme ne lit pas la table ni la clé depuis le navigateur
select pg_temp.login('00000000-0000-0000-0000-0000000041a1');
select throws_ok($$ select count(*) from public.ai_providers $$, '42501', null, 'propriétaire (navigateur) : ai_providers refusée');
select throws_ok($$ select public.ai_key_read('anthropic') $$, '42501', null, 'propriétaire (navigateur) : ai_key_read refusée');
reset role;

-- ===== Enregistrement par l'Edge Function (rôle de service) =====
select is((public.ai_key_save('anthropic', 'sk-fictive-cle-0001', '00000000-0000-0000-0000-0000000041a1', 320))->>'replaced',
  'false', 'première clé : ajoutée');
select is(public.ai_key_read('anthropic'), 'sk-fictive-cle-0001', 'clé lue dans le coffre par la fonction de service');
select is((select last_test_ok from public.ai_providers where provider = 'anthropic'), true, 'état : dernier test réussi');
select is((public.ai_key_save('anthropic', 'sk-fictive-cle-0002', '00000000-0000-0000-0000-0000000041a1', 280))->>'replaced',
  'true', 'seconde clé : remplacée');
select is((select count(*)::int from vault.secrets where name = 'ai_key_anthropic'), 1, 'un seul secret par fournisseur');
select is(public.ai_key_read('anthropic'), 'sk-fictive-cle-0002', 'la nouvelle clé prend la place');
select is((select array_agg(action order by id)::text from public.console_audit where object_type = 'ai'),
  '{ai.key_added,ai.key_replaced}', 'journal : ai.key_added puis ai.key_replaced');
select ok(not exists (
  select 1 from public.console_audit where object_label ~ 'sk-fictive' or object_id ~ 'sk-fictive'
) and not exists (select 1 from public.ai_providers p where row_to_json(p)::text ~ 'sk-fictive'),
  'la clé n''apparaît ni dans l''état ni dans le journal');

-- Lecture seule : aucune écriture, même par l'Edge Function en son nom
select throws_ok($$ select public.ai_key_save('openai', 'sk-fictive-cle-0003', '00000000-0000-0000-0000-0000000041a2', 100) $$,
  '42501', null, 'Lecture seule : enregistrement refusé');
select throws_ok($$ select public.ai_key_tested('anthropic', true, null, 100, '00000000-0000-0000-0000-0000000041a3') $$,
  '42501', null, 'client : test refusé');

-- Test en échec : cause nommée, journalisée
select public.ai_key_tested('elevenlabs', false, 'KEY_REFUSED', 210, '00000000-0000-0000-0000-0000000041a1');
select is((select last_test_error from public.ai_providers where provider = 'elevenlabs'), 'KEY_REFUSED',
  'échec du test : cause nommée gardée');
select throws_ok($$ select public.ai_key_tested('elevenlabs', false, 'refus : sk-fictive', 10, '00000000-0000-0000-0000-0000000041a1') $$,
  'P0001', 'BAD_CAUSE', 'une cause libre (texte du fournisseur) est refusée');

select * from finish();
rollback;
