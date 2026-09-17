import { storage } from '@/src/utils/storage';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://github-app-builder-28.emergent.host').replace(/\/$/, '');
const TOKEN_KEY = 'kjapp_token';
const RECONNECT_MS = 3000;
const IDLE_CLOSE_MS = 20000;
const FALLBACK_DEDUPE_MS = 750;

type Entry<T> = {
  key: string;
  path: string;
  xhr: XMLHttpRequest | null;
  connected: boolean;
  data?: T;
  stopped: boolean;
  offset: number;
  buffer: string;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  fallbackAt: number;
  fallbackData?: T;
  fallbackInFlight?: Promise<T>;
};

const entries = new Map<string, Entry<any>>();

function closeEntry(entry: Entry<any>) {
  entry.stopped = true;
  entry.connected = false;
  if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.reconnectTimer = null;
  entry.idleTimer = null;
  try { entry.xhr?.abort(); } catch {}
  entry.xhr = null;
  entries.delete(entry.key);
}

function parseChunk<T>(entry: Entry<T>, text: string) {
  entry.buffer += text;
  const frames = entry.buffer.split(/\r?\n\r?\n/);
  entry.buffer = frames.pop() || '';

  for (const frame of frames) {
    if (!frame || frame.startsWith(':')) continue;
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (event !== 'update' || !dataLines.length) continue;
    try {
      entry.data = JSON.parse(dataLines.join('\n')) as T;
      entry.connected = true;
    } catch {
      // Ignore malformed frames and keep polling fallback available.
    }
  }
}

async function openEntry<T>(entry: Entry<T>) {
  if (entry.stopped || entry.xhr) return;
  const token = await storage.getItem(TOKEN_KEY);
  if (entry.stopped) return;
  if (!token) {
    entry.connected = false;
    scheduleReconnect(entry);
    return;
  }

  const xhr = new XMLHttpRequest();
  entry.xhr = xhr;
  entry.offset = 0;
  entry.buffer = '';

  xhr.open('GET', `${BACKEND}/api${entry.path}`, true);
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Cache-Control', 'no-cache');
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);

  xhr.onreadystatechange = () => {
    if (entry.stopped || entry.xhr !== xhr) return;
    if ((xhr.readyState === 2 || xhr.readyState === 3) && xhr.status === 200) entry.connected = true;
  };

  xhr.onprogress = () => {
    if (entry.stopped || entry.xhr !== xhr) return;
    try {
      const response = xhr.responseText || '';
      if (response.length <= entry.offset) return;
      const chunk = response.slice(entry.offset);
      entry.offset = response.length;
      parseChunk(entry, chunk);
    } catch {
      entry.connected = false;
    }
  };

  const disconnected = () => {
    if (entry.xhr !== xhr) return;
    entry.xhr = null;
    entry.connected = false;
    scheduleReconnect(entry);
  };
  xhr.onerror = disconnected;
  xhr.onabort = () => {
    if (!entry.stopped) disconnected();
  };
  xhr.onload = disconnected;

  try { xhr.send(); } catch { disconnected(); }
}

function scheduleReconnect<T>(entry: Entry<T>) {
  if (entry.stopped || entry.reconnectTimer) return;
  entry.reconnectTimer = setTimeout(() => {
    entry.reconnectTimer = null;
    void openEntry(entry);
  }, RECONNECT_MS);
}

function touch<T>(entry: Entry<T>) {
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => closeEntry(entry), IDLE_CLOSE_MS);
}

function entryFor<T>(key: string, path: string): Entry<T> {
  const existing = entries.get(key) as Entry<T> | undefined;
  if (existing && existing.path === path && !existing.stopped) return existing;
  if (existing) closeEntry(existing);

  const entry: Entry<T> = {
    key,
    path,
    xhr: null,
    connected: false,
    stopped: false,
    offset: 0,
    buffer: '',
    reconnectTimer: null,
    idleTimer: null,
    fallbackAt: 0,
  };
  entries.set(key, entry);
  void openEntry(entry);
  return entry;
}

export async function realtimeSnapshot<T>(key: string, path: string, fallback: () => Promise<T>): Promise<T> {
  const entry = entryFor<T>(key, path);
  touch(entry);
  if (entry.connected && entry.data !== undefined) return entry.data;

  const now = Date.now();
  if (entry.fallbackData !== undefined && now - entry.fallbackAt < FALLBACK_DEDUPE_MS) return entry.fallbackData;
  if (entry.fallbackInFlight) return entry.fallbackInFlight;

  entry.fallbackInFlight = fallback()
    .then((data) => {
      entry.fallbackData = data;
      entry.fallbackAt = Date.now();
      return data;
    })
    .finally(() => { entry.fallbackInFlight = undefined; });
  return entry.fallbackInFlight;
}

export function stopRealtime(key: string) {
  const entry = entries.get(key);
  if (entry) closeEntry(entry);
}
