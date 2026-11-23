"use client";

import { createClient, type User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const authReady = Boolean(url && anonKey);

// One shared client. The session is kept in the browser and refreshed automatically.
export const supabase = createClient(url || "http://localhost", anonKey || "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** The logged-in user, or null. `loading` is true until the first check finishes. */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// A save started before logging in waits here until login finishes
const PENDING = "pco_pending_save";
export function stashPendingSave(v: unknown) {
  try { localStorage.setItem(PENDING, JSON.stringify(v)); } catch {}
}
export function takePendingSave<T>(): T | null {
  try {
    const raw = localStorage.getItem(PENDING);
    localStorage.removeItem(PENDING);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
