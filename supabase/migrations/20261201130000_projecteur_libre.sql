-- EXT-02 §6.3 : projecteur libre, réglage de toute la démo lu par le lecteur public.
-- demos.settings.spotlight = { enabled, size, dim, fixedOnReducedMotion } ; quand il est activé, le
-- manifeste publié reçoit « spotlight » :
--   size  : diamètre du halo, en px à l'échelle d'une capture de 1 280 px (120 à 400, 220 par défaut) ;
--   dim   : assombrissement du reste, en % (20 à 80, 55 par défaut) ;
--   fixedOnReducedMotion : halo fixe si le visiteur préfère moins d'animations (vrai par défaut).
-- Toute valeur inattendue retombe sur le défaut ou sur la borne (jamais d'erreur de conversion).
-- Désactivé ou absent : le manifeste n'a pas la clé.

create or replace function public.demo_versions_spotlight()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  v_size numeric;
  v_dim numeric;
begin
  select d.settings -> 'spotlight' into v from public.demos d where d.id = new.demo_id;
  if jsonb_typeof(v) is distinct from 'object' or coalesce(v ->> 'enabled', 'false') <> 'true' then
    new.manifest := new.manifest - 'spotlight';
    return new;
  end if;
  v_size := case when jsonb_typeof(v -> 'size') = 'number' then (v ->> 'size')::numeric else 220 end;
  v_dim := case when jsonb_typeof(v -> 'dim') = 'number' then (v ->> 'dim')::numeric else 55 end;
  new.manifest := new.manifest || jsonb_build_object('spotlight', jsonb_build_object(
    'size', round(least(greatest(v_size, 120), 400))::int,
    'dim', round(least(greatest(v_dim, 20), 80))::int,
    'fixedOnReducedMotion', coalesce(v ->> 'fixedOnReducedMotion', 'true') <> 'false'));
  return new;
end $$;
revoke all on function public.demo_versions_spotlight() from public, anon, authenticated;

drop trigger if exists demo_versions_spotlight on public.demo_versions;
create trigger demo_versions_spotlight before insert on public.demo_versions
  for each row execute function public.demo_versions_spotlight();
