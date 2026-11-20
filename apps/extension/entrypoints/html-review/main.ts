import '@flowdsiml/ui/tokens.css';
import './style.css';
import { browser } from 'wxt/browser';
import { APP_URL } from '@/lib/config';
import { strings } from '@/lib/i18n';
import { htmlStore, type PendingHtmlPage } from '@/lib/htmlStore';
import { sendHtml, type HtmlDemoKind } from '@/lib/htmlUpload';
import { supabase } from '@/lib/supabase';

/**
 * A8 : vérification de la capture HTML. Aperçus en iframe sandbox vide (aucun script, origine
 * opaque), données remplacées déjà dans la source ; « Envoyer » ou « Supprimer la capture ».
 */
const s = strings;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]'))
  el.textContent = s[el.dataset.i18n as keyof typeof s];
document.title = s.hrTitle;
const fmt = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(v[k] ?? ''));

function alert(msg: string | null) {
  $('alert').textContent = msg ?? '';
  $('alert').hidden = !msg;
}

function card(p: PendingHtmlPage, i: number): HTMLLIElement {
  const li = document.createElement('li');
  const frame = document.createElement('div');
  frame.className = 'frame';
  const iframe = document.createElement('iframe');
  // Aucun droit : ni script, ni formulaire, ni navigation ; origine opaque
  iframe.setAttribute('sandbox', '');
  iframe.setAttribute('loading', 'lazy');
  iframe.title = fmt(s.hrPreview, { n: i + 1, title: p.title || p.url });
  iframe.tabIndex = -1;
  iframe.srcdoc = p.html;
  frame.append(iframe);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const mb = (p.bytes / 1024 / 1024).toLocaleString(document.documentElement.lang, {
    maximumFractionDigits: 1,
  });
  const lines = [
    [`${i + 1}. ${p.title || p.url}`, 'b'],
    [`${new URL(p.url).host} · ${mb} Mo · ${fmt(s.hrLinks, { n: p.links.length })}`, 'span'],
    [fmt(s.hrBlurred, { n: p.blurred }), 'span'],
  ] as Array<[string, string]>;
  if (p.clickLabel) lines.push([fmt(s.hrClick, { label: p.clickLabel }), 'span']);
  if (p.tooBig) lines.push([s.htmlTooBig, 'span.warn']);
  for (const [text, tag] of lines) {
    const [t, cls] = tag.split('.');
    const el = document.createElement(t!);
    if (cls) el.className = cls;
    el.textContent = text;
    meta.append(el);
  }
  li.append(frame, meta);
  return li;
}

async function main() {
  const pages = (await htmlStore.all()).sort((a, b) => a.order - b.order);
  const target = (await browser.storage.local.get('fd.htmlReview'))['fd.htmlReview'] as
    { workspaceId: string; title: string } | undefined;
  const send = $<HTMLButtonElement>('send');
  if (!pages.length || !target) {
    alert(s.hrNone);
    send.disabled = true;
    return;
  }
  $('pages').replaceChildren(...pages.map(card));
  // L48-G §3 : type choisi dans « Nouvelle démo » (métadonnées du compte), prérempli et modifiable ;
  // à défaut, Sandbox proposé d'office quand les pages sont reliées entre elles
  const chosen = await supabase.auth
    .getUser()
    .then(({ data }) => data.user?.user_metadata?.content_type as unknown)
    .catch(() => null);
  const preset: HtmlDemoKind | null = chosen === 'sandbox' ? 'sandbox' : chosen === 'html' ? 'guided' : null;
  const linked = pages.length > 2 && pages.filter((p) => p.clickSel).length < pages.length - 1;
  if (preset ?? (linked ? 'sandbox' : null))
    (document.querySelector(`input[value="${preset ?? 'sandbox'}"]`) as HTMLInputElement).checked = true;
  send.addEventListener('click', async () => {
    send.disabled = true;
    alert(null);
    const kind = (document.querySelector('input[name="kind"]:checked') as HTMLInputElement)
      .value as HtmlDemoKind;
    const total = pages.filter((p) => !p.tooBig).length;
    try {
      const demoId = await sendHtml(pages, { ...target, kind }, (done) => {
        $('progress').textContent = fmt(s.hrSending, { done, total });
      });
      await htmlStore.clear();
      await browser.storage.local.remove('fd.htmlReview');
      $('progress').textContent = s.hrSent;
      location.href = `${APP_URL.replace(/\/$/, '')}/#/demos/${demoId}/edit`;
    } catch {
      send.disabled = false;
      $('progress').textContent = '';
      alert(s.hrError);
    }
  });
  $('delete').addEventListener('click', async () => {
    if (!confirm(s.hrConfirmDelete)) return;
    await htmlStore.clear();
    await browser.storage.local.remove('fd.htmlReview');
    window.close();
  });
}
void main();
