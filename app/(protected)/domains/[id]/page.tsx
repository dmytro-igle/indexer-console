import { notFound } from "next/navigation";
import { getDomainById } from "@/lib/db/domains";
import { listUrlsForDomainWithSubmissions } from "@/lib/db/urls";
import { getSeoAuditById } from "@/lib/db/seoAudits";
import { getSitemapRunById } from "@/lib/db/sitemapRuns";
import { deriveBriefIssues } from "@/lib/seo/issues";
import DomainDetail from "@/components/DomainDetail";

export default async function DomainDetailPage(
  props: PageProps<"/domains/[id]">
) {
  const { id } = await props.params;
  const domain = getDomainById(Number(id));
  if (!domain) notFound();

  const urls = listUrlsForDomainWithSubmissions(domain.id);
  const seoAudit = domain.last_seo_audit_id ? (getSeoAuditById(domain.last_seo_audit_id) ?? null) : null;
  const sitemapRun = domain.last_sitemap_run_id ? getSitemapRunById(domain.last_sitemap_run_id) : null;
  const issues = deriveBriefIssues({
    domain,
    seoAudit,
    sitemapStatus: sitemapRun?.status ?? null,
  });

  return <DomainDetail domain={domain} urls={urls} issues={issues} />;
}
