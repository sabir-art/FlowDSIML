import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { browser } from 'wxt/browser';
import type { Database } from '@flowdsiml/supabase-types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/** Stockage de session dans chrome.storage.local (partagé popup ↔ service worker). */
const chromeStorage: SupportedStorage = {
  async getItem(key) {
    const r = await browser.storage.local.get(key);
    return (r[key] as string | undefined) ?? null;
  },
  async setItem(key, value) {
    await browser.storage.local.set({ [key]: value });
  },
  async removeItem(key) {
    await browser.storage.local.remove(key);
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY || 'missing-anon-key', {
  auth: { storage: chromeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
