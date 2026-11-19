-- L26-02 / L26-03 : aide intégrée.
--  * help_feedback : « Cet article vous a aidé ? » = compteur anonyme par article (ni utilisateur, ni espace,
--    ni texte libre). Écriture seulement par la RPC help_feedback ; lecture réservée au service.
--  * help_tours : visites guidées (§3.3) = démos publiées d'un espace système en lecture seule, ouvertes
--    dans le lecteur en aperçu (?preview=1 : aucune statistique). Lisibles par tout utilisateur connecté ;
--    renseignées par l'équipe produit (aucune ligne par défaut : sans visite, l'app masque le bouton).

create table if not exists public.help_feedback (
  article text primary key check (article ~ '^[a-z0-9-]{1,60}$'),
  yes int not null default 0 check (yes >= 0),
  no int not null default 0 check (no >= 0),
  updated_at timestamptz not null default now()
);
alter table public.help_feedback enable row level security;
revoke all on public.help_feedback from anon, authenticated;

create or replace function public.help_feedback(p_article text, p_helpful boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_article is null or p_article !~ '^[a-z0-9-]{1,60}$' or p_helpful is null then
    raise exception 'ARTICLE_INVALID';
  end if;
  insert into public.help_feedback as f (article, yes, no)
  values (p_article, case when p_helpful then 1 else 0 end, case when p_helpful then 0 else 1 end)
  on conflict (article) do update
    set yes = f.yes + excluded.yes, no = f.no + excluded.no, updated_at = now();
end $$;
revoke all on function public.help_feedback(text, boolean) from public, anon;
grant execute on function public.help_feedback(text, boolean) to authenticated;

create table if not exists public.help_tours (
  key text primary key check (key ~ '^[a-z0-9-]{1,60}$'),
  demo_id uuid not null references public.demos (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  steps int not null default 0 check (steps between 0 and 500),
  updated_at timestamptz not null default now()
);
alter table public.help_tours enable row level security;
revoke all on public.help_tours from anon;
revoke insert, update, delete on public.help_tours from authenticated;
grant select on public.help_tours to authenticated;
drop policy if exists help_tours_select on public.help_tours;
create policy help_tours_select on public.help_tours for select to authenticated using (true);
