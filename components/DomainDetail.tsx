"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DomainRow } from "@/lib/db/domains";
import type { DomainUrlSummary } from "@/lib/db/urls";
import type { BriefIssueRow } from "@/lib/seo/issues";
import DomainUrlsTable from "./DomainUrlsTable";
import DomainIssuesList from "./DomainIssuesList";
import SelfCheckLabel from "./SelfCheckLabel";
import ConfirmDialog from "./ConfirmDialog";

export default function DomainDetail({
  domain,
  urls,
  issues,
}: {
  domain: DomainRow;
  urls: DomainUrlSummary[];
  issues: BriefIssueRow[];
}) {
  const router = useRouter();
  const [host, setHost] = useState(domain.host);
  const [key, setKey] = useState(domain.key);
  const [keyLocation, setKeyLocation] = useState(domain.key_location);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [hasSeoAudit, setHasSeoAudit] = useState(Boolean(domain.last_seo_audit_id));
  const [runningSeoAudit, setRunningSeoAudit] = useState(false);
  const [fetchingSitemap, setFetchingSitemap] = useState(false);
  const [sitemapSummary, setSitemapSummary] = useState<string | null>(null);
  const [newUrls, setNewUrls] = useState<string[]>([]);
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [deadline, setDeadline] = useState("");

  async function fetchSitemapNow() {
    setFetchingSitemap(true);
    setSitemapSummary(null);
    setNewUrls([]);
    try {
      const res = await fetch("/api/sitemaps/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainIds: [domain.id] }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setSitemapSummary(`Failed: ${body?.error?.message ?? res.status}`);
        return;
      }
      const result = body.data?.[0] as
        | {
            status: string;
            urlCount: number;
            newUrlCount?: number;
            newUrls?: string[];
            reactivatedUrlCount?: number;
            error?: string | null;
          }
        | undefined;
      if (!result) {
        setSitemapSummary("Fetch completed, but no result was returned.");
        return;
      }
      const discovered = result.newUrls ?? [];
      setNewUrls(discovered);
      const reactivated = result.reactivatedUrlCount ?? 0;
      setSitemapSummary(
        `Sitemap ${result.status}: ${result.urlCount} URL(s), ${discovered.length} new${
          reactivated > 0 ? `, ${reactivated} reactivated` : ""
        }${result.error ? ` (${result.error})` : ""}`
      );
      router.refresh();
    } finally {
      setFetchingSitemap(false);
    }
  }

  async function runSeoAuditNow() {
    setRunningSeoAudit(true);
    try {
      const res = await fetch("/api/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainIds: [domain.id] }),
      });
      if (res.ok) {
        setHasSeoAudit(true);
        router.refresh();
      }
    } finally {
      setRunningSeoAudit(false);
    }
  }

  function briefHref() {
    const params = new URLSearchParams();
    if (owner.trim()) params.set("owner", owner.trim());
    if (priority.trim()) params.set("priority", priority.trim());
    if (deadline.trim()) params.set("deadline", deadline.trim());
    const qs = params.toString();
    return `/api/domains/${domain.id}/brief${qs ? `?${qs}` : ""}`;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/domains/${domain.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, key, keyLocation }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? "Failed to save");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/domains/${domain.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDeleteError(body?.error?.message ?? "Failed to delete");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
      >
        <h1 className="text-lg font-semibold">Domain settings</h1>
        <label className="flex flex-col gap-1 text-sm">
          Host
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/15"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          IndexNow key
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 dark:border-white/15"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Key location <SelfCheckLabel />
          <input
            value={keyLocation}
            onChange={(e) => setKeyLocation(e.target.value)}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/15"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            {deleting ? "Deleting…" : "Delete domain"}
          </button>
        </div>
        {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this domain?"
        description={`This removes ${domain.host} from the dashboard along with its submission history. This can't be undone from the UI.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          setConfirmDelete(false);
          handleDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Issues {issues.length > 0 && `(${issues.length})`}</h2>
          <button
            type="button"
            onClick={runSeoAuditNow}
            disabled={runningSeoAudit}
            className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-neutral-800"
          >
            {runningSeoAudit ? "Auditing…" : hasSeoAudit ? "Re-run SEO audit" : "Run SEO audit now"}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          From lightweight HTTP checks (sitemap, HTTPS redirect, viewport meta tag, robots.txt,
          meta description, hreflang) — not a full page-speed or mobile-UX audit. <SelfCheckLabel />
        </p>
        {!hasSeoAudit && issues.length === 0 && (
          <p className="text-sm text-neutral-500">
            No SEO audit has been run yet — click &quot;Run SEO audit now&quot; above to check.
          </p>
        )}
        <DomainIssuesList issues={issues} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Developer brief</h2>
        <p className="text-xs text-neutral-500">
          Downloads the issues above as a formatted .docx brief you can hand to a developer.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Owner
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Unassigned"
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/15"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/15"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/15"
            />
          </label>
        </div>

        <div>
          {hasSeoAudit ? (
            <a
              href={briefHref()}
              className="inline-block rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Download Brief (.docx)
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white opacity-50"
            >
              Download Brief (.docx)
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            URLs ({urls.filter((u) => u.is_active).length} active / {urls.length} total)
          </h2>
          <button
            type="button"
            onClick={fetchSitemapNow}
            disabled={fetchingSitemap}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-neutral-800"
          >
            {fetchingSitemap ? "Fetching…" : "Fetch sitemap"}
          </button>
        </div>
        {sitemapSummary && (
          <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">{sitemapSummary}</p>
        )}
        {newUrls.length > 0 && (
          <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900/60 dark:bg-green-950/30">
            <p className="font-medium text-green-800 dark:text-green-200">
              New pages found ({newUrls.length})
            </p>
            <ul className="mt-2 max-h-40 overflow-auto text-xs text-green-900 dark:text-green-100">
              {newUrls.map((url) => (
                <li key={url} className="truncate py-0.5">
                  {url}
                </li>
              ))}
            </ul>
          </div>
        )}
        <DomainUrlsTable domainId={domain.id} urls={urls} newUrls={newUrls} />
      </div>
    </div>
  );
}
