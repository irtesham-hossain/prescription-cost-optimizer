"use client";

import { Icon } from "./ui";
import { describeDose, type ScannedMedicine } from "@/lib/api";

export default function ConfirmScreen({
  medicines,
  imageUrl,
  setMedicines,
  onEdit,
  onAdd,
  onViewImage,
  onConfirm,
  error,
}: {
  medicines: ScannedMedicine[];
  imageUrl: string | null;
  setMedicines: (m: ScannedMedicine[]) => void;
  onEdit: (index: number) => void;
  onAdd: () => void;
  onViewImage: () => void;
  onConfirm: () => void;
  error: string | null;
}) {
  const update = (i: number, m: ScannedMedicine) => setMedicines(medicines.map((x, j) => (j === i ? m : x)));
  const remove = (i: number) => setMedicines(medicines.filter((_, j) => j !== i));
  const unresolved = medicines.filter((m) => m.status === "red").length;
  const toCheck = medicines.filter((m) => m.status !== "green").length;

  return (
    <div className="flex flex-col gap-3">
      {imageUrl && (
        <button type="button" onClick={onViewImage}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-13 w-13 rounded-lg bg-slate-200 object-cover" />
          <span className="flex flex-1 flex-col">
            <span className="font-semibold">View prescription</span>
            <span className="text-xs text-slate-600">Compare the photo with what we read</span>
          </span>
          <Icon name="chev" className="text-slate-500" />
        </button>
      )}

      <p className="text-sm text-slate-600">
        {toCheck === 0
          ? "Check the list, then confirm."
          : `${toCheck} of ${medicines.length} need${toCheck === 1 ? "s" : ""} your attention.`}
      </p>

      {medicines.map((m, i) => {
        const border = m.status === "amber" ? "border-amber-400" : m.status === "red" ? "border-red-600" : "border-slate-200";
        return (
          <div key={i} className={`flex flex-col gap-2.5 rounded-2xl border-2 bg-white p-3.5 ${border}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <p className="font-semibold">
                  {m.status === "red" ? "Could not read" : `${m.matched_brand || m.brand_name} ${m.strength}`}
                </p>
                <p className="text-[13px] text-slate-600">{describeDose(m)}</p>
                {m.raw_text && <p className="text-xs italic text-slate-500">Read as: {m.raw_text}</p>}
              </div>
              {/* Only medicines that need attention get a badge */}
              {m.status === "amber" && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Check</span>
              )}
              {m.status === "red" && (
                <span className="shrink-0 rounded-full bg-red-700 px-2.5 py-1 text-xs font-semibold text-white">Fix</span>
              )}
            </div>

            {m.status === "amber" && (
              <div className="flex items-center gap-2.5 rounded-lg bg-amber-50 p-2.5 text-sm">
                <span className="flex-1">
                  Did you mean <b>{m.matched_brand}</b>?
                </span>
                <button type="button" onClick={() => update(i, { ...m, status: "green" })}
                  className="min-h-9 rounded-lg bg-teal-700 px-3.5 text-[13px] font-semibold text-white">
                  Yes
                </button>
              </div>
            )}

            <div className="flex gap-5 text-sm font-semibold">
              <button type="button" onClick={() => onEdit(i)} className="flex min-h-9 items-center gap-1.5 text-teal-700">
                <Icon name="edit" size={16} /> {m.status === "red" ? "Choose medicine" : "Edit"}
              </button>
              <button type="button" onClick={() => remove(i)} className="flex min-h-9 items-center gap-1.5 text-red-700">
                <Icon name="trash" size={16} /> Remove
              </button>
            </div>
          </div>
        );
      })}

      <button type="button" onClick={onAdd}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-teal-700 font-semibold text-teal-700">
        <Icon name="plus" size={20} /> Add a medicine
      </button>

      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <button type="button" disabled={medicines.length === 0 || unresolved > 0} onClick={onConfirm}
        className="min-h-12 rounded-xl bg-teal-700 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
        {unresolved > 0
          ? `Fix ${unresolved} card${unresolved > 1 ? "s" : ""} to continue`
          : `Confirm ${medicines.length} medicine${medicines.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
