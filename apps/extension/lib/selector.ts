/** Sélecteur CSS raisonnablement stable pour un élément (métadonnée, utile en V2 / live demo). */
export function cssSelector(el: Element, maxDepth = 5): string {
  const parts: string[] = [];
  let node: Element | null = el;
  for (let depth = 0; node && node.nodeType === 1 && depth < maxDepth; depth++) {
    const testId = node.getAttribute('data-testid') || node.getAttribute('data-test');
    if (testId) {
      parts.unshift(`[data-testid="${CSS.escape(testId)}"]`);
      break;
    }
    if (node.id && !/\d{3,}/.test(node.id)) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}
