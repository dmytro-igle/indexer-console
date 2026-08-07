"use client";

import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

type ActionKey = "sitemaps" | "keys" | "lang" | "seo" | "submit" | "submitGoogle" | "submitAll" | "checkGoogleStatus";

const ENDPOINTS: Partial<Record<ActionKey, string>> = {
  sitemaps: "/api/sitemaps/fetch",
  keys: "/api/keys/verify",
  lang: "/api/lang/detect",
  seo: "/api/seo/audit",
  submit: "/api/submissions/run",
  submitGoogle: "/api/google/submit",
  checkGoogleStatus: "/api/google/status",
};

export interface SubmitRunResult {
  batchId: number;
  summary: { domainCount: number; urlCount: number; submitted: number; skipped: number; errored: number };
  results: {
    domainId: number;
    host: string;
    outcome: string;
    httpStatus: number | null;
    urlCount: number;
    error: string | null;
  }[];
}

export default function BulkActionsToolbar({
  selectedIds,
  onRefresh,
  onSubmitComplete,
  onGoogleSubmitComplete,
}: {
  selectedIds: number[];
  onRefresh: () => Promise<void>;
  onSubmitComplete: (result: SubmitRunResult) => void;
  onGoogleSubmitComplete: (result: SubmitRunResult) => void;
}) {
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmSubmitGoogle, setConfirmSubmitGoogle] = useState(false);
  const [confirmSubmitAll, setConfirmSubmitAll] = useState(false);

  function requestBody() {
    return JSON.stringify({ domainIds: selectedIds.length > 0 ? selectedIds : undefined });
  }

  async function runAction(action: Exclude<ActionKey, "submitAll">) {
    setPending(action);
    setSummary(null);
    try {
      const res = await fetch(ENDPOINTS[action]!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody(),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setSummary(`Failed: ${body?.error?.message ?? res.status}`);
        return;
      }

      if (action === "sitemaps") {
        const results = body.data as { host: string; status: string }[];
        const ok = results.filter((r) => r.status === "success").length;
        setSummary(`Fetch Sitemaps: ${ok}/${results.length} succeeded`);
      } else if (action === "keys") {
        const results = body.data as { host: string; success: boolean }[];
        const ok = results.filter((r) => r.success).length;
        setSummary(`Verify Keys: ${ok}/${results.length} verified`);
      } else if (action === "lang") {
        const results = body.data as { host: string; isMismatch: boolean }[];
        const mismatches = results.filter((r) => r.isMismatch).length;
        setSummary(
          `Detect Country: ${results.length} checked${mismatches > 0 ? `, ${mismatches} flagged as mismatched` : ""}`
        );
      } else if (action === "seo") {
        const results = body.data as {
          host: string;
          httpsRedirects: boolean;
          hasViewportMeta: boolean;
          robotsTxtHasSitemap: boolean;
          metaDescriptionFlag: string;
          hasHreflang: boolean;
        }[];
        const withIssues = results.filter(
          (r) =>
            !r.httpsRedirects ||
            !r.hasViewportMeta ||
            !r.robotsTxtHasSitemap ||
            r.metaDescriptionFlag !== "ok" ||
            !r.hasHreflang
        ).length;
        setSummary(`SEO Audit: ${results.length} checked, ${withIssues} with issues`);
      } else if (action === "submit") {
        const result = body.data as SubmitRunResult;
        setSummary(
          `Submit to IndexNow: ${result.summary.submitted} submitted, ${result.summary.skipped} skipped, ${result.summary.errored} errored (${result.summary.urlCount} URLs)`
        );
        onSubmitComplete(result);
      } else if (action === "submitGoogle") {
        const result = body.data as SubmitRunResult;
        setSummary(
          `Submit to Google: ${result.summary.submitted} submitted, ${result.summary.skipped} skipped, ${result.summary.errored} errored (${result.summary.urlCount} URLs)`
        );
        onGoogleSubmitComplete(result);
      } else if (action === "checkGoogleStatus") {
        const result = body.data as { checked: number; updated: number };
        setSummary(`Check Google Index Status: ${result.checked} checked, ${result.updated} updated`);
      }

      await onRefresh();
    } finally {
      setPending(null);
    }
  }

  async function runSubmitAll() {
    setPending("submitAll");
    setSummary(null);
    try {
      const [indexNowRes, googleRes] = await Promise.all([
        fetch(ENDPOINTS.submit!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody(),
        }),
        fetch(ENDPOINTS.submitGoogle!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody(),
        }),
      ]);
      const [indexNowBody, googleBody] = await Promise.all([
        indexNowRes.json().catch(() => null),
        googleRes.json().catch(() => null),
      ]);

      const parts: string[] = [];

      if (indexNowRes.ok) {
        const result = indexNowBody.data as SubmitRunResult;
        parts.push(
          `IndexNow: ${result.summary.submitted} submitted, ${result.summary.skipped} skipped, ${result.summary.errored} errored`
        );
        onSubmitComplete(result);
      } else {
        parts.push(`IndexNow failed: ${indexNowBody?.error?.message ?? indexNowRes.status}`);
      }

      if (googleRes.ok) {
        const result = googleBody.data as SubmitRunResult;
        parts.push(
          `Google: ${result.summary.submitted} submitted, ${result.summary.skipped} skipped, ${result.summary.errored} errored`
        );
        onGoogleSubmitComplete(result);
      } else {
        parts.push(`Google failed: ${googleBody?.error?.message ?? googleRes.status}`);
      }

      setSummary(`Submit All — ${parts.join(" · ")}`);
      await onRefresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => runAction("sitemaps")}
          disabled={pending !== null}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-neutral-800"
        >
          {pending === "sitemaps" ? "Fetching…" : "Fetch Sitemaps"}
        </button>
        <button
          onClick={() => runAction("keys")}
          disabled={pending !== null}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-neutral-800"
        >
          {pending === "keys" ? "Verifying…" : "Verify Keys"}
        </button>
        <button
          onClick={() => runAction("lang")}
          disabled={pending !== null}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-neutral-800"
        >
          {pending === "lang" ? "Detecting…" : "Detect Country"}
        </button>
        <button
          onClick={() => runAction("seo")}
          disabled={pending !== null}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-neutral-800"
        >
          {pending === "seo" ? "Auditing…" : "Run SEO Audit"}
        </button>
        <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" aria-hidden />
        <button
          onClick={() => setConfirmSubmit(true)}
          disabled={pending !== null}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending === "submit" ? "Submitting…" : "Submit to IndexNow"}
        </button>
        <button
          onClick={() => setConfirmSubmitGoogle(true)}
          disabled={pending !== null}
          className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending === "submitGoogle" ? "Submitting…" : "Submit to Google"}
        </button>
        <button
          onClick={() => setConfirmSubmitAll(true)}
          disabled={pending !== null}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending === "submitAll" ? "Submitting…" : "Submit All"}
        </button>
        <button
          onClick={() => runAction("checkGoogleStatus")}
          disabled={pending !== null}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-neutral-800"
        >
          {pending === "checkGoogleStatus" ? "Checking…" : "Check Google Index Status"}
        </button>
        <a
          href="/api/export/csv"
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-white/15 dark:hover:bg-neutral-800"
        >
          Export CSV
        </a>
        <span className="text-xs text-neutral-400">
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : "All domains"}
        </span>
      </div>
      {summary && <p className="text-sm text-neutral-600 dark:text-neutral-400">{summary}</p>}

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit to IndexNow?"
        description={`This POSTs real data to api.indexnow.org for ${
          selectedIds.length > 0 ? `${selectedIds.length} selected domain(s)` : "all active domains"
        }. Only domains with a verified key and fetched URLs will actually be submitted.`}
        confirmLabel="Submit"
        onConfirm={() => {
          setConfirmSubmit(false);
          runAction("submit");
        }}
        onCancel={() => setConfirmSubmit(false)}
      />

      <ConfirmDialog
        open={confirmSubmitGoogle}
        title="Submit to Google via RocketIndexer?"
        description={`This spends paid RocketIndexer credits submitting URLs for ${
          selectedIds.length > 0 ? `${selectedIds.length} selected domain(s)` : "all active domains"
        }. Only domains with fetched URLs will be submitted.`}
        confirmLabel="Submit"
        onConfirm={() => {
          setConfirmSubmitGoogle(false);
          runAction("submitGoogle");
        }}
        onCancel={() => setConfirmSubmitGoogle(false)}
      />

      <ConfirmDialog
        open={confirmSubmitAll}
        title="Submit to both IndexNow and Google?"
        description={`This runs both submissions for ${
          selectedIds.length > 0 ? `${selectedIds.length} selected domain(s)` : "all active domains"
        } — free IndexNow submission (needs a verified key) AND paid RocketIndexer/Google submission (spends credits). Use the individual buttons instead if you only want one.`}
        confirmLabel="Submit to both"
        onConfirm={() => {
          setConfirmSubmitAll(false);
          runSubmitAll();
        }}
        onCancel={() => setConfirmSubmitAll(false)}
      />
    </div>
  );
}
