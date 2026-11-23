"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { AdSlot, BottomNav, Header, Icon, Page } from "@/components/ui";
import ResultsScreen from "@/components/ResultsScreen";
import {
  deletePrescription,
  durationDays,
  listPrescriptions,
  savePrescription,
  taka,
  type AlternativesResponse,
  type SavedPrescription,
  type ScannedMedicine,
} from "@/lib/api";
import { supabase, takePendingSave, useUser } from "@/lib/supabase";

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

type Pending = { medicines: ScannedMedicine[]; results: AlternativesResponse; label: string };

export default function SavedPage() {
  const { user, loading } = useUser();
  const [items, setItems] = useState<SavedPrescription[] | null>(null);
  const [open, setOpen] = useState<SavedPrescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Finish a save that was started before logging in
      const pending = takePendingSave<Pending>();
      if (pending) {
        await savePrescription(pending.medicines, pending.results, pending.label);
        setNotice(pending.label ? `Saved "${pending.label}".` : "Prescription saved.");
      }
      setItems(await listPrescriptions());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function remove(p: SavedPrescription) {
    if (!confirm(`Delete "${p.label || fmtDate(p.created_at)}"?`)) return;
    try {
      await deletePrescription(p.id);
      setItems((items ?? []).filter((x) => x.id !== p.id));
      setOpen(null);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (open) {
    return (
      <Page>
        <Header title={open.label || fmtDate(open.created_at)} onBack={() => setOpen(null)} />
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
        {loading && <p className="text-sm text-slate-600">Loading...</p>}

        {!loading && !user && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <Icon name="saved" size={32} className="text-teal-700" />
            <p className="font-semibold">Log in to see your saved prescriptions</p>
            <p className="text-sm text-slate-600">Your saved prescriptions stay with your account, on any phone.</p>
            <Link href="/login?next=/saved" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-teal-700 font-semibold text-white">
              Log in
            </Link>
            <Link href="/login?next=/saved&mode=signup" className="min-h-11 py-2 text-sm font-semibold text-teal-700">
              Create an account
            </Link>
          </div>
        )}

        {user && (
          <>
            {notice && <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
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
                    <span className="flex w-full items-start justify-between gap-2">
                      <span className="font-semibold">{p.label || fmtDate(p.created_at)}</span>
                      <span className="shrink-0 text-sm font-semibold text-teal-700">Saved {taka(p.total_saving)}</span>
                    </span>
                    {p.label && <span className="text-xs text-slate-500">{fmtDate(p.created_at)}</span>}
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
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 text-sm">
              <span className="truncate text-slate-600">{user.email}</span>
              <button type="button" onClick={() => supabase.auth.signOut()}
                className="min-h-11 shrink-0 px-2 font-semibold text-red-700">
                Log out
              </button>
            </div>
          </>
        )}
      </section>
      <BottomNav />
    </Page>
  );
}
