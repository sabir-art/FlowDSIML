-- Les dossiers restreints valent aussi à l'écriture : politiques INSERT et UPDATE (with check) des démos,
-- des dossiers et des tables liées à une démo.

-- ===== 3. Dossiers restreints : contrôle à l'écriture =====
do $$
declare
  p record;
begin
  for p in select policyname, with_check from pg_policies
            where schemaname = 'public' and tablename = 'demos' and cmd in ('INSERT', 'UPDATE', 'ALL')
              and with_check is not null and with_check not like '%my_hidden%' loop
    execute format('alter policy %I on public.demos with check ((%s) and (folder_id is null or not (folder_id = any ((select public.my_hidden_folders())::uuid[]))))',
                   p.policyname, p.with_check);
  end loop;
  for p in select policyname, with_check from pg_policies
            where schemaname = 'public' and tablename = 'folders' and cmd in ('INSERT', 'UPDATE', 'ALL')
              and with_check is not null and with_check not like '%my_hidden%' loop
    execute format('alter policy %I on public.folders with check ((%s) and not (id = any ((select public.my_hidden_folders())::uuid[])) and (parent_id is null or not (parent_id = any ((select public.my_hidden_folders())::uuid[]))))',
                   p.policyname, p.with_check);
  end loop;
  for p in select pl.tablename, pl.policyname, pl.with_check from pg_policies pl
            where pl.schemaname = 'public' and pl.cmd in ('INSERT', 'UPDATE', 'ALL')
              and pl.with_check is not null and pl.with_check not like '%my_hidden%'
              and pl.tablename <> 'demos'
              and exists (select 1 from information_schema.columns c
                           where c.table_schema = 'public' and c.table_name = pl.tablename and c.column_name = 'demo_id') loop
    execute format('alter policy %I on public.%I with check ((%s) and (demo_id is null or not (demo_id = any ((select public.my_hidden_demos())::uuid[]))))',
                   p.policyname, p.tablename, p.with_check);
  end loop;
end $$;
