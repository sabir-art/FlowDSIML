# Vérifie que fr.json et en.json ont les mêmes clés et les mêmes variables {{x}}.
# Usage : python3 docs/ux/tools/i18n-check.py docs/ux/i18n/fr.json docs/ux/i18n/en.json
import json, re, sys
def flat(d, p=''):
    o = {}
    for k, v in d.items():
        o.update(flat(v, p + k + '.')) if isinstance(v, dict) else o.__setitem__(p + k, v)
    return o
a, b = (flat(json.load(open(f, encoding='utf-8'))) for f in sys.argv[1:3])
var = lambda s: set(re.findall(r'\{\{(\w+)\}\}', s))
errs = [f'clé absente de {sys.argv[2]} : {k}' for k in a.keys() - b.keys()]
errs += [f'clé absente de {sys.argv[1]} : {k}' for k in b.keys() - a.keys()]
errs += [f'variables différentes : {k}' for k in a.keys() & b.keys() if var(a[k]) != var(b[k])]
print('\n'.join(errs) or f'OK : {len(a)} clés, variables cohérentes.')
sys.exit(1 if errs else 0)
