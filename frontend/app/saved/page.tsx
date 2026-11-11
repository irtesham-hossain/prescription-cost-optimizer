"use client";

import { Fragment, useEffect, useState } from "react";
import { AdSlot, BottomNav, Header, Icon, Page } from "@/components/ui";
import ResultsScreen from "@/components/ResultsScreen";
import {
  deletePrescription,
  durationDays,
  listPrescriptions,
  taka,
  type SavedPrescription,
} from "@/lib/api";

const DAY = 24 * 60 * 60 * 1000;

/** The medicine that runs out soonest (within 5 days), for a refill reminder. */
function refillNote(p: SavedPrescription): string | null {
  const age = Math.floor((Date.now() - new Date(p.created_at).getTime()) / DAY);
  let best: { name: string; left: number } | null = null;
  for (const m of p.medicines ?? []) {
    const days = durationDays(m.duration);
    if (days === null) continue;
    const left = days - age;
    if (left >= 0 && left <= 5 && (!best || left < best.left)) best = { name: m.matched_brand || m.brand_name, left };
  }
  if (!best) return null;
  return best.left === 0 ? `${best.name} runs out today` : `${best.name} runs out in ${best.left} day${best.left > 1 ? "s" : ""}`;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function SavedPage() {
  const [items, setItems] = useState<SavedPrescription[] | null>(null);
  const [open, setOpen] = useState<SavedPrescription | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listPrescriptions().then(setItems).catch(() => setError(true));
  }, []);

  async function remove(p: SavedPrescription) {
    if (!confirm(`Delete the prescription from ${fmtDate(p.created_at)}?`)) return;
    try {
      await deletePrescription(p.id);
      setItems((items ?? []).filter((x) => x.id !== p.id));
      setOpen(null);
    } catch {
      alert("Could not delete. Try again.");
    }
  }

  if (open) {
    return (
      <Page>
        <Header title={fmtDate(open.created_at)} onBack={() => setOpen(null)} />
        <section className="flex flex-1 flex-col gap-3 p-5">
          <ResultsScreen data={open.results} saved />
          <button type="button" onClick={() => remove(open)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-red-700 font-semibold text-red-700">
            <Icon name="trash" size={18} /> Delete this prescription
          </button>
        </section>
      </Page>
    );
  }

  return (
    <Page>
      <Header title="Saved prescriptions" backHref="/" />
      <section className="flex flex-1 flex-col gap-3 p-5">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Could not load your saved prescriptions.</p>}
        {items === null && !error && <p className="text-sm text-slate-600">Loading...</p>}
        {items?.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <Icon name="saved" size={32} className="text-slate-400" />
            <p className="font-semibold">No saved prescriptions yet</p>
            <p className="text-sm text-slate-600">After a scan, tap Save on the results page.</p>
          </div>
        )}
        {items?.map((p, i) => {
          const note = refillNote(p);
          return (
            <Fragment key={p.id}>
              <button type="button" onClick={() => setOpen(p)}
                className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-3.5 text-left">
                <span className="flex w-full items-center justify-between">
                  <span className="font-semibold">{fmtDate(p.created_at)}</span>
                  <span className="text-sm font-semibold text-teal-700">Saved {taka(p.total_saving)}</span>
                </span>
                <span className="text-[13px] text-slate-600">{p.title}</span>
                {note && (
                  <span className="flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    <Icon name="bell" size={13} /> {note}
                  </span>
                )}
              </button>
              {i === 0 && items.length > 1 && <AdSlot compact text="Small banner for a health partner" />}
            </Fragment>
          );
        })}
        <p className="text-xs text-slate-500">Saved on this phone. Login to keep them on every device is coming later.</p>
      </section>
      <BottomNav />
    </Page>
  );
}
