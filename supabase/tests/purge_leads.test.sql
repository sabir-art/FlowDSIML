-- Tests pgTAP : RGPD (171), purge des leads au-delà de la durée de conservation du plan.
begin;
set search_path = public, extensions;
select plan(8);

insert into public.workspaces (id, name, slug, plan_code) values
  ('00000000-0000-0000-0000-0000000550a1', 'Acme Free', 'acme-free-leads', 'free'),
  ('00000000-0000-0000-0000-0000000550a2', 'Acme Pro', 'acme-pro-leads', 'pro');
-- Free (30 jours) : un lead de 31 jours, un de 29 jours. Pro (365 jours) : un lead de 31 jours.
insert into public.leads (id, workspace_id, email, created_at) values
  ('00000000-0000-0000-0000-0000000550b1', '00000000-0000-0000-0000-0000000550a1', 'ancien@acme.example', now() - interval '31 days'),
  ('00000000-0000-0000-0000-0000000550b2', '00000000-0000-0000-0000-0000000550a1', 'recent@acme.example', now() - interval '29 days'),
  ('00000000-0000-0000-0000-0000000550b3', '00000000-0000-0000-0000-0000000550a2', 'pro@acme.example', now() - interval '31 days');

select is(private.purge_leads(), 1, 'un seul lead supprimé');
select ok(not exists (select 1 from public.leads where id = '00000000-0000-0000-0000-0000000550b1'),
  'au-delà de la durée du plan : supprimé');
select ok(exists (select 1 from public.leads where id = '00000000-0000-0000-0000-0000000550b2'),
  'en deçà de la durée : conservé');
select ok(exists (select 1 from public.leads where id = '00000000-0000-0000-0000-0000000550b3'),
  'isolation par espace : la durée du plan Pro s’applique à son espace');
select is((select meta from public.audit_log where workspace_id = '00000000-0000-0000-0000-0000000550a1'
            and action = 'leads.purge'), '{"count": 1}'::jsonb, 'trace leads.purge avec le nombre, sans e-mail');
select is((select count(*)::int from public.audit_log where workspace_id = '00000000-0000-0000-0000-0000000550a2'
            and action = 'leads.purge'), 0, 'aucune trace pour un espace sans suppression');
select is(private.purge_leads(), 0, 'idempotent : rien à supprimer au second passage');
select ok(not has_function_privilege('authenticated', 'private.purge_leads()', 'execute')
          and not has_function_privilege('anon', 'private.purge_leads()', 'execute'),
  'fonction non exécutable par les rôles clients');

select * from finish();
rollback;
