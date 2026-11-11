import type { ScannedMedicine } from "@/lib/api";

/** Full view of the photo next to what was read. The photo never leaves the phone after scanning. */
export default function PrescriptionViewer({ imageUrl, medicines }: { imageUrl: string; medicines: ScannedMedicine[] }) {
  const dot = { green: "bg-teal-100 text-teal-900", amber: "bg-amber-100 text-amber-900", red: "bg-red-100 text-red-800" };
  return (
    <div className="flex flex-col gap-3">
      <a href={imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Your prescription" className="max-h-[480px] w-full object-contain" />
      </a>
      <p className="text-xs text-slate-600">Tap the photo to open it full size and zoom.</p>
      <ol className="rounded-2xl border border-slate-200 bg-white px-3.5">
        {medicines.map((m, i) => (
          <li key={i} className="flex items-center gap-2.5 border-b border-slate-100 py-2.5 text-sm last:border-0">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dot[m.status]}`}>
              {i + 1}
            </span>
            <span className="flex flex-col">
              <span>{m.raw_text || m.matched_brand || m.brand_name}</span>
              {m.status !== "red" && m.raw_text && (
                <span className="text-xs text-slate-500">Matched to {m.matched_brand || m.brand_name}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
