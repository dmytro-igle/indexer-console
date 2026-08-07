const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; IndexNowConsole/1.0)";

export interface FetchResult {
  ok: boolean;
  status: number | null;
  body: string;
  error: string | null;
  finalUrl: string | null;
}

export async function fetchWithTimeout(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number; method?: string; headers?: Record<string, string> } = {}
): Promise<FetchResult> {
  const { timeoutMs = 10_000, maxBytes, method = "GET", headers = {} } = opts;
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": DEFAULT_USER_AGENT, ...headers },
    });

    let body = "";
    if (maxBytes) {
      const reader = res.body?.getReader();
      if (reader) {
        let received = 0;
        const chunks: Uint8Array[] = [];
        while (received < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
        }
        reader.cancel().catch(() => {});
        body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
      } else {
        body = await res.text();
      }
    } else {
      body = await res.text();
    }

    return { ok: res.ok, status: res.status, body, error: null, finalUrl: res.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: null, body: "", error: message, finalUrl: null };
  }
}
