"use client";

import { useState } from "react";
import SearchBox from "./SearchBox";
import { Icon } from "./ui";
import { manualMedicine, type ScannedMedicine } from "@/lib/api";

const TIMES = ["Morning", "Noon", "Night"];
const MEALS = [
  { value: "before_meal", label: "Before meal" },
  { value: "after_meal", label: "After meal" },
  { value: "unknown", label: "Not sure" },
];
const UNITS = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "ongoing", label: "Ongoing" },
];

function parsePattern(p: string): number[] {
  const parts = (p || "").split("+").map((x) => parseInt(x.trim(), 10));
  return parts.length === 3 && parts.every((n) => !isNaN(n)) ? parts : [0, 0, 0];
}

function parseDuration(d: string): { amount: string; unit: string } {
  if (/continue|ongoing/i.test(d || "")) return { amount: "", unit: "ongoing" };
  const m = /(\d+)\s*(day|week|month)/i.exec(d || "");
  return m ? { amount: m[1], unit: m[2].toLowerCase() + "s" } : { amount: "", unit: "days" };
}

function buildDuration(amount: string, unit: string) {
  if (unit === "ongoing") return "continue";
  const n = parseInt(amount, 10);
  if (!n) return "";
  return `${n} ${n === 1 ? unit.replace(/s$/, "") : unit}`;
}

/** Edit a scanned medicine, or add a new one (initial = null). */
export default function MedicineForm({
  initial,
  onSave,
}: {
  initial: ScannedMedicine | null;
  onSave: (m: ScannedMedicine) => void;
}) {
  const [med, setMed] = useState<ScannedMedicine | null>(
    initial && initial.status !== "red" ? initial : null,
  );
  const [picking, setPicking] = useState(!initial || initial.status === "red");
  const [dose, setDose] = useState(parsePattern(initial?.dose_pattern ?? ""));
  const [meal, setMeal] = useState(
    MEALS.some((x) => x.value === initial?.meal_timing) ? initial!.meal_timing : "unknown",
  );
  const d0 = parseDuration(initial?.duration ?? "");
  const [amount, setAmount] = useState(d0.amount);
  const [unit, setUnit] = useState(d0.unit);

  const setCount = (i: number, delta: number) =>
    setDose(dose.map((v, j) => (j === i ? Math.min(9, Math.max(0, v + delta)) : v)));

  function save() {
    if (!med) return;
    onSave({
      ...med,
      raw_text: initial?.raw_text ?? "",
      dose_pattern: dose.some((n) => n > 0) ? dose.join("+") : "",
      meal_timing: meal,
      duration: buildDuration(amount, unit),
      status: "green",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Medicine */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-slate-700">Medicine</span>
        {picking ? (
          <>
            {initial?.raw_text && (
              <p className="text-xs italic text-slate-500">Read from photo: {initial.raw_text}</p>
            )}
            <SearchBox
              autoFocus
              placeholder="Search for the medicine..."
              onPick={(r) => {
                setMed({ ...manualMedicine(r), raw_text: initial?.raw_text ?? "" });
                setPicking(false);
              }}
            />
          </>
        ) : (
          med && (
            <div className="flex items-center gap-2 rounded-xl border-2 border-teal-700 bg-white p-3">
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">
                  {med.matched_brand || med.brand_name} {med.strength}
                </span>
                <span className="text-xs text-slate-600">{med.dosage_form}</span>
              </span>
              <button type="button" onClick={() => setPicking(true)} className="min-h-11 px-2 text-sm font-semibold text-teal-700">
                Change
              </button>
            </div>
          )
        )}
      </div>

      {/* Dose */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-slate-700">Dose (how many each time)</legend>
        <div className="flex gap-2">
          {TIMES.map((t, i) => (
            <div key={t} className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-1.5 py-2.5">
              <span className="text-xs font-medium text-slate-600">{t}</span>
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label={`Less in the ${t.toLowerCase()}`} onClick={() => setCount(i, -1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300">
                  <Icon name="minus" size={16} />
                </button>
                <span className="w-5 text-center text-xl font-bold" aria-live="polite">{dose[i]}</span>
                <button type="button" aria-label={`More in the ${t.toLowerCase()}`} onClick={() => setCount(i, 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300">
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <span className="text-xs text-slate-600">Written as {dose.join("+")}</span>
      </fieldset>

      {/* Meal */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-slate-700">When to take</legend>
        <div className="flex gap-1 rounded-xl bg-slate-200 p-1">
          {MEALS.map((m) => (
            <button key={m.value} type="button" aria-pressed={meal === m.value} onClick={() => setMeal(m.value)}
              className={`min-h-10 flex-1 rounded-lg text-sm font-semibold ${
                meal === m.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Duration */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-slate-700">For how long</legend>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="duration-amount">Number</label>
          <input id="duration-amount" inputMode="numeric" value={unit === "ongoing" ? "" : amount}
            disabled={unit === "ongoing"} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="0" className="w-20 rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold disabled:bg-slate-100" />
          <div className="flex flex-1 gap-1 rounded-xl bg-slate-200 p-1">
            {UNITS.map((u) => (
              <button key={u.value} type="button" aria-pressed={unit === u.value} onClick={() => setUnit(u.value)}
                className={`min-h-10 flex-1 rounded-lg text-xs font-semibold ${
                  unit === u.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <button type="button" disabled={!med} onClick={save}
        className="min-h-12 rounded-xl bg-teal-700 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
        {initial ? "Save changes" : "Add medicine"}
      </button>
    </div>
  );
}
