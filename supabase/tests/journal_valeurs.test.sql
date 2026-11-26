-- Tests pgTAP : L41 étape 6, journal de la Console avec l'ancienne et la nouvelle valeur.
-- Conditions : colonnes bornées à 200 caractères ; console_audit_list les rend ; état d'une clé (jamais la
-- clé) ; nom lisible du fournisseur ; anciennes lignes sans valeur ; journal toujours en insertion seule.
begin;
set search_path = public, extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000041e1', 'proprio-ia6@example.com');
insert into public.platform_admins (user_id, role) values ('00000000-0000-0000-0000-0000000041e1', 'admin');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select has_column('public', 'console_audit', 'old_value', 'colonne old_value');
select throws_ok($$ insert into public.console_audit (action, old_value) values ('ai.test', repeat('x', 201)) $$,
  '23514', null, 'valeur de plus de 200 caractères refusée');

-- Test d'une clé : état avant et après, jamais la clé
select public.ai_key_tested('openai', false, 'UNAUTHORIZED', 120, '00000000-0000-0000-0000-0000000041e1');
select is((select object_label || ' | ' || old_value || ' | ' || new_value from public.console_audit
            where action = 'ai.key_tested' order by id desc limit 1),
  'OpenAI | Jamais testée | Échec : UNAUTHORIZED', 'premier test : jamais testée → échec nommé');
select public.ai_key_tested('openai', true, null, 90, '00000000-0000-0000-0000-0000000041e1');
select is((select old_value || ' → ' || new_value from public.console_audit
            where action = 'ai.key_tested' order by id desc limit 1),
  'Échec : UNAUTHORIZED → Test réussi', 'test suivant : échec → réussi');
select ok(not exists (select 1 from public.console_audit where coalesce(old_value, '') ~ 'sk-'
                      or coalesce(new_value, '') ~ 'sk-'), 'aucune clé dans le journal');

-- Règle d'Auto sans libellés : identifiants
select public.ai_auto_rule_set('short', 'claude-opus-5-5', '00000000-0000-0000-0000-0000000041e1');
select is((select object_label || ' | ' || old_value || ' | ' || new_value from public.console_audit
            where action = 'ai.auto_rule' order by id desc limit 1),
  'short | claude-sonnet-5-5 | claude-opus-5-5', 'règle d''Auto : ancien et nouveau modèle');

-- Lecture par la Console
insert into public.console_audit (actor_id, action, object_type, object_label)
values ('00000000-0000-0000-0000-0000000041e1', 'ai.old_line', 'ai', 'ancienne ligne');
select pg_temp.login('00000000-0000-0000-0000-0000000041e1');
select is((select e ->> 'old' || ' → ' || (e ->> 'new') from jsonb_array_elements(public.console_audit_list(50)) e
            where e ->> 'action' = 'ai.key_tested' order by (e ->> 'id')::bigint desc limit 1),
  'Échec : UNAUTHORIZED → Test réussi', 'console_audit_list : old et new');
select ok((select (e -> 'old') = 'null'::jsonb and (e -> 'new') = 'null'::jsonb
             from jsonb_array_elements(public.console_audit_list(50)) e where e ->> 'action' = 'ai.old_line'),
  'ancienne ligne : sans valeur');
reset role;
select throws_ok($$ update public.console_audit set old_value = 'x' where action = 'ai.auto_rule' $$,
  null, null, 'journal en insertion seule');

select * from finish();
rollback;
