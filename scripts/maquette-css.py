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
src = re.sub(r'^@import .*;\s*$', '', src, flags=re.M)


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

# ---- Peau DSI (référence de la Lead UX, docs/ux/maquettes/reference/assets/reference.css) ----
# Jetons --ref-* globaux (:root, thème sombre) ; règles d'effets préfixées .mk comme le reste.
ref_path = ROOT / 'docs/ux/maquettes/reference/assets/reference.css'
if ref_path.exists():
    ref = re.sub(r'/\*.*?\*/', '', ref_path.read_text(), flags=re.S)

    def prefix_ref(sel: str):
        out = []
        for s in split_selectors(sel):
            if s.startswith(':root'):
                # :root:not(...) [descendant] -> :root:not(...) .mk descendant
                head, _, rest = s.partition(' ')
                out.append(f'{head} .mk {rest}'.strip() if rest else head)
            elif s.startswith('[data-theme'):
                head, _, rest = s.partition(' ')
                out.append(f':root{head} .mk {rest}'.strip() if rest else f':root{head}')
            elif s.startswith(('html', 'body')):
                continue
            else:
                out.append(f'.mk {s}')
        return ', '.join(out) if out else None

    def process_ref(block: str) -> str:
        res, i = [], 0
        while i < len(block):
            j = block.find('{', i)
            if j < 0:
                break
            head = block[i:j].strip()
            depth, k = 1, j + 1
            while depth and k < len(block):
                depth += {'{': 1, '}': -1}.get(block[k], 0)
                k += 1
            body = block[j + 1 : k - 1]
            if head.startswith('@media'):
                inner = process_ref(body)
                if inner.strip():
                    res.append(f'{head} {{\n{inner}}}\n')
            elif head:
                p = prefix_ref(head)
                if p:
                    res.append(f'{p} {{{body.strip()}}}\n')
            i = k
        return ''.join(res)

    peau = process_ref(ref)
    (ROOT / 'apps/web/src/styles/maquette-peau.css').write_text(
        '/* Généré par scripts/maquette-css.py depuis docs/ux/maquettes/reference/assets/reference.css\n'
        '   (peau DSI : effets des maquettes d\'origine transposés). Ne pas modifier à la main. */\n' + peau
    )
    print(len(peau.splitlines()), 'lignes de peau')
