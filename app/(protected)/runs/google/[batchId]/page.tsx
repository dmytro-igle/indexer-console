import { notFound } from "next/navigation";
import { getGoogleBatchById, getGoogleBatchDomainDetails } from "@/lib/db/googleSubmissions";
import SubmissionReport from "@/components/SubmissionReport";

export default async function GoogleRunDetailPage(
  props: PageProps<"/runs/google/[batchId]">
) {
  const { batchId } = await props.params;
  const batch = getGoogleBatchById(Number(batchId));
  if (!batch) notFound();

  const domains = getGoogleBatchDomainDetails(batch.id);
  const rows = domains.map((d) => ({
    host: d.host,
    outcome: d.outcome,
    httpStatus: d.http_status,
    urlCount: d.url_count,
    error: d.error_message,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Google run #{batch.id}</h1>
      <p className="text-sm text-neutral-500">
        Started {batch.started_at} · Finished {batch.finished_at ?? "in progress"} ·{" "}
        {batch.domain_count} domains · {batch.url_count} URLs
      </p>
      <SubmissionReport rows={rows} />
    </div>
  );
}
