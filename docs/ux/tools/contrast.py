# Vérifie le contraste WCAG de paires de couleurs.
# Usage : echo "#FFFFFF #0E7C71 bouton primaire" | python3 docs/ux/tools/contrast.py
import sys
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+0.05)/(lb+0.05)
pairs=[l.split() for l in sys.stdin if l.strip()]
for p in pairs:
    fg,bg,name=p[0],p[1],' '.join(p[2:])
    c=cr(fg,bg); print(f"{c:5.2f} {'AA' if c>=4.5 else ('AA-large/UI' if c>=3 else 'FAIL'):12} {name} ({fg} on {bg})")
