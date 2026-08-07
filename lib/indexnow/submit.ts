import type { IndexNowSubmitResult } from "./types";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

function classifyStatus(status: number | null): IndexNowSubmitResult["submissionStatus"] {
  if (status === 200 || status === 202) return "accepted";
  if (status !== null) return "rejected";
  return "error";
}

export async function submitToIndexNow(payload: {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}): Promise<IndexNowSubmitResult> {
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.text().catch(() => "");
    const submissionStatus = classifyStatus(res.status);

    return {
      httpStatus: res.status,
      submissionStatus,
      responseBody: body || null,
      errorMessage: submissionStatus === "rejected" ? `HTTP ${res.status}` : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      httpStatus: null,
      submissionStatus: "error",
      responseBody: null,
      errorMessage: message,
    };
  }
}
