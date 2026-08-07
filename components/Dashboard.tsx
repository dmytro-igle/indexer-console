"use client";

import { useState, useCallback } from "react";
import type { DomainSummary } from "@/lib/db/domains";
import DomainTable from "./DomainTable";
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

  function toggleAll() {
    setSelected((prev) => {
      if (domains.length > 0 && domains.every((d) => prev.has(d.id))) {
        return new Set();
      }
      return new Set(domains.map((d) => d.id));
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Domains</h1>
        <AddDomainForm onAdded={refresh} />
      </div>

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
        domains={domains}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />

      <IssuesPanel domains={domains} />
    </div>
  );
}
