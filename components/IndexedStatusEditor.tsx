"use client";

import { useState } from "react";

const SUGGESTIONS = ["Not verified", "Indexed", "Not indexed", "Pending"];

export default function IndexedStatusEditor({
  urlId,
  initialValue,
  onSaved,
}: {
  urlId: number;
  initialValue: string;
  onSaved: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value === initialValue) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/urls/${urlId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexedStatus: value }),
      });
      if (res.ok) onSaved(value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        list={`indexed-status-suggestions-${urlId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={saving}
        className="w-36 rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-white/15"
      />
      <datalist id={`indexed-status-suggestions-${urlId}`}>
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {saving && <span className="text-[10px] text-neutral-400">saving…</span>}
    </div>
  );
}
