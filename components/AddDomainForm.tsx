"use client";

import { useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";

interface EntryResult {
  host: string;
  status: "added" | "duplicate" | "error";
  message?: string;
}

interface DomainKeyRow {
  domain: string;
  key: string;
}

function emptyRow(): DomainKeyRow {
  return { domain: "", key: "" };
}

export default function AddDomainForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DomainKeyRow[]>([emptyRow()]);
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<EntryResult[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function reset() {
    setRows([emptyRow()]);
    setResults(null);
    setParseError(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateRow(index: number, field: keyof DomainKeyRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function createOne(host: string, key: string): Promise<EntryResult> {
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, key }),
    });
    if (res.status === 201) return { host, status: "added" };
    if (res.status === 409) return { host, status: "duplicate", message: "Already exists" };
    const body = await res.json().catch(() => null);
    return { host, status: "error", message: body?.error?.message ?? `HTTP ${res.status}` };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParseError(null);

    const entries = rows
      .map((r) => ({ domain: r.domain.trim().toLowerCase(), key: r.key.trim() }))
      .filter((r) => r.domain.length > 0);

    if (entries.length === 0) {
      setParseError("Enter at least one domain.");
      return;
    }

    setPending(true);
    setResults(null);
    try {
      const out: EntryResult[] = [];
      for (const entry of entries) {
        out.push(await createOne(entry.domain, entry.key));
      }
      setResults(out);
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
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-black/10 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-neutral-900"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          ✕
        </button>

        <h2 className="pr-6 text-base font-semibold">Add domains</h2>
        <p className="text-xs text-neutral-500">
          Key location defaults to <code>https://&lt;host&gt;/&lt;key&gt;.txt</code>; edit it on
          the domain page afterward if you need a different URL.
        </p>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-neutral-500">
            <span>Domain</span>
            <span>Key</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input
                value={row.domain}
                onChange={(e) => updateRow(i, "domain", e.target.value)}
                placeholder="example.com"
                className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 dark:border-white/15"
              />
              <input
                value={row.key}
                onChange={(e) => updateRow(i, "key", e.target.value)}
                placeholder="faac612dbf83431ca0b07346cb00e881"
                className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 dark:border-white/15"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                aria-label="Remove domain"
                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div>
          <button
            type="button"
            onClick={addRow}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-white/15 dark:hover:bg-neutral-800"
          >
            + Add another domain
          </button>
        </div>

        {parseError && <p className="text-sm text-red-600">{parseError}</p>}

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
            onClick={close}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {results ? "Close" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={pending || rows.every((r) => r.domain.trim().length === 0)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add domains"}
          </button>
        </div>
      </form>
    </div>
  );
}
