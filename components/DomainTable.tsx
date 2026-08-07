"use client";

import Link from "next/link";
import type { DomainSummary } from "@/lib/db/domains";
import StatusBadge from "./StatusBadge";
import SelfCheckLabel from "./SelfCheckLabel";

export default function DomainTable({
  domains,
  selected,
  onToggle,
  onToggleAll,
}: {
  domains: DomainSummary[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
}) {
  const allSelected = domains.length > 0 && domains.every((d) => selected.has(d.id));

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full min-w-275 text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
          <tr>
            <th className="w-8 px-3 py-2">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
            </th>
            <th className="px-3 py-2">Host</th>
            <th className="px-3 py-2">Country</th>
            <th className="px-3 py-2">
              Key <SelfCheckLabel />
            </th>
            <th className="px-3 py-2">Sitemap</th>
            <th className="px-3 py-2">SEO Audit</th>
            <th className="px-3 py-2">Last submitted (IndexNow)</th>
            <th className="px-3 py-2">Last submitted (Google)</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr
              key={d.id}
              className="border-t border-black/5 hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-neutral-900/50"
            >
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => onToggle(d.id)}
                />
              </td>
              <td className="px-3 py-2">
                <Link href={`/domains/${d.id}`} className="font-medium hover:underline">
                  {d.host}
                </Link>
              </td>
              <td className="px-3 py-2">
                {d.lang.detected_country ? (
                  <span className="flex items-center gap-1">
                    {d.lang.detected_country}
                    {d.lang.is_mismatch && (
                      <StatusBadge label="mismatch?" tone="yellow" />
                    )}
                  </span>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                {d.keyVerification.success === null ? (
                  <StatusBadge label="Never checked" tone="gray" />
                ) : d.keyVerification.success ? (
                  <StatusBadge label="Verified" tone="green" />
                ) : (
                  <StatusBadge
                    label={`Failed${d.keyVerification.http_status ? ` (${d.keyVerification.http_status})` : ""}`}
                    tone="red"
                  />
                )}
              </td>
              <td className="px-3 py-2">
                {d.sitemap.status === null ? (
                  <StatusBadge label="Never fetched" tone="gray" />
                ) : d.sitemap.status === "success" ? (
                  <StatusBadge label={`${d.sitemap.url_count} URLs`} tone="green" />
                ) : d.sitemap.status === "partial" ? (
                  <StatusBadge label={`Partial (${d.sitemap.url_count} URLs)`} tone="yellow" />
                ) : (
                  <StatusBadge label="Failed" tone="red" />
                )}
              </td>
              <td className="px-3 py-2">
                <Link href={`/domains/${d.id}`}>
                  {d.seoAudit.checked_at === null ? (
                    <StatusBadge label="Never audited" tone="gray" />
                  ) : d.seoIssueCount === 0 ? (
                    <StatusBadge label="No issues" tone="green" />
                  ) : (
                    <StatusBadge
                      label={`${d.seoIssueCount} issue${d.seoIssueCount === 1 ? "" : "s"}`}
                      tone="yellow"
                    />
                  )}
                </Link>
              </td>
              <td className="px-3 py-2 text-neutral-500">
                {d.lastSubmission.submitted_at ? (
                  <span>
                    {d.lastSubmission.submitted_at} —{" "}
                    {d.lastSubmission.outcome === "submitted" ? (
                      <StatusBadge label={`HTTP ${d.lastSubmission.http_status}`} tone="green" />
                    ) : (
                      <StatusBadge label={d.lastSubmission.outcome ?? "unknown"} tone="yellow" />
                    )}
                  </span>
                ) : (
                  <span className="text-neutral-400">Never</span>
                )}
              </td>
              <td className="px-3 py-2 text-neutral-500">
                {d.lastGoogleSubmission.submitted_at ? (
                  <span>
                    {d.lastGoogleSubmission.submitted_at} —{" "}
                    {d.lastGoogleSubmission.outcome === "submitted" ? (
                      <StatusBadge label={`HTTP ${d.lastGoogleSubmission.http_status}`} tone="green" />
                    ) : (
                      <StatusBadge label={d.lastGoogleSubmission.outcome ?? "unknown"} tone="yellow" />
                    )}
                    {d.lastGoogleSubmission.credits_remaining !== null && (
                      <span className="text-neutral-400"> ({d.lastGoogleSubmission.credits_remaining} credits left)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-neutral-400">Never</span>
                )}
              </td>
            </tr>
          ))}
          {domains.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-neutral-400">
                No domains yet. Add one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
