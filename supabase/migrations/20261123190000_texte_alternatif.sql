-- L29 §3.5 : « Texte alternatif de la capture » d'une étape (facultatif, 250 caractères), repris dans le
-- manifeste publié (step.alt) pour le lecteur (alt de l'image) et la version accessible. Pas de droit
-- nouveau : la colonne suit les droits d'écriture des étapes. Idempotent.
alter table public.steps add column if not exists alt_text text;
alter table public.steps drop constraint if exists steps_alt_text_len;
alter table public.steps add constraint steps_alt_text_len check (alt_text is null or char_length(alt_text) <= 250);

-- Manifeste : step.alt (texte nettoyé) pour les étapes qui en ont un, sans redéfinir publish_demo
create or replace function public.demo_versions_alt()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_alts jsonb;
begin
  select coalesce(jsonb_object_agg(s.id::text, btrim(s.alt_text)), '{}'::jsonb) into v_alts
    from public.steps s where s.demo_id = new.demo_id and coalesce(btrim(s.alt_text), '') <> '';
  if v_alts <> '{}'::jsonb and jsonb_typeof(new.manifest -> 'steps') = 'array' then
    new.manifest := jsonb_set(new.manifest, '{steps}', (
      select coalesce(jsonb_agg(case when v_alts ? (st ->> 'id')
                                     then st || jsonb_build_object('alt', v_alts -> (st ->> 'id'))
                                     else st end order by ord), '[]'::jsonb)
        from jsonb_array_elements(new.manifest -> 'steps') with ordinality as e(st, ord)));
  end if;
  return new;
end $$;
revoke all on function public.demo_versions_alt() from public, anon, authenticated;
drop trigger if exists demo_versions_alt on public.demo_versions;
create trigger demo_versions_alt before insert on public.demo_versions
  for each row execute function public.demo_versions_alt();
