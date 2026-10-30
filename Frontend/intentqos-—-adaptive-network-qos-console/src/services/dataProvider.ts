import { ApiError, SystemHealth } from '../types/qos';

const DEFAULT_API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_API_BASE_URL as string)) ||
  'http://localhost:8080/api';

export function getDemoSystemHealth(lastUpdated: string): SystemHealth {
  return {
    mode: 'DEMO',
    connected: false,
    lastUpdated,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    latencyMs: null,
    components: [
      {
        id: 'frontend',
        name: 'IntentQoS Web Console',
        state: 'DEMO_SIMULATION',
        detail: 'Deterministic DemoDataProvider active (seed=42026)',
        version: 'v1.0.0-demo',
        lastChecked: lastUpdated,
      },
      {
        id: 'api',
        name: 'Telemetry & Policy REST API',
        state: 'DEMO_SIMULATION',
        detail: 'Simulated locally — no live backend bound',
        version: 'contract-v1-draft',
        lastChecked: lastUpdated,
      },
      {
        id: 'classifier',
        name: 'Nano-Stream Early-Flow Classifier',
        state: 'DEMO_SIMULATION',
        detail: 'Replaying seeded INT8 reference predictions',
        version: 'nano-stream-int8-v1.4.2',
        lastChecked: lastUpdated,
      },
      {
        id: 'sdn_controller',
        name: 'Ryu OpenFlow Controller',
        state: 'DEMO_SIMULATION',
        detail: 'Simulated flow-table & meter state transitions',
        version: 'ryu-4.34-proto',
        lastChecked: lastUpdated,
      },
      {
        id: 'enforcement',
        name: 'Linux HTB / FQ-CoDel Shaper',
        state: 'DEMO_SIMULATION',
        detail: 'Simulated token-bucket rate adaptation',
        version: 'tc-htb-sim',
        lastChecked: lastUpdated,
      },
    ],
  };
}

export function getDisconnectedLiveHealth(
  apiBaseUrl: string,
  checkedAt: string,
  errorMsg?: string
): SystemHealth {
  const apiError: ApiError = {
    code: 'ERR_BACKEND_UNREACHABLE',
    message:
      errorMsg ||
      `No verified backend responded at ${apiBaseUrl}/health. Live mode will never display synthetic demo telemetry.`,
    endpoint: `${apiBaseUrl}/health`,
    timestamp: checkedAt,
    retryable: true,
  };

  return {
    mode: 'LIVE',
    connected: false,
    lastUpdated: checkedAt,
    apiBaseUrl,
    latencyMs: null,
    error: apiError,
    components: [
      {
        id: 'frontend',
        name: 'IntentQoS Web Console',
        state: 'OPERATIONAL',
        detail: 'UI shell running in strict Live verification mode',
        version: 'v1.0.0',
        lastChecked: checkedAt,
      },
      {
        id: 'api',
        name: 'Telemetry & Policy REST API',
        state: 'NOT_CONNECTED',
        detail: `No response from ${apiBaseUrl}/health`,
        version: 'Unknown',
        lastChecked: checkedAt,
      },
      {
        id: 'classifier',
        name: 'Nano-Stream Early-Flow Classifier',
        state: 'UNKNOWN',
        detail: 'Unverified — live feature extractor not connected',
        version: 'Unknown',
        lastChecked: checkedAt,
      },
      {
        id: 'sdn_controller',
        name: 'Ryu OpenFlow Controller',
        state: 'NOT_CONNECTED',
        detail: 'Controller telemetry endpoint unavailable',
        version: 'Unknown',
        lastChecked: checkedAt,
      },
      {
        id: 'enforcement',
        name: 'Linux HTB / FQ-CoDel Shaper',
        state: 'UNKNOWN',
        detail: 'WAN shaper enforcement unverified',
        version: 'Unknown',
        lastChecked: checkedAt,
      },
    ],
  };
}

/**
 * Attempts a real HTTP health check against `${apiBaseUrl}/health` with timeout.
 * Never fabricates a healthy response if the endpoint is unreachable or returns HTML.
 */
export async function probeLiveBackendHealth(
  apiBaseUrl = DEFAULT_API_BASE_URL,
  signal?: AbortSignal
): Promise<SystemHealth> {
  const nowStr = new Date().toISOString().slice(11, 19) + ' UTC';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const start = performance.now();
    const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return getDisconnectedLiveHealth(
        apiBaseUrl,
        nowStr,
        `Endpoint ${apiBaseUrl}/health returned HTTP ${res.status} (${contentType || 'non-JSON'}). Backend API is not implemented in this environment.`
      );
    }

    const data = await res.json();
    if (!data || data.status !== 'ok') {
      return getDisconnectedLiveHealth(
        apiBaseUrl,
        nowStr,
        'Backend health payload did not confirm operational status.'
      );
    }

    const latencyMs = Math.round(performance.now() - start);
    return {
      mode: 'LIVE',
      connected: true,
      lastUpdated: nowStr,
      apiBaseUrl,
      latencyMs,
      components: data.components || [],
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? `Connection timed out after 2.5s probing ${apiBaseUrl}/health.`
        : `Backend not connected at ${apiBaseUrl}/health. Ensure the Python Ryu/REST bridge is running or switch to Demo / Replay mode.`;
    return getDisconnectedLiveHealth(apiBaseUrl, nowStr, reason);
  }
}
