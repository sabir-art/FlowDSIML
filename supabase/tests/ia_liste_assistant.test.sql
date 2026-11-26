-- Tests pgTAP : L41 étape 4, modèles proposés dans l'assistant et règles d'« Auto ».
-- Conditions : tables fermées aux clients ; valeurs de départ = comportement actuel ; au moins un modèle
-- proposé ; écritures réservées à un admin de la plateforme (rôle de service) ; journal lisible.
begin;
set search_path = public, extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000041c1', 'proprio-ia4@example.com'),
  ('00000000-0000-0000-0000-0000000041c2', 'lecture-ia4@example.com');
insert into public.platform_admins (user_id, role) values
  ('00000000-0000-0000-0000-0000000041c1', 'admin'),
  ('00000000-0000-0000-0000-0000000041c2', 'read_only');

select ok(not has_table_privilege('authenticated', 'public.ai_assistant_models', 'select'), 'client : ai_assistant_models illisible');
select ok(not has_table_privilege('authenticated', 'public.ai_auto_rules', 'select'), 'client : ai_auto_rules illisible');
select ok(not has_function_privilege('authenticated', 'public.ai_assistant_set(jsonb, uuid, text, text, text)', 'execute'), 'client : ai_assistant_set refusée');
select ok(has_function_privilege('service_role', 'public.ai_auto_rule_set(text, text, uuid, text, text, text)', 'execute'), 'rôle de service : ai_auto_rule_set permise');

-- Valeurs de départ : le comportement actuel
select is((select array_agg(model || ':' || proposed || ':' || tag order by position)::text from public.ai_assistant_models),
  '{claude-sonnet-5-5:true:recommended,claude-opus-5-5:true:recommended,claude-haiku-5-5:false:none}',
  'départ : Sonnet et Opus proposés et recommandés, Haiku non proposé');
select is((select array_agg(rule || '=' || model order by rule)::text from public.ai_auto_rules),
  '{fallback=next,short=claude-sonnet-5-5,whole_demo=claude-sonnet-5-5}', 'départ : Auto sur Sonnet, repli « le suivant »');

-- Liste remplacée
select public.ai_assistant_set('[
  {"model":"claude-opus-5-5","position":1,"proposed":true,"tag":"recommended"},
  {"model":"claude-sonnet-5-5","position":2,"proposed":true,"tag":"none"},
  {"model":"claude-haiku-5-5","position":3,"proposed":true,"tag":"beta"}
]'::jsonb, '00000000-0000-0000-0000-0000000041c1', 'Liste de l''assistant · Ordre : Claude Opus, Claude Sonnet, Claude Haiku');
select is((select array_agg(model order by position)::text from public.ai_assistant_models where proposed),
  '{claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5}', 'ordre et cases enregistrés');
select is((select tag from public.ai_assistant_models where model = 'claude-haiku-5-5'), 'beta', 'étiquette enregistrée');
select is((select object_label || ' | ' || old_value || ' | ' || new_value from public.console_audit
            where action = 'ai.assistant_list' order by id desc limit 1),
  'Liste de l''assistant · Ordre : Claude Opus, Claude Sonnet, Claude Haiku | claude-sonnet-5-5, claude-opus-5-5 | claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5',
  'journal lisible, liste avant et après (identifiants sans libellés de l''Edge Function)');
select throws_ok($$ select public.ai_assistant_set('[{"model":"claude-opus-5-5","position":1,"proposed":false,"tag":"none"}]'::jsonb,
  '00000000-0000-0000-0000-0000000041c1') $$, 'P0001', 'LAST_MODEL', 'décocher le dernier modèle : refusé');
select throws_ok($$ select public.ai_assistant_set('[{"model":"claude-opus-5-5","position":1,"proposed":true,"tag":"none"}]'::jsonb,
  '00000000-0000-0000-0000-0000000041c2') $$, '42501', null, 'Lecture seule : refusé');

-- Règles d'Auto
select is((public.ai_auto_rule_set('whole_demo', 'claude-opus-5-5', '00000000-0000-0000-0000-0000000041c1',
  'Auto · analyse de toute la démo', 'Claude Sonnet', 'Claude Opus'))->>'old', 'claude-sonnet-5-5', 'règle changée, ancienne valeur rendue');
select throws_ok($$ select public.ai_auto_rule_set('autre', 'claude-opus-5-5', '00000000-0000-0000-0000-0000000041c1') $$,
  'P0001', 'BAD_RULE', 'règle inconnue refusée');

select * from finish();
rollback;
