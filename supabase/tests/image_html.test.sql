-- Tests pgTAP : L28-05, opérations « image » avec « fit » et « mask » acceptées par html_ops_ok.
begin;
set search_path = public, extensions;
select plan(6);

select ok(public.html_ops_ok('[{"id":"a1","sel":"img","op":"image","scope":"step","fit":"cover","value":"00000000-0000-0000-0000-000000000001/media/logo.png"}]'),
  'image : Remplir (cover) accepté');
select ok(public.html_ops_ok('[{"id":"a1","sel":"img","op":"image","scope":"step","value":"00000000-0000-0000-0000-000000000001/media/logo.png"}]'),
  'image sans fit : Ajuster par défaut');
select ok(not public.html_ops_ok('[{"id":"a1","sel":"img","op":"image","scope":"step","fit":"stretch","value":"00000000-0000-0000-0000-000000000001/media/logo.png"}]'),
  'fit inconnu : refusé');
select ok(not public.html_ops_ok('[{"id":"a1","sel":"p","op":"text","scope":"step","fit":"cover","value":"x"}]'),
  'fit hors image : refusé');
select ok(public.html_ops_ok('[{"id":"a1","sel":"img","op":"mask","scope":"step"}]'), 'masquer l’image : accepté');
select ok(not public.html_ops_ok('[{"id":"a1","sel":"img","op":"mask","scope":"step","value":"https://ailleurs.example/x.png"}]'),
  'masquer l’image avec une valeur : refusé');

select * from finish();
rollback;
