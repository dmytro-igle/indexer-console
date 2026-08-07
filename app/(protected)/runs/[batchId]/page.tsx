import { notFound } from "next/navigation";
import { getBatchById, getBatchDomainDetails } from "@/lib/db/submissions";
import SubmissionReport from "@/components/SubmissionReport";

export default async function RunDetailPage(
  props: PageProps<"/runs/[batchId]">
) {
  const { batchId } = await props.params;
  const batch = getBatchById(Number(batchId));
  if (!batch) notFound();

  const domains = getBatchDomainDetails(batch.id);
  const rows = domains.map((d) => ({
    host: d.host,
    outcome: d.outcome,
    httpStatus: d.http_status,
    urlCount: d.url_count,
    error: d.error_message,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">IndexNow run #{batch.id}</h1>
      <p className="text-sm text-neutral-500">
        Started {batch.started_at} · Finished {batch.finished_at ?? "in progress"} ·{" "}
        {batch.domain_count} domains · {batch.url_count} URLs
      </p>
      <SubmissionReport rows={rows} />
    </div>
  );
}
