import Store from 'electron-store';
import { AppSettings } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/constants';

interface StoreSchema {
  userSettings: Record<string, Partial<AppSettings>>;
}

let _store: Store<StoreSchema> | null = null;

function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new Store<StoreSchema>({ defaults: { userSettings: {} } });
  }
  return _store;
}

export function getSettings(userId: string): AppSettings {
  const all = getStore().get('userSettings', {}) as Record<string, Partial<AppSettings>>;
  return { ...DEFAULT_SETTINGS, ...(all[userId] ?? {}) } as AppSettings;
}

export function setSettings(userId: string, data: Partial<AppSettings>): AppSettings {
  const store = getStore();
  const all = store.get('userSettings', {}) as Record<string, Partial<AppSettings>>;
  all[userId] = { ...(all[userId] ?? {}), ...data };
  store.set('userSettings', all);
  return { ...DEFAULT_SETTINGS, ...all[userId] } as AppSettings;
}
