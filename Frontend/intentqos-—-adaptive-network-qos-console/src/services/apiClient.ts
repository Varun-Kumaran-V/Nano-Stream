/**
 * ===============================================================================
 * FILE: src/services/apiClient.ts
 * ===============================================================================
 *
 * PURPOSE
 * -------
 * Centralized, typed API client for interacting with the IntentQoS management
 * backend. Manages timeouts, cancellation, error translation, request IDs,
 * and contract parsing between frontend domain types and backend REST endpoints.
 *
 * ROLE IN INTENTQOS
 * -----------------
 * This is the FRONTEND-BACKEND INTEGRATION BOUNDARY.
 *
 * Ensures that when LIVE mode is active and verified, components query live
 * measured endpoints rather than relying on deterministic simulated data.
 *
 * ===============================================================================
 */

import {
  CapacityEstimate,
  ExperimentRun,
  FlowRecord,
  MetricPoint,
  ModelEvaluation,
  PolicyEvent,
  QoSPolicy,
  SystemHealth,
  UserIntent,
} from '../types/qos';

export const DEFAULT_API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_API_BASE_URL as string)) ||
  'http://localhost:8080/api';

export class ApiClientError extends Error {
  code: string;
  endpoint: string;
  status?: number;

  constructor(message: string, code: string, endpoint: string, status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.endpoint = endpoint;
    this.status = status;
  }
}

async function requestJson<T>(
  endpointUrl: string,
  options: RequestInit = {},
  timeoutMs = 4000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpointUrl, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new ApiClientError(
        `HTTP ${res.status}: ${errText || res.statusText}`,
        `ERR_HTTP_${res.status}`,
        endpointUrl,
        res.status
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ApiClientError) throw err;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    throw new ApiClientError(
      isTimeout
        ? `Request timed out after ${timeoutMs}ms for ${endpointUrl}`
        : `Network error reaching ${endpointUrl}: ${err instanceof Error ? err.message : String(err)}`,
      isTimeout ? 'ERR_TIMEOUT' : 'ERR_NETWORK',
      endpointUrl
    );
  }
}

export const ApiClient = {
  async getHealth(baseUrl = DEFAULT_API_BASE_URL): Promise<SystemHealth> {
    const data = await requestJson<any>(`${baseUrl.replace(/\/$/, '')}/health`);
    return {
      mode: 'LIVE',
      connected: data.status === 'ok',
      lastUpdated: data.lastUpdated,
      apiBaseUrl: baseUrl,
      latencyMs: data.latencyMs ?? 1,
      components: data.components || [],
    };
  },

  async getCurrentMetrics(baseUrl = DEFAULT_API_BASE_URL): Promise<MetricPoint> {
    return requestJson<MetricPoint>(`${baseUrl.replace(/\/$/, '')}/v1/metrics/current`);
  },

  async getMetricsHistory(baseUrl = DEFAULT_API_BASE_URL, limit = 48): Promise<MetricPoint[]> {
    return requestJson<MetricPoint[]>(`${baseUrl.replace(/\/$/, '')}/v1/metrics/history?limit=${limit}`);
  },

  async getFlows(baseUrl = DEFAULT_API_BASE_URL, limit = 50): Promise<FlowRecord[]> {
    return requestJson<FlowRecord[]>(`${baseUrl.replace(/\/$/, '')}/v1/flows?limit=${limit}`);
  },

  async getCapacity(baseUrl = DEFAULT_API_BASE_URL): Promise<CapacityEstimate> {
    return requestJson<CapacityEstimate>(`${baseUrl.replace(/\/$/, '')}/v1/capacity`);
  },

  async getPolicies(baseUrl = DEFAULT_API_BASE_URL): Promise<QoSPolicy[]> {
    return requestJson<QoSPolicy[]>(`${baseUrl.replace(/\/$/, '')}/v1/policies`);
  },

  async previewPolicy(
    policies: Record<string, any>,
    wanCapacityMbps?: number,
    baseUrl = DEFAULT_API_BASE_URL
  ): Promise<any> {
    return requestJson<any>(`${baseUrl.replace(/\/$/, '')}/v1/policies/preview`, {
      method: 'POST',
      body: JSON.stringify({ policies, wanCapacityMbps }),
    });
  },

  async applyPolicy(
    policies: Record<string, any>,
    reason = 'Frontend operator application',
    baseUrl = DEFAULT_API_BASE_URL
  ): Promise<PolicyEvent> {
    return requestJson<PolicyEvent>(`${baseUrl.replace(/\/$/, '')}/v1/policies/apply`, {
      method: 'POST',
      body: JSON.stringify({ policies, reason }),
    });
  },

  async rollbackPolicy(baseUrl = DEFAULT_API_BASE_URL): Promise<PolicyEvent> {
    return requestJson<PolicyEvent>(`${baseUrl.replace(/\/$/, '')}/v1/policies/rollback`, {
      method: 'POST',
    });
  },

  async getIntents(baseUrl = DEFAULT_API_BASE_URL): Promise<UserIntent[]> {
    return requestJson<UserIntent[]>(`${baseUrl.replace(/\/$/, '')}/v1/intents`);
  },

  async createIntent(
    payload: {
      name: string;
      trafficClass: string;
      durationMinutes: number;
      priorityTier?: number;
      minFloorMbps?: number;
      maxCeilingMbps?: number;
      targetLatencyMs?: number;
      rationale?: string;
    },
    baseUrl = DEFAULT_API_BASE_URL
  ): Promise<UserIntent> {
    return requestJson<UserIntent>(`${baseUrl.replace(/\/$/, '')}/v1/intents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelIntent(intentId: string, baseUrl = DEFAULT_API_BASE_URL): Promise<boolean> {
    const res = await requestJson<{ cancelled: boolean }>(
      `${baseUrl.replace(/\/$/, '')}/v1/intents/${encodeURIComponent(intentId)}`,
      { method: 'DELETE' }
    );
    return res.cancelled;
  },

  async getEvents(baseUrl = DEFAULT_API_BASE_URL, limit = 50): Promise<PolicyEvent[]> {
    return requestJson<PolicyEvent[]>(`${baseUrl.replace(/\/$/, '')}/v1/events?limit=${limit}`);
  },

  async getModelInsights(baseUrl = DEFAULT_API_BASE_URL): Promise<ModelEvaluation> {
    return requestJson<ModelEvaluation>(`${baseUrl.replace(/\/$/, '')}/v1/model`);
  },

  async getExperiments(baseUrl = DEFAULT_API_BASE_URL): Promise<ExperimentRun[]> {
    return requestJson<ExperimentRun[]>(`${baseUrl.replace(/\/$/, '')}/v1/experiments`);
  },

  async resetSystem(baseUrl = DEFAULT_API_BASE_URL): Promise<{ status: string }> {
    return requestJson<{ status: string }>(`${baseUrl.replace(/\/$/, '')}/v1/system/reset`, {
      method: 'POST',
    });
  },
};
