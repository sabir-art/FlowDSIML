-- L19 (A4, analytics avancées) partie 3 : alertes. Schéma validé par le chef d'équipe.
--  * alerts : 7 déclencheurs, seuil, démo, parcours (structure sous l'objectif), segment, canaux
--    (app, webhook ; e-mail et Slack « Bientôt »), fréquence (immédiate, quotidienne, hebdomadaire).
--  * alerts_tick (pg_cron, chaque minute) : évalue chaque alerte AVEC LES DROITS DE SA CRÉATRICE (une
--    alerte ne voit que ce qu'elle voit), regroupe (au plus 1 alerte immédiate toutes les 10 min par
--    alerte, « 5 nouveaux leads »), résumés à 9 h (heure de Paris), le lundi pour l'hebdomadaire.
--  * notifications : type 'alert' (step_id et comment_id facultatifs, contrainte selon le type).
--  * webhooks : événement « alert.triggered » (aucune donnée personnelle dans la charge).

-- ===== 1. Table =====
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trigger text not null check (trigger in ('lead', 'cta', 'link_opened', 'completion_below', 'views_above',
                                           'quiz_failed_last', 'structure_below_goal')),
  threshold int check (threshold between 1 and 1000000),
  demo_id uuid references public.demos (id) on delete cascade,
  path_id uuid references public.paths (id) on delete cascade,
  segment_id uuid references public.segments (id) on delete set null,
  channels text[] not null default array['app'] check (cardinality(channels) between 1 and 2 and channels <@ array['app', 'webhook']),
  frequency text not null default 'immediate' check (frequency in ('immediate', 'daily', 'weekly')),
  active boolean not null default true,
  -- état interne de l'évaluation
  pending int not null default 0 check (pending >= 0),
  last_state boolean not null default false,
  checked_at timestamptz not null default now(),
  digest_at timestamptz,
  last_fired_at timestamptz,
  created_by uuid references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerts_threshold_ok check (coalesce(
    case trigger when 'completion_below' then threshold between 1 and 100
                 when 'views_above' then threshold is not null
                 else threshold is null end, false)),
  constraint alerts_path_ok check ((trigger = 'structure_below_goal') = (path_id is not null))
);
create index if not exists alerts_active_idx on public.alerts (workspace_id) where active;

-- Démo, parcours et segment du même workspace ; état interne remis à zéro à chaque modification
create or replace function public.alerts_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.demo_id is not null and not exists (select 1 from public.demos where id = new.demo_id and workspace_id = new.workspace_id)
     or new.path_id is not null and not exists (select 1 from public.paths where id = new.path_id and workspace_id = new.workspace_id)
     or new.segment_id is not null and not exists (select 1 from public.segments where id = new.segment_id and workspace_id = new.workspace_id) then
    raise exception 'ALERT_SCOPE' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.alerts where workspace_id = new.workspace_id) >= 50 then
    raise exception 'ALERT_LIMIT' using errcode = '23514';
  end if;
  -- destinataire des notifications : toujours la personne qui crée l'alerte
  if tg_op = 'INSERT' and auth.uid() is not null then new.created_by := auth.uid(); end if;
  if tg_op = 'UPDATE' then
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
  end if;
  if tg_op = 'INSERT' or (new.trigger, new.threshold, new.demo_id, new.path_id, new.segment_id, new.frequency, new.active)
                         is distinct from (old.trigger, old.threshold, old.demo_id, old.path_id, old.segment_id, old.frequency, old.active) then
    new.pending := 0;
    new.last_state := false;
    new.checked_at := now();
    if tg_op = 'INSERT' then new.digest_at := null; new.last_fired_at := null; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.alerts_check() from public, anon, authenticated;
drop trigger if exists alerts_check on public.alerts;
create trigger alerts_check before insert or update on public.alerts for each row execute function public.alerts_check();

alter table public.alerts enable row level security;
drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts for select to authenticated using (public.has_role(workspace_id, 'viewer'));
drop policy if exists alerts_write on public.alerts;
create policy alerts_write on public.alerts for all to authenticated
  using (public.has_role(workspace_id, 'editor')) with check (public.has_role(workspace_id, 'editor'));
revoke all on public.alerts from anon, authenticated;
grant select, insert, delete on public.alerts to authenticated;
grant update (trigger, threshold, demo_id, path_id, segment_id, channels, frequency, active) on public.alerts to authenticated;

-- ===== 2. Notifications et webhooks =====
alter table public.notifications alter column demo_id drop not null;
alter table public.notifications alter column step_id drop not null;
alter table public.notifications alter column comment_id drop not null;
alter table public.notifications add column if not exists alert_id uuid references public.alerts (id) on delete cascade;
alter table public.notifications add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mention', 'comment', 'reply', 'resolved', 'alert'));
alter table public.notifications drop constraint if exists notifications_kind_refs;
alter table public.notifications add constraint notifications_kind_refs check (case when kind = 'alert'
  then alert_id is not null and comment_id is null
  else demo_id is not null and step_id is not null and comment_id is not null and alert_id is null end);

create or replace function public.notification_prefs_valid(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_each(p) e
                    where e.key not in ('mention', 'reply', 'comment', 'resolved', 'alert') or jsonb_typeof(e.value) <> 'boolean');
$$;

create or replace function public.webhook_event_types()
returns text[] language sql immutable set search_path = '' as $$
  select array['lead.created', 'demo.completed', 'demo.published', 'learner.quiz_passed', 'learner.quiz_failed',
               'learner.module_validated', 'alert.triggered'];
$$;
alter table public.webhooks drop constraint if exists webhooks_events_ok;
alter table public.webhooks add constraint webhooks_events_ok
  check (cardinality(events) between 1 and 7 and events <@ public.webhook_event_types());

-- ===== 3. Évaluation =====
/** Valeur d'une alerte à seuil (vues, complétion, structure) : { state, value } ; jamais de donnée personnelle. */
create or replace function private.alert_state(a public.alerts, p_vis text[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_views int;
  v_vis int;
  v_done int;
  v_rate int;
  v_ov jsonb;
begin
  if a.trigger = 'views_above' then
    select count(*) into v_views from public.events e join public.demos d on d.id = e.demo_id and d.deleted_at is null
      where e.workspace_id = a.workspace_id and e.type = 'demo_view' and e.occurred_at > now() - interval '24 hours'
        and (a.demo_id is null or e.demo_id = a.demo_id) and (p_vis is null or e.visitor_id = any (p_vis));
    return jsonb_build_object('state', v_views > a.threshold, 'value', v_views);
  elsif a.trigger = 'completion_below' then
    select count(distinct e.visitor_id) filter (where e.type = 'demo_view'),
           count(distinct e.visitor_id) filter (where e.type = 'demo_complete')
      into v_vis, v_done
      from public.events e join public.demos d on d.id = e.demo_id and d.deleted_at is null
      where e.workspace_id = a.workspace_id and e.type in ('demo_view', 'demo_complete') and e.occurred_at > now() - interval '7 days'
        and (a.demo_id is null or e.demo_id = a.demo_id) and (p_vis is null or e.visitor_id = any (p_vis));
    -- au moins 20 visiteurs sur 7 jours, sinon aucune alerte (taux non significatif)
    if v_vis < 20 then return jsonb_build_object('state', false, 'value', null); end if;
    v_rate := round(100.0 * v_done / v_vis);
    return jsonb_build_object('state', v_rate < a.threshold, 'value', v_rate);
  elsif a.trigger = 'structure_below_goal' then
    v_ov := public.structure_overview(a.path_id);
    select min(round(100 * (s ->> 'trainedRate')::numeric)) into v_rate
      from jsonb_array_elements(v_ov -> 'structures') s where s ->> 'trainedRate' is not null;
    return jsonb_build_object('state', v_rate is not null and v_rate < (v_ov ->> 'goal')::int, 'value', v_rate,
                              'goal', (v_ov ->> 'goal')::int);
  end if;
  return jsonb_build_object('state', false);
end $$;

/** Nombre de nouveaux faits d'une alerte à événement (lead, CTA, lien ouvert, échec au quiz) sur ]p_since, p_to]. */
create or replace function private.alert_count(a public.alerts, p_vis text[], p_since timestamptz, p_to timestamptz)
returns int language sql stable security definer set search_path = '' as $$
  select case a.trigger
    when 'lead' then (select count(*) from public.leads l
      where l.workspace_id = a.workspace_id and l.created_at > p_since and l.created_at <= p_to
        and (a.demo_id is null or l.demo_id = a.demo_id) and (p_vis is null or l.visitor_id = any (p_vis)))
    when 'cta' then (select count(*) from public.events e
      where e.workspace_id = a.workspace_id and e.type = 'cta_click' and e.occurred_at > p_since and e.occurred_at <= p_to
        and (a.demo_id is null or e.demo_id = a.demo_id) and (p_vis is null or e.visitor_id = any (p_vis)))
    when 'link_opened' then (select count(distinct e.session_id) from public.events e
      where e.workspace_id = a.workspace_id and e.type = 'demo_view' and e.link_id is not null
        and e.occurred_at > p_since and e.occurred_at <= p_to
        and (a.demo_id is null or e.demo_id = a.demo_id) and (p_vis is null or e.visitor_id = any (p_vis)))
    -- apprenant identifié (F3) qui échoue à sa dernière tentative autorisée
    when 'quiz_failed_last' then (select count(*) from public.quiz_attempts q
      join public.demo_versions v on v.id = q.version_id
      where q.workspace_id = a.workspace_id and not q.passed and q.created_at > p_since and q.created_at <= p_to
        and (a.demo_id is null or q.demo_id = a.demo_id) and (p_vis is null or q.visitor_id = any (p_vis))
        and coalesce((v.manifest -> 'quiz' ->> 'attempts')::int, 0) > 0
        and exists (select 1 from public.learner_visitors lv where lv.workspace_id = q.workspace_id and lv.visitor_id = q.visitor_id)
        and (select count(*) from public.quiz_attempts q2 where q2.demo_id = q.demo_id and q2.visitor_id = q.visitor_id
               and q2.created_at <= q.created_at)
            >= (v.manifest -> 'quiz' ->> 'attempts')::int
               + coalesce((select o.extra_attempts from public.learner_overrides o
                             join public.learner_visitors lv on lv.learner_id = o.learner_id
                            where lv.workspace_id = q.workspace_id and lv.visitor_id = q.visitor_id and o.demo_id = q.demo_id), 0))
    else 0 end::int;
$$;

create or replace function private.alert_fire(a public.alerts, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if 'app' = any (a.channels) and public.notification_wanted(a.created_by, 'alert') then
    insert into public.notifications (workspace_id, user_id, kind, demo_id, alert_id, data)
    values (a.workspace_id, a.created_by, 'alert', a.demo_id, a.id, p_data);
  end if;
  if 'webhook' = any (a.channels) then
    perform public.enqueue_webhook_event(a.workspace_id, 'alert.triggered',
      p_data || jsonb_build_object('alert_id', a.id, 'demo_id', a.demo_id, 'frequency', a.frequency, 'at', now()));
  end if;
end $$;

/** Tâche de chaque minute. Retourne le nombre d'alertes envoyées. */
create or replace function public.alerts_tick()
returns int language plpgsql security definer set search_path = '' as $$
declare
  a public.alerts;
  v_now timestamptz := clock_timestamp();
  v_paris timestamp := v_now at time zone 'Europe/Paris';
  v_due timestamptz;
  v_vis text[];
  v_n int;
  v_st jsonb;
  v_fire jsonb;
  v_sent int := 0;
  v_event boolean;
begin
  for a in select * from public.alerts al where al.active
             and exists (select 1 from public.members m where m.workspace_id = al.workspace_id and m.user_id = al.created_by
                           and m.role >= 'editor')
  loop
    begin
      -- droits de la créatrice : les fonctions appelées (structure_overview…) vérifient son rôle
      perform set_config('request.jwt.claim.sub', a.created_by::text, true);
      perform set_config('request.jwt.claims', json_build_object('sub', a.created_by)::text, true);
      v_vis := null;
      if a.segment_id is not null then
        v_vis := private.segment_visitors(a.workspace_id, private.segment_def(a.workspace_id, jsonb_build_object('id', a.segment_id)),
                                          v_now - interval '30 days', v_now);
      end if;
      v_event := a.trigger in ('lead', 'cta', 'link_opened', 'quiz_failed_last');
      v_fire := null;
      if v_event then
        v_n := private.alert_count(a, v_vis, a.checked_at, v_now);
        a.pending := least(a.pending + v_n, 1000000);
      else
        v_st := private.alert_state(a, v_vis);
      end if;

      if a.frequency = 'immediate' then
        if v_event and a.pending > 0 and (a.last_fired_at is null or a.last_fired_at <= v_now - interval '10 minutes') then
          v_fire := jsonb_build_object('trigger', a.trigger, 'count', a.pending);
        elsif not v_event and (v_st ->> 'state')::boolean and not a.last_state
              and (a.last_fired_at is null or a.last_fired_at <= v_now - interval '10 minutes') then
          v_fire := jsonb_build_object('trigger', a.trigger, 'value', v_st -> 'value', 'threshold', coalesce(a.threshold, (v_st ->> 'goal')::int));
        end if;
        if not v_event and (v_fire is not null or not (v_st ->> 'state')::boolean) then
          a.last_state := (v_st ->> 'state')::boolean;
        end if;
      else
        -- résumé : dernier 9 h (heure de Paris), le lundi pour l'hebdomadaire
        v_due := (date_trunc('day', v_paris) + interval '9 hours'
                  - case when v_paris < date_trunc('day', v_paris) + interval '9 hours' then interval '1 day' else interval '0' end)
                 at time zone 'Europe/Paris';
        if a.frequency = 'weekly' then
          v_due := ((v_due at time zone 'Europe/Paris')
                    - make_interval(days => (extract(isodow from v_due at time zone 'Europe/Paris')::int - 1))) at time zone 'Europe/Paris';
        end if;
        if a.created_at < v_due and (a.digest_at is null or a.digest_at < v_due) then
          a.digest_at := v_now;
          if v_event and a.pending > 0 then
            v_fire := jsonb_build_object('trigger', a.trigger, 'count', a.pending, 'digest', a.frequency);
          elsif not v_event and (v_st ->> 'state')::boolean then
            v_fire := jsonb_build_object('trigger', a.trigger, 'value', v_st -> 'value',
                                         'threshold', coalesce(a.threshold, (v_st ->> 'goal')::int), 'digest', a.frequency);
          end if;
        end if;
      end if;

      if v_fire is not null then
        perform private.alert_fire(a, v_fire);
        a.last_fired_at := v_now;
        if v_event then a.pending := 0; end if;
        v_sent := v_sent + 1;
      end if;
      -- écriture directe de l'état interne (le déclencheur alerts_check ne le remet pas à zéro : champs inchangés)
      update public.alerts set pending = a.pending, last_state = a.last_state, checked_at = v_now,
                               digest_at = a.digest_at, last_fired_at = a.last_fired_at
       where id = a.id;
    exception when others then
      raise notice 'alerte % ignorée : %', a.id, sqlerrm;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  return v_sent;
end $$;
revoke all on function private.alert_state(public.alerts, text[]) from public;
revoke all on function private.alert_count(public.alerts, text[], timestamptz, timestamptz) from public;
revoke all on function private.alert_fire(public.alerts, jsonb) from public;
revoke all on function public.alerts_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_alerts_tick', '* * * * *', 'select public.alerts_tick()');
  else
    raise notice 'pg_cron indisponible : alertes non planifiées';
  end if;
end $$;
