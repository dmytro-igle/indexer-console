import { NextResponse } from "next/server";
import { z } from "zod";
import { getDomainsByIds } from "@/lib/db/domains";
import { listUrlsWithGoogleTrackingId, updateIndexedStatus } from "@/lib/db/urls";
import { checkRocketIndexerStatus } from "@/lib/google/rocketIndexer";

const CHUNK_SIZE = 50;

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const bodySchema = z.object({ domainIds: z.array(z.number().int().positive()).optional() });

export async function POST(request: Request) {
  if (!process.env.ROCKETINDEXER_API_KEY) {
    return NextResponse.json(
      {
        error: {
          message: "RocketIndexer API key is not configured. Add ROCKETINDEXER_API_KEY to .env and restart.",
        },
      },
      { status: 400 }
    );
  }

  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json ?? {});
  const domainIds = parsed.success ? parsed.data.domainIds : undefined;

  const domains = getDomainsByIds(domainIds);
  const urls = listUrlsWithGoogleTrackingId(domainIds);

  if (urls.length === 0) {
    return NextResponse.json({
      data: {
        checked: 0,
        updated: 0,
        results: domains.map((d) => ({ domainId: d.id, host: d.host, checked: 0, updated: 0, error: null })),
      },
    });
  }

  const trackingIdToUrl = new Map(urls.map((u) => [u.last_google_tracking_id as number, u]));
  const perDomainCounts = new Map<number, { checked: number; updated: number; error: string | null }>();

  let totalChecked = 0;
  let totalUpdated = 0;
  let sharedError: string | null = null;

  for (const idChunk of chunk(Array.from(trackingIdToUrl.keys()), CHUNK_SIZE)) {
    const result = await checkRocketIndexerStatus(idChunk);
    if (!result.ok) {
      sharedError = result.errorMessage;
      continue;
    }
    for (const item of result.items) {
      const urlRow = trackingIdToUrl.get(item.trackingId);
      if (!urlRow) continue;
      totalChecked++;
      const counts = perDomainCounts.get(urlRow.domain_id) ?? { checked: 0, updated: 0, error: null };
      counts.checked++;

      if (item.indexedStatus) {
        updateIndexedStatus(urlRow.id, titleCase(item.indexedStatus));
        totalUpdated++;
        counts.updated++;
      }
      perDomainCounts.set(urlRow.domain_id, counts);
    }
  }

  const results = domains.map((d) => {
    const counts = perDomainCounts.get(d.id);
    return {
      domainId: d.id,
      host: d.host,
      checked: counts?.checked ?? 0,
      updated: counts?.updated ?? 0,
      error: sharedError,
    };
  });

  return NextResponse.json({
    data: { checked: totalChecked, updated: totalUpdated, results },
  });
}
