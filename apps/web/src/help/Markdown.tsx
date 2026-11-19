/**
 * L26-03 : rendu des articles d'aide (sous-ensemble de Markdown : titres ##, paragraphes, listes,
 * **gras**, `code`, liens internes [texte](#/route)). Rendu en éléments React, jamais en HTML brut.
 */
import type { ReactNode } from 'react';

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((#\/[^)\s]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1] !== undefined) out.push(<b key={k}>{m[1]}</b>);
    else if (m[2] !== undefined) out.push(<code key={k}>{m[2]}</code>);
    else
      out.push(
        <a key={k} href={m[4]}>
          {m[3]}
        </a>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines[0]!.startsWith('## '))
          return (
            <div key={bi}>
              <h3>{lines[0]!.slice(3)}</h3>
              {lines.length > 1 && <Markdown source={lines.slice(1).join('\n')} />}
            </div>
          );
        if (lines.every((l) => /^- /.test(l)))
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.slice(2), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\d+\. /.test(l)))
          return (
            <ol key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\d+\. /, ''), `${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        // Paragraphe suivi d'une liste dans le même bloc
        const firstList = lines.findIndex((l) => /^(- |\d+\. )/.test(l));
        if (firstList > 0)
          return (
            <div key={bi}>
              <p>{inline(lines.slice(0, firstList).join(' '), `${bi}p`)}</p>
              <Markdown source={lines.slice(firstList).join('\n')} />
            </div>
          );
        return <p key={bi}>{inline(lines.join(' '), `${bi}`)}</p>;
      })}
    </>
  );
}
