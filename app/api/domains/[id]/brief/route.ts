import { NextResponse } from "next/server";
import { getDomainById } from "@/lib/db/domains";
import { getSeoAuditById } from "@/lib/db/seoAudits";
import { getSitemapRunById } from "@/lib/db/sitemapRuns";
import { generateBriefDocx } from "@/lib/brief/generateBrief";

export async function GET(request: Request, ctx: RouteContext<"/api/domains/[id]/brief">) {
  const { id } = await ctx.params;
  const domain = getDomainById(Number(id));
  if (!domain) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }
  if (!domain.last_seo_audit_id) {
    return NextResponse.json(
      { error: { message: "Run an SEO audit for this domain before generating a brief." } },
      { status: 409 }
    );
  }

  const seoAudit = getSeoAuditById(domain.last_seo_audit_id) ?? null;
  const sitemapRun = domain.last_sitemap_run_id ? getSitemapRunById(domain.last_sitemap_run_id) : null;

  const url = new URL(request.url);
  const owner = url.searchParams.get("owner")?.trim() || undefined;
  const priority = url.searchParams.get("priority")?.trim() || undefined;
  const deadline = url.searchParams.get("deadline")?.trim() || undefined;

  const buffer = await generateBriefDocx({
    domain,
    seoAudit,
    sitemapStatus: sitemapRun?.status ?? null,
    owner,
    priority,
    deadline,
  });

  const date = new Date().toISOString().slice(0, 10);
  const safeHost = domain.host.replace(/[^a-z0-9.-]/gi, "_");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="developer-task-${safeHost}-${date}.docx"`,
    },
  });
}
