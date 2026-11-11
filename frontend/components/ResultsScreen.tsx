"use client";

import { useState } from "react";
import { AdSlot, Icon } from "./ui";
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
        <span className="block text-[11px] font-normal text-slate-500">
          {option.unit}
          {option.source === "live" && <span className="ml-1 font-semibold text-teal-700">live</span>}
        </span>
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
          Price from {m.prescribed.source === "live" ? "MedEx (live)" : "dataset"}
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

const LIVE_NOTE = {
  idle: null,
  checking: { text: "Checking today's prices on MedEx...", style: "bg-slate-100 text-slate-700" },
  done: { text: "Updated with today's prices where available.", style: "bg-teal-50 text-teal-800" },
  failed: { text: "Could not get today's prices. Showing dataset prices.", style: "bg-amber-50 text-amber-900" },
};

function shareText(found: Found[], picks: Pick[], saving: number) {
  const lines = found.map((m, i) => {
    const c = m[picks[i]];
    const qty = m.quantity > 1 && c.unit === "per unit" ? `, ${m.quantity} tablets` : "";
    return `${i + 1}. ${m.prescribed.brand} ${m.strength}: buy ${c.brand} (${c.manufacturer})${qty}`;
  });
  return [
    "My medicine list",
    ...lines,
    `Possible saving: ${taka(saving)}`,
    "Same generic, strength and form. Please check with the doctor or pharmacist.",
  ].join("\n");
}

export default function ResultsScreen({
  data,
  live = "idle",
  onSave,
  saved = false,
  onRestart,
}: {
  data: AlternativesResponse;
  live?: keyof typeof LIVE_NOTE;
  onSave?: (label: string) => Promise<void>;
  saved?: boolean;
  onRestart?: () => void;
}) {
  const found = data.medicines.filter((m): m is Found => m.found);
  const missing = data.medicines.filter((m) => !m.found);

  // Recommended is chosen by default; the user can tap another option
  const [picks, setPicks] = useState<Pick[]>(found.map(() => "recommended"));
  const [showPharmacist, setShowPharmacist] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(saved ? "saved" : "idle");
  // After every scan, ask once whether to save it, with a label
  const [askSave, setAskSave] = useState(Boolean(onSave) && !saved);
  const [label, setLabel] = useState("");

  const prescribedTotal = found.reduce((s, m) => s + m.prescribed.price * m.quantity, 0);
  const chosenTotal = found.reduce((s, m, i) => s + m[picks[i]].price * m.quantity, 0);
  const saving = Math.max(prescribedTotal - chosenTotal, 0);
  const note = LIVE_NOTE[live];

  async function share() {
    const text = shareText(found, picks, saving);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      return; // user closed the share sheet
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function save() {
    if (!onSave || saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    try {
      await onSave(label);
      setSaveState("saved");
      setAskSave(false);
    } catch {
      setSaveState("error");
    }
  }

  const action = "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-1 text-xs font-semibold text-teal-800";

  return (
    <div className="flex flex-col gap-3">
      {note && (
        <div role="status" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${note.style}`}>
          {live === "checking" && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
          )}
          {note.text}
        </div>
      )}

      <div className="rounded-2xl border-2 border-teal-700 bg-teal-50 p-4 text-center">
        <p className="text-sm text-slate-600">You could save</p>
        <p className="text-3xl font-bold text-teal-900">{taka(saving)}</p>
        <p className="text-xs text-slate-600">
          Prescribed {taka(prescribedTotal)} · with your picks {taka(chosenTotal)}
        </p>
      </div>

      <div className={`grid gap-2 ${onSave || saved ? "grid-cols-3" : "grid-cols-2"}`}>
        <button type="button" onClick={share} className={action}>
          <Icon name="share" size={20} /> Share list
        </button>
        <button type="button" onClick={() => setShowPharmacist(true)} className={action}>
          <Icon name="show" size={20} /> Show pharmacist
        </button>
        {(onSave || saved) && (
          <button type="button" onClick={() => setAskSave(true)} disabled={saveState === "saved"} className={action}>
            <Icon name={saveState === "saved" ? "check" : "saved"} size={20} />
            {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Try again" : "Save"}
          </button>
        )}
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

      <p className="text-xs text-slate-600">
        Prices marked live come from MedEx; others are from a past dataset snapshot and may differ in the pharmacy.
        Always check with your doctor or pharmacist before switching.
      </p>

      {/* Ad sits below the comparison, never inside it */}
      <AdSlot compact text="Order these medicines from a partner pharmacy, delivered home" />

      {onRestart && (
        <button type="button" onClick={onRestart} className="min-h-12 rounded-xl bg-teal-700 font-semibold text-white">
          Scan another prescription
        </button>
      )}

      {askSave && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 sm:items-center">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title"
            onSubmit={(e) => { e.preventDefault(); save(); }}
            className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white p-5 sm:rounded-3xl"
          >
            <h2 id="save-title" className="text-lg font-bold">Save this prescription?</h2>
            <p className="text-sm text-slate-600">
              Find it later in Saved prescriptions, with your saving of {taka(saving)}.
            </p>
            <label htmlFor="save-label" className="text-sm font-semibold text-slate-700">Label</label>
            <input
              id="save-label"
              autoFocus
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Mother's BP medicine"
              className="min-h-12 rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-teal-600"
            />
            {saveState === "error" && (
              <p role="alert" className="text-sm text-red-700">Could not save. Try again.</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setAskSave(false)}
                className="min-h-12 flex-1 rounded-xl border-2 border-slate-300 font-semibold text-slate-700">
                Not now
              </button>
              <button type="submit" disabled={saveState === "saving"}
                className="min-h-12 flex-1 rounded-xl bg-teal-700 font-semibold text-white disabled:bg-slate-300">
                {saveState === "saving" ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showPharmacist && (
        <div role="dialog" aria-modal="true" aria-label="Medicine list for the pharmacist"
          className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <div className="mx-auto flex max-w-md flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Please give me these medicines</h2>
              <button type="button" aria-label="Close" onClick={() => setShowPharmacist(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                <Icon name="close" />
              </button>
            </div>
            <ol className="flex flex-col gap-3">
              {found.map((m, i) => {
                const c = m[picks[i]];
                return (
                  <li key={i} className="rounded-2xl border-2 border-slate-200 p-4">
                    <p className="text-2xl font-bold">{c.brand} {m.strength}</p>
                    <p className="text-base text-slate-700">{m.dosage_form} · {c.manufacturer}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Generic: {m.generic}
                      {m.quantity > 1 && c.unit === "per unit" ? ` · ${m.quantity} tablets` : ""}
                    </p>
                    {c.brand !== m.prescribed.brand && (
                      <p className="mt-1 text-sm text-slate-600">Instead of {m.prescribed.brand}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
