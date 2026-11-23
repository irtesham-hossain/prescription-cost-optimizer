"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header, Page } from "@/components/ui";
import { authReady, supabase } from "@/lib/supabase";

// Plain-language versions of Supabase's error messages
function friendly(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/already registered|already been registered/i.test(msg)) return "This email already has an account. Log in instead.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first. Check your inbox.";
  if (/password/i.test(msg) && /6/.test(msg)) return "Password must be at least 6 characters.";
  if (/rate limit/i.test(msg)) return "Too many tries. Wait a minute and try again.";
  return msg;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/saved";
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        if (data.session) router.replace(next);
        else setInfo("Account created. Check your email and tap the link to confirm, then log in.");
      }
    } catch (err) {
      setError(friendly((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (error) setError(friendly(error.message));
  }

  return (
    <section className="flex flex-1 flex-col gap-4 p-5">
      <p className="text-sm text-slate-600">
        {mode === "login"
          ? "Log in to save prescriptions and see them on any phone."
          : "Create a free account to save your prescriptions."}
      </p>

      {!authReady && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Login is not set up yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.
        </p>
      )}

      <div className="flex gap-1 rounded-xl bg-slate-200 p-1" role="tablist">
        {(["login", "signup"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m}
            onClick={() => { setMode(m); setError(null); setInfo(null); }}
            className={`min-h-11 flex-1 rounded-lg text-sm font-semibold ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-semibold text-slate-700">Email</label>
        <input id="email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-teal-600" />
        <label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label>
        <input id="password" type="password" required minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"} value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-teal-600" />
        {mode === "signup" && <p className="text-xs text-slate-600">At least 6 characters.</p>}

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {info && <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{info}</p>}

        <button type="submit" disabled={busy || !authReady}
          className="min-h-12 rounded-xl bg-teal-700 font-semibold text-white disabled:bg-slate-300">
          {busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-300" /> or <span className="h-px flex-1 bg-slate-300" />
      </div>

      <button type="button" onClick={google} disabled={!authReady}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white font-semibold text-slate-800 disabled:opacity-50">
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
        </svg>
        Continue with Google
      </button>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Page>
      <Header title="Log in or sign up" backHref="/" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </Page>
  );
}
