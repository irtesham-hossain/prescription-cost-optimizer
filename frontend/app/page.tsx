import Link from "next/link";
import AccountChip from "@/components/AccountChip";
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
      <div className="flex flex-col gap-1.5 bg-teal-900 px-5 pb-5 pt-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold opacity-90">Prescription Cost Optimizer</p>
          <AccountChip />
        </div>
        <h1 className="text-[22px] font-bold leading-tight">Pay less for the same medicine</h1>
        <p className="text-sm text-teal-100 [@media(max-height:600px)]:hidden">Same generic, same strength, same form. Cheaper brand.</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex min-h-[118px] flex-col gap-1.5 rounded-2xl border p-3.5 ${
                t.primary ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  t.primary ? "bg-white/20 text-white" : "bg-teal-100 text-teal-700"
                }`}
              >
                <Icon name={t.icon} size={22} />
              </span>
              <span className="text-[15px] font-semibold leading-tight">{t.title}</span>
              {/* Hidden on short screens so all four tiles fit above the bottom bar */}
              <span className={`text-xs leading-snug [@media(max-height:700px)]:hidden ${t.primary ? "text-teal-100" : "text-slate-600"}`}>{t.sub}</span>
            </Link>
          ))}
        </div>

        <AdSlot compact text="Banner space for health partners: diagnostic labs, health checkups, insurance" />
      </div>

      <BottomNav />
    </Page>
  );
}
