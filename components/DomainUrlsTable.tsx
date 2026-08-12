"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DomainUrlRow } from "@/lib/db/urls";
import StatusBadge from "./StatusBadge";
import IndexedStatusEditor from "./IndexedStatusEditor";
import ConfirmDialog from "./ConfirmDialog";

type SubmitTarget = "bing" | "google" | "both";

interface SubmitRunResult {
  summary: { urlCount: number; submitted: number; skipped: number; errored: number };
  results: { outcome: string; httpStatus: number | null; urlCount: number; error: string | null }[];
}

export default function DomainUrlsTable({
  domainId,
  urls,
  newUrls,
}: {
  domainId: number;
  urls: DomainUrlRow[];
  newUrls: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [indexedStatusById, setIndexedStatusById] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<SubmitTarget | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SubmitTarget | null>(null);

  const newUrlSet = useMemo(() => new Set(newUrls), [newUrls]);
  const activeRows = urls.filter((u) => u.is_active);
  const selectedIds = activeRows.filter((u) => selected.has(u.id)).map((u) => u.id);
  const selectedIdSet = new Set(selectedIds);
  const selectedCount = selectedIds.length;
  const allActiveSelected = activeRows.length > 0 && activeRows.every((u) => selectedIdSet.has(u.id));

  function toggleAllActive() {
    setSelected((prev) => {
      if (allActiveSelected) return new Set();
      const next = new Set(prev);
      for (const row of activeRows) next.add(row.id);
      return next;
    });
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function summarize(label: string, result: SubmitRunResult): string {
    const domainResult = result.results[0];
    const status = domainResult?.httpStatus ? `, HTTP ${domainResult.httpStatus}` : "";
    const error = domainResult?.error ? ` (${domainResult.error})` : "";
    return `${label}: ${result.summary.urlCount} URL(s), ${result.summary.submitted} submitted, ${result.summary.skipped} skipped, ${result.summary.errored} errored${status}${error}`;
  }

  async function postSubmit(endpoint: string): Promise<{ ok: boolean; body: unknown; status: number }> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainIds: [domainId], urlIds: selectedIds }),
    });
    return {
      ok: res.ok,
      body: await res.json().catch(() => null),
      status: res.status,
    };
  }

  async function runSubmit(target: SubmitTarget) {
    if (selectedCount === 0) {
      setSummary("Select one or more active URLs first.");
      return;
    }

    setPending(target);
    setSummary(null);
    try {
      if (target === "both") {
        const [bing, google] = await Promise.all([
          postSubmit("/api/submissions/run"),
          postSubmit("/api/google/submit"),
        ]);
        const parts: string[] = [];
        if (bing.ok) {
          parts.push(summarize("Bing", (bing.body as { data: SubmitRunResult }).data));
        } else {
          parts.push(`Bing failed: ${(bing.body as { error?: { message?: string } } | null)?.error?.message ?? bing.status}`);
        }
        if (google.ok) {
          parts.push(summarize("Google", (google.body as { data: SubmitRunResult }).data));
        } else {
          parts.push(
            `Google failed: ${(google.body as { error?: { message?: string } } | null)?.error?.message ?? google.status}`
          );
        }
        setSummary(parts.join(" · "));
      } else {
        const label = target === "bing" ? "Bing" : "Google";
        const endpoint = target === "bing" ? "/api/submissions/run" : "/api/google/submit";
        const result = await postSubmit(endpoint);
        if (!result.ok) {
          setSummary(
            `${label} failed: ${(result.body as { error?: { message?: string } } | null)?.error?.message ?? result.status}`
          );
          return;
        }
        setSummary(summarize(label, (result.body as { data: SubmitRunResult }).data));
      }

      setSelected(new Set());
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function confirmDescription(target: SubmitTarget): string {
    if (target === "bing") {
      return `This submits ${selectedCount} selected URL(s) to Bing through IndexNow. The domain needs a verified IndexNow key.`;
    }
    if (target === "google") {
      return `This submits ${selectedCount} selected URL(s) to Google through RocketIndexer and spends credits.`;
    }
    return `This submits ${selectedCount} selected URL(s) to both Bing/IndexNow and Google/RocketIndexer. Google submission spends credits.`;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirmTarget("bing")}
          disabled={pending !== null || selectedCount === 0}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending === "bing" ? "Submitting…" : "Submit selected to Bing"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmTarget("google")}
          disabled={pending !== null || selectedCount === 0}
          className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending === "google" ? "Submitting…" : "Submit selected to Google"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmTarget("both")}
          disabled={pending !== null || selectedCount === 0}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending === "both" ? "Submitting…" : "Submit selected to both"}
        </button>
        <span className="text-xs text-neutral-400">
          {selectedCount > 0 ? `${selectedCount} selected` : "No URLs selected"}
        </span>
      </div>
      {summary && <p className="text-sm text-neutral-600 dark:text-neutral-400">{summary}</p>}

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allActiveSelected}
                  disabled={activeRows.length === 0}
                  onChange={toggleAllActive}
                  aria-label="Select all active URLs"
                />
              </th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">New</th>
              <th className="px-3 py-2">Last seen</th>
              <th className="px-3 py-2">Indexed status</th>
            </tr>
          </thead>
          <tbody>
            {urls.map((u) => (
              <tr key={u.id} className="border-t border-black/5 dark:border-white/5">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIdSet.has(u.id)}
                    disabled={!u.is_active}
                    onChange={() => toggleOne(u.id)}
                    aria-label={`Select ${u.url}`}
                  />
                </td>
                <td className="max-w-[360px] truncate px-3 py-2">
                  <a href={u.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {u.url}
                  </a>
                </td>
                <td className="px-3 py-2">
                  {u.is_active ? (
                    <StatusBadge label="active" tone="green" />
                  ) : (
                    <StatusBadge label="removed" tone="gray" />
                  )}
                </td>
                <td className="px-3 py-2">
                  {newUrlSet.has(u.url) ? <StatusBadge label="new" tone="green" /> : <span className="text-neutral-400">—</span>}
                </td>
                <td className="px-3 py-2 text-neutral-500">{u.last_seen_at}</td>
                <td className="px-3 py-2">
                  <IndexedStatusEditor
                    urlId={u.id}
                    initialValue={indexedStatusById[u.id] ?? u.indexed_status}
                    onSaved={(value) =>
                      setIndexedStatusById((prev) => ({
                        ...prev,
                        [u.id]: value,
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
            {urls.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-400">
                  No URLs yet. Fetch the sitemap for this domain.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={
          confirmTarget === "bing"
            ? "Submit selected URLs to Bing?"
            : confirmTarget === "google"
              ? "Submit selected URLs to Google?"
              : "Submit selected URLs to both?"
        }
        description={confirmTarget ? confirmDescription(confirmTarget) : ""}
        confirmLabel={confirmTarget === "both" ? "Submit to both" : "Submit"}
        onConfirm={() => {
          const target = confirmTarget;
          setConfirmTarget(null);
          if (target) runSubmit(target);
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
