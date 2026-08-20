"use client";

import { useState, useCallback, useMemo } from "react";
import type { DomainSummary } from "@/lib/db/domains";
import DomainTable, { type DomainSortKey, type SortDir } from "./DomainTable";
import BulkActionsToolbar, { type SubmitRunResult } from "./BulkActionsToolbar";
import IssuesPanel from "./IssuesPanel";
import AddDomainForm from "./AddDomainForm";
import SubmissionReport, { type SubmissionReportRow } from "./SubmissionReport";

export default function Dashboard({
  initialDomains,
}: {
  initialDomains: DomainSummary[];
}) {
  const [domains, setDomains] = useState(initialDomains);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<DomainSortKey>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [lastReport, setLastReport] = useState<SubmissionReportRow[] | null>(
    null,
  );
  const [lastGoogleReport, setLastGoogleReport] = useState<
    SubmissionReportRow[] | null
  >(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/domains");
    const body = await res.json();
    setDomains(body.data as DomainSummary[]);
  }, []);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleDomains = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    const filtered = needle
      ? domains.filter(
          (d) =>
            d.host.toLowerCase().includes(needle) ||
            (d.lang.detected_country ?? "").toLowerCase().includes(needle)
        )
      : domains;

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "host") {
        cmp = a.host.localeCompare(b.host);
      } else if (sortKey === "country") {
        cmp = (a.lang.detected_country ?? "").localeCompare(
          b.lang.detected_country ?? ""
        );
      } else if (sortKey === "added") {
        cmp = a.created_at.localeCompare(b.created_at);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [domains, filterText, sortKey, sortDir]);

  function toggleAll() {
    setSelected((prev) => {
      if (visibleDomains.length > 0 && visibleDomains.every((d) => prev.has(d.id))) {
        return new Set();
      }
      return new Set(visibleDomains.map((d) => d.id));
    });
  }

  function handleSort(key: DomainSortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "added" ? "desc" : "asc");
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Domains</h1>
        <AddDomainForm onAdded={refresh} />
      </div>

      <input
        type="text"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        placeholder="Filter by host or country…"
        className="w-full max-w-sm rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/15"
      />

      <BulkActionsToolbar
        selectedIds={Array.from(selected)}
        onRefresh={refresh}
        onSubmitComplete={(result: SubmitRunResult) => {
          const rows: SubmissionReportRow[] = result.results.map((r) => ({
            host: r.host,
            outcome: r.outcome,
            httpStatus: r.httpStatus,
            urlCount: r.urlCount,
            error: r.error,
          }));
          setLastReport(rows);
        }}
        onGoogleSubmitComplete={(result: SubmitRunResult) => {
          const rows: SubmissionReportRow[] = result.results.map((r) => ({
            host: r.host,
            outcome: r.outcome,
            httpStatus: r.httpStatus,
            urlCount: r.urlCount,
            error: r.error,
          }));
          setLastGoogleReport(rows);
        }}
      />

      {lastReport && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">
            Last submit run (IndexNow)
          </h2>
          <SubmissionReport rows={lastReport} />
        </div>
      )}

      {lastGoogleReport && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">
            Last submit run (Google)
          </h2>
          <SubmissionReport rows={lastGoogleReport} />
        </div>
      )}

      <DomainTable
        domains={visibleDomains}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      <IssuesPanel domains={domains} />
    </div>
  );
}
