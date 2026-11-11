import { Icon } from "./ui";

/** Shown while the photo is being read. No time is promised. */
export default function Scanning({ imageUrl }: { imageUrl: string | null }) {
  const steps = [
    { label: "Photo received", done: true },
    { label: "Reading the medicines", active: true },
    { label: "Matching with our medicine list" },
  ];
  return (
    <div className="flex flex-col gap-5">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Your prescription" className="max-h-72 w-full rounded-2xl bg-slate-200 object-contain" />
      )}
      <div className="flex flex-col items-center gap-3">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" />
        <p className="text-lg font-semibold">Reading your prescription...</p>
      </div>
      <ul className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        {steps.map((s) => (
          <li key={s.label} className={`flex items-center gap-2.5 text-sm ${s.done || s.active ? "text-slate-900" : "text-slate-500"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
              s.done ? "bg-teal-100 text-teal-700" : s.active ? "bg-amber-100" : "bg-slate-100"}`}>
              {s.done && <Icon name="check" size={14} />}
              {s.active && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-700" />}
            </span>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
