import StatusBadge from "./StatusBadge";

export interface SubmissionReportRow {
  host: string;
  outcome: string;
  httpStatus: number | null;
  urlCount: number;
  error: string | null;
}

function toneFor(outcome: string): "green" | "red" | "yellow" | "gray" {
  if (outcome === "submitted") return "green";
  if (outcome === "error") return "red";
  if (outcome.startsWith("skipped")) return "yellow";
  return "gray";
}

function labelFor(outcome: string): string {
  switch (outcome) {
    case "submitted":
      return "Submitted";
    case "skipped_no_key_verified":
      return "Skipped: key not verified";
    case "skipped_no_urls":
      return "Skipped: no URLs";
    case "skipped_inactive":
      return "Skipped: inactive";
    case "error":
      return "Error";
    default:
      return outcome;
  }
}

export default function SubmissionReport({ rows }: { rows: SubmissionReportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
          <tr>
            <th className="px-3 py-2">Domain</th>
            <th className="px-3 py-2">Outcome</th>
            <th className="px-3 py-2">HTTP code</th>
            <th className="px-3 py-2">URLs</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.host}
              className="border-t border-black/5 dark:border-white/5"
            >
              <td className="px-3 py-2 font-medium">{r.host}</td>
              <td className="px-3 py-2">
                <StatusBadge label={labelFor(r.outcome)} tone={toneFor(r.outcome)} />
              </td>
              <td className="px-3 py-2 text-neutral-500">{r.httpStatus ?? "—"}</td>
              <td className="px-3 py-2 text-neutral-500">{r.urlCount}</td>
              <td className="px-3 py-2 text-neutral-500">{r.error ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
