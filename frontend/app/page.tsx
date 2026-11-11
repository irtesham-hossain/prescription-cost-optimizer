import Link from "next/link";
import { AdSlot, BottomNav, Icon, Page } from "@/components/ui";

const TILES = [
  { href: "/scan", title: "Scan prescription", sub: "Take a photo and find cheaper brands", icon: "scan", primary: true },
  { href: "/search", title: "Search medicine price", sub: "Check one medicine and its cheaper options", icon: "search" },
  { href: "/saved", title: "Saved prescriptions", sub: "Open past scans and refill reminders", icon: "saved" },
  { href: "/pharmacy", title: "Nearby pharmacies", sub: "Find, call or get directions", icon: "pin" },
];

export default function Home() {
  return (
    <Page>
      <div className="flex flex-col gap-2.5 bg-teal-900 px-5 pb-6 pt-5 text-white">
        <p className="text-[15px] font-semibold opacity-90">Prescription Cost Optimizer</p>
        <h1 className="text-[26px] font-bold leading-tight">Pay less for the same medicine</h1>
        <p className="text-sm text-teal-100">Same generic, same strength, same form. Cheaper brand.</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex min-h-[140px] flex-col gap-2.5 rounded-2xl border p-4 ${
                t.primary ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  t.primary ? "bg-white/20 text-white" : "bg-teal-100 text-teal-700"
                }`}
              >
                <Icon name={t.icon} size={24} />
              </span>
              <span className="text-base font-semibold leading-tight">{t.title}</span>
              <span className={`text-xs leading-snug ${t.primary ? "text-teal-100" : "text-slate-600"}`}>{t.sub}</span>
            </Link>
          ))}
        </div>

        <section className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3.5">
          <h2 className="text-sm font-semibold">How it works</h2>
          <ol className="flex gap-2 text-xs text-slate-600">
            <li className="flex-1 rounded-lg bg-slate-50 p-2">1. Scan or search</li>
            <li className="flex-1 rounded-lg bg-slate-50 p-2">2. Check the list</li>
            <li className="flex-1 rounded-lg bg-slate-50 p-2">3. See your saving</li>
          </ol>
        </section>

        <AdSlot text="Banner space for health partners: diagnostic labs, health checkups, insurance" />
      </div>

      <BottomNav />
    </Page>
  );
}
