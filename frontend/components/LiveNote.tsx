import type { LiveProgress } from "@/lib/useLivePrices";

/** Progress of the MedEx price check, shown above the comparison. */
export default function LiveNote({ live }: { live: LiveProgress }) {
  if (live.phase === "idle") return null;

  if (live.phase === "checking") {
    const pct = live.total ? Math.round((live.done / live.total) * 100) : 0;
    return (
      <div role="status" className="flex flex-col gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
          Checking today&apos;s prices on MedEx: {live.done} of {live.total}
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <span className="block h-full rounded-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-slate-500">Prescribed, Cheapest, Best and Recommended of each medicine. The saving updates as prices come in.</span>
      </div>
    );
  }

  if (live.phase === "failed") {
    return (
      <div role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Could not get today&apos;s prices. Showing dataset prices.
      </div>
    );
  }

  const all = live.done >= live.total;
  return (
    <div role="status" className={`rounded-lg px-3 py-2 text-xs ${all ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900"}`}>
      {all
        ? "Prescribed, Cheapest, Best and Recommended prices are from MedEx today. Other brands under See all use dataset prices unless marked live."
        : `${live.done} of ${live.total} pick prices are from MedEx today. The rest${
            live.failed ? ` (${live.failed} could not be checked)` : ""
          } show dataset prices.`}
    </div>
  );
}
