# Polices

`plus-jakarta-sans-fr-wght.woff2` : sous-ensemble de Plus Jakarta Sans (variable, latin, paquet
`@fontsource-variable/plus-jakarta-sans` 5.3.0), licence SIL OFL 1.1 (`OFL-plus-jakarta-sans.txt`, aucun nom
réservé). Réduit aux caractères de l'interface française et anglaise et aux graisses 400 à 800 (L33, premier
rendu plus léger). Fabriqué avec fonttools :

```sh
fonttools varLib.instancer plus-jakarta-sans-latin-wght-normal.woff2 wght=400:800 -o inst.ttf
pyftsubset inst.ttf --flavor=woff2 --output-file=plus-jakarta-sans-fr-wght.woff2 \
  --layout-features='kern,liga,calt,ccmp,locl,mark,mkmk' \
  --unicodes='U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+202F,U+20AC,U+2122,U+2190-2193,U+2212,U+221E'
```

Le `unicode-range` de `src/fonts.css` doit rester identique à la liste ci-dessus.
