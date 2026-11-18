-- FlowDSIML — L15 attestations de suivi (F5). Idempotent, additif.
--  * learner_certificates : une attestation par apprenant et par formation (numéro, première délivrance).
--    Cascade sur l'apprenant, la formation et le workspace : l'effacement RGPD et la purge L13 la suppriment.
--    Lecture editor+ ; aucune écriture directe (seule issue_certificate insère).
--  * issue_certificate(p_link_token, p_path) : appelée par le centre (anon) avec le lien personnel.
--    Vérifie le lien (actif, non expiré, démo publiée), les liens publics du workspace, le centre publié,
--    la formation visible, et que TOUS les modules obligatoires publiés et non expirés sont validés.
--    Sinon '{}' (même réponse pour un lien inconnu, désactivé ou une formation non terminée).
--    validatedAt est calculé à la lecture (quiz : première tentative réussie ; démo : premier demo_complete
--    ou première vue de la dernière étape) ; null si une date manque, jamais inventée.
--    Nom : full_name de l'apprenant, sinon first_name + last_name des variables du lien. Jamais l'e-mail.

create table if not exists public.learner_certificates (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  path_id uuid not null references public.paths (id) on delete cascade,
  issued_at timestamptz not null default now(),
  unique (learner_id, path_id)
);
create index if not exists learner_certificates_ws_idx on public.learner_certificates (workspace_id);

alter table public.learner_certificates enable row level security;
drop policy if exists learner_certificates_select on public.learner_certificates;
create policy learner_certificates_select on public.learner_certificates
  for select to authenticated using (public.has_role(workspace_id, 'editor'));
revoke all on public.learner_certificates from anon;
revoke insert, update, delete on public.learner_certificates from authenticated;
grant select on public.learner_certificates to authenticated;

create or replace function public.issue_certificate(p_link_token text, p_path uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_link public.share_links;
  l public.learners;
  c public.training_centers;
  v_name text;
  v_required int;
  v_missing int;
  v_validated timestamptz;
  v_has_null boolean;
  v_cert public.learner_certificates;
  v_mods jsonb;
begin
  if p_link_token is null or char_length(p_link_token) not between 8 and 128 or p_path is null then
    return '{}'::jsonb;
  end if;
  select sl.* into v_link from public.share_links sl
    join public.demos d on d.id = sl.demo_id
    join public.workspaces w on w.id = sl.workspace_id
   where sl.token = p_link_token and sl.is_active
     and (sl.expires_at is null or sl.expires_at > now())
     and d.status = 'published' and d.deleted_at is null
     and w.public_links_enabled;
  if not found then return '{}'::jsonb; end if;
  select * into l from public.learners where share_link_id = v_link.id and workspace_id = v_link.workspace_id;
  if not found then return '{}'::jsonb; end if;
  select * into c from public.training_centers where workspace_id = v_link.workspace_id and published is not null;
  if not found then return '{}'::jsonb; end if;
  if not exists (select 1 from public.center_visible_paths(v_link.workspace_id, c.published) vp where vp.path_id = p_path) then
    return '{}'::jsonb;
  end if;

  -- Modules obligatoires comptés : publiés, non supprimés, non expirés (L11)
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', x.title, 'pos', x.pos, 'status', x.status, 'hasQuiz', x.has_quiz, 'best', x.best, 'doneAt', x.done_at)
           order by x.pos), '[]'::jsonb)
    into v_mods
    from (
  select d.title, m.position as pos, lm.status, coalesce(lm.has_quiz, false) as has_quiz, lm.best_score as best,
         case when coalesce(lm.has_quiz, false) then
           (select min(q.created_at) from public.quiz_attempts q
              join public.learner_visitors lv on lv.workspace_id = q.workspace_id and lv.visitor_id = q.visitor_id
             where lv.learner_id = l.id and q.demo_id = d.id and q.passed)
         else
           (select min(e.occurred_at) from public.events e
              join public.learner_visitors lv on lv.workspace_id = e.workspace_id and lv.visitor_id = e.visitor_id
             where lv.learner_id = l.id and e.workspace_id = v_link.workspace_id and e.demo_id = d.id
               and (e.type = 'demo_complete'
                    or (e.type = 'step_view' and lm.total_steps > 0 and e.step_index = lm.total_steps - 1)))
         end as done_at
    from public.path_modules m
    join public.demos d on d.id = m.demo_id and d.status = 'published' and d.deleted_at is null
    left join public.demo_access a on a.demo_id = d.id
    left join public.learner_modules(v_link.workspace_id) lm on lm.learner_id = l.id and lm.demo_id = d.id
  where m.path_id = p_path and m.required
     and not (a.expires_at is not null and a.expires_at <= now())) x;

  select count(*), count(*) filter (where (e ->> 'status') is distinct from 'validated'),
         max((e ->> 'doneAt')::timestamptz), bool_or(e ->> 'doneAt' is null)
    into v_required, v_missing, v_validated, v_has_null
    from jsonb_array_elements(v_mods) e;
  if v_required = 0 or v_missing > 0 then return '{}'::jsonb; end if;

  v_name := left(btrim(coalesce(
    nullif(btrim(l.full_name), ''),
    nullif(btrim(concat_ws(' ', nullif(btrim(v_link.variables ->> 'first_name'), ''),
                                nullif(btrim(v_link.variables ->> 'last_name'), ''))), ''),
    '')), 120);
  -- Sans nom connu, pas d'attestation (le centre affiche une aide pour contacter le service)
  if v_name = '' then return jsonb_build_object('error', 'name_missing'); end if;

  insert into public.learner_certificates (workspace_id, learner_id, path_id)
  values (v_link.workspace_id, l.id, p_path)
  on conflict (learner_id, path_id) do nothing;
  select * into v_cert from public.learner_certificates where learner_id = l.id and path_id = p_path;

  return jsonb_build_object(
    'certificateId', lpad(v_cert.id::text, 6, '0'),
    'issuedAt', v_cert.issued_at,
    'learner', v_name,
    'path', (select title from public.paths where id = p_path),
    'workspace', (select name from public.workspaces where id = v_link.workspace_id),
    'validatedAt', case when v_has_null then null else v_validated end,
    'modules', (select coalesce(jsonb_agg(jsonb_build_object(
        'title', e ->> 'title', 'best', case when (e ->> 'hasQuiz')::boolean then e -> 'best' else 'null'::jsonb end)
        order by o), '[]'::jsonb)
      from jsonb_array_elements(v_mods) with ordinality as t(e, o)));
end $$;
revoke all on function public.issue_certificate(text, uuid) from public;
grant execute on function public.issue_certificate(text, uuid) to anon, authenticated;
