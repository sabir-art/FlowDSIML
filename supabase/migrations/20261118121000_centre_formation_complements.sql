-- FlowDSIML — L14 compléments (maquette 3f8cd20). Idempotent, additif.
-- La migration 20261118120000 est en production et figée : les ajouts passent par ce fichier.
--  * center_draft_valid : nouvelles clés a11yUrl et privacyUrl (https uniquement, 300 caractères au plus).
--    La contrainte check de training_centers appelle cette fonction : elle n'a pas à être recréée.
--    La nouvelle version n'ajoute que des clés acceptées, donc toute ligne existante reste valide
--    (vérifié ci-dessous avant de continuer).
--  * center_payload : par module, expiredAt (date d'expiration L11, déjà publique sur l'écran L11-12)
--    et best (meilleur score, seulement pour l'apprenant identifié et un module à quiz) ; au niveau
--    du centre, a11yUrl et privacyUrl.

create or replace function public.center_draft_valid(d jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(d) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(d) k
      where k not in ('title', 'intro', 'brand', 'accent', 'style', 'logoPath', 'help', 'indexable', 'a11y', 'a11yUrl',
                    'privacyUrl', 'paths'))
    and (d -> 'title' is null or (jsonb_typeof(d -> 'title') = 'string' and char_length(d ->> 'title') <= 120))
    and (d -> 'intro' is null or (jsonb_typeof(d -> 'intro') = 'string' and char_length(d ->> 'intro') <= 600))
    and (d -> 'brand' is null or (d ->> 'brand') ~ '^#[0-9a-fA-F]{6}$')
    and (d -> 'accent' is null or (d ->> 'accent') ~ '^#[0-9a-fA-F]{6}$')
    and (d -> 'style' is null or (d ->> 'style') in ('workspace', 'sober', 'dark', 'contrast'))
    and (d -> 'logoPath' is null or jsonb_typeof(d -> 'logoPath') = 'null'
         or (d ->> 'logoPath') ~ '^[0-9a-f-]{36}/center-logo-[0-9a-z]{4,24}\.(png|svg|webp)$')
    and (d -> 'help' is null or (jsonb_typeof(d -> 'help') = 'string' and char_length(d ->> 'help') <= 200
         and ((d ->> 'help') = '' or (d ->> 'help') ~ '^https://\S+$' or (d ->> 'help') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')))
    and (d -> 'a11yUrl' is null or (jsonb_typeof(d -> 'a11yUrl') = 'string' and char_length(d ->> 'a11yUrl') <= 300
         and ((d ->> 'a11yUrl') = '' or (d ->> 'a11yUrl') ~ '^https://\S+$')))
    and (d -> 'privacyUrl' is null or (jsonb_typeof(d -> 'privacyUrl') = 'string' and char_length(d ->> 'privacyUrl') <= 300
         and ((d ->> 'privacyUrl') = '' or (d ->> 'privacyUrl') ~ '^https://\S+$')))
    and (d -> 'indexable' is null or jsonb_typeof(d -> 'indexable') = 'boolean')
    and (d -> 'a11y' is null or (d ->> 'a11y') in ('non_evalue', 'partiel', 'total'))
    and (d -> 'paths' is null or (
      jsonb_typeof(d -> 'paths') = 'array' and jsonb_array_length(d -> 'paths') <= 50
      and not exists (
        select 1 from jsonb_array_elements(d -> 'paths') p
        where jsonb_typeof(p) <> 'object'
           or (p ->> 'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or jsonb_typeof(p -> 'visible') <> 'boolean')));
$$;

do $$
begin
  if exists (select 1 from public.training_centers
             where not public.center_draft_valid(draft) or (published is not null and not public.center_draft_valid(published))) then
    raise exception 'training_centers : une ligne ne respecte pas center_draft_valid';
  end if;
end $$;

create or replace function public.center_payload(p_ws uuid, p_link_token text, p_visitor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.training_centers;
  v_link public.share_links;
  l public.learners;
  v_first text;
  v_learner uuid;
begin
  select * into c from public.training_centers where workspace_id = p_ws;
  -- Visiteur identifié : lien personnel actif, non expiré, sur une démo publiée du workspace
  if p_link_token is not null and char_length(p_link_token) between 8 and 128 then
    select sl.* into v_link from public.share_links sl join public.demos d on d.id = sl.demo_id
     where sl.token = p_link_token and sl.workspace_id = p_ws and sl.is_active
       and (sl.expires_at is null or sl.expires_at > now())
       and d.status = 'published' and d.deleted_at is null;
    if found then
      select * into l from public.learners where share_link_id = v_link.id;
      if found then
        v_learner := l.id;
        v_first := coalesce(nullif(btrim(v_link.variables ->> 'first_name'), ''), split_part(btrim(l.full_name), ' ', 1));
        -- Les modules ouverts depuis le centre comptent pour cet apprenant (le lien prime sur un formulaire)
        if p_visitor is not null and char_length(p_visitor) between 8 and 64 then
          perform public.learner_attach_visitor(p_ws, p_visitor, l.id, true);
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'center', jsonb_build_object(
      'title', coalesce(c.published ->> 'title', ''),
      'intro', coalesce(c.published ->> 'intro', ''),
      'brand', c.published ->> 'brand', 'accent', c.published ->> 'accent',
      'style', coalesce(c.published ->> 'style', 'workspace'),
      'logoPath', c.published ->> 'logoPath',
      'help', coalesce(c.published ->> 'help', ''),
      'a11y', coalesce(c.published ->> 'a11y', 'non_evalue'),
      'a11yUrl', coalesce(c.published ->> 'a11yUrl', ''),
      'privacyUrl', coalesce(c.published ->> 'privacyUrl', ''),
      'indexable', coalesce((c.published ->> 'indexable')::boolean, false),
      'workspace', (select name from public.workspaces where id = p_ws)),
    'visitor', case when v_learner is not null then jsonb_build_object('firstName', left(coalesce(v_first, ''), 60)) end,
    'paths', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'description', p.description, 'ordered', p.ordered,
        'isNew', coalesce((c.path_first_published ->> p.id::text)::timestamptz > now() - interval '30 days', false),
        'tags', (select coalesce(jsonb_agg(distinct jsonb_build_object('name', t.name, 'color', t.color)), '[]'::jsonb)
                 from public.path_modules m join public.demos d on d.id = m.demo_id
                 join public.demo_tags dt on dt.demo_id = d.id join public.tags t on t.id = dt.tag_id
                 where m.path_id = p.id and d.status = 'published' and d.deleted_at is null),
        'modules', (select coalesce(jsonb_agg(jsonb_build_object(
            'demoId', d.id, 'title', d.title, 'required', m.required,
            'steps', coalesce(jsonb_array_length(v.manifest -> 'steps'), 0),
            'hasQuiz', jsonb_typeof(v.manifest -> 'quiz') = 'object' and v.manifest -> 'quiz' ->> 'mode' is distinct from 'survey',
            'access', case when a.expires_at is not null and a.expires_at <= now() then 'expired'
                           when a.mode = 'password' then 'password'
                           when a.mode in ('invite', 'domain') then 'password'
                           else 'open' end,
            -- Couverture : capture de l'étape 1, seulement pour un module ouvert (signée par open-center)
            'cover', case when (a.demo_id is null or (a.mode = 'link' and (a.expires_at is null or a.expires_at > now())))
                               and (v.manifest -> 'steps' -> 0 -> 'image' ->> 'url') ~ '^assets/[\w.-]+$'
                          then v.manifest -> 'steps' -> 0 -> 'image' ->> 'url' end,
            -- Date d'expiration L11 (« plus disponible depuis le … ») et meilleur score de l'apprenant
            'expiredAt', case when a.expires_at is not null and a.expires_at <= now() then a.expires_at end,
            'best', case when lm.has_quiz then lm.best_score end,
            'status', lm.status, 'seen', lm.steps_seen, 'total', lm.total_steps
          ) order by m.position), '[]'::jsonb)
          from public.path_modules m
          join public.demos d on d.id = m.demo_id and d.status = 'published' and d.deleted_at is null
          left join public.demo_versions v on v.id = d.current_version_id
          left join public.demo_access a on a.demo_id = d.id
          left join public.learner_modules(p_ws) lm on v_learner is not null and lm.learner_id = v_learner and lm.demo_id = d.id
          where m.path_id = p.id)
      ) order by vp.ord), '[]'::jsonb)
      from public.center_visible_paths(p_ws, c.published) vp
      join public.paths p on p.id = vp.path_id)
  );
end $$;
revoke all on function public.center_payload(uuid, text, text) from public, anon, authenticated;
