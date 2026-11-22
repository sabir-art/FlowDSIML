-- Les Edge Functions qui écrivent ou lisent une démo avec le rôle de service (html-ingest, html-recheck)
-- appliquent le filtre de dossier restreint du membre : elles appellent demo_visible_to.
grant execute on function public.demo_visible_to(uuid, uuid) to service_role;
