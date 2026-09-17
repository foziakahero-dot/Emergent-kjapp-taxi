import { fetch as expoFetch } from 'expo/fetch';
import { storage } from '@/src/utils/storage';
import { TOKEN_KEY } from '@/src/lib/api';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://github-app-builder-28.emergent.host').replace(/\/$/, '');

type SseOptions = {
  path: string;
  signal: AbortSignal;
  onEvent: (event: string, data: any) => void;
  onConnectionChange?: (connected: boolean) => void;
};

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
});

function consumeBlock(block: string, onEvent: SseOptions['onEvent']) {
  const normalized = block.replace(/\r/g, '');
  if (!normalized.trim() || normalized.trimStart().startsWith(':')) return;

  let event = 'message';
  const data: string[] = [];
  for (const line of normalized.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim() || 'message';
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return;
  try {
    onEvent(event, JSON.parse(data.join('\n')));
  } catch {
    // Ugyldig enkelt-event skal ikke stoppe realtime-strømmen.
  }
}

export async function runSse({ path, signal, onEvent, onConnectionChange }: SseOptions) {
  while (!signal.aborted) {
    try {
      const token = await storage.getItem(TOKEN_KEY);
      const response = await expoFetch(`${BACKEND}/api${path}`, {
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE HTTP ${response.status}`);

      onConnectionChange?.(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          consumeBlock(block, onEvent);
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch {
      if (signal.aborted) break;
    } finally {
      onConnectionChange?.(false);
    }

    if (!signal.aborted) await sleep(2500, signal);
  }
}
