"use client";

import { useState } from "react";
import SearchBox from "./SearchBox";
import { manualMedicine, type ScannedMedicine } from "@/lib/api";

const STATUS = {
  green: { dot: "bg-green-600", border: "border-slate-200", label: "Sure" },
  amber: { dot: "bg-amber-500", border: "border-amber-400", label: "Check" },
  red: { dot: "bg-red-600", border: "border-red-500", label: "Fix" },
};

export default function ConfirmScreen({
  medicines,
  setMedicines,
  onConfirm,
  onBack,
  error,
}: {
  medicines: ScannedMedicine[];
  setMedicines: (m: ScannedMedicine[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  error: string | null;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const update = (i: number, m: ScannedMedicine) => setMedicines(medicines.map((x, j) => (j === i ? m : x)));
  const remove = (i: number) => setMedicines(medicines.filter((_, j) => j !== i));
  const unresolved = medicines.filter((m) => m.status === "red").length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Check what we read. Fix any card that is not right, then confirm.</p>

      {medicines.map((m, i) => {
        const s = STATUS[m.status];
        const name = m.matched_brand || m.brand_name || "Could not read";
        return (
          <div key={i} className={`rounded-xl border-2 bg-white p-3 ${s.border}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {m.status === "red" ? "Could not read" : name} {m.status !== "red" && m.strength}
                </p>
                <p className="text-xs text-slate-500">
                  {[m.dosage_form, m.dose_pattern, m.duration].filter(Boolean).join(", ")}
                </p>
                {m.raw_text && <p className="mt-1 text-xs italic text-slate-400">Read as: {m.raw_text}</p>}
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
                <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </div>

            {m.status === "amber" && editing !== i && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span>
                  Did you mean <b>{m.matched_brand}</b>?
                </span>
                <button
                  onClick={() => update(i, { ...m, status: "green" })}
                  className="rounded-md bg-teal-700 px-3 py-1 text-xs font-semibold text-white"
                >
                  Yes
                </button>
                <button onClick={() => setEditing(i)} className="text-xs font-semibold text-teal-700 underline">
                  No, change
                </button>
              </div>
            )}

            {(m.status === "red" || editing === i) && (
              <div className="mt-2">
                <SearchBox
                  autoFocus={editing === i}
                  placeholder="Search for the correct medicine..."
                  onPick={(r) => {
                    update(i, {
                      ...m,
                      brand_name: r.brand_name,
                      matched_brand: r.brand_name,
                      strength: r.strength,
                      dosage_form: r.dosage_form,
                      status: "green",
                    });
                    setEditing(null);
                  }}
                />
              </div>
            )}

            <div className="mt-2 flex gap-4 text-xs">
              {m.status === "green" && editing !== i && (
                <button onClick={() => setEditing(i)} className="font-semibold text-teal-700">
                  Change
                </button>
              )}
              <button onClick={() => remove(i)} className="font-semibold text-red-700">
                Remove
              </button>
            </div>
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-xl border-2 border-teal-700 bg-white p-3">
          <SearchBox
            autoFocus
            onPick={(r) => {
              setMedicines([...medicines, manualMedicine(r)]);
              setAdding(false);
            }}
          />
          <button onClick={() => setAdding(false)} className="mt-2 text-xs font-semibold text-slate-500">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border-2 border-teal-700 py-2.5 font-semibold text-teal-700"
        >
          + Add a medicine
        </button>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <button
        disabled={medicines.length === 0 || unresolved > 0}
        onClick={onConfirm}
        className="w-full rounded-xl bg-teal-700 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {unresolved > 0
          ? `Fix ${unresolved} red card${unresolved > 1 ? "s" : ""} first`
          : `Confirm ${medicines.length} medicine${medicines.length === 1 ? "" : "s"}`}
      </button>
      <button onClick={onBack} className="w-full py-2 text-sm text-slate-500">
        Start again
      </button>
    </div>
  );
}
