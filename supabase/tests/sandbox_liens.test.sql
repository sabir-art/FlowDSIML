-- Tests pgTAP : L48-G §5 (liens laissés volontairement, demos.sandbox.ignoredLinks).
begin;
set search_path = public, extensions;
select plan(6);

select ok(public.sandbox_ok('{"ignoredLinks": []}'), 'liste vide acceptée');
select ok(public.sandbox_ok('{"autoLink": true, "ignoredLinks": [{"url": "https://app.acme.example/aide", "from": "00000000-0000-4000-8000-0000000000a1"}]}'),
          'lien laissé (url https, page d’origine)');
select ok(not public.sandbox_ok('{"ignoredLinks": [{"url": "javascript:alert(1)", "from": "00000000-0000-4000-8000-0000000000a1"}]}'),
          'schéma autre que http(s) refusé');
select ok(not public.sandbox_ok('{"ignoredLinks": [{"url": "https://app.acme.example/x", "from": "pas-un-uuid"}]}'),
          'page d’origine invalide refusée');
select ok(not public.sandbox_ok('{"ignoredLinks": [{"url": "https://app.acme.example/x", "from": "00000000-0000-4000-8000-0000000000a1", "note": "x"}]}'),
          'clé inconnue refusée');
select ok(not public.sandbox_ok('{"autre": 1}'), 'clé de premier niveau inconnue toujours refusée');

select * from finish();
rollback;
