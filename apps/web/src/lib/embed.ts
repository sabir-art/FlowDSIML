import { PLAYER_URL } from './env';

export const publicDemoUrl = (demoId: string) => `${PLAYER_URL}/#/d/${demoId}`;
export const shareLinkUrl = (token: string) => `${PLAYER_URL}/#/l/${token}`;

/** Snippet d'intégration responsive (ratio 16:10 + barre du player). */
export function embedSnippet(url: string, title: string): string {
  const safeTitle = title.replace(/[<>"&]/g, '');
  return `<div style="position:relative;width:100%;padding-bottom:calc(62.5% + 44px);height:0">
  <iframe src="${url}" title="${safeTitle}" loading="lazy" allow="fullscreen; clipboard-write"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px"></iframe>
</div>`;
}

/** L19b : page publique d'une démo. */
export const publicPageUrl = (demoId: string) => `${PLAYER_URL}/#/p/${demoId}`;

/** L25-14 : page personnalisée d'un lien (code de 12 caractères tiré par la base). */
export const personalPageUrl = (demoId: string, code: string) => `${PLAYER_URL}/#/p/${demoId}/${code}`;
