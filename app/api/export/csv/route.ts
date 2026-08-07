import { getSubmissionsForExport } from "@/lib/db/submissions";
import { toCsv } from "@/lib/csv";

function statusLabel(status: "accepted" | "rejected" | "error" | null): string {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "error") return "Error";
  return "Never submitted";
}

export async function GET() {
  const rows = getSubmissionsForExport();

  const csv = toCsv(
    [
      "#",
      "Country",
      "Domain",
      "Page URL",
      "Submission status",
      "HTTP code",
      "Google Submission status",
      "Google HTTP/API code",
      "Indexed status",
    ],
    rows.map((row, i) => [
      i + 1,
      row.detected_country ?? "Unknown",
      row.host,
      row.url,
      statusLabel(row.submission_status),
      row.http_status ?? "N/A",
      statusLabel(row.google_submission_status),
      row.google_http_status ?? "N/A",
      row.indexed_status,
    ])
  );

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="indexnow-export-${date}.csv"`,
    },
  });
}
