const CLIENT_ID_KEY = 'perler_anonymous_client_id_v1';
const LOCAL_BUFFER_KEY = 'perler_analytics_buffer_v1';
const MAX_BUFFER = 200;

export interface AnalyticsEvent {
  clientId: string;
  event: string;
  props: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
  platform: string;
}

export function getAnonymousClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown-client';
  }
}

function readLocalBuffer(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_BUFFER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalBuffer(events: AnalyticsEvent[]): void {
  try {
    localStorage.setItem(LOCAL_BUFFER_KEY, JSON.stringify(events.slice(0, MAX_BUFFER)));
  } catch {
    // Best-effort only. The buffer is useful for local testing without a backend.
  }
}

export function trackEvent(event: string, props: Record<string, unknown> = {}): void {
  const payload: AnalyticsEvent = {
    clientId: getAnonymousClientId(),
    event,
    props,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
  };

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
  if (endpoint) {
    try {
      const sent = navigator.sendBeacon(
        endpoint,
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      );
      if (sent) return;
    } catch {
      // Fall back to the local buffer below.
    }
  }

  const buffer = readLocalBuffer();
  buffer.push(payload);
  writeLocalBuffer(buffer);
}

export function getLocalAnalyticsBuffer(): AnalyticsEvent[] {
  return readLocalBuffer();
}

export function clearLocalAnalyticsBuffer(): void {
  try {
    localStorage.removeItem(LOCAL_BUFFER_KEY);
  } catch {
    // Ignore.
  }
}
