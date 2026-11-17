"""Génère apps/web/src/styles/maquette.css à partir de docs/ux/maquettes/assets/mockup.css.

Règle D13 : l'app reprend le CSS des maquettes à l'identique. Chaque sélecteur est préfixé par
`.mk` (racine des écrans reconstruits) pour ne pas toucher aux écrans pas encore refaits.
Les règles html/body/:root et le bandeau des maquettes (.mock-nav) ne sont pas repris.
Usage : python3 scripts/maquette-css.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = (ROOT / 'docs/ux/maquettes/assets/mockup.css').read_text()
src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
src = re.sub(r'@import[^;]+;', '', src)


def split_selectors(sel: str):
    out, depth, cur = [], 0, ''
    for ch in sel:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def prefix(sel: str):
    parts = []
    for s in split_selectors(sel):
        if s.startswith(('html', 'body', ':root')) or 'mock-nav' in s:
            return None
        if s.startswith('*'):
            parts.append(f'.mk {s}')
        else:
            parts.append(f'.mk {s}')
    return ', '.join(parts)


def process(block: str) -> str:
    out, i = [], 0
    while i < len(block):
        j = block.find('{', i)
        if j < 0:
            break
        head = block[i:j].strip()
        # bloc imbriqué (@media) : traiter récursivement
        depth, k = 1, j + 1
        while depth and k < len(block):
            if block[k] == '{':
                depth += 1
            elif block[k] == '}':
                depth -= 1
            k += 1
        body = block[j + 1 : k - 1]
        if head.startswith('@media') or head.startswith('@supports'):
            inner = process(body)
            if inner.strip():
                out.append(f'{head} {{\n{inner}}}\n')
        elif head.startswith('@keyframes') or head.startswith('@font-face'):
            out.append(f'{head} {{{body}}}\n')
        elif head:
            p = prefix(head)
            if p:
                out.append(f'{p} {{{body.strip()}}}\n')
        i = k
    return ''.join(out)


css = process(src)
header = (
    '/* Généré par scripts/maquette-css.py depuis docs/ux/maquettes/assets/mockup.css (règle D13 :\n'
    '   CSS des maquettes repris à l\'identique, préfixé par .mk). Ne pas modifier à la main. */\n'
)
# Racine .mk : reprend la règle body de la maquette (police, couleurs, fond)
root = (
    '.mk { font-family: var(--fd-font-sans); font-size: var(--fd-text-body-size); '
    'line-height: var(--fd-text-body-line); color: var(--fd-color-text); background: var(--fd-color-bg); '
    '-webkit-font-smoothing: antialiased; }\n'
)
(ROOT / 'apps/web/src/styles/maquette.css').write_text(header + root + css)
print(len(css.splitlines()), 'lignes')
