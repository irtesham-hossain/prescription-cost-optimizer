"use client";

import Link from "next/link";
import { useUser } from "@/lib/supabase";

/** Top-right of the home page: "Log in", or the user's initial when logged in. */
export default function AccountChip() {
  const { user, loading } = useUser();
  if (loading) return <span className="h-9 w-16" />;
  if (!user) {
    return (
      <Link href="/login" className="flex min-h-9 items-center rounded-full border border-white/40 px-3.5 text-sm font-semibold text-white">
        Log in
      </Link>
    );
  }
  const initial = (user.email || "?").charAt(0).toUpperCase();
  return (
    <Link href="/saved" aria-label={`Account: ${user.email}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-teal-900">
      {initial}
    </Link>
  );
}
