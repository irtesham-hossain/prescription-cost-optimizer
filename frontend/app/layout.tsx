import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prescription Cost Optimizer",
  description: "Find cheaper medicine brands with the same generic, strength and form.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#134e4a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-200 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
