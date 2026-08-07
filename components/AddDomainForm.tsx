"use client";

import { useState } from "react";
import { parseDomainList, type ParsedDomainEntry } from "@/lib/domainParsing";
import StatusBadge from "./StatusBadge";

interface EntryResult {
  host: string;
  status: "added" | "duplicate" | "error";
  message?: string;
}

const PLACEHOLDER = `Paste one or many domains, in any of these shapes:

example.com  faac612dbf83431ca0b07346cb00e881
another.com: 9c6e13d60b614469b5bab56f013874c2;
third.com
1b25071e1d1f40b7947b393cbf1c45a2

Optionally add a key location URL after the key to override the default.`;

export default function AddDomainForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<EntryResult[] | null>(null);
  const [unparsedTokens, setUnparsedTokens] = useState<string[]>([]);
  const [incompleteHosts, setIncompleteHosts] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  function reset() {
    setText("");
    setResults(null);
    setUnparsedTokens([]);
    setIncompleteHosts([]);
    setParseError(null);
  }

  async function createOne(entry: ParsedDomainEntry): Promise<EntryResult> {
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (res.status === 201) return { host: entry.host, status: "added" };
    if (res.status === 409) return { host: entry.host, status: "duplicate", message: "Already exists" };
    const body = await res.json().catch(() => null);
    return { host: entry.host, status: "error", message: body?.error?.message ?? `HTTP ${res.status}` };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParseError(null);
    const { entries, unparsedTokens, incompleteHosts } = parseDomainList(text);

    if (entries.length === 0) {
      setParseError("No valid host/key pairs found in the pasted text.");
      setUnparsedTokens(unparsedTokens);
      setIncompleteHosts(incompleteHosts);
      return;
    }

    setPending(true);
    setResults(null);
    try {
      const out: EntryResult[] = [];
      for (const entry of entries) {
        out.push(await createOne(entry));
      }
      setResults(out);
      setUnparsedTokens(unparsedTokens);
      setIncompleteHosts(incompleteHosts);
      if (out.some((r) => r.status === "added")) {
        onAdded();
      }
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-white/15 dark:hover:bg-neutral-800"
      >
        + Add domains
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-black/10 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-neutral-900"
      >
        <h2 className="text-base font-semibold">Add domains</h2>
        <p className="text-xs text-neutral-500">
          Add as many as you need at once — one per line or pasted straight from a spreadsheet.
          Key location defaults to <code>https://&lt;host&gt;/&lt;key&gt;.txt</code> unless you
          include a URL.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 dark:border-white/15"
        />

        {parseError && <p className="text-sm text-red-600">{parseError}</p>}

        {(unparsedTokens.length > 0 || incompleteHosts.length > 0) && (
          <div className="rounded-md bg-yellow-50 p-2 text-xs text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
            {incompleteHosts.length > 0 && (
              <p>Host(s) with no key found nearby: {incompleteHosts.join(", ")}</p>
            )}
            {unparsedTokens.length > 0 && (
              <p>Couldn&apos;t interpret: {unparsedTokens.join(", ")}</p>
            )}
          </div>
        )}

        {results && (
          <div className="flex flex-col gap-1 rounded-md border border-black/10 p-2 dark:border-white/10">
            {results.map((r, i) => (
              <div key={`${r.host}-${i}`} className="flex items-center justify-between text-xs">
                <span className="font-mono">{r.host}</span>
                <span className="flex items-center gap-2">
                  {r.message && <span className="text-neutral-400">{r.message}</span>}
                  <StatusBadge
                    label={r.status}
                    tone={r.status === "added" ? "green" : r.status === "duplicate" ? "yellow" : "red"}
                  />
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {results ? "Close" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={pending || text.trim().length === 0}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add domains"}
          </button>
        </div>
      </form>
    </div>
  );
}
