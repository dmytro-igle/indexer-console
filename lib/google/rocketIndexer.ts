const BASE_URL = "https://rocketindexer.com/api/index.php";

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface RocketIndexerSubmitResult {
  configured: boolean;
  httpStatus: number | null;
  ok: boolean;
  submitted: number;
  failed: number;
  invalidUrls: string[];
  trackingIds: number[];
  creditsRemaining: number | null;
  errorMessage: string | null;
}

export async function submitUrlsToRocketIndexer(urls: string[]): Promise<RocketIndexerSubmitResult> {
  const apiKey = process.env.ROCKETINDEXER_API_KEY;
  if (!apiKey) {
    return {
      configured: false,
      httpStatus: null,
      ok: false,
      submitted: 0,
      failed: 0,
      invalidUrls: [],
      trackingIds: [],
      creditsRemaining: null,
      errorMessage: "ROCKETINDEXER_API_KEY is not configured",
    };
  }

  const endpoint = `${BASE_URL}?token=${encodeURIComponent(apiKey)}&endpoint=submit`;
  const body = urls.length === 1 ? { url: urls[0] } : { urls };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    const json = safeJsonParse(text);

    if (!json) {
      return {
        configured: true,
        httpStatus: res.status,
        ok: false,
        submitted: 0,
        failed: 0,
        invalidUrls: [],
        trackingIds: [],
        creditsRemaining: null,
        errorMessage: `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
      };
    }

    const data = (json.data as Record<string, unknown>) ?? {};
    const invalidUrls = Array.isArray(data.invalid_urls) ? (data.invalid_urls as string[]) : [];
    const trackingIds = Array.isArray(data.tracking_ids) ? (data.tracking_ids as number[]) : [];

    return {
      configured: true,
      httpStatus: res.status,
      ok: res.ok && json.success === true,
      submitted: Number(data.submitted) || 0,
      failed: Number(data.failed) || 0,
      invalidUrls,
      trackingIds,
      creditsRemaining: typeof data.credits_remaining === "number" ? data.credits_remaining : null,
      errorMessage: json.success === true ? null : (String(json.message ?? "") || `HTTP ${res.status}`),
    };
  } catch (err) {
    return {
      configured: true,
      httpStatus: null,
      ok: false,
      submitted: 0,
      failed: 0,
      invalidUrls: [],
      trackingIds: [],
      creditsRemaining: null,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface RocketIndexerStatusItem {
  trackingId: number;
  url: string;
  status: string;
  /** "pending" | "indexed" | whatever else RocketIndexer returns — passed through verbatim, never re-interpreted. */
  indexedStatus: string;
}

export interface RocketIndexerStatusResult {
  configured: boolean;
  ok: boolean;
  items: RocketIndexerStatusItem[];
  errorMessage: string | null;
}

export async function checkRocketIndexerStatus(trackingIds: number[]): Promise<RocketIndexerStatusResult> {
  const apiKey = process.env.ROCKETINDEXER_API_KEY;
  if (!apiKey) {
    return { configured: false, ok: false, items: [], errorMessage: "ROCKETINDEXER_API_KEY is not configured" };
  }
  if (trackingIds.length === 0) {
    return { configured: true, ok: true, items: [], errorMessage: null };
  }

  const endpoint = `${BASE_URL}?token=${encodeURIComponent(apiKey)}&endpoint=status&ids=${trackingIds.join(",")}`;

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
    const json = safeJsonParse(await res.text());

    if (!json || json.success !== true) {
      return {
        configured: true,
        ok: false,
        items: [],
        errorMessage: (json?.message as string) ?? `HTTP ${res.status}`,
      };
    }

    const data = (json.data as Record<string, unknown>) ?? {};
    const rawItems = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
    const items: RocketIndexerStatusItem[] = rawItems.map((it) => ({
      trackingId: Number(it.tracking_id),
      url: String(it.url ?? ""),
      status: String(it.status ?? ""),
      indexedStatus: String(it.indexed_status ?? ""),
    }));

    return { configured: true, ok: true, items, errorMessage: null };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      items: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface RocketIndexerBalance {
  configured: boolean;
  ok: boolean;
  available: number | null;
  used: number | null;
  totalSubmitted: number | null;
  delivered: number | null;
  inProgress: number | null;
  errorMessage: string | null;
}

export async function getRocketIndexerBalance(): Promise<RocketIndexerBalance> {
  const apiKey = process.env.ROCKETINDEXER_API_KEY;
  const empty = {
    available: null,
    used: null,
    totalSubmitted: null,
    delivered: null,
    inProgress: null,
  };
  if (!apiKey) {
    return { configured: false, ok: false, ...empty, errorMessage: "ROCKETINDEXER_API_KEY is not configured" };
  }

  const endpoint = `${BASE_URL}?token=${encodeURIComponent(apiKey)}&endpoint=balance`;

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
    const json = safeJsonParse(await res.text());

    if (!json || json.success !== true) {
      return {
        configured: true,
        ok: false,
        ...empty,
        errorMessage: (json?.message as string) ?? `HTTP ${res.status}`,
      };
    }

    const data = (json.data as Record<string, unknown>) ?? {};
    const credits = (data.credits as Record<string, unknown>) ?? {};
    const stats = (data.statistics as Record<string, unknown>) ?? {};

    return {
      configured: true,
      ok: true,
      available: typeof credits.available === "number" ? credits.available : null,
      used: typeof credits.used === "number" ? credits.used : null,
      totalSubmitted: typeof stats.total_submitted === "number" ? stats.total_submitted : null,
      delivered: typeof stats.delivered === "number" ? stats.delivered : null,
      inProgress: typeof stats.in_progress === "number" ? stats.in_progress : null,
      errorMessage: null,
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      ...empty,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Unauthenticated health check — no API key required, works even before one is configured. */
export async function checkRocketIndexerHealth(): Promise<{ ok: boolean; message: string | null }> {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(10_000) });
    const json = safeJsonParse(await res.text());
    return { ok: res.ok && json?.success === true, message: (json?.message as string) ?? null };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
