"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Small inline icons (stroke style)
const PATHS: Record<string, React.ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  home: (<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>),
  scan: (<><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M8 9h8M8 12h8M8 15h5" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
  saved: <path d="M6 3h12v18l-6-4-6 4z" />,
  pin: (<><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 8" /></>),
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  share: (<><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>),
  show: (<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />,
  route: <path d="M3 11l18-8-8 18-2-8z" />,
  bell: (<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  check: <path d="M5 12l5 5 9-10" />,
  chev: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({ name, size = 22, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {PATHS[name]}
    </svg>
  );
}

/** Top bar. Give onBack for an in-page step, or backHref for another page; neither = no arrow. */
export function Header({ title, onBack, backHref }: { title: string; onBack?: () => void; backHref?: string }) {
  const router = useRouter();
  const showBack = onBack || backHref;
  return (
    <header className="sticky top-0 z-20 flex min-h-[60px] items-center gap-1 bg-teal-900 px-4 text-white">
      {showBack && (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => (onBack ? onBack() : router.push(backHref!))}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
        >
          <Icon name="back" size={24} />
        </button>
      )}
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}

const NAV = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/scan", label: "Scan", icon: "scan" },
  { href: "/saved", label: "Saved", icon: "saved" },
  { href: "/pharmacy", label: "Pharmacy", icon: "pin" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 flex justify-around border-t border-slate-200 bg-white px-2 pb-3 pt-1.5">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex min-w-16 flex-col items-center gap-1 px-3 py-2 text-xs ${
              active ? "font-semibold text-teal-700" : "font-medium text-slate-500"
            }`}
          >
            <Icon name={n.icon} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Ad placeholder. Always labelled. Never placed inside the medicine comparison. */
export function AdSlot({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <aside
      aria-label="Advertisement"
      className={`flex items-center gap-3 rounded-xl border border-dashed border-slate-400 bg-white px-3.5 ${
        compact ? "min-h-14 py-2" : "min-h-[72px] py-3"
      }`}
    >
      <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">Ad</span>
      <span className="text-sm text-slate-600">{text}</span>
    </aside>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50">{children}</main>;
}
