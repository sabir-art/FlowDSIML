-- Tests pgTAP : L49 P3, opération « extlink » (lien externe autorisé : https seulement, sur l'étape).
begin;
set search_path = public, extensions;
select plan(5);
select ok(public.html_ops_ok('[{"id":"e1","sel":"a.doc","op":"extlink","value":"https://docs.example.com/guide","scope":"step"}]'),
  'https autorisé');
select ok(not public.html_ops_ok('[{"id":"e1","sel":"a.doc","op":"extlink","value":"http://docs.example.com/","scope":"step"}]'),
  'http refusé');
select ok(not public.html_ops_ok('[{"id":"e1","sel":"a.doc","op":"extlink","value":"javascript:alert(1)","scope":"step"}]'),
  'javascript: refusé');
select ok(not public.html_ops_ok('[{"id":"e1","sel":"a.doc","op":"extlink","scope":"step"}]'), 'sans adresse refusé');
select ok(not public.html_ops_ok('[{"id":"e1","sel":"a.doc","op":"extlink","value":"https://docs.example.com/","scope":"all"}]'),
  'toutes les étapes refusé');
select * from finish();
rollback;
