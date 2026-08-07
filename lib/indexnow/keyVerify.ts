import { fetchWithTimeout } from "@/lib/http";
import type { KeyVerifyResult } from "./types";

/**
 * Self-check only: IndexNow has no official "verify key" API. This
 * replicates what search engines do — GET the key file and compare its
 * body to the key.
 */
export async function verifyDomainKey(keyLocation: string, key: string): Promise<KeyVerifyResult> {
  const result = await fetchWithTimeout(keyLocation, { timeoutMs: 10_000, maxBytes: 4096 });

  if (result.error) {
    return {
      success: false,
      httpStatus: null,
      responseBodySnippet: null,
      errorMessage: result.error,
    };
  }

  const body = result.body.trim();
  const success = result.status === 200 && body === key;

  return {
    success,
    httpStatus: result.status,
    responseBodySnippet: body.slice(0, 200),
    errorMessage: success
      ? null
      : result.status !== 200
        ? `HTTP ${result.status}`
        : "Key file content does not match the expected key",
  };
}
