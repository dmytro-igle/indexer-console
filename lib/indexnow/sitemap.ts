import { XMLParser } from "fast-xml-parser";
import { fetchWithTimeout } from "@/lib/http";
import type { SitemapFetchResult } from "./types";

const MAX_DEPTH = 3;
const MAX_URLS = 20_000;

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (tagName) => tagName === "sitemap" || tagName === "url",
});

interface ParsedSitemap {
  urls: string[];
  subSitemaps: string[];
}

function parseSitemapXml(xml: string): ParsedSitemap {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return { urls: [], subSitemaps: [] };
  }

  const root = doc as {
    sitemapindex?: { sitemap?: { loc?: string }[] };
    urlset?: { url?: { loc?: string }[] };
  };

  if (root.sitemapindex?.sitemap) {
    const subSitemaps = root.sitemapindex.sitemap
      .map((s) => s.loc?.trim())
      .filter((loc): loc is string => Boolean(loc));
    return { urls: [], subSitemaps };
  }

  if (root.urlset?.url) {
    const urls = root.urlset.url
      .map((u) => u.loc?.trim())
      .filter((loc): loc is string => Boolean(loc));
    return { urls, subSitemaps: [] };
  }

  return { urls: [], subSitemaps: [] };
}

async function fetchSitemapRecursive(
  url: string,
  depth: number,
  visited: Set<string>,
  acc: { urls: string[]; sitemapsVisited: string[]; errors: string[] }
): Promise<void> {
  if (visited.has(url) || depth > MAX_DEPTH || acc.urls.length >= MAX_URLS) {
    return;
  }
  visited.add(url);
  acc.sitemapsVisited.push(url);

  const result = await fetchWithTimeout(url, { timeoutMs: 10_000 });
  if (!result.ok || !result.body) {
    acc.errors.push(
      `${url}: ${result.status ? `HTTP ${result.status}` : result.error ?? "fetch failed"}`
    );
    return;
  }

  const { urls, subSitemaps } = parseSitemapXml(result.body);
  acc.urls.push(...urls);

  for (const sub of subSitemaps) {
    if (acc.urls.length >= MAX_URLS) break;
    await fetchSitemapRecursive(sub, depth + 1, visited, acc);
  }
}

export async function fetchDomainSitemap(host: string): Promise<SitemapFetchResult> {
  const rootUrl = `https://${host}/sitemap.xml`;
  const acc = { urls: [] as string[], sitemapsVisited: [] as string[], errors: [] as string[] };

  await fetchSitemapRecursive(rootUrl, 0, new Set(), acc);

  const dedupedUrls = Array.from(new Set(acc.urls));

  let status: SitemapFetchResult["status"];
  if (acc.sitemapsVisited.length === 1 && acc.errors.length > 0) {
    status = "failed";
  } else if (acc.errors.length > 0) {
    status = "partial";
  } else {
    status = "success";
  }

  return {
    status,
    urls: dedupedUrls,
    sitemapsVisited: acc.sitemapsVisited,
    errors: acc.errors,
  };
}
