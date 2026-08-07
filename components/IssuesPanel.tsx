import type { DomainSummary } from "@/lib/db/domains";

function seoIssueLabels(seo: DomainSummary["seoAudit"]): string[] {
  const labels: string[] = [];
  if (!seo.https_redirects) labels.push("no HTTPS redirect");
  if (!seo.has_viewport_meta) labels.push("no viewport meta tag");
  if (!seo.robots_txt_has_sitemap) labels.push("robots.txt missing sitemap");
  if (seo.meta_description_flag === "missing") labels.push("meta description missing");
  else if (seo.meta_description_flag === "too_long")
    labels.push(`meta description too long (${seo.meta_description_length} chars)`);
  if (!seo.has_hreflang) labels.push("no hreflang tags");
  return labels;
}

export default function IssuesPanel({ domains }: { domains: DomainSummary[] }) {
  const keyFailures = domains.filter(
    (d) => d.keyVerification.success === false
  );
  const sitemapFailures = domains.filter(
    (d) => d.sitemap.status === "failed" || d.sitemap.status === "partial"
  );
  const langMismatches = domains.filter((d) => d.lang.is_mismatch);
  const seoIssues = domains
    .filter((d) => d.seoAudit.checked_at !== null)
    .map((d) => ({ domain: d, labels: seoIssueLabels(d.seoAudit) }))
    .filter((x) => x.labels.length > 0);

  const hasIssues =
    keyFailures.length > 0 ||
    sitemapFailures.length > 0 ||
    langMismatches.length > 0 ||
    seoIssues.length > 0;

  if (!hasIssues) {
    return (
      <div className="rounded-lg border border-black/10 p-4 text-sm text-neutral-500 dark:border-white/10">
        No issues detected. Run the bulk actions above to check for problems.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
      <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">Issues</h2>
      <div className="mt-3 flex flex-col gap-4 text-sm">
        {keyFailures.length > 0 && (
          <div>
            <h3 className="font-medium text-neutral-700 dark:text-neutral-300">
              Key verification failures ({keyFailures.length})
            </h3>
            <ul className="mt-1 flex flex-col gap-1">
              {keyFailures.map((d) => (
                <li key={d.id} className="text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium">{d.host}</span>
                  {d.keyVerification.http_status
                    ? ` — HTTP ${d.keyVerification.http_status}`
                    : d.keyVerification.error_message
                      ? ` — ${d.keyVerification.error_message}`
                      : ""}
                  {d.keyVerification.checked_at && (
                    <span className="text-neutral-400"> ({d.keyVerification.checked_at})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {sitemapFailures.length > 0 && (
          <div>
            <h3 className="font-medium text-neutral-700 dark:text-neutral-300">
              Sitemap failures ({sitemapFailures.length})
            </h3>
            <ul className="mt-1 flex flex-col gap-1">
              {sitemapFailures.map((d) => (
                <li key={d.id} className="text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium">{d.host}</span> — {d.sitemap.status}
                  {d.sitemap.error_message ? `: ${d.sitemap.error_message}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {langMismatches.length > 0 && (
          <div>
            <h3 className="font-medium text-neutral-700 dark:text-neutral-300">
              Language/country mismatches ({langMismatches.length})
            </h3>
            <ul className="mt-1 flex flex-col gap-1">
              {langMismatches.map((d) => (
                <li key={d.id} className="text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium">{d.host}</span> — tagged{" "}
                  <code>{d.lang.raw_lang}</code> but content looks Brazilian/Portuguese
                  {d.lang.pt_br_markers_found && d.lang.pt_br_markers_found.length > 0 && (
                    <span className="text-neutral-400">
                      {" "}
                      (markers: {d.lang.pt_br_markers_found.join(", ")})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {seoIssues.length > 0 && (
          <div>
            <h3 className="font-medium text-neutral-700 dark:text-neutral-300">
              SEO audit issues ({seoIssues.length})
            </h3>
            <ul className="mt-1 flex flex-col gap-1">
              {seoIssues.map(({ domain, labels }) => (
                <li key={domain.id} className="text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium">{domain.host}</span> — {labels.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
