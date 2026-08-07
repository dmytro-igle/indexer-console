"use client";

import { useState } from "react";
import type { DomainUrlRow } from "@/lib/db/urls";
import StatusBadge from "./StatusBadge";
import IndexedStatusEditor from "./IndexedStatusEditor";

export default function DomainUrlsTable({ urls }: { urls: DomainUrlRow[] }) {
  const [rows, setRows] = useState(urls);

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
          <tr>
            <th className="px-3 py-2">URL</th>
            <th className="px-3 py-2">Active</th>
            <th className="px-3 py-2">Last seen</th>
            <th className="px-3 py-2">Indexed status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-black/5 dark:border-white/5">
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
              <td className="px-3 py-2 text-neutral-500">{u.last_seen_at}</td>
              <td className="px-3 py-2">
                <IndexedStatusEditor
                  urlId={u.id}
                  initialValue={u.indexed_status}
                  onSaved={(value) =>
                    setRows((prev) =>
                      prev.map((r) => (r.id === u.id ? { ...r, indexed_status: value } : r))
                    )
                  }
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-neutral-400">
                No URLs yet. Run Fetch Sitemaps for this domain.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
