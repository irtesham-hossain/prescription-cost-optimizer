"use client";

import { useEffect, useState } from "react";
import { searchMedicine, type SearchResult } from "@/lib/api";

// Type a name, see matching medicines, tap one to choose it.
export default function SearchBox({
  onPick,
  placeholder = "Search a medicine by name...",
  autoFocus = false,
}: {
  onPick: (r: SearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    // wait until the user stops typing for 300 ms
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchMedicine(q.trim()));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600"
      />
      {loading && <p className="mt-2 text-xs text-slate-500">Searching...</p>}
      {results.length > 0 && (
        <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setQ("");
                  setResults([]);
                }}
                className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-teal-50"
              >
                <span className="font-semibold">{r.brand_name}</span> {r.strength} {r.dosage_form}
                <span className="block text-xs text-slate-500">{r.manufacturer}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
