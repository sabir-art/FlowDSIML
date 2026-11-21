-- Tests pgTAP : purge planifiée de storage_orphans (lots bornés, buckets de l'app, lignes traitées).
begin;
set search_path = public, extensions;
select plan(5);

delete from public.storage_orphans;
insert into public.storage_orphans (bucket, path) values
  ('avatars', '00000000-0000-0000-0000-0000000330a1/photo.webp'),
  ('captures', '00000000-0000-0000-0000-0000000330b1/a.webp'),
  ('captures', '00000000-0000-0000-0000-0000000330b1/b.webp'),
  ('autre', 'x/y.webp');
select is((select count(*)::int from public.storage_orphans_claim(10)), 3, 'buckets de l''app seulement');
select is((select count(*)::int from public.storage_orphans_claim(2)), 2, 'lot borné');
select is((select bucket from public.storage_orphans_claim(1)), 'avatars', 'les plus anciens d''abord');
select is(public.storage_orphans_done(array(select id from public.storage_orphans_claim(2))), 2, 'lignes traitées supprimées');
select is((select count(*)::int from public.storage_orphans), 2, 'le reste attend le lot suivant');

select * from finish();
rollback;
