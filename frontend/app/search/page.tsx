"use client";

import { useState } from "react";
import { BottomNav, Header, Page } from "@/components/ui";
import SearchBox from "@/components/SearchBox";
import {
  getAlternatives,
  manualMedicine,
  refreshLivePrices,
  taka,
  type MedicineResult,
  type SearchResult,
} from "@/lib/api";

type Found = Extract<MedicineResult, { found: true }>;

export default function SearchPage() {
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [result, setResult] = useState<Found | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "notfound" | "error">("idle");
  const [showAll, setShowAll] = useState(false);

  async function load(r: SearchResult) {
    setPicked(r);
    setResult(null);
    setShowAll(false);
    setStatus("loading");
    try {
      const med = [manualMedicine(r)];
      const data = await getAlternatives(med);
      const m = data.medicines[0];
      if (!m?.found) { setStatus("notfound"); return; }
      setResult(m);
      setStatus("idle");
      // Update this brand and the cheapest one with today's price, quietly
      refreshLivePrices([m.prescribed.brand_id, m.cheapest.brand_id])
        .then(async (x) => {
          if (x.updated.length) {
            const again = (await getAlternatives(med)).medicines[0];
            if (again?.found) setResult(again);
          }
        })
        .catch(() => {});
    } catch {
      setStatus("error");
    }
  }

  const cheaper = result ? result.all_options.filter((o) => o.price < result.prescribed.price) : [];
  const shown = showAll ? cheaper : cheaper.slice(0, 5);

  return (
    <Page>
      <Header title="Search medicine price" backHref="/" />
      <section className="flex flex-1 flex-col gap-3 p-5">
        <SearchBox autoFocus onPick={load} placeholder="Type a medicine name, e.g. Napa" />

        {status === "loading" && <p className="text-sm text-slate-600">Finding the price...</p>}
        {status === "notfound" && picked && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No price found for {picked.brand_name}.</p>
        )}
        {status === "error" && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Could not reach the server. Try again.</p>
        )}

        {result && (
          <>
            <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="text-xs text-slate-600">You searched</span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl font-bold">{result.prescribed.brand} {result.strength}</span>
                <span className="text-xl font-bold">{taka(result.prescribed.price)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>{result.generic} · {result.dosage_form} · {result.prescribed.manufacturer}</span>
                <span>{result.prescribed.unit}</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Price from {result.prescribed.source === "live" ? "MedEx (live)" : "dataset"}
                {result.prescribed.date ? `, ${result.prescribed.date}` : ""}
              </span>
              {result.no_substitute && (
                <p className="mt-1 rounded-lg border border-amber-400 bg-amber-50 p-2 text-xs text-amber-900">
                  <b>Ask your doctor first.</b> Switching brand is not advised for this medicine.
                </p>
              )}
            </div>

            <h2 className="text-sm font-semibold">
              {cheaper.length ? `Same generic, cheaper (${cheaper.length})` : "This is already the cheapest brand"}
            </h2>
            {cheaper.length > 0 && (
              <ul className="rounded-2xl border border-slate-200 bg-white px-3.5">
                {shown.map((o) => (
                  <li key={o.brand_id} className="flex items-center gap-2.5 border-b border-slate-100 py-2.5 last:border-0">
                    <span className="flex flex-1 flex-col">
                      <span className="text-sm font-semibold">{o.brand}</span>
                      <span className="text-xs text-slate-600">{o.manufacturer}</span>
                    </span>
                    {o.brand_id === result.cheapest.brand_id && (
                      <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-bold text-white">Cheapest</span>
                    )}
                    {o.brand_id === result.best.brand_id && (
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-bold text-white">Best</span>
                    )}
                    <span className="text-sm font-bold">{taka(o.price)}</span>
                  </li>
                ))}
                {cheaper.length > 5 && (
                  <li>
                    <button type="button" onClick={() => setShowAll(!showAll)}
                      className="min-h-11 w-full text-left text-sm font-semibold text-teal-700">
                      {showAll ? "Show fewer" : `See all ${cheaper.length} cheaper brands`}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </section>
      <BottomNav />
    </Page>
  );
}
