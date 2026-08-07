export interface ParsedDomainEntry {
  host: string;
  key: string;
  keyLocation?: string;
}

const HOST_REGEX =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const KEY_REGEX = /^[a-f0-9]{8,128}$/i;
const URL_REGEX = /^https?:\/\//i;

/**
 * Parses a free-form pasted list of domains into host/key/keyLocation
 * entries. Tolerant of the messy real-world formats people actually paste:
 * "host: key;", "host  key", "host  key  keyLocation", or a host and its
 * key on separate lines. Works by walking whitespace-separated tokens (with
 * surrounding punctuation stripped) rather than requiring one fixed
 * delimiter or one entry per line.
 */
export function parseDomainList(text: string): {
  entries: ParsedDomainEntry[];
  unparsedTokens: string[];
  incompleteHosts: string[];
} {
  const rawTokens = text.split(/\s+/).filter(Boolean);
  const tokens = rawTokens
    .map((t) => (URL_REGEX.test(t) ? t.replace(/[;,]+$/, "") : t.replace(/^[:;,|()[\]{}]+|[:;,|()[\]{}]+$/g, "")))
    .filter(Boolean);

  const entries: ParsedDomainEntry[] = [];
  const unparsedTokens: string[] = [];
  const incompleteHosts: string[] = [];

  let pendingHost: string | null = null;
  let pendingEntry: ParsedDomainEntry | null = null;

  for (const token of tokens) {
    if (KEY_REGEX.test(token) && !HOST_REGEX.test(token)) {
      if (pendingHost) {
        const entry: ParsedDomainEntry = { host: pendingHost, key: token };
        entries.push(entry);
        pendingEntry = entry;
        pendingHost = null;
      } else {
        unparsedTokens.push(token);
      }
      continue;
    }

    if (URL_REGEX.test(token)) {
      if (pendingEntry && !pendingEntry.keyLocation) {
        pendingEntry.keyLocation = token;
      } else {
        unparsedTokens.push(token);
      }
      continue;
    }

    if (HOST_REGEX.test(token) && !KEY_REGEX.test(token)) {
      if (pendingHost) incompleteHosts.push(pendingHost);
      pendingHost = token.toLowerCase();
      pendingEntry = null;
      continue;
    }

    unparsedTokens.push(token);
  }

  if (pendingHost) incompleteHosts.push(pendingHost);

  return { entries, unparsedTokens, incompleteHosts };
}
