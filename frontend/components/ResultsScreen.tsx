"use client";

import { useState } from "react";
import { taka, type AlternativesResponse, type MedicineResult, type Option } from "@/lib/api";

type Pick = "prescribed" | "cheapest" | "best" | "recommended";

const TAGS: { key: Pick; label: string; style: string }[] = [
  { key: "cheapest", label: "Cheapest", style: "bg-teal-700 text-white" },
  { key: "best", label: "Best", style: "bg-slate-700 text-white" },
  { key: "recommended", label: "Recommended", style: "bg-amber-400 text-slate-900" },
  { key: "prescribed", label: "Prescribed", style: "bg-slate-200 text-slate-800" },
];

type Found = Extract<MedicineResult, { found: true }>;

function OptionRow({
  tag,
  option,
  selected,
  onSelect,
}: {
  tag: (typeof TAGS)[number];
  option: Option;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-lg border-2 px-2.5 py-2 text-left text-sm ${
        selected ? "border-teal-700 bg-teal-50" : "border-transparent hover:bg-slate-50"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tag.style}`}>{tag.label}</span>
        <span>
          <span className="font-semibold">{option.brand}</span>
          <span className="block text-xs text-slate-500">{option.manufacturer}</span>
        </span>
      </span>
      <span className="text-right font-semibold">
        {taka(option.price)}
        <span className="block text-[11px] font-normal text-slate-500">{option.unit}</span>
      </span>
    </button>
  );
}

function MedicineCard({ m, pick, setPick }: { m: Found; pick: Pick; setPick: (p: Pick) => void }) {
  const [showAll, setShowAll] = useState(false);
  const chosen = m[pick];
  const saving = Math.max((m.prescribed.price - chosen.price) * m.quantity, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2">
        <p className="font-semibold">
          {m.prescribed.brand} {m.strength}
        </p>
        <p className="text-xs text-slate-500">
          {m.generic}, {m.dosage_form}
        </p>
      </div>

      {m.no_substitute && (
        <div className="mb-2 rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          <b>Ask your doctor first.</b> Switching brand is not advised for this medicine.
        </div>
      )}

      <div className="space-y-1">
        {TAGS.map((t) => (
          <OptionRow key={t.key} tag={t} option={m[t.key]} selected={pick === t.key} onSelect={() => setPick(t.key)} />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          Price from {m.prescribed.source}
          {m.prescribed.date ? `, ${m.prescribed.date}` : ""}
        </span>
        {saving > 0 && <span className="font-semibold text-teal-700">Save {taka(saving)}</span>}
      </div>

      <button onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-semibold text-teal-700">
        {showAll ? "Hide" : `See all ${m.all_options.length} brands`}
      </button>
      {showAll && (
        <ul className="mt-2 max-h-64 overflow-y-auto border-t border-slate-100 text-sm">
          {m.all_options.map((o) => (
            <li key={o.brand_id} className="flex justify-between border-b border-slate-100 py-1.5">
              <span>
                {o.brand} <span className="text-xs text-slate-500">{o.manufacturer}</span>
              </span>
              <span className="font-medium">{taka(o.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ResultsScreen({ data, onRestart }: { data: AlternativesResponse; onRestart: () => void }) {
  const found = data.medicines.filter((m): m is Found => m.found);
  const missing = data.medicines.filter((m) => !m.found);

  // Recommended is chosen by default; the user can tap another option
  const [picks, setPicks] = useState<Pick[]>(found.map(() => "recommended"));

  const prescribedTotal = found.reduce((s, m) => s + m.prescribed.price * m.quantity, 0);
  const chosenTotal = found.reduce((s, m, i) => s + m[picks[i]].price * m.quantity, 0);
  const saving = Math.max(prescribedTotal - chosenTotal, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-teal-700 bg-teal-50 p-4 text-center">
        <p className="text-sm text-slate-600">Total you could save</p>
        <p className="text-3xl font-bold text-teal-900">{taka(saving)}</p>
        <p className="text-xs text-slate-500">
          Prescription total {taka(prescribedTotal)}, with your picks {taka(chosenTotal)}
        </p>
      </div>

      {found.map((m, i) => (
        <MedicineCard
          key={i}
          m={m}
          pick={picks[i]}
          setPick={(p) => setPicks(picks.map((x, j) => (j === i ? p : x)))}
        />
      ))}

      {missing.map((m, i) => (
        <div key={`x${i}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
          <b>{m.input}</b>: no price or alternatives found.
        </div>
      ))}

      <p className="text-xs text-slate-500">
        Prices are from a past dataset snapshot and may differ in the pharmacy. Always check with your doctor or
        pharmacist before switching.
      </p>

      <button onClick={onRestart} className="w-full rounded-xl bg-teal-700 py-3 font-semibold text-white">
        Scan another prescription
      </button>
    </div>
  );
}
